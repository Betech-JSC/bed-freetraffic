import fs from 'fs';
import path from 'path';
import { getAiConfig, parseAiJson, fetchWithRetry } from '../lib/ai';
import prisma from '../lib/prisma';


export type GeneratedPost = {
  title: string;
  content: string;
  imageUrl: string | null;
};

export async function generateAiPostContent(
  urlTarget: string,
  aiPrompt?: string | null,
  contentType?: 'blog' | 'facebook' | 'video_script',
  workspaceId?: number,
  useKnowledgeBase?: boolean
): Promise<{
  title: string;
  content: string;
  slug?: string;
  metaDescription?: string;
  variations?: { short: string; curious: string; cta: string };
  script?: { hook: string; body: string; cta: string };
}> {
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) {
    throw new Error('Chưa cấu hình OPENAI_API_KEY trong file .env');
  }

  let systemInstructions = '';
  if (contentType === 'blog') {
    systemInstructions = `Bạn là chuyên gia SEO Copywriter chuyên nghiệp viết bài bằng tiếng Việt.
Nhiệm vụ của bạn là phân tích URL đích và định hướng/chủ đề từ người dùng để tạo ra một bài Blog chuẩn SEO thu hút độc giả.

Quy tắc viết bài:
1. Tiêu đề (title): Dưới 60 ký tự, hấp dẫn, chứa từ khóa chính.
2. Slug (slug): Thân thiện SEO, không dấu, viết thường, ngăn cách bằng dấu gạch ngang (ví dụ: tieu-de-viet-nam).
3. Meta Description (metaDescription): Khoảng 120-160 ký tự, tóm tắt bài viết hấp dẫn, chứa từ khóa chính.
4. Nội dung bài viết (content): Định dạng Markdown chuẩn hóa (TUYỆT ĐỐI không sử dụng các thẻ HTML như <h2>, <p>, <strong>, <a>, <ul>, <li>, v.v.). Sử dụng các ký tự Markdown chuẩn: '##' hoặc '###' cho tiêu đề phụ, các đoạn văn ngăn cách bằng dòng trống, '**chữ đậm**' cho in đậm, và dấu gạch đầu dòng '- ' cho danh sách. Bài viết phải có độ dài tốt (tối thiểu 500 từ), có giá trị thực tế cao, lập luận sắc bén và kết cấu tự nhiên. BẮT BUỘC chèn placeholder '{url}' ở vị trí thích hợp nhất.

BẮT BUỘC: Trả về DUY NHẤT một đối tượng JSON hợp lệ (KHÔNG có bất kỳ text nào khác trước hoặc sau), với đúng các thuộc tính:
{"title": "tiêu đề bài viết", "slug": "slug-than-thien", "metaDescription": "mô tả bài viết", "content": "nội dung Markdown bài viết"}`;
  } else if (contentType === 'facebook') {
    systemInstructions = `Bạn là chuyên gia Social Media Marketing viết bài quảng cáo tiếng Việt trên Facebook tối ưu CTR.
Nhiệm vụ của bạn là phân tích URL đích và yêu cầu từ người dùng để tạo ra 3 biến thể caption khác nhau nhằm mục đích thử nghiệm và lựa chọn.

Yêu cầu 3 biến thể caption:
1. Biến thể Ngắn gọn (short): Tối giản, tập trung thẳng vào lợi ích cốt lõi hoặc ưu đãi, cực kỳ súc tích.
2. Biến thể Gây tò mò (curious): Sử dụng câu hỏi gợi mở, hé lộ một phần thông tin hấp dẫn để kích thích tính tò mò của độc giả.
3. Biến thể Thôi thúc hành động (cta): Tập trung tối đa vào lời kêu gọi hành động (CTA), giới hạn thời gian (Scarcity) hoặc cam kết mạnh mẽ để thúc đẩy click.

Cả 3 biến thể đều phải có emoji phù hợp, chèn placeholder '{url}' tự nhiên và có 3-5 hashtag ở cuối.

BẮT BUỘC: Trả về DUY NHẤT một đối tượng JSON hợp lệ (KHÔNG có bất kỳ text nào khác trước hoặc sau), với đúng các thuộc tính:
{
  "title": "tiêu đề chung bài viết",
  "content": "nội dung biến thể ngắn gọn",
  "variations": {
    "short": "nội dung biến thể ngắn gọn",
    "curious": "nội dung biến thể gây tò mò",
    "cta": "nội dung biến thể cta"
  }
}`;
  } else if (contentType === 'video_script') {
    systemInstructions = `Bạn là chuyên gia biên kịch video ngắn (TikTok, Reels, Shorts) chuyên nghiệp.
Nhiệm vụ của bạn là thiết kế một kịch bản video ngắn lôi cuốn từ giây đầu tiên bằng tiếng Việt để giới thiệu/quảng bá sản phẩm liên quan đến URL đích.

Khung kịch bản bắt buộc:
1. Hook (giây 1-3): Một câu mở đầu gây sốc, đánh thẳng vào nỗi đau hoặc khơi gợi sự tò mò tột độ để giữ chân người xem không lướt qua.
2. Body (giây 4-50): Trình bày ngắn gọn giải pháp, 2-3 điểm mấu chốt một cách trực quan, nhịp độ nhanh.
3. CTA (giây 51-60): Lời kêu gọi hành động rõ ràng (đăng ký, mua hàng, click link). Bắt buộc lồng ghép placeholder '{url}' một cách tự nhiên.

BẮT BUỘC: Trả về DUY NHẤT một đối tượng JSON hợp lệ (KHÔNG có bất kỳ text nào khác trước hoặc sau), với đúng các thuộc tính:
{
  "title": "tiêu đề kịch bản video",
  "content": "kịch bản đầy đủ định dạng text",
  "script": {
    "hook": "câu mở đầu (3 giây đầu)",
    "body": "nội dung chính chi tiết",
    "cta": "lời kêu gọi hành động ở cuối"
  }
}`;
  } else {
    systemInstructions = `Bạn là chuyên gia marketing chuyên viết bài quảng cáo mạng xã hội (Facebook, Zalo) bằng tiếng Việt với mục tiêu tối ưu tỷ lệ nhấp chuột (CTR).
Nhiệm vụ của bạn là phân tích URL đích và định hướng/chủ đề từ người dùng (nếu có) để tạo ra tiêu đề và nội dung bài viết lôi cuốn theo công thức AIDA (Attention - Gây chú ý, Interest - Tạo hứng thú, Desire - Khơi gợi khao khát, Action - Kêu gọi hành động).

Quy tắc viết bài:
1. Tiêu đề (title): Phải thật giật gân, khơi gợi tò mò hoặc giải quyết trực tiếp vấn đề của khách hàng, có sử dụng emoji phù hợp.
2. Nội dung (content):
   - Bắt đầu bằng một câu mở đầu gây chú ý mạnh mẽ (câu hỏi nhức nhối hoặc một thực tế gây sốc).
   - Trình bày các điểm nổi bật dưới dạng danh sách gạch đầu dòng rõ ràng, trực quan.
   - Luôn chèn placeholder '{url}' ở vị trí tự nhiên nhất để hướng người đọc click vào liên kết.
   - Có lời kêu gọi hành động (CTA) rõ ràng ở cuối.
   - Thêm 3-5 hashtag liên quan ở dưới cùng.
3. BẮT BUỘC: Chỉ trả về DUY NHẤT một đối tượng JSON hợp lệ (KHÔNG có bất kỳ text nào khác trước hoặc sau), với đúng 2 thuộc tính:
   {"title": "tiêu đề bài viết", "content": "nội dung bài viết"}
4. TUYỆT ĐỐI KHÔNG viết lời giải thích, lời dẫn, markdown, hay bất kỳ ký tự nào ngoài đối tượng JSON.`;
  }

  let urlMetadataText = '';
  try {
    console.log(`[AI Scraper] Fetching metadata for: ${urlTarget}`);
    const fetchRes = await fetch(urlTarget, {
      headers: { 'User-Agent': 'FreeTrafficBot/1.0 AI-Content-Generator' },
      signal: AbortSignal.timeout(8000),
    });
    if (fetchRes.ok) {
      const html = await fetchRes.text();
      const pageTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
      
      const metaDesc = html.match(
        /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i
      )?.[1]?.trim() || html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i
      )?.[1]?.trim();
      
      const parts = [];
      if (pageTitle) parts.push(`Tiêu đề website: "${pageTitle}"`);
      if (metaDesc) parts.push(`Mô tả website: "${metaDesc}"`);
      
      if (parts.length > 0) {
        urlMetadataText = `\n\nThông tin thực tế từ nội dung website:\n${parts.join('\n')}`;
      }
    }
  } catch (err) {
    console.warn(`[AI Scraper] Không thể tải thông tin từ URL ${urlTarget}:`, err);
  }

  let ragContextText = '';
  if (workspaceId) {
    try {
      const { retrieveRelevantChunksStructured } = await import('../lib/embeddings');
      const queryStr = aiPrompt || urlTarget;
      const structuredChunks = await retrieveRelevantChunksStructured(workspaceId, queryStr, 5);
      
      const config = await prisma.cskhConfig.findUnique({
        where: { workspaceId }
      });
      const kbText = config?.knowledgeBaseText || '';
      
      let relevantChunks = structuredChunks.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
      
      let mergedChunks = [...relevantChunks];
      if (kbText && !mergedChunks.some(c => c.includes('Hướng dẫn & Ghi chú nhanh') || c.includes('Hướng dẫn chung') || c.includes(kbText.slice(0, 30)))) {
        mergedChunks.unshift(`[Nguồn: Hướng dẫn & Ghi chú nhanh]\n${kbText}`);
      }
      
      if (mergedChunks.length > 0) {
        ragContextText = `\n\n--- DƯỚI ĐÂY LÀ THÔNG TIN DOANH NGHIỆP THỰC TẾ (BẮT BUỘC SỬ DỤNG ĐỂ VIẾT NỘI DUNG CHÍNH XÁC, KHÔNG BỊA ĐẶT THÔNG TIN): ---\n${mergedChunks.join('\n\n')}\n--- KẾT THÚC THÔNG TIN DOANH NGHIỆP ---`;
      }
    } catch (ragErr) {
      console.error('[AI Content Generation RAG] Lỗi tích hợp tri thức:', ragErr);
    }
  }

  const userPrompt = `URL đích: ${urlTarget}${urlMetadataText}${ragContextText}
${aiPrompt ? `Chủ đề/Yêu cầu viết bài: ${aiPrompt}` : 'Hãy tự suy nghĩ chủ đề thu hút nhất liên quan đến URL đích.'}`;

  try {
    const res = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API returned status ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = data.choices?.[0]?.message?.content?.trim() || '';

    if (contentType) {
      try {
        const parsed = parseAiJson(contentText);
        if (!parsed.title) parsed.title = 'Bài viết tự động';
        if (!parsed.content) parsed.content = 'Khám phá ngay tại {url}';
        return parsed;
      } catch (parseErr) {
        console.warn('Failed to parse specific contentType JSON, falling back to legacy extractor:', parseErr);
      }
    }

    return extractTitleContent(contentText);
  } catch (err: any) {
    console.error('Lỗi khi gọi AI:', err);
    throw err;
  }
}

