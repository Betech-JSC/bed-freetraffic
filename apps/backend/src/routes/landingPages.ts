import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { getAiConfig, parseAiJson, fetchWithRetry } from '../lib/ai';


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
    const { title, slug, layoutJson, htmlContent, cssContent, status, fbPixelId, googleTagId, enableMessengerChat } = req.body;
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
        enableMessengerChat: enableMessengerChat !== undefined ? !!enableMessengerChat : false,
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
    const { title, slug, layoutJson, htmlContent, cssContent, status, fbPixelId, googleTagId, enableMessengerChat } = req.body;

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
        enableMessengerChat: enableMessengerChat !== undefined ? !!enableMessengerChat : existing.enableMessengerChat,
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

const getThemedUnsplashImage = (theme: string, prompt: string): string => {
  const query = ((prompt || '') + ' ' + (theme || '')).toLowerCase();
  
  if (query.includes('mật ong') || query.includes('honey') || query.includes('ong')) {
    return 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80';
  }
  if (query.includes('hải sản') || query.includes('seafood') || query.includes('cá') || query.includes('tôm') || query.includes('cua')) {
    return 'https://images.unsplash.com/photo-1534080391025-09795d197360?w=800&auto=format&fit=crop&q=80';
  }
  if (query.includes('ăn') || query.includes('food') || query.includes('bếp') || query.includes('nhà hàng') || query.includes('ẩm thực')) {
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80';
  }
  if (query.includes('code') || query.includes('lập trình') || query.includes('developer') || query.includes('javascript') || query.includes('react')) {
    return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80';
  }
  if (query.includes('học') || query.includes('course') || query.includes('giáo dục') || query.includes('education') || query.includes('sách')) {
    return 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80';
  }
  if (query.includes('vé') || query.includes('bay') || query.includes('flight') || query.includes('plane') || query.includes('vé máy bay')) {
    return 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=80';
  }
  if (query.includes('du lịch') || query.includes('travel') || query.includes('tour') || query.includes('khách sạn') || query.includes('hotel')) {
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80';
  }
  if (theme === 'sale-theme') {
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80';
  }
  if (theme === 'education-theme') {
    return 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80';
  }
  if (theme === 'saleticket-theme') {
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80';
};

// AI Page generator
router.post('/generate-ai', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt, theme, useCase } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Mô tả (prompt) là bắt buộc.' });
      return;
    }

    const ai = getAiConfig('/chat/completions');
    if (!ai.apiKey) {
      res.status(400).json({ error: 'Chưa cấu hình API Key AI. Vui lòng kiểm tra file .env.' });
      return;
    }

    const THEME_COLORS: Record<string, {
      heroBg: string;
      heroText: string;
      featuresBg: string;
      featuresText: string;
      pricingBg: string;
      pricingText: string;
      formBg: string;
      formText: string;
    }> = {
      'ocean-breeze': { heroBg: '#f0f9ff', heroText: '#1e3a8a', featuresBg: '#ffffff', featuresText: '#0369a1', pricingBg: '#e0f2fe', pricingText: '#0369a1', formBg: '#f0f9ff', formText: '#1e3a8a' },
      'sunny-meadow': { heroBg: '#f0fdf4', heroText: '#064e3b', featuresBg: '#ffffff', featuresText: '#15803d', pricingBg: '#dcfce7', pricingText: '#15803d', formBg: '#f0fdf4', formText: '#064e3b' },
      'sunset-glow': { heroBg: '#fff7ed', heroText: '#7c2d12', featuresBg: '#ffffff', featuresText: '#c2410c', pricingBg: '#ffedd5', pricingText: '#c2410c', formBg: '#fff7ed', formText: '#7c2d12' },
      'vibrant-orchid': { heroBg: '#faf5ff', heroText: '#581c87', featuresBg: '#ffffff', featuresText: '#7e22ce', pricingBg: '#f3e8ff', pricingText: '#7e22ce', formBg: '#faf5ff', formText: '#581c87' },
      'minimalist-light': { heroBg: '#f8fafc', heroText: '#0f172a', featuresBg: '#ffffff', featuresText: '#334155', pricingBg: '#f1f5f9', pricingText: '#334155', formBg: '#f8fafc', formText: '#0f172a' },
      'sale-theme': { heroBg: '#fffdf9', heroText: '#2d1a03', featuresBg: '#ffffff', featuresText: '#451a03', pricingBg: '#fff7ed', pricingText: '#c2410c', formBg: '#fffdf9', formText: '#2d1a03' },
      'education-theme': { heroBg: '#ffffff', heroText: '#1e293b', featuresBg: '#f8fafc', featuresText: '#0f172a', pricingBg: '#fff7ed', pricingText: '#f05123', formBg: '#ffffff', formText: '#1e293b' },
      'saleticket-theme': { heroBg: '#f0f9ff', heroText: '#0f172a', featuresBg: '#ffffff', featuresText: '#1e3a8a', pricingBg: '#e0f2fe', pricingText: '#0284c7', formBg: '#f0f9ff', formText: '#0f172a' }
    };

    const selectedTheme = theme && THEME_COLORS[theme] ? theme : 'ocean-breeze';
    const themeInfo = THEME_COLORS[selectedTheme];

    let layoutInstructions = '';
    if (useCase === 'saas') {
      layoutInstructions = 'Thiết kế bố cục kiểu SaaS/Phần mềm. Thứ tự các khối nên là: hero -> features -> testimonials -> form (đăng ký dùng thử) -> faq -> footer.';
    } else if (useCase === 'course') {
      layoutInstructions = 'Thiết kế bố cục kiểu Khoá học/E-book. Thứ tự các khối nên là: hero -> features -> testimonials -> countdown (giới hạn ưu đãi học phí) -> pricing (đăng ký khoá học) -> faq -> footer.';
    } else if (useCase === 'ecommerce') {
      layoutInstructions = 'Thiết kế bố cục kiểu Bán sản phẩm/E-commerce. Thứ tự các khối nên là: hero -> features -> testimonials -> pricing (gói sản phẩm, hỗ trợ direct checkout bằng cách điền productId nếu có) -> faq -> footer.';
    } else if (useCase === 'service') {
      layoutInstructions = 'Thiết kế bố cục kiểu Dịch vụ (Yoga, Spa, Agency). Thứ tự các khối nên là: hero -> features -> testimonials -> form (để lại yêu cầu tư vấn) -> faq -> footer.';
    } else if (useCase === 'event') {
      layoutInstructions = 'Thiết kế bố cục kiểu Sự kiện/Webinar. Thứ tự các khối nên là: hero -> countdown (thời gian đếm ngược đến sự kiện) -> features -> form (đăng ký vé tham gia) -> footer.';
    } else if (useCase === 'sale-theme') {
      layoutInstructions = 'Học theo thiết kế cothaotomca.vn (Bố cục & màu sắc ấm cúng): Tông màu chủ đạo ấm cúng, đậm vị quê hương (cam đỏ, nâu gỗ, vàng nhạt). Bố cục: hero (Slogan nhấn mạnh tính nguyên chất, tự nhiên của sản phẩm người dùng) -> features (Các điểm nổi bật như chất lượng hàng đầu, nguồn gốc tự nhiên, chế biến mẻ mới mỗi ngày) -> pricing (Hiển thị các gói sản phẩm của người dùng với giá bắt đầu bằng "chỉ từ ... VNĐ") -> testimonials (Nhận xét của thực khách/khách hàng) -> footer. LƯU Ý: Nội dung các khối và tên sản phẩm phải hoàn toàn trùng khớp với chủ đề mà người dùng yêu cầu ở prompt (ví dụ nếu bán mật ong thì sinh sản phẩm mật ong, tuyệt đối KHÔNG sinh hải sản ngâm tương của Cô Thảo).';
    } else if (useCase === 'education-theme') {
      layoutInstructions = 'Học theo thiết kế f8.edu.vn (Khóa học/Đào tạo): Thiết kế trẻ trung, hiện đại, màu cam nhấn đặc trưng. Bố cục: hero (Banner giới thiệu định hướng/lộ trình học từ số 0 theo chủ đề người dùng yêu cầu) -> features (Lộ trình chi tiết chia thành các chặng/bước học bài bản) -> testimonials (Đánh giá học viên đi trước) -> pricing (Đăng ký gói học/combo ưu đãi) -> faq (Hỏi đáp thắc mắc liên quan) -> footer. LƯU Ý: Nội dung các khối và tên sản phẩm phải hoàn toàn trùng khớp với chủ đề mà người dùng yêu cầu ở prompt (ví dụ nếu bán mật ong thì sinh khóa học/gói học về nuôi ong hoặc kinh doanh nông sản, tuyệt đối KHÔNG sinh các khóa học lập trình Javascript/React của F8).';
    } else if (useCase === 'saleticket-theme') {
      layoutInstructions = 'Học theo thiết kế happybooktravel.com (Đặt vé/Du lịch/Combo): Tone màu xanh biển, trời tươi sáng. Bố cục: hero (Banner giới thiệu kèm một đoạn text widget tìm kiếm/đặt trước sản phẩm của người dùng) -> features (Các tiện ích đi kèm chất lượng cao, dịch vụ hỗ trợ chu đáo) -> pricing (Bảng giá các gói sản phẩm/combo dịch vụ theo yêu cầu người dùng) -> form (Form đăng ký tư vấn nhận ưu đãi nhanh) -> footer. LƯU Ý: Nội dung các khối và tên sản phẩm phải hoàn toàn trùng khớp với chủ đề mà người dùng yêu cầu ở prompt (ví dụ nếu bán mật ong thì sinh gói combo mật ong đặc sản, tuyệt đối KHÔNG sinh chặng bay hay tour du lịch của HappyBook).';
    } else {
      layoutInstructions = 'Thiết kế bố cục cơ bản: hero -> features -> testimonials -> form -> faq -> footer.';
    }

    const systemInstructions = `Bạn là một kỹ sư thiết kế Landing Page AI chuyên nghiệp kiêm chuyên gia Copywriter chuyển đổi cao (Conversion Copywriting).
Nhiệm vụ của bạn là tạo ra cấu trúc trang web Landing Page tuyệt đẹp dưới dạng một mảng JSON các khối PageBlock theo đúng định dạng được yêu cầu.

Các loại khối (block.type) được hỗ trợ:
1. "hero": Banner chính (title, subtitle, buttonText, buttonLink, imageUrl, imageAlignment: "left"|"right"|"center", backgroundColor, textColor).
2. "features": Các lợi ích nổi bật (title, items: string[], backgroundColor, textColor).
3. "form": Biểu mẫu đăng ký (title, subtitle, formId: "", backgroundColor, textColor).
4. "pricing": Bảng giá sản phẩm (title, subtitle, priceVal: "499.000đ", buttonText: "Mua ngay", buttonLink: "#register-form", backgroundColor, textColor, productId: "").
5. "footer": Chân trang (title, subtitle, backgroundColor, textColor).
6. "countdown": Đồng hồ đếm ngược (title, subtitle, countdownEnd: "2026-06-30T23:59:00", backgroundColor, textColor).
7. "testimonials": Đánh giá khách hàng (title, reviews: [{name, role, rating: 5, quote, avatar: ""}], backgroundColor, textColor).
8. "faq": Câu hỏi thường gặp (title, faqs: [{question, answer}], backgroundColor, textColor).

Quy quy tắc thiết kế & Copywriting quan trọng:
1. Áp dụng các công thức viết lời quảng cáo kinh doanh chuyên sâu như AIDA (Attention, Interest, Desire, Action) hoặc PAS (Pain, Agitate, Solve):
   - Tiêu đề Hero (title) phải cực kỳ cuốn hút, đánh trúng nhu cầu hoặc mong muốn lớn nhất của khách hàng (ví dụ: "Chinh phục tiếng Anh giao tiếp trôi chảy sau 3 tháng" thay vì "Khóa học tiếng Anh").
   - Phụ đề Hero (subtitle) phải làm rõ giải pháp hoặc lợi thế độc bản (USP), tạo sự tò mò hoặc cam kết rõ ràng.
   - Các lợi ích (features.items) phải được viết dưới dạng "Tính năng đi kèm Lợi ích thực tế" chứ không chỉ liệt kê kỹ thuật (ví dụ: "Học 1 kèm 1 với giáo viên bản ngữ - Giúp sửa phát âm chuẩn xác ngay lập tức" thay vì "Giáo viên bản ngữ").
   - Testimonials (đánh giá): Hãy viết các nhận xét đầy thuyết phục, nêu rõ sự thay đổi trước và sau khi sử dụng sản phẩm/dịch vụ của khách hàng.
   - FAQ (câu hỏi thường gặp): Trả lời trực diện vào các mối lo ngại lớn nhất về giá cả, thời gian, sự cam kết hoàn tiền hoặc bảo hành để củng cố niềm tin.
2. Thứ tự và bố cục khối: ${layoutInstructions}
3. Tạo ra tối thiểu 4 khối và tối đa 7 khối. Hãy viết tiêu đề, nội dung và các câu hỏi/lợi ích bằng tiếng Việt thật tự nhiên, lưu loát, chuyên nghiệp và có tính thuyết phục cao.
4. Luôn sử dụng tông màu chuyên nghiệp, tinh tế dựa trên cấu hình theme được chọn sau đây:
   - Màu nền Hero: ${themeInfo.heroBg}, màu chữ Hero: ${themeInfo.heroText}
   - Màu nền Features: ${themeInfo.featuresBg}, màu chữ Features: ${themeInfo.featuresText}
   - Màu nền Pricing: ${themeInfo.pricingBg}, màu chữ Pricing: ${themeInfo.pricingText}
   - Màu nền Form: ${themeInfo.formBg}, màu chữ Form: ${themeInfo.formText}
   - Màu nền Testimonials/Faq/Footer nên dùng màu nền sáng dịu như #ffffff, #f8fafc hoặc màu nền đồng tông nhẹ nhàng khác.
5. Đối với ảnh (imageUrl) trong Hero: Hãy chọn hình ảnh chất lượng từ Unsplash tương thích với chủ đề. Ví dụ ảnh công nghệ/lập trình: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop", ảnh hải sản/món ăn: "https://images.unsplash.com/photo-1534080391025-09795d197360?w=800&auto=format&fit=crop", ảnh máy bay/du lịch: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop", vv.
6. Chỉ trả về MẢNG JSON HỢP LỆ dạng PageBlock[].
7. KHÔNG bao bọc kết quả bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.`;

    let response = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: `Hãy sinh các khối Landing Page tuyệt đẹp cho chủ đề sau: ${prompt}` }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok && ai.apiKey.startsWith('sk-or-')) {
      console.warn(`[AI Landing Page] Primary model ${ai.model} failed (${response.status}). Trying fallback Llama...`);
      response = await fetchWithRetry(ai.url, {
        method: 'POST',
        headers: ai.headers,
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: `Hãy sinh các khối Landing Page tuyệt đẹp cho chủ đề sau: ${prompt}` }
          ],
          temperature: 0.8,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(90000),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).json({ error: `AI API returned status ${response.status}: ${errText}` });
      return;
    }

    const data = await response.json() as any;
    const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';

    try {
      const parsed = parseAiJson(contentText);
      if (Array.isArray(parsed)) {
        // Add random ID if not present and ensure high-quality themed images
        const processed = parsed.map((b: any, idx: number) => {
          let imageUrl = b.imageUrl;
          if (b.type === 'hero') {
            if (!imageUrl || imageUrl.startsWith('/') || !imageUrl.startsWith('http')) {
              imageUrl = getThemedUnsplashImage(theme || '', prompt || '');
            }
          }
          return {
            ...b,
            imageUrl,
            id: b.id || `block-ai-${Date.now()}-${idx}`
          };
        });
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

router.post('/:id/share-facebook', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { connectionIds, message } = req.body;
    
    if (!connectionIds || !Array.isArray(connectionIds) || connectionIds.length === 0) {
      res.status(400).json({ error: 'Vui lòng chọn ít nhất một Fanpage để chia sẻ.' });
      return;
    }

    const page = await prisma.landingPage.findUnique({ where: { id } });
    if (!page) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page' });
      return;
    }

    const { dispatchToPlatform } = await import('../lib/dispatch');
    const results = [];

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const landingPageUrl = `${frontendUrl}/p/${page.slug}`;

    for (const connId of connectionIds) {
      const conn = await prisma.socialConnection.findFirst({
        where: { id: connId, platform: 'facebook', workspaceId: req.workspaceId }
      });
      if (!conn) {
        results.push({ connectionId: connId, success: false, message: 'Không tìm thấy kết nối Facebook' });
        continue;
      }

      const utmUrl = `${landingPageUrl}?utm_source=facebook&utm_medium=social&utm_campaign=share_landing&utm_term=${encodeURIComponent(conn.pageName || '')}`;

      try {
        const result = await dispatchToPlatform('facebook', {
          title: page.title,
          content: message || `Khám phá trang mới của chúng tôi: ${page.title}`,
          urlTarget: utmUrl,
          workspaceId: req.workspaceId,
          connectionId: conn.id
        });
        results.push({
          connectionId: connId,
          pageName: conn.pageName,
          success: result.success,
          message: result.message
        });
      } catch (err: any) {
        results.push({
          connectionId: connId,
          pageName: conn.pageName,
          success: false,
          message: err.message
        });
      }
    }

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi chia sẻ lên Fanpage' });
  }
});

export default router;

