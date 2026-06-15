import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Generate unique short code
function generateCode(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 1. GET /shortlinks - List short links for workspace
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const links = await prisma.shortLink.findMany({
      where: { workspaceId: req.workspaceId! },
      include: {
        _count: {
          select: { clicks: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Map click count cleanly
    const mapped = links.map(link => ({
      ...link,
      clickCount: link._count.clicks,
    }));
    
    res.json(mapped);
  } catch (error: any) {
    console.error('[GET /shortlinks]', error);
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách links' });
  }
});

// 2. POST /shortlinks - Create a short link
router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { originalUrl, code, title, utmSource, utmMedium, utmCampaign } = req.body;
  
  if (!originalUrl) {
    res.status(400).json({ error: 'Đường dẫn gốc (originalUrl) là bắt buộc' });
    return;
  }
  
  try {
    let finalCode = code?.trim();
    if (finalCode) {
      // Check if code is alphanumeric and correct length
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(finalCode)) {
        res.status(400).json({ error: 'Mã rút gọn chỉ chứa ký tự chữ, số, gạch dưới, gạch ngang và dài từ 3-30 ký tự' });
        return;
      }
      
      // Check code uniqueness
      const existing = await prisma.shortLink.findUnique({
        where: { code: finalCode }
      });
      if (existing) {
        res.status(400).json({ error: 'Mã rút gọn này đã tồn tại, vui lòng chọn mã khác' });
        return;
      }
    } else {
      // Generate unique random code
      let attempts = 0;
      while (attempts < 10) {
        const candidate = generateCode(6);
        const existing = await prisma.shortLink.findUnique({
          where: { code: candidate }
        });
        if (!existing) {
          finalCode = candidate;
          break;
        }
        attempts++;
      }
      if (!finalCode) {
        res.status(500).json({ error: 'Không thể tạo mã rút gọn ngẫu nhiên. Vui lòng thử lại.' });
        return;
      }
    }
    
    const shortLink = await prisma.shortLink.create({
      data: {
        workspaceId: req.workspaceId!,
        code: finalCode,
        originalUrl: originalUrl.trim(),
        title: title?.trim() || null,
        utmSource: utmSource?.trim() || null,
        utmMedium: utmMedium?.trim() || null,
        utmCampaign: utmCampaign?.trim() || null,
      }
    });
    
    res.status(201).json(shortLink);
  } catch (error: any) {
    console.error('[POST /shortlinks]', error);
    res.status(500).json({ error: error.message || 'Lỗi tạo link rút gọn' });
  }
});

// 3. DELETE /shortlinks/:id - Delete short link
router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  try {
    const link = await prisma.shortLink.findFirst({
      where: { id, workspaceId: req.workspaceId! }
    });
    if (!link) {
      res.status(404).json({ error: 'Không tìm thấy link rút gọn hoặc bạn không có quyền' });
      return;
    }
    
    await prisma.shortLink.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa link rút gọn thành công' });
  } catch (error: any) {
    console.error('[DELETE /shortlinks/:id]', error);
    res.status(500).json({ error: error.message || 'Lỗi xóa link rút gọn' });
  }
});

// 4. GET /shortlinks/:id/analytics - Get short link click analytics
router.get('/:id/analytics', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  try {
    const link = await prisma.shortLink.findFirst({
      where: { id, workspaceId: req.workspaceId! }
    });
    if (!link) {
      res.status(404).json({ error: 'Không tìm thấy link rút gọn hoặc bạn không có quyền' });
      return;
    }
    
    // Get all clicks for this link
    const clicks = await prisma.shortLinkClick.findMany({
      where: { shortLinkId: id },
      orderBy: { clickedAt: 'asc' },
    });
    
    // Group clicks by date (last 7 days)
    const clicksByDate: Record<string, number> = {};
    const referrers: Record<string, number> = {};
    const devices: Record<string, number> = {};
    
    // Initialize dates for last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      clicksByDate[dateStr] = 0;
    }
    
    clicks.forEach(click => {
      const dateStr = click.clickedAt.toISOString().split('T')[0];
      clicksByDate[dateStr] = (clicksByDate[dateStr] || 0) + 1;
      
      // Group by referrer domain
      let ref = 'Direct/None';
      if (click.referrer) {
        try {
          ref = new URL(click.referrer).hostname;
        } catch {
          ref = click.referrer;
        }
      }
      referrers[ref] = (referrers[ref] || 0) + 1;
      
      // Group by device
      const dev = click.deviceType || 'desktop';
      devices[dev] = (devices[dev] || 0) + 1;
    });
    
    // Format response arrays
    const clicksTimeline = Object.entries(clicksByDate).map(([date, count]) => ({ date, count }));
    const referrerBreakdown = Object.entries(referrers).map(([referrer, count]) => ({ referrer, count }));
    const deviceBreakdown = Object.entries(devices).map(([device, count]) => ({ device, count }));
    
    res.json({
      link,
      clicksTimeline,
      referrerBreakdown,
      deviceBreakdown,
    });
  } catch (error: any) {
    console.error('[GET /shortlinks/:id/analytics]', error);
    res.status(500).json({ error: error.message || 'Lỗi lấy thống kê phân tích' });
  }
});

export default router;
