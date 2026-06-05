import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { getAiConfig } from '../lib/ai';


const router = Router();

// Get list of landing pages
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pages = await prisma.landingPage.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pages);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi hệ thống khi lấy danh sách Landing Page' });
  }
});

// Get landing page details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const page = await prisma.landingPage.findUnique({
      where: { id },
      include: { forms: true },
    });
    if (!page) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page' });
      return;
    }

    if (page.workspaceId) {
      const hasAccess = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.user!.userId,
            workspaceId: page.workspaceId,
          },
        },
      });
      if (!hasAccess && req.user!.role !== 'ADMIN') {
        res.status(403).json({ error: 'Bạn không có quyền truy cập Landing Page này' });
        return;
      }
    }

    res.json(page);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi lấy chi tiết Landing Page' });
  }
});

// Create new landing page
router.post('/', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, slug, layoutJson, htmlContent, cssContent, status, fbPixelId, googleTagId } = req.body;
    if (!title || !slug) {
      res.status(400).json({ error: 'Tiêu đề và đường dẫn (slug) là bắt buộc.' });
      return;
    }

    const existing = await prisma.landingPage.findFirst({
      where: { slug },
    });
    if (existing) {
      res.status(400).json({ error: 'Đường dẫn (slug) đã tồn tại. Vui lòng chọn đường dẫn khác.' });
      return;
    }

    const page = await prisma.landingPage.create({
      data: {
        title,
        slug,
        layoutJson: layoutJson || '{}',
        htmlContent: htmlContent || '',
        cssContent: cssContent || '',
        status: status || 'DRAFT',
        fbPixelId: fbPixelId || null,
        googleTagId: googleTagId || null,
        workspaceId: req.workspaceId,
      },
    });

    res.status(201).json(page);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi tạo Landing Page' });
  }
});

// Update landing page
router.put('/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { title, slug, layoutJson, htmlContent, cssContent, status, fbPixelId, googleTagId } = req.body;

    const existing = await prisma.landingPage.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page để cập nhật' });
      return;
    }

    if (existing.workspaceId) {
      const hasAccess = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.user!.userId,
            workspaceId: existing.workspaceId,
          },
        },
      });
      if (!hasAccess && req.user!.role !== 'ADMIN') {
        res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa Landing Page này' });
        return;
      }
    }

    if (slug && slug !== existing.slug) {
      const slugConflict = await prisma.landingPage.findFirst({
        where: { slug },
      });
      if (slugConflict) {
        res.status(400).json({ error: 'Đường dẫn (slug) đã được sử dụng bởi trang khác.' });
        return;
      }
    }

    const updated = await prisma.landingPage.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        slug: slug !== undefined ? slug : existing.slug,
        layoutJson: layoutJson !== undefined ? layoutJson : existing.layoutJson,
        htmlContent: htmlContent !== undefined ? htmlContent : existing.htmlContent,
        cssContent: cssContent !== undefined ? cssContent : existing.cssContent,
        status: status !== undefined ? status : existing.status,
        fbPixelId: fbPixelId !== undefined ? fbPixelId : existing.fbPixelId,
        googleTagId: googleTagId !== undefined ? googleTagId : existing.googleTagId,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi cập nhật Landing Page' });
  }
});

// Delete landing page
router.delete('/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.landingPage.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page để xóa' });
      return;
    }

    if (existing.workspaceId) {
      const hasAccess = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.user!.userId,
            workspaceId: existing.workspaceId,
          },
        },
      });
      if (!hasAccess && req.user!.role !== 'ADMIN') {
        res.status(403).json({ error: 'Bạn không có quyền xóa Landing Page này' });
        return;
      }
    }
    await prisma.landingPage.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xóa Landing Page' });
  }
});