/**
 * Resiliently extracts a Post Title and Post Content from various AI completion formats.
 * 
 * Progressive parsing strategies:
 * 1. Direct JSON parse (optimal case).
 * 2. Substring extraction bounded by curly braces { } (handles wrapper preamble/text).
 * 3. Markdown code block cleanup (strips ```json wrapper).
 * 4. Regex extraction (rescues fully valid fields or repairs truncated content strings).
 * 5. Line-based split (assumes first line is the title, and the rest is the content).
 * 
 * @param raw The raw output string from the AI model.
 * @returns An object containing the extracted post `title` and `content`.
 */
function extractTitleContent(raw: string): { title: string; content: string } {
  if (!raw) {
    return { title: 'Bài viết tự động', content: 'Khám phá ngay tại {url}' };
  }

  const cleanRaw = raw.trim();

  // Chiến lược 1: Parse JSON trực tiếp
  try {
    const parsed = JSON.parse(cleanRaw);
    if (parsed.title && parsed.content) return { title: parsed.title.trim(), content: parsed.content.trim() };
  } catch {}

  // Chiến lược 2: Tìm JSON object nằm giữa { } trong text
  const objStart = cleanRaw.indexOf('{');
  const objEnd = cleanRaw.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    try {
      const parsed = JSON.parse(cleanRaw.slice(objStart, objEnd + 1));
      if (parsed.title && parsed.content) return { title: parsed.title.trim(), content: parsed.content.trim() };
    } catch {}
  }

  // Chiến lược 3: Loại bỏ markdown code block rồi parse lại
  const mdCleaned = cleanRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(mdCleaned);
    if (parsed.title && parsed.content) return { title: parsed.title.trim(), content: parsed.content.trim() };
  } catch {}

  // Chiến lược 4: Dùng regex trích xuất "title" và "content" (hỗ trợ cả JSON bị cắt cụt/thiếu dấu ngoặc đóng)
  let title = '';
  let content = '';

  // Tìm title hoàn chỉnh trước
  const titleMatch = cleanRaw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (titleMatch) {
    title = titleMatch[1];
  } else {
    // Nếu bị cụt giữa chừng trong phần title
    const truncatedTitleMatch = cleanRaw.match(/"title"\s*:\s*"([^"\\]*)/);
    if (truncatedTitleMatch) title = truncatedTitleMatch[1];
  }

  // Tìm content hoàn chỉnh trước
  const contentMatch = cleanRaw.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (contentMatch) {
    content = contentMatch[1];
  } else {
    // Nếu phần content bị cắt cụt (thiếu dấu ngoặc kép đóng ở cuối), lấy toàn bộ từ lúc bắt đầu content đến hết chuỗi
    const contentStartMatch = cleanRaw.match(/"content"\s*:\s*"\s*(.*)/s);
    if (contentStartMatch) {
      content = contentStartMatch[1];
      // Loại bỏ các ký tự rác của cú pháp JSON bị dính ở cuối nếu có
      content = content.replace(/\s*"\s*\}\s*$/, '');
      content = content.replace(/\s*\}\s*$/, '');
      content = content.replace(/\s*"\s*$/, '');
    }
  }

  // Giải mã các ký tự escape JSON nếu có
  const unescapeJson = (str: string) => {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\\t/g, '\t');
  };

  title = unescapeJson(title).trim();
  content = unescapeJson(content).trim();

  if (title || content) {
    return {
      title: title || 'Bài viết tự động',
      content: content || 'Khám phá ngay tại {url}',
    };
  }

  // Chiến lược 5: Nếu là text thuần túy - dùng dòng đầu tiên làm tiêu đề
  const lines = cleanRaw.split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    return {
      title: lines[0].replace(/^#+\s*/, '').replace(/^\*+/, '').trim(),
      content: lines.slice(1).join('\n').trim(),
    };
  }

  return { title: 'Bài viết tự động', content: cleanRaw };
}

