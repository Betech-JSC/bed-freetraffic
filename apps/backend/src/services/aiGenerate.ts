import fs from 'fs';
import path from 'path';

export type GeneratedPost = {
  title: string;
  content: string;
  imageUrl: string | null;
};

export async function generateAiPostContent(
  urlTarget: string,
  aiPrompt?: string | null
): Promise<{ title: string; content: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình OPENAI_API_KEY trong file .env');
  }

  const systemInstructions = `Bạn là chuyên gia marketing chuyên viết bài quảng cáo mạng xã hội (Facebook, Zalo) bằng tiếng Việt.
Bạn phải phân tích URL đích và định hướng/chủ đề từ người dùng (nếu có) để tạo ra tiêu đề và nội dung bài viết hấp dẫn, kích thích lượt click chuột (CTR cao).
Nội dung bài đăng phải chứa placeholder '{url}' ở nơi thích hợp nhất để chèn link đích (không tự viết link giả).
TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON HỢP LỆ với 2 thuộc tính duy nhất: "title" và "content".
KHÔNG bao bọc chuỗi JSON bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô.

Ví dụ định dạng trả về:
{
  "title": "Bí Quyết Tăng Trưởng Giao Dịch",
  "content": "Bạn đang tìm giải pháp tăng doanh số? Khám phá ngay tại {url}!"
}`;

  const userPrompt = `URL đích: ${urlTarget}
${aiPrompt ? `Chủ đề/Yêu cầu viết bài: ${aiPrompt}` : 'Hãy tự suy nghĩ chủ đề thu hút nhất liên quan đến URL đích.'}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API returned status ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse JSON
    try {
      const parsed = JSON.parse(contentText) as { title: string; content: string };
      return {
        title: parsed.title || 'Bài viết tự động',
        content: parsed.content || 'Khám phá ngay tại {url}',
      };
    } catch {
      // Fallback if AI didn't return clean JSON
      console.warn('AI did not return valid JSON, using raw text fallback:', contentText);
      return {
        title: 'Bài viết tự sinh',
        content: contentText || 'Khám phá thêm tại {url}',
      };
    }
  } catch (err: any) {
    console.error('Lỗi khi gọi OpenAI GPT:', err);
    throw err;
  }
}

export async function generateAiImage(imagePrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    // Generate image using DALL-E 2 for fast & cost-efficient generation
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-2',
        prompt: `A vibrant professional marketing social media post illustration, flat modern digital art style, suitable for: ${imagePrompt.slice(0, 300)}`,
        n: 1,
        size: '1024x1024',
      }),
      signal: AbortSignal.timeout(30000),
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
    console.error('Lỗi khi tạo ảnh với DALL-E:', err);
    return null;
  }
}

export interface CopilotPlanItem {
  day: string;
  title: string;
  content: string;
  platform: string;
  suggestedTime: string;
}

export async function generateAiContentPlan(
  topic: string,
  industry: string,
  tone: string,
  postCount = 5
): Promise<CopilotPlanItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback/Stubs for AI content plan when OPENAI_API_KEY is not configured
    const plan: CopilotPlanItem[] = [];
    const mockPosts = [
      {
        title: `🚀 Khởi đầu đột phá: Tối ưu ${topic} cho doanh nghiệp ${industry}`,
        content: `Bạn muốn nâng tầm doanh số trong lĩnh vực ${industry}? Khám phá giải pháp tự động hóa và tăng trưởng lưu lượng truy cập tối ưu tại {url}! Giọng điệu ${tone} đảm bảo chuyên nghiệp và hiệu quả.\n\n#${industry.toLowerCase()} #marketing #sales`,
        platform: 'facebook',
        suggestedTime: '09:00'
      },
      {
        title: `⚠️ 3 Sai lầm chí mạng khi triển khai ${topic}`,
        content: `Nhiều đơn vị trong ngành ${industry} vẫn đang mắc phải những sai lầm này. Đọc ngay bài viết phân tích chi tiết và cách khắc phục tại {url} để tránh lãng phí ngân sách!`,
        platform: 'email',
        suggestedTime: '12:00'
      },
      {
        title: `💡 Case Study: Tăng 200% doanh thu nhờ áp dụng ${topic}`,
        content: `Khám phá câu chuyện thành công thực tế của một doanh nghiệp trong ngành ${industry}. Xem chi tiết cách họ tối ưu quy trình và gặt hái kết quả tại {url}!\n\n#casestudy #growth`,
        platform: 'zalo',
        suggestedTime: '20:00'
      },
      {
        title: `🔥 Hướng dẫn từng bước: Làm chủ ${topic} trong 7 ngày`,
        content: `Cẩm nang chi tiết dành riêng cho các nhà quản lý trong lĩnh vực ${industry}. Bắt đầu hành trình chuyển đổi số của bạn ngay hôm nay tại {url}!`,
        platform: 'facebook',
        suggestedTime: '09:00'
      },
      {
        title: `🎁 Ưu đãi đặc biệt: Tư vấn miễn phí chiến lược ${topic}`,
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

  const systemInstructions = `Bạn là một trợ lý Marketing AI chuyên nghiệp. Hãy tạo một kế hoạch nội dung mạng xã hội đa kênh gồm \${postCount} ngày dựa trên chủ đề, ngành nghề, và giọng điệu được cung cấp.
Bài đăng phải phù hợp với các kênh như facebook, email, zalo.
Nội dung bài đăng phải chứa placeholder '{url}' ở nơi thích hợp để chèn link đích.
TRẢ VỀ KẾT QUẢ DƯỚI DẠNG MỘT MẢNG JSON HỢP LỆ, mỗi đối tượng có các thuộc tính:
- "day": Ví dụ "Ngày 1", "Ngày 2"
- "title": Tiêu đề bài viết ngắn gọn hấp dẫn
- "content": Nội dung chi tiết của bài đăng (kèm placeholder {url})
- "platform": Kênh phù hợp nhất ("facebook", "email", hoặc "zalo")
- "suggestedTime": Khung giờ đề xuất đăng bài (Ví dụ: "09:00", "12:00", "20:00")

KHÔNG bao bọc kết quả bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô.`;

  const userPrompt = `Chủ đề: \${topic}
Ngành nghề: \${industry}
Giọng điệu: \${tone}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer \${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API returned status \${res.status}: \${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';

    try {
      return JSON.parse(contentText) as CopilotPlanItem[];
    } catch {
      console.warn('AI plan did not return valid JSON, parsing raw text fallback:', contentText);
      throw new Error('AI không trả về đúng định dạng JSON kế hoạch.');
    }
  } catch (err) {
    console.error('Lỗi gọi OpenAI cho Copilot Plan:', err);
    throw err;
  }
}
