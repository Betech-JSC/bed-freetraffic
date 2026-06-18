import prisma from '../lib/prisma';
import { getAiConfig, parseAiJson, fetchWithRetry } from '../lib/ai';

export interface LeadQualificationResult {
  score: number;       // 0-100
  decision: 'HOT' | 'WARM' | 'COLD' | 'SPAM';
  reason: string;      // Lý do phân loại
  draftMsg: string;    // Tin nhắn nháp tiếp cận gợi ý
}

/**
 * Qualifies a post content using AI/LLM based on campaign settings and workspace RAG context.
 * Falls back to keyword-based heuristics if AI is not configured.
 */
export async function qualifyLead(
  workspaceId: number,
  postContent: string,
  keywords: string,
  excludeKeywords?: string | null,
  targetAudience?: string | null,
  campaignId?: number
): Promise<LeadQualificationResult> {
  // 1. Check for negative / exclude keywords first
  if (excludeKeywords) {
    const excludes = excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const contentLower = postContent.toLowerCase();
    for (const key of excludes) {
      if (contentLower.includes(key)) {
        return {
          score: 5,
          decision: 'SPAM',
          reason: `Chứa từ khóa loại trừ: "${key}"`,
          draftMsg: '',
        };
      }
    }
  }

  // 2. Fetch RAG Context (Knowledge Base) if workspaceId is provided
  let ragContextText = '';
  try {
    const { retrieveRelevantChunksStructured } = await import('../lib/embeddings');
    
    // Resolve campaign knowledge sources if campaignId is provided
    let sourceIds: number[] | undefined = undefined;
    if (campaignId) {
      const campaignWithSources = await prisma.socialListeningCampaign.findUnique({
        where: { id: campaignId },
        include: { knowledgeSources: { select: { id: true } } }
      });
      if (campaignWithSources && campaignWithSources.knowledgeSources.length > 0) {
        sourceIds = campaignWithSources.knowledgeSources.map(s => s.id);
      }
    }

    // We use the post content or keywords to query relevant chunks
    const structuredChunks = await retrieveRelevantChunksStructured(
      workspaceId,
      postContent.slice(0, 300),
      4,
      sourceIds
    );
    
    const config = await prisma.cskhConfig.findUnique({
      where: { workspaceId }
    });
    const kbText = config?.knowledgeBaseText || '';
    
    const relevantChunks = structuredChunks.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
    const mergedChunks = [...relevantChunks];
    
    if (kbText && !mergedChunks.some(c => c.includes(kbText.slice(0, 30)))) {
      mergedChunks.unshift(`[Nguồn: Hướng dẫn & Ghi chú nhanh]\n${kbText}`);
    }
    
    if (mergedChunks.length > 0) {
      ragContextText = `\n\n--- THÔNG TIN DOANH NGHIỆP CỦA BẠN (Sử dụng để đối chiếu xem nhu cầu của bài viết có khớp với sản phẩm/dịch vụ của bạn không và soạn tin nhắn nháp): ---\n${mergedChunks.join('\n\n')}\n--- KẾT THÚC THÔNG TIN DOANH NGHIỆP ---`;
    }
  } catch (ragErr) {
    console.error('⚠️ [Lead Qualifier RAG Error] Lỗi tích hợp tri thức:', ragErr);
  }

  // 3. Try AI qualification
  const ai = getAiConfig('/chat/completions', 'lead_qualifier');
  if (!ai.apiKey) {
    console.warn('⚠️ OPENAI_API_KEY không được cấu hình. Sử dụng heuristic từ khóa.');
    return fallbackKeywordScoring(postContent, keywords);
  }

  // ICP Context / Target Audience
  let targetAudienceText = '';
  if (targetAudience) {
    targetAudienceText = `\n\n--- CHÂN DUNG KHÁCH HÀNG MỤC TIÊU & DỊCH VỤ CỦA CHIẾN DỊCH NÀY: ---\n${targetAudience}\n--- KẾT THÚC CHÂN DUNG KHÁCH HÀNG MỤC TIÊU ---`;
  }

  // Fetch examples of past accepted (saved as CRM customer) and rejected (ignored/spam) logs for few-shot learning
  let fewShotContext = '';
  if (campaignId) {
    try {
      const campaign = await prisma.socialListeningCampaign.findUnique({
        where: { id: campaignId }
      });
      if (campaign) {
        const convertedCustomers = await prisma.customer.findMany({
          where: {
            workspaceId,
            trafficSource: 'FACEBOOK_LISTENING',
            utmCampaign: campaign.name
          },
          take: 3,
          orderBy: { createdAt: 'desc' }
        });

        const ignoredLogs = await prisma.socialListeningLog.findMany({
          where: {
            campaignId,
            status: 'IGNORED',
            aiDecision: { in: ['COLD', 'SPAM'] }
          },
          take: 3,
          orderBy: { createdAt: 'desc' }
        });

        if (convertedCustomers.length > 0 || ignoredLogs.length > 0) {
          fewShotContext = '\n\n--- CÁC VÍ DỤ THỰC TẾ VỀ QUYẾT ĐỊNH CỦA DOANH NGHIỆP: ---';
          if (convertedCustomers.length > 0) {
            fewShotContext += '\nCác bài viết được phê duyệt lưu vào CRM (Ví dụ Tốt - HOT/WARM):';
            for (const cust of convertedCustomers) {
              const matchedLog = await prisma.socialListeningLog.findFirst({
                where: { campaignId, postAuthor: cust.name },
                select: { postContent: true, aiDecision: true }
              });
              if (matchedLog) {
                fewShotContext += `\n- Bài viết: "${matchedLog.postContent.slice(0, 150).replace(/\n/g, ' ')}..." -> Phân loại mong muốn: ${matchedLog.aiDecision}`;
              }
            }
          }
          if (ignoredLogs.length > 0) {
            fewShotContext += '\nCác bài viết bị bỏ qua hoặc từ chối (Ví dụ Không liên quan/SPAM/COLD):';
            for (const log of ignoredLogs) {
              fewShotContext += `\n- Bài viết: "${log.postContent.slice(0, 150).replace(/\n/g, ' ')}..." -> Phân loại mong muốn: COLD/SPAM`;
            }
          }
          fewShotContext += '\n--- KẾT THÚC CÁC VÍ DỤ ---';
        }
      }
    } catch (fewShotErr) {
      console.warn('⚠️ [Few-shot Learning] Lỗi nạp ví dụ mẫu:', fewShotErr);
    }
  }

  const systemPrompt = `Bạn là một chuyên gia AI Social Listening & Phân loại Khách hàng Tiềm năng (Lead Qualifier).
Nhiệm vụ của bạn là phân tích nội dung bài viết thu thập từ mạng xã hội để đánh giá mức độ tiềm năng mua hàng/sử dụng dịch vụ của tác giả bài viết đối với doanh nghiệp.

Quy tắc phân loại (decision) & phân biệt người bán/người mua:
- HOT: Bài viết thể hiện nhu cầu mua/thuê/sử dụng sản phẩm/dịch vụ cực kỳ rõ ràng, khẩn cấp (Ví dụ: "Cần tìm nguồn sỉ...", "Ai nhận làm web...", "Cần mua gấp...").
- WARM: Bài viết thể hiện nỗi đau, khó khăn, câu hỏi thảo luận, xin lời khuyên hoặc đang tìm giải pháp liên quan mà doanh nghiệp có thể giải quyết được (Ví dụ: "Làm sao để tăng traffic...", "Facebook ads đắt quá...", "Mọi người hay dùng tool gì...").
- COLD: Bài viết chỉ chia sẻ thông tin chung, không thể hiện rõ nhu cầu hoặc liên quan rất ít.
- SPAM: Bài viết tự quảng cáo dịch vụ/sản phẩm của họ, tin rác, tuyển dụng hoặc bot tự động viết bài bán hàng.

⚠️ QUAN TRỌNG VỀ SỰ LINH HOẠT VÀ ĐỘ CHÍNH XÁC THEO NGƯỠNG ĐIỂM (Thang điểm từ 0 đến 10):
1. ĐỐI VỚI WARM (Từ 6 đến 7 điểm): Hãy đánh giá thật rộng rãi và linh hoạt để tìm được CÀNG NHIỀU bài viết có liên quan CÀNG TỐT. Chỉ cần bài viết có nhắc đến khó khăn, câu hỏi thảo luận, chia sẻ kinh nghiệm hoặc bất cứ mối quan tâm nào liên quan đến chủ đề/từ khóa, hãy cho điểm từ 6 - 7 (WARM). Đừng đánh giá quá khắt khe ở khoảng điểm này để tránh bỏ sót các lead thảo luận có thể tiếp cận gián tiếp.
2. ĐỐI VỚI HOT (Từ 8 đến 10 điểm): Hãy đánh giá CỰC KỲ khắt khe và chuẩn xác tuyệt đối. Bài đăng phải thể hiện rõ ràng, trực tiếp 100% nhu cầu tìm mua, thuê dịch vụ hoặc cần hỗ trợ gấp thì mới được cho điểm từ 8 trở lên.
3. PHÂN BIỆT NGƯỜI BÁN & NGƯỜI MUA: Bạn PHẢI phân biệt người BÁN (cung cấp dịch vụ/sản phẩm) và người MUA (đang tìm kiếm/có nhu cầu thực tế). Nếu người viết bài viết quảng cáo hoặc tự chào mời dịch vụ của họ (Ví dụ: 'Em nhận thiết kế logo...', 'Bên mình cung cấp dịch vụ SEO chuyên nghiệp...', 'Em là freelancer nhận dự án...'), bạn phải phân loại là SPAM hoặc COLD với điểm số dưới 6 (vì họ là người bán hoặc đối thủ cạnh tranh, không phải khách hàng tiềm năng mua hàng).
4. TRÙNG KHỚP TỪ KHÓA: BẮT BUỘC điểm số từ 6 trở lên chỉ được phép cấp khi nội dung bài đăng trùng khớp hoặc liên quan trực tiếp về mặt ngữ nghĩa/chủ đề với TỪ KHÓA ĐỊNH HƯỚNG CHIẾN DỊCH được cung cấp. Nếu nội dung bài viết hoàn toàn không liên quan gì đến từ khóa định hướng, điểm số không được vượt quá 5.

Yêu cầu chấm điểm (score):
- HOT: 8 - 10 điểm (Yêu cầu chính xác cao, nhu cầu mua/thuê trực tiếp).
- WARM: 6 - 7 điểm (Rộng rãi, bao dung, gom mọi bài thảo luận/nỗi đau/câu hỏi liên quan để bắt được nhiều lead nhất).
- COLD: 3 - 5 điểm.
- SPAM: 0 - 2 điểm.

Yêu cầu soạn tin nhắn phản hồi gợi ý (draftMsg):
- Viết bằng tiếng Việt, giọng điệu tự nhiên, lịch sự, đóng vai trò là chuyên gia tư vấn tận tâm hoặc chủ doanh nghiệp thân thiện.
- Tuyệt đối không spam bán hàng lộ liễu ngay lập tức. Hãy bắt đầu bằng việc đồng cảm hoặc đưa ra một lời khuyên có giá trị ngắn gọn trước, sau đó khéo léo giới thiệu giải pháp/sản phẩm của doanh nghiệp (sử dụng thông tin doanh nghiệp được cung cấp bên dưới) và kêu gọi nhắn tin/ib riêng.
- Nếu bài viết là SPAM hoặc COLD, để draftMsg trống ("").

BẮT BUỘC: Trả về DUY NHẤT một đối tượng JSON hợp lệ (không kèm theo lời giải thích hay ký hiệu markdown \`\`\`json), với định dạng sau:
{
  "score": 8,
  "decision": "HOT",
  "reason": "Giải thích ngắn gọn lý do phân loại bằng tiếng Việt",
  "draftMsg": "Chào bạn, mình thấy bạn đang gặp vấn đề... Bên mình có giải pháp... Bạn inbox mình chia sẻ thêm nhé!"
}`;

  const userPrompt = `NỘI DUNG BÀI VIẾT CỦA KHÁCH HÀNG:
"""
${postContent}
"""

TỪ KHÓA ĐỊNH HƯỚNG CHIẾN DỊCH:
${keywords}
${targetAudienceText}
${ragContextText}
${fewShotContext}

Hãy phân tích và trả về đối tượng JSON đánh giá tiềm năng.`;

  try {
    const res = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API status ${res.status}: ${errText}`);
    }

    const data = await res.json() as any;
    const contentText = data.choices?.[0]?.message?.content?.trim() || '';
    
    const parsed = parseAiJson<LeadQualificationResult>(contentText);
    let finalScore = typeof parsed.score === 'number' ? parsed.score : 6;
    
    // Convert 0-10 score to 0-100 scale for database/UI compatibility
    if (finalScore <= 10) {
      finalScore = finalScore * 10;
    }

    return {
      score: finalScore,
      decision: ['HOT', 'WARM', 'COLD', 'SPAM'].includes(parsed.decision) ? parsed.decision : 'WARM',
      reason: parsed.reason || 'Được phân tích bởi AI',
      draftMsg: parsed.draftMsg || ''
    };
  } catch (err: any) {
    console.error('❌ [Lead Qualifier AI Error] Lỗi gọi AI chấm điểm, chuyển sang fallback:', err.message);
    const fallbackRes = fallbackKeywordScoring(postContent, keywords);
    return {
      ...fallbackRes,
      score: fallbackRes.score * 10
    };
  }
}

/**
 * Fallback scoring algorithm using keyword weights and heuristics (scaled to 1-10 points)
 */
function fallbackKeywordScoring(postContent: string, keywords: string): LeadQualificationResult {
  const contentLower = postContent.toLowerCase();
  const kwList = keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  
  let matchCount = 0;
  for (const kw of kwList) {
    if (contentLower.includes(kw)) {
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return {
      score: 1,
      decision: 'COLD',
      reason: 'Không chứa từ khóa định hướng nào (Heuristic Fallback)',
      draftMsg: ''
    };
  }

  // Look for buying intent indicators in Vietnamese (scaled to 1-10 points)
  const highIntentWords = ['cần', 'tìm', 'gấp', 'mua', 'thuê', 'báo giá', 'inbox', 'ib', 'tư vấn', 'chỉ mình', 'xin giá', 'source code', 'ai làm'];
  let intentScore = 0;
  for (const word of highIntentWords) {
    if (contentLower.includes(word)) {
      intentScore += 2;
    }
  }

  const baseScore = 4 + matchCount;
  const finalScore = Math.min(baseScore + intentScore, 10);
  
  let decision: 'HOT' | 'WARM' | 'COLD' = 'WARM';
  if (finalScore >= 8) {
    decision = 'HOT';
  } else if (finalScore < 6) {
    decision = 'COLD';
  }

  const draftMsg = decision === 'COLD' ? '' : `Chào bạn, mình thấy bạn đang quan tâm về vấn đề này. Mình có giải pháp tối ưu có thể giúp bạn giải quyết nhanh gọn. Bạn kiểm tra tin nhắn chờ hoặc inbox mình trao đổi chi tiết nhé!`;

  return {
    score: finalScore,
    decision,
    reason: `Trùng khớp ${matchCount} từ khóa chiến dịch. Có dấu hiệu nhu cầu mức độ ${decision} (Heuristic Fallback).`,
    draftMsg
  };
}