async function translateToEnglishImagePrompt(prompt: string): Promise<string> {
  try {
    const ai = getAiConfig('/chat/completions');
    if (!ai.apiKey) return prompt;

    const res = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional image prompt translator and optimizer. If the user input is in Vietnamese, translate it to clear, descriptive English for text-to-image AI (Stable Diffusion/Flux). If it is already in English, keep/improve it. Output ONLY the translated/improved English text, with no preamble, no explanations, and no quotes.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 80
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json() as any;
      let result = data.choices?.[0]?.message?.content?.trim();
      if (result && !result.includes('{') && result.length > 2) {
        if (result.startsWith('"') && result.endsWith('"')) {
          result = result.slice(1, -1);
        }
        if (result.startsWith("'") && result.endsWith("'")) {
          result = result.slice(1, -1);
        }
        return result.trim();
      }
    }
  } catch (e) {
    console.error('Failed to translate/optimize image prompt to English:', e);
  }
  return prompt;
}


function getSafeCategory(prompt: string): 'technology' | 'business' | 'marketing' | 'finance' | 'education' {
  const clean = prompt.toLowerCase();
  
  if (
    clean.includes('công nghệ') ||
    clean.includes('tech') ||
    clean.includes('phần mềm') ||
    clean.includes('hệ thống') ||
    clean.includes('ai') ||
    clean.includes('robot') ||
    clean.includes('digital') ||
    clean.includes('số hóa') ||
    clean.includes('computer') ||
    clean.includes('lập trình') ||
    clean.includes('developer') ||
    clean.includes('mạng') ||
    clean.includes('cloud') ||
    clean.includes('future') ||
    clean.includes('tương lai')
  ) {
    return 'technology';
  }
  
  if (
    clean.includes('marketing') ||
    clean.includes('bán hàng') ||
    clean.includes('quảng cáo') ||
    clean.includes('sales') ||
    clean.includes('seo') ||
    clean.includes('ctr') ||
    clean.includes('quảng bá') ||
    clean.includes('thị trường') ||
    clean.includes('ads') ||
    clean.includes('lead') ||
    clean.includes('email') ||
    clean.includes('zalo') ||
    clean.includes('facebook') ||
    clean.includes('social') ||
    clean.includes('truyền thông')
  ) {
    return 'marketing';
  }

  if (
    clean.includes('tài chính') ||
    clean.includes('tiền') ||
    clean.includes('doanh thu') ||
    clean.includes('đầu tư') ||
    clean.includes('finance') ||
    clean.includes('thanh toán') ||
    clean.includes('ví') ||
    clean.includes('ngân hàng') ||
    clean.includes('bank') ||
    clean.includes('giao dịch') ||
    clean.includes('chi phí') ||
    clean.includes('lợi nhuận')
  ) {
    return 'finance';
  }

  if (
    clean.includes('học') ||
    clean.includes('đào tạo') ||
    clean.includes('education') ||
    clean.includes('sách') ||
    clean.includes('trường') ||
    clean.includes('study') ||
    clean.includes('khóa học') ||
    clean.includes('tri thức') ||
    clean.includes('kiến thức') ||
    clean.includes('cẩm nang')
  ) {
    return 'education';
  }

  return 'business';
}

