import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { runSeoAudit } from '../services/seoAuditService';
import { runPageSpeedAudit } from '../services/pagespeedAuditService';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { generateSeoRecommendations } from '../services/seoFixer';

const router = Router();
router.use(authenticate);

router.get('/audits', async (req: AuthRequest, res: Response): Promise<void> => {
  const audits = await prisma.seoAudit.findMany({
    where: { workspaceId: req.workspaceId },
    include: { issues: true },
    orderBy: { auditedAt: 'desc' },
    take: 50,
  });
  res.json(audits);
});

router.post('/audit', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { url, targetKeyword } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL là bắt buộc' });
    return;
  }

  const maxPerDay = parseInt(process.env.MAX_SEO_AUDITS_PER_DAY || '20', 10);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayCount = await prisma.seoAudit.count({
    where: { auditedAt: { gte: startOfDay }, workspaceId: req.workspaceId },
  });
  if (todayCount >= maxPerDay) {
    res.status(429).json({
      error: `Đã đạt giới hạn ${maxPerDay} lần audit/ngày (SRS OI-01). Thử lại ngày mai.`,
    });
    return;
  }

  const result = await runSeoAudit(url, targetKeyword);
  const audit = await prisma.seoAudit.create({
    data: {
      url,
      score: result.score,
      technicalScore: result.technicalScore,
      contentScore: result.contentScore,
      uxScore: result.uxScore,
      issues: { create: result.issues },
      workspaceId: req.workspaceId,
    },
    include: { issues: true },
  });
  res.status(201).json(audit);
});

router.post('/pagespeed', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { url, targetKeyword } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL là bắt buộc' });
    return;
  }

  try {
    const result = await runPageSpeedAudit(url, targetKeyword);
    const audit = await prisma.seoAudit.create({
      data: {
        url,
        score: result.score,
        technicalScore: result.technicalScore,
        contentScore: result.contentScore,
        uxScore: result.uxScore,
        issues: { create: result.issues },
        workspaceId: req.workspaceId,
      },
      include: { issues: true },
    });
    res.status(201).json(audit);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'PageSpeed Audit thất bại' });
  }
});

router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  const url = (req.query.url as string)?.trim();
  if (!url) {
    res.status(400).json({ error: 'Tham số url là bắt buộc' });
    return;
  }
  const audits = await prisma.seoAudit.findMany({
    where: { url, workspaceId: req.workspaceId },
    include: { issues: true },
    orderBy: { auditedAt: 'asc' },
    take: 20,
  });
  res.json(audits);
});

router.get('/audits/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const audit = await prisma.seoAudit.findFirst({
    where: { id, workspaceId: req.workspaceId },
    include: { issues: true },
  });
  if (!audit) {
    res.status(404).json({ error: 'Không tìm thấy audit' });
    return;
  }
  res.json(audit);
});

router.delete('/audits', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { count } = await prisma.seoAudit.deleteMany({
      where: { workspaceId: req.workspaceId },
    });
    res.json({ success: true, message: `Đã xóa thành công tất cả ${count} kết quả audit` });
  } catch (error: any) {
    console.error('[DELETE /seo/audits]', error);
    res.status(500).json({ error: error.message || 'Lỗi xóa tất cả kết quả audit' });
  }
});

router.delete('/audits/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  try {
    const audit = await prisma.seoAudit.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!audit) {
      res.status(404).json({ error: 'Không tìm thấy audit' });
      return;
    }
    await prisma.seoAudit.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa kết quả audit thành công' });
  } catch (error: any) {
    console.error('[DELETE /seo/audits/:id]', error);
    res.status(500).json({ error: error.message || 'Lỗi xóa kết quả audit' });
  }
});

router.post('/fix-issues', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, keywords, issues } = req.body;
  try {
    const recommendations = await generateSeoRecommendations(
      title || '',
      description || '',
      keywords || '',
      Array.isArray(issues) ? issues : []
    );
    res.json(recommendations);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xử lý tối ưu SEO bằng AI' });
  }
});

import { getAiConfig, parseAiJson, fetchWithRetry } from '../lib/ai';

