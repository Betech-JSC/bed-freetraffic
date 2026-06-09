import { getAiConfig, parseAiJson, fetchWithRetry } from '../lib/ai';

export async function generateSeoRecommendations(
  title: string,
  description: string,
  keywords: string,
  issues: string[]
): Promise<{ title: string; description: string; keywords: string }> {
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) {
    // Return standard professional fallback tags
    return {
      title: title ? `${title} | Giải pháp Marketing Toàn diện` : "Growth OS - Giải pháp tăng trưởng traffic tự động chuyên nghiệp",
      description: description ? `${description}. Tìm hiểu giải pháp tăng trưởng chuyển đổi và tối ưu hóa SEO tự động ngay.` : "Hệ thống Growth OS hỗ trợ tăng trưởng doanh thu và khách hàng tự động đa kênh hiệu quả hàng đầu.",
      keywords: keywords ? `${keywords}, tối ưu SEO, tăng traffic` : "tăng traffic, tối ưu seo, marketing automation, crm"
    };
  }

  const systemInstructions = `Bạn là chuyên gia tối ưu hóa tìm kiếm (SEO Specialist) hàng đầu bằng tiếng Việt.
Nhiệm vụ của bạn là phân tích các thuộc tính SEO hiện tại của trang (Tiêu đề, Mô tả, Từ khóa) và danh sách lỗi SEO phát hiện được để đề xuất bộ Meta Tag hoàn chỉnh tối ưu nhất:
1. Tiêu đề (title): Dài từ 50-60 ký tự, chứa từ khóa chính, cuốn hút người tìm kiếm.
2. Mô tả (description): Dài từ 140-160 ký tự, hấp dẫn, nêu bật giá trị cốt lõi, có lời kêu gọi hành động ngầm.
3. Từ khóa (keywords): Ngăn cách bởi dấu phẩy, tập trung vào các từ khóa có lượng tìm kiếm cao liên quan.

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON HỢP LỆ với 3 thuộc tính duy nhất: "title", "description", và "keywords".
KHÔNG bao bọc chuỗi JSON bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.`;

  const userPrompt = `Dữ liệu SEO hiện tại:
- Tiêu đề hiện tại: ${title || 'Chưa cấu hình'}
- Mô tả hiện tại: ${description || 'Chưa cấu hình'}
- Từ khóa hiện tại: ${keywords || 'Chưa cấu hình'}
- Danh sách lỗi SEO phát hiện được: ${issues.length > 0 ? issues.join(', ') : 'Không phát hiện lỗi cụ thể'}`;

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
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI error: status ${res.status}`);
    }

    const data = await res.json() as any;
    const contentText = data.choices?.[0]?.message?.content?.trim() || '{}';
    
    try {
      const parsed = parseAiJson(contentText);
      return {
        title: parsed.title || title,
        description: parsed.description || description,
        keywords: parsed.keywords || keywords
      };
    } catch {
      // Fallback
      return { title, description, keywords };
    }
  } catch (err) {
    console.error('Failed to generate SEO recommendations:', err);
    return {
      title: title ? `${title} - Tối ưu SEO bởi AI` : "Growth OS - Tăng trưởng traffic tự động",
      description: description || "Hệ thống tự động hóa tăng trưởng traffic và tối ưu hóa SEO bền vững cho doanh nghiệp.",
      keywords: keywords || "tối ưu seo, marketing crm, growth hacking"
    };
  }
}