export async function generateAiImage(imagePrompt: string): Promise<string | null> {
  const ai = getAiConfig('/images/generations');

  try {
    const englishPrompt = await translateToEnglishImagePrompt(imagePrompt);
    console.log(`[AI Image] Original: "${imagePrompt}" -> Translated/Optimized: "${englishPrompt}"`);

    // If API key is not set, is an OpenRouter key, or is a Gemini key, route to AI Horde with Flickr+Preset fallbacks!
    if (!ai.apiKey || ai.apiKey.startsWith('sk-or-') || ai.apiKey.startsWith('AIzaSy')) {
      const stylizedPrompt = `flat minimal vector illustration of ${englishPrompt.slice(0, 200)}, clean minimalist design, professional corporate marketing graphic art, orange and warm color scheme, white background`;
      console.log(`[AI Image] Querying AI Horde with prompt: "${stylizedPrompt}"`);

      let buffer: Buffer | null = null;
      let generateSuccess = false;

      try {
        const queueRes = await fetch('https://stablehorde.net/api/v2/generate/async', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': '0000000000',
            'Client-Agent': 'free-traffic-system:1.0:github'
          },
          body: JSON.stringify({
            prompt: stylizedPrompt,
            params: {
              n: 1,
              width: 512,
              height: 512,
              steps: 20,
              sampler_name: 'k_euler',
              cfg_scale: 7
            },
            models: ["stable_diffusion"]
          }),
          signal: AbortSignal.timeout(15000)
        });

        if (queueRes.ok) {
          const queueData = await queueRes.json() as any;
          const jobId = queueData.id;
          if (jobId) {
            console.log(`[AI Image] AI Horde job submitted successfully. Job ID: ${jobId}. Polling...`);
            
            // Poll up to 15 times (45 seconds)
            for (let i = 0; i < 15; i++) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const checkRes = await fetch(`https://stablehorde.net/api/v2/generate/check/${jobId}`, {
                headers: { 'Client-Agent': 'free-traffic-system:1.0:github' },
                signal: AbortSignal.timeout(8000)
              });
              
              if (checkRes.ok) {
                const checkData = await checkRes.json() as any;
                console.log(`[AI Image] Horde Poll ${i + 1}: done=${checkData.done}, wait_time=${checkData.wait_time}s`);
                
                if (checkData.done) {
                  const statusRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${jobId}`, {
                    headers: { 'Client-Agent': 'free-traffic-system:1.0:github' },
                    signal: AbortSignal.timeout(10000)
                  });
                  
                  if (statusRes.ok) {
                    const statusData = await statusRes.json() as any;
                    if (statusData.generations && statusData.generations.length > 0) {
                      const imgData = statusData.generations[0].img as string;
                      if (imgData) {
                        if (imgData.startsWith('data:') || imgData.includes(';base64,')) {
                          // Base64 image
                          const base64Data = imgData.split(';base64,').pop() || imgData;
                          buffer = Buffer.from(base64Data, 'base64');
                          generateSuccess = true;
                          console.log(`[AI Image] AI Horde successfully returned base64 image!`);
                        } else if (imgData.startsWith('http')) {
                          // URL image
                          console.log(`[AI Image] AI Horde returned image URL: ${imgData}. Downloading...`);
                          const downloadRes = await fetch(imgData, { signal: AbortSignal.timeout(15000) });
                          if (downloadRes.ok) {
                            const arrayBuffer = await downloadRes.arrayBuffer();
                            buffer = Buffer.from(arrayBuffer);
                            generateSuccess = true;
                            console.log(`[AI Image] AI Horde image downloaded successfully!`);
                          }
                        }
                      }
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[AI Image] AI Horde process failed or timed out:`, err);
      }

      // If AI Horde succeeded, save it and return
      if (generateSuccess && buffer) {
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 10000)}.webp`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, buffer);
        return `/uploads/${filename}`;
      }

      // --- FALLBACK (LoremFlickr + local preset fallback) ---
      console.warn(`[AI Image] AI Horde failed or timed out. Falling back to Flickr...`);
      const category = getSafeCategory(imagePrompt);
      console.log(`[AI Image] Classified category: "${category}" for prompt: "${imagePrompt}"`);
      
      const searchUrl = `https://loremflickr.com/800/600/illustration,${category}/all`;
      console.log(`[AI Image] Fetching from LoremFlickr: ${searchUrl}`);

      let imgRes: Response | null = null;
      try {
        imgRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
      } catch (e) {
        console.error(`[AI Image] LoremFlickr fetch failed:`, e);
      }

      let usePresetFallback = true;
      let fallbackBuffer: Buffer | null = null;

      if (imgRes && imgRes.ok) {
        const isDefaultCat = imgRes.url.includes('defaultImage') || imgRes.url.includes('defaultImage.small');
        if (!isDefaultCat) {
          console.log(`[AI Image] LoremFlickr returned valid image: ${imgRes.url}. Downloading...`);
          try {
            const arrayBuffer = await imgRes.arrayBuffer();
            fallbackBuffer = Buffer.from(arrayBuffer);
            usePresetFallback = false;
          } catch (err) {
            console.error(`[AI Image] Failed to read array buffer:`, err);
          }
        } else {
          console.warn(`[AI Image] LoremFlickr returned default cat fallback image.`);
        }
      }

      if (usePresetFallback) {
        console.log(`[AI Image] Using local preset fallback illustration for category: ${category}`);
        return `/uploads/presets/${category}.png`;
      }

      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, fallbackBuffer!);

      return `/uploads/${filename}`;
    }

    // Generate image using DALL-E 2 for fast & cost-efficient generation
    const res = await fetch(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: 'dall-e-2',
        prompt: `Flat vector illustration of ${englishPrompt.slice(0, 200)}, clean minimalist design, professional corporate marketing graphic art, orange and warm color scheme, white background`,
        n: 1,
        size: '1024x1024',
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`DALL-E API error: ${errText}`);
      return null;
    }

    const data = (await res.json()) as { data?: { url?: string }[] };
    const tempUrl = data.data?.[0]?.url;
    if (!tempUrl) return null;

    // Download image and save to local uploads directory
    const imgRes = await fetch(tempUrl);
    if (!imgRes.ok) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);

    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Lỗi khi tạo ảnh với AI:', err);
    return null;
  }
}