router.post('/keyword-research', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { seedKeyword } = req.body;
  if (!seedKeyword || typeof seedKeyword !== 'string' || !seedKeyword.trim()) {
    res.status(400).json({ error: 'Từ khóa gốc (seedKeyword) là bắt buộc' });
    return;
  }

  const trimmedKeyword = seedKeyword.trim();

  // Try to use AI
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) {
    res.json(generateFallbackKeywords(trimmedKeyword));
    return;
  }

  const systemInstructions = `Bạn là chuyên gia tối ưu hóa tìm kiếm (SEO Specialist) và lập kế hoạch nội dung hàng đầu bằng tiếng Việt.
Nhiệm vụ của bạn là nhận vào một từ khóa gốc (seed keyword) và phân tích, đề xuất một danh sách gồm 5-8 từ khóa ngách (long-tail keywords) liên quan mật thiết và tiềm năng tăng trưởng traffic tốt nhất.
Với mỗi từ khóa đề xuất, hãy trả về các thông tin sau:
1. keyword: Từ khóa ngách (viết thường tiếng Việt có dấu, tự nhiên).
2. difficulty: Độ khó từ khóa (Chỉ nhận 1 trong 3 giá trị bằng tiếng Anh: 'Easy', 'Medium', 'Hard').
3. volume: Lượng tìm kiếm mô phỏng hàng tháng (số nguyên ngẫu nhiên từ 100 đến 5000 phù hợp với độ khó và mức phổ biến của từ khóa).
4. intent: Ý định tìm kiếm (Chỉ nhận 1 trong 3 giá trị bằng tiếng Anh: 'Informational', 'Transactional', 'Navigational').
5. suggestedTitle: Tiêu đề bài viết gợi ý chuẩn SEO cho blog chứa từ khóa ngách này (hấp dẫn, không quá 60 ký tự).
6. brief: Dàn ý sơ lược cho bài viết gợi ý dưới dạng mảng các chuỗi (array of strings, khoảng 3-4 ý chính).

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG MỘT MẢNG JSON HỢP LỆ (JSON ARRAY OF OBJECTS) CHỨA CÁC THUỘC TÍNH: "keyword", "difficulty", "volume", "intent", "suggestedTitle", "brief".
KHÔNG viết phần giải thích hay suy nghĩ/suy luận dài dòng, hãy đi thẳng vào phản hồi JSON hợp lệ để tiết kiệm thời gian phản hồi.
KHÔNG bao bọc chuỗi JSON bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.`;

  const userPrompt = `Hãy nghiên cứu từ khóa gốc sau: "${trimmedKeyword}"`;

  try {
    const aiRes = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!aiRes.ok) {
      throw new Error(`OpenAI compatibility API error: status ${aiRes.status}`);
    }

    const data = await aiRes.json() as any;
    const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';
    
    try {
      const parsed = parseAiJson(contentText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        res.json(parsed);
      } else {
        throw new Error('Parsed AI output is not a non-empty array');
      }
    } catch (parseErr) {
      console.error('Failed to parse AI keyword research output, returning fallback:', parseErr);
      res.json(generateFallbackKeywords(trimmedKeyword));
    }
  } catch (err) {
    console.error('Failed to run AI keyword research:', err);
    res.json(generateFallbackKeywords(trimmedKeyword));
  }
});

function generateFallbackKeywords(seedKeyword: string) {
  return [
    {
      keyword: `${seedKeyword} giá rẻ`,
      difficulty: 'Easy',
      volume: 850,
      intent: 'Transactional',
      suggestedTitle: `Mua ${seedKeyword} Giá Rẻ Hợp Lý Chất Lượng Uy Tín`,
      brief: ['Tổng quan về nhu cầu thị trường', 'Các tiêu chí chọn lựa giá cả và chất lượng', 'Gợi ý nơi cung cấp tốt nhất']
    },
    {
      keyword: `hướng dẫn ${seedKeyword} cho người mới bắt đầu`,
      difficulty: 'Easy',
      volume: 1200,
      intent: 'Informational',
      suggestedTitle: `Hướng Dẫn Từng Bước ${seedKeyword} Cực Dễ Cho Người Mới`,
      brief: ['Giới thiệu cơ bản', 'Các bước chuẩn bị cần thiết', 'Quy trình thực hiện chi tiết', 'Các lưu ý tránh sai lầm']
    },
    {
      keyword: `kinh nghiệm ${seedKeyword} hiệu quả`,
      difficulty: 'Medium',
      volume: 600,
      intent: 'Informational',
      suggestedTitle: `Kinh Nghiệm ${seedKeyword} Thực Chiến Hiệu Quả Nhất`,
      brief: ['Tầm quan trọng của kinh nghiệm thực tế', '5 bí quyết tối ưu hóa hiệu quả', 'Case study thành công điển hình']
    },
    {
      keyword: `đánh giá ${seedKeyword} chi tiết`,
      difficulty: 'Medium',
      volume: 450,
      intent: 'Informational',
      suggestedTitle: `Đánh Giá ${seedKeyword} Chi Tiết: Ưu Nhược Điểm Cần Biết`,
      brief: ['Giới thiệu sản phẩm/dịch vụ', 'Phân tích chi tiết ưu điểm', 'Phân tích chi tiết nhược điểm', 'Đánh giá chung và lời khuyên']
    },
    {
      keyword: `dịch vụ ${seedKeyword} chuyên nghiệp`,
      difficulty: 'Hard',
      volume: 350,
      intent: 'Transactional',
      suggestedTitle: `Dịch Vụ ${seedKeyword} Chuyên Nghiệp Trọn Gói Tốt Nhất`,
      brief: ['Tại sao nên chọn dịch vụ chuyên nghiệp', 'Quy trình cung cấp dịch vụ chuẩn', 'Bảng giá và cam kết chất lượng']
    }
  ];
}

export default router;
