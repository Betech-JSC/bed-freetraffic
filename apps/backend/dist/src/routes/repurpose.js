"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const ai_1 = require("../lib/ai");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
function cleanHtml(html) {
    let cleaned = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, 10000);
}
function generateRepurposeFallback(title, content, platforms) {
    const result = {};
    const snippet = content.slice(0, 150) + '...';
    if (platforms.includes('facebook')) {
        result.facebook = `📣 CƠ HỘI MỚI CHO BẠN: ${title}!\n\n✨ Bạn có biết: ${snippet}\n\n👉 Đọc ngay bài viết đầy đủ để cập nhật những kiến thức thực chiến mới nhất từ Growth OS nhé. Đừng quên Like và Share bài viết này!\n\n#marketing #growthos #marketingautomation`;
    }
    if (platforms.includes('linkedin')) {
        result.linkedin = `💡 [Chia sẻ] ${title}\n\nNhu cầu tối ưu hóa quy trình tiếp thị ngày càng trở nên cấp thiết. Dưới đây là tóm tắt nhanh những điểm quan trọng:\n- ${snippet}\n\nBài học rút ra: Cần tập trung vào tự động hóa để nhân rộng hiệu suất tiếp thị bền vững.\n\nĐọc bài viết chi tiết tại website của chúng tôi.\n\n#DigitalMarketing #Productivity #GrowthOS #BusinessTransformation`;
    }
    if (platforms.includes('zalo')) {
        result.zalo = `Tin mới từ Growth OS: "${title}". Bài viết chia sẻ kinh nghiệm thực chiến mới nhất giúp tăng trưởng khách hàng đột phá. Click xem chi tiết ngay tại đây!`;
    }
    if (platforms.includes('tiktok')) {
        result.tiktok = `[Cảnh 1: Cận mặt MC cười thân thiện, giơ điện thoại hiển thị logo Growth OS]\nMC: Bạn muốn tăng gấp đôi doanh thu mà không cần thêm nhân sự? Đây là bí quyết của bạn!\n\n[Cảnh 2: MC chỉ tay vào màn hình máy tính hiển thị bài viết "${title}"]\nMC: Đọc ngay bài viết mới nhất để biết cách tự động hóa quy trình tiếp thị chỉ trong 5 phút.\n\n[Cảnh 3: MC giơ ngón tay cái, màn hình hiển thị text kêu gọi Follow]\nMC: Nhấn Follow kênh để nhận thêm nhiều bí quyết kéo traffic miễn phí mỗi ngày nhé!`;
    }
    return result;
}
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { sourceType, sourceId, url, textContent, platforms } = req.body;
    if (!sourceType || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
        res.status(400).json({ error: 'Nguồn nội dung (sourceType) và danh sách kênh (platforms) là bắt buộc' });
        return;
    }
    try {
        let sourceTitle = 'Ý tưởng mới';
        let sourceText = '';
        if (sourceType === 'blog') {
            const blogId = parseInt(String(sourceId));
            if (isNaN(blogId)) {
                res.status(400).json({ error: 'ID bài viết Blog không hợp lệ' });
                return;
            }
            const blog = await prisma_1.default.blogPost.findFirst({
                where: { id: blogId, workspaceId: req.workspaceId }
            });
            if (!blog) {
                res.status(404).json({ error: 'Không tìm thấy bài viết Blog' });
                return;
            }
            sourceTitle = blog.title;
            sourceText = cleanHtml(blog.content);
        }
        else if (sourceType === 'url') {
            if (!url || typeof url !== 'string' || !url.trim()) {
                res.status(400).json({ error: 'Đường dẫn URL là bắt buộc' });
                return;
            }
            const targetUrl = url.trim();
            const fetchRes = await fetch(targetUrl, { signal: AbortSignal.timeout(15000) });
            if (!fetchRes.ok) {
                res.status(400).json({ error: `Không thể tải nội dung từ URL: Status ${fetchRes.status}` });
                return;
            }
            const html = await fetchRes.text();
            sourceTitle = `Bài viết từ URL: ${targetUrl}`;
            sourceText = cleanHtml(html);
        }
        else if (sourceType === 'text') {
            if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
                res.status(400).json({ error: 'Nội dung văn bản thô là bắt buộc' });
                return;
            }
            sourceText = textContent.trim();
            sourceTitle = sourceText.slice(0, 50);
        }
        else {
            res.status(400).json({ error: 'Loại nguồn nội dung không hợp lệ' });
            return;
        }
        const ai = (0, ai_1.getAiConfig)('/chat/completions');
        if (!ai.apiKey) {
            res.json(generateRepurposeFallback(sourceTitle, sourceText, platforms));
            return;
        }
        const systemInstructions = `Bạn là chuyên gia truyền thông mạng xã hội và sáng tạo nội dung đa kênh hàng đầu bằng tiếng Việt.
Nhiệm vụ của bạn là nhận vào một đoạn nội dung văn bản (hoặc tóm tắt bài viết) và chuyển đổi/xé nhỏ nội dung này thành các bài đăng trên các nền tảng mạng xã hội được yêu cầu.
Các nền tảng được yêu cầu tạo bài đăng gồm: ${platforms.join(', ')}.

YÊU CẦU ĐỊNH DẠNG TỪNG NỀN TẢNG:
1. facebook (nếu có): Viết bài chia sẻ Facebook thú vị, hấp dẫn, dùng nhiều biểu tượng cảm xúc (emojis), có tiêu đề cuốn hút, phân đoạn rõ ràng và lời kêu gọi hành động (CTA) rõ nét.
2. linkedin (nếu có): Viết bài chia sẻ LinkedIn mang tính chuyên nghiệp, văn phong học thuật/chia sẻ kiến thức sâu sắc, tập trung vào giá trị cốt lõi, bài học rút ra, sử dụng định dạng bullet points nếu cần, đi kèm 3-5 hashtag ngành chuyên sâu.
3. zalo (nếu có): Viết một tin nhắn ngắn gọn qua Zalo, đi thẳng vào giá trị hấp dẫn nhất, súc tích, độ dài dưới 150 từ, đính kèm lời mời click đọc thêm.
4. tiktok (nếu có): Viết kịch bản video ngắn (TikTok/Reels) dài khoảng 30-45 giây. Cấu trúc gồm: 3 giây đầu giật tít thu hút (Hook), 3 phần nội dung chính triển khai nhanh, kết luận kêu gọi tương tác. Hãy bổ sung thêm mô tả cảnh quay bằng dấu ngoặc vuông [ ] (ví dụ: [Cảnh cận mặt], [Hiển thị slide chữ]).

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG MỘT ĐỐI TƯỢNG JSON HỢP LỆ (JSON OBJECT) CHỨA CÁC KHÓA (KEYS) TƯƠNG ỨNG VỚI NỀN TẢNG YÊU CẦU: ${JSON.stringify(platforms)}.
KHÔNG viết phần giải thích hay suy nghĩ/suy luận dài dòng, hãy đi thẳng vào phản hồi JSON hợp lệ để tiết kiệm thời gian phản hồi.
KHÔNG bao bọc chuỗi JSON bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.`;
        const userPrompt = `Tiêu đề: ${sourceTitle}\nNội dung bài viết cần xé nhỏ: ${sourceText}`;
        const aiRes = await (0, ai_1.fetchWithRetry)(ai.url, {
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
        const data = await aiRes.json();
        const contentText = data.choices?.[0]?.message?.content?.trim() || '{}';
        try {
            const parsed = (0, ai_1.parseAiJson)(contentText);
            res.json(parsed);
        }
        catch (parseErr) {
            console.error('Failed to parse AI repurpose output, returning fallback:', parseErr);
            res.json(generateRepurposeFallback(sourceTitle, sourceText, platforms));
        }
    }
    catch (err) {
        console.error('Failed to repurpose content:', err);
        res.status(500).json({ error: err.message || 'Lỗi xử lý xé nhỏ nội dung' });
    }
});
exports.default = router;