export interface CopilotPlanItem {
  day: string;
  title: string;
  content: string;
  platform: string;
  suggestedTime: string;
  imageUrl?: string | null;
}

export async function generateAiContentPlan(
  topic: string,
  industry: string,
  tone: string,
  postCount = 5,
  workspaceId?: number,
  useKnowledgeBase?: boolean
): Promise<CopilotPlanItem[]> {
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) {
    // Fallback/Stubs for AI content plan when OPENAI_API_KEY is not configured
    const plan: CopilotPlanItem[] = [];
    const mockPosts = [
      {
        title: `🚀 [TOFU] Khởi đầu đột phá: Tối ưu ${topic} cho doanh nghiệp ${industry}`,
        content: `Bạn muốn nâng tầm doanh số trong lĩnh vực ${industry}? Khám phá giải pháp tự động hóa và tăng trưởng lưu lượng truy cập tối ưu tại {url}! Giọng điệu ${tone} đảm bảo chuyên nghiệp và hiệu quả.\n\n#${industry.toLowerCase()} #marketing #sales`,
        platform: 'facebook',
        suggestedTime: '09:00'
      },
      {
        title: `⚠️ [TOFU] 3 Sai lầm chí mạng khi triển khai ${topic}`,
        content: `Nhiều đơn vị trong ngành ${industry} vẫn đang mắc phải những sai lầm này. Đọc ngay bài viết phân tích chi tiết và cách khắc phục tại {url} để tránh lãng phí ngân sách!`,
        platform: 'email',
        suggestedTime: '12:00'
      },
      {
        title: `💡 [MOFU] Case Study: Tăng 200% doanh thu nhờ áp dụng ${topic}`,
        content: `Khám phá câu chuyện thành công thực tế của một doanh nghiệp trong ngành ${industry}. Xem chi tiết cách họ tối ưu quy trình và gặt hái kết quả tại {url}!\n\n#casestudy #growth`,
        platform: 'zalo',
        suggestedTime: '20:00'
      },
      {
        title: `🔥 [BOFU] Hướng dẫn từng bước: Làm chủ ${topic} trong 7 ngày`,
        content: `Cẩm nang chi tiết dành riêng cho các nhà quản lý trong lĩnh vực ${industry}. Bắt đầu hành trình chuyển đổi số của bạn ngay hôm nay tại {url}!`,
        platform: 'facebook',
        suggestedTime: '09:00'
      },
      {
        title: `🎁 [BOFU] Ưu đãi đặc biệt: Tư vấn miễn phí chiến lược ${topic}`,
        content: `Chỉ dành riêng cho 50 doanh nghiệp ${industry} đăng ký sớm nhất tuần này. Đặt lịch hẹn tư vấn miễn phí 1-1 cùng chuyên gia tại {url}!`,
        platform: 'email',
        suggestedTime: '12:00'
      }
    ];

    for (let i = 0; i < Math.min(postCount, mockPosts.length); i++) {
      plan.push({
        day: `Ngày ${i + 1}`,
        ...mockPosts[i]
      });
    }
    return plan;
  }

  const systemInstructions = `Bạn là một Giám đốc Marketing AI chuyên nghiệp, chuyên viết bài quảng cáo mạng xã hội (Facebook, Zalo, Email) bằng tiếng Việt với mục tiêu tối ưu tỷ lệ nhấp chuột (CTR) và tỷ lệ chuyển đổi.
Hãy tạo một kế hoạch nội dung đa kênh gồm ${postCount} ngày dựa trên chủ đề, ngành nghề và giọng điệu "${tone}" được cung cấp.

Mỗi ngày, hãy tạo một bài viết chất lượng cao phù hợp với kênh được đề xuất (facebook, email, zalo).
Quy tắc viết bài:
1. Nội dung của chiến dịch phải được phân bổ chặt chẽ theo Phễu Marketing (Marketing Funnel):
   - Nhóm bài viết TOFU (Top of Funnel - Nhận diện - ngày đầu chiến dịch): Tập trung chia sẻ kiến thức, chia sẻ giá trị hữu ích hoàn toàn miễn phí, giải quyết nỗi đau chung của tệp khách hàng nhằm tạo lòng tin và sự chú ý.
   - Nhóm bài viết MOFU (Middle of Funnel - Cân nhắc - ngày giữa chiến dịch): Giới thiệu giải pháp cụ thể, phân tích Case Study thành công, so sánh các giải pháp, nêu bật lợi ích độc quyền của sản phẩm/dịch vụ nhằm nuôi dưỡng sự hứng thú.
   - Nhóm bài viết BOFU (Bottom of Funnel - Quyết định - ngày cuối chiến dịch): Đưa ra lời chào mua hàng mạnh mẽ, cam kết chất lượng, ưu đãi giới hạn thời gian (Scarcity), kêu gọi hành động (CTA) trực tiếp nhằm thúc đẩy chuyển đổi thanh toán/đăng ký.
2. Bài viết phải cực kỳ lôi cuốn, viết theo công thức AIDA (Attention - Gây chú ý, Interest - Tạo hứng thú, Desire - Khơi gợi khao khát, Action - Kêu gọi hành động):
   - Tiêu đề (title): Phải thật giật gân, khơi gợi tò mò hoặc giải quyết trực tiếp vấn đề/nỗi đau của khách hàng, có sử dụng emoji phù hợp.
   - Nội dung (content):
     * Bắt đầu bằng một câu mở đầu gây chú ý mạnh mẽ (câu hỏi nhức nhối hoặc một thực tế gây sốc).
     * Trình bày các điểm nổi bật/giá trị dưới dạng danh sách gạch đầu dòng rõ ràng, trực quan để người đọc dễ quét thông tin, tránh viết một khối văn bản dài tẻ nhạt.
     * Luôn chèn placeholder '{url}' ở vị trí tự nhiên nhất để hướng người đọc click vào liên kết.
     * Luôn có lời kêu gọi hành động (CTA) rõ ràng, thôi thúc ở cuối.
     * Thêm 3-5 hashtag liên quan ở dưới cùng.
   - Tránh dùng các từ ngữ sáo rỗng, quá tâng bốc ("cách mạng", "tuyệt vời nhất", "hoàn hảo") để nội dung tự nhiên, chân thực và không bị "giả trân".
3. Trả về kết quả dưới dạng một MẢNG JSON HỢP LỆ (Array of Objects), mỗi đối tượng có định dạng:
   {
     "day": "Ngày X",
     "title": "Tiêu đề bài viết ngắn gọn và kích thích tò mò",
     "content": "Nội dung chi tiết lôi cuốn, chèn placeholder {url} và các hashtag liên quan ở cuối",
     "platform": "facebook" | "email" | "zalo",
     "suggestedTime": "HH:MM"
   }
KHÔNG bao bọc kết quả bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô.`;

  let ragContextText = '';
  if (workspaceId) {
    try {
      const { retrieveRelevantChunksStructured } = await import('../lib/embeddings');
      const queryStr = `${topic} ${industry}`;
      const structuredChunks = await retrieveRelevantChunksStructured(workspaceId, queryStr, 5);
      
      const config = await prisma.cskhConfig.findUnique({
        where: { workspaceId }
      });
      const kbText = config?.knowledgeBaseText || '';
      
      let relevantChunks = structuredChunks.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
      
      let mergedChunks = [...relevantChunks];
      if (kbText && !mergedChunks.some(c => c.includes('Hướng dẫn & Ghi chú nhanh') || c.includes('Hướng dẫn chung') || c.includes(kbText.slice(0, 30)))) {
        mergedChunks.unshift(`[Nguồn: Hướng dẫn & Ghi chú nhanh]\n${kbText}`);
      }
      
      if (mergedChunks.length > 0) {
        ragContextText = `\n\n--- DƯỚI ĐÂY LÀ THÔNG TIN DOANH NGHIỆP THỰC TẾ (BẮT BUỘC SỬ DỤNG ĐỂ VIẾT NỘI DUNG CHÍNH XÁC, KHÔNG BỊA ĐẶT THÔNG TIN): ---\n${mergedChunks.join('\n\n')}\n--- KẾT THÚC THÔNG TIN DOANH NGHIỆP ---`;
      }
    } catch (ragErr) {
      console.error('[AI Plan Generation RAG] Lỗi tích hợp tri thức:', ragErr);
    }
  }

  const userPrompt = `Chủ đề: ${topic}
Ngành nghề: ${industry}
Giọng điệu: ${tone}${ragContextText}`;

  try {
    const res = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API returned status ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';

    try {
      return parseAiJson(contentText) as CopilotPlanItem[];
    } catch {
      console.warn('AI plan did not return valid JSON, parsing raw text fallback:', contentText);
      throw new Error('AI không trả về đúng định dạng JSON kế hoạch.');
    }
  } catch (err) {
    console.error('Lỗi gọi OpenAI cho Copilot Plan:', err);
    throw err;
  }
}

