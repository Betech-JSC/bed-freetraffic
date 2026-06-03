import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

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
    const page = await prisma.landingPage.findFirst({
      where: { id, workspaceId: req.workspaceId },
      include: { forms: true },
    });
    if (!page) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page' });
      return;
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

    const existing = await prisma.landingPage.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page để cập nhật' });
      return;
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
    const existing = await prisma.landingPage.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy Landing Page để xóa' });
      return;
    }
    await prisma.landingPage.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xóa Landing Page' });
  }
});

export default router;