// AI Page generator
router.post('/generate-ai', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Mô tả (prompt) là bắt buộc.' });
      return;
    }

    const ai = getAiConfig('/chat/completions');
    if (!ai.apiKey) {
      res.status(400).json({ error: 'Chưa cấu hình API Key AI. Vui lòng kiểm tra file .env.' });
      return;
    }

    const systemInstructions = `Bạn là một kỹ sư thiết kế Landing Page AI chuyên nghiệp.
Nhiệm vụ của bạn là tạo ra cấu trúc trang web Landing Page tuyệt đẹp dưới dạng một mảng JSON các khối PageBlock theo đúng định dạng được yêu cầu.

Các loại khối (block.type) được hỗ trợ:
1. "hero": Banner chính (title, subtitle, buttonText, buttonLink, imageUrl, imageAlignment: "left"|"right"|"center", backgroundColor, textColor).
2. "features": Các lợi ích nổi bật (title, items: string[], backgroundColor, textColor).
3. "form": Biểu mẫu đăng ký (title, subtitle, formId: "", backgroundColor, textColor).
4. "pricing": Bảng giá sản phẩm (title, subtitle, priceVal: "499.000đ", buttonText: "Mua ngay", buttonLink: "#register-form", backgroundColor, textColor).
5. "footer": Chân trang (title, subtitle, backgroundColor, textColor).
6. "countdown": Đồng hồ đếm ngược (title, subtitle, countdownEnd: "2026-06-30T23:59:00", backgroundColor, textColor).
7. "testimonials": Đánh giá khách hàng (title, reviews: [{name, role, rating: 5, quote, avatar: ""}], backgroundColor, textColor).
8. "faq": Câu hỏi thường gặp (title, faqs: [{question, answer}], backgroundColor, textColor).

Quy tắc:
1. Luôn thiết kế Landing Page có thứ tự khối hợp lý (Ví dụ: hero -> features -> testimonials -> countdown -> pricing -> faq -> footer).
2. Tạo ra tối thiểu 4 khối và tối đa 7 khối. Hãy viết tiêu đề, nội dung và các câu hỏi/lợi ích bằng tiếng Việt thật tự nhiên, thu hút khách mua hàng.
3. Luôn chọn màu sắc phối hợp hài hòa, đẹp mắt (ví dụ: backgroundColor tối như #0f172a, #0b0f19, #030712 và chữ sáng như #ffffff, #94a3b8).
4. Chỉ trả về MẢNG JSON HỢP LỆ dạng PageBlock[].
5. KHÔNG bao bọc kết quả bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.

Ví dụ trả về:
[
  {
    "id": "block-hero",
    "type": "hero",
    "title": "Tăng Trưởng Bứt Phá Doanh Số",
    "subtitle": "Giải pháp marketing tối ưu",
    "buttonText": "Đăng ký ngay",
    "buttonLink": "#register-form",
    "imageUrl": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60",
    "imageAlignment": "right",
    "backgroundColor": "#0f172a",
    "textColor": "#ffffff"
  }
]`;

    const response = await fetch(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: `Hãy sinh các khối Landing Page tuyệt đẹp cho chủ đề sau: ${prompt}` }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).json({ error: `AI API returned status ${response.status}: ${errText}` });
      return;
    }

    const data = await response.json() as any;
    const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';

    try {
      const parsed = JSON.parse(contentText);
      if (Array.isArray(parsed)) {
        // Add random ID if not present
        const processed = parsed.map((b: any, idx: number) => ({
          ...b,
          id: b.id || `block-ai-${Date.now()}-${idx}`
        }));
        res.json(processed);
      } else {
        throw new Error('AI không trả về mảng.');
      }
    } catch (e) {
      console.warn('AI did not return valid JSON array, raw response:', contentText);
      res.status(500).json({ error: 'AI không trả về đúng định dạng JSON. Vui lòng thử lại.', raw: contentText });
    }
  } catch (err: any) {
    console.error('[AI Page Generator Error]:', err);
    res.status(500).json({ error: err.message || 'Lỗi hệ thống khi sinh trang.' });
  }
});

export default router;