export async function optimizeSeoContent(
  title: string,
  slug: string,
  metaDescription: string,
  content: string,
  focusKeyword: string
): Promise<{
  title: string;
  slug: string;
  metaDescription: string;
  content: string;
}> {
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) {
    const cleanKw = focusKeyword.trim();
    const updatedTitle = title.toLowerCase().includes(cleanKw.toLowerCase())
      ? title
      : `Cách tối ưu ${cleanKw} hiệu quả: ${title}`;
    const cleanSlug = updatedTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    const updatedMeta = metaDescription.toLowerCase().includes(cleanKw.toLowerCase())
      ? metaDescription
      : `Hướng dẫn ${cleanKw}. ${metaDescription}`;
    
    let updatedContent = content;
    if (!content.toLowerCase().includes(cleanKw.toLowerCase())) {
      updatedContent = `## Khái niệm về ${cleanKw} trong thực tế\n\nKhi tối ưu hóa **${cleanKw}**, chúng ta cần chú ý đến nhiều yếu tố.\n\n${content}`;
    }
    
    return {
      title: updatedTitle,
      slug: cleanSlug,
      metaDescription: updatedMeta.substring(0, 160),
      content: updatedContent
    };
  }

  const systemInstructions = `Bạn là chuyên gia tối ưu hóa SEO Copywriting chuyên nghiệp bằng tiếng Việt.
Nhiệm vụ của bạn là tối ưu hóa tiêu đề, mô tả, slug và nội dung của một bài viết hiện có để đạt điểm SEO cao nhất dựa trên "Từ khóa chính" (Focus Keyword) được cung cấp.

Hãy thực hiện các tối ưu hóa bắt buộc sau:
1. Tiêu đề (title): Độ dài từ 10 đến 60 ký tự, hấp dẫn, BẮT BUỘC chứa từ khóa chính.
2. Đường dẫn (slug): Slug thân thiện SEO, không dấu, viết thường, ngăn cách bằng dấu gạch ngang (ví dụ: dac-san-tom-ca).
3. Meta Description (metaDescription): Độ dài từ 50 đến 160 ký tự, tóm tắt bài viết lôi cuốn, BẮT BUỘC chứa từ khóa chính.
4. Nội dung bài viết (content):
   - Định dạng Markdown chuẩn hóa (TUYỆT ĐỐI KHÔNG dùng các thẻ HTML như <h2>, <p>, <strong>, <a>, <ul>, <li>, v.v.).
   - Phân chia bố cục rõ ràng bằng các tiêu đề phụ bắt đầu bằng "## " hoặc "### ". Đảm bảo từ khóa chính xuất hiện trong ít nhất một tiêu đề phụ.
   - Chèn từ khóa chính vào nội dung một cách tự nhiên với mật độ khoảng 1% đến 2.5% tổng số từ (in đậm từ khóa chính dạng **từ khóa chính** khi xuất hiện lần đầu hoặc lần quan trọng).
   - Đảm bảo bài viết có độ dài tốt (tối thiểu 300-500 từ). Nếu bài viết hiện tại quá ngắn, hãy viết thêm 1-2 đoạn văn chất lượng cao, sâu sắc về chủ đề này để bổ sung.
   - Giữ nguyên các thông tin thực tế, cấu trúc cốt lõi và placeholders như '{url}' ở các vị trí tự nhiên nhất.

BẮT BUỘC: Trả về DUY NHẤT một đối tượng JSON hợp lệ (KHÔNG có bất kỳ text nào khác trước hoặc sau), với đúng các thuộc tính:
{"title": "tiêu đề tối ưu", "slug": "slug-toi-uu", "metaDescription": "mô tả tối ưu", "content": "nội dung Markdown tối ưu"}`;

  const userPrompt = `Từ khóa chính (Focus Keyword): ${focusKeyword}

Thông tin bài viết hiện tại:
- Tiêu đề hiện tại: ${title}
- Slug hiện tại: ${slug}
- Mô tả hiện tại: ${metaDescription}
- Nội dung hiện tại:
${content}`;

  try {
    const res = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API returned status ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = data.choices?.[0]?.message?.content?.trim() || '';

    try {
      const parsed = parseAiJson(contentText);
      if (!parsed.title) parsed.title = title;
      if (!parsed.content) parsed.content = content;
      if (!parsed.slug) parsed.slug = slug;
      if (!parsed.metaDescription) parsed.metaDescription = metaDescription;
      return parsed;
    } catch {
      console.warn('Failed to parse AI optimized JSON, falling back to legacy extractor:', contentText);
      throw new Error('AI không trả về đúng định dạng JSON tối ưu.');
    }
  } catch (err) {
    console.error('Lỗi gọi OpenAI để tối ưu bài viết:', err);
    throw err;
  }
}
