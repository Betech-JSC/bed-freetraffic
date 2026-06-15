import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 1. GET /popups - List all popups in workspace
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const popups = await prisma.popupWidget.findMany({
      where: { workspaceId: req.workspaceId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(popups);
  } catch (error: any) {
    console.error('[GET /popups]', error);
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách Popups' });
  }
});

// 2. POST /popups - Create a popup widget configuration
router.post('/', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, type, delaySeconds, scrollDepth, title, description, buttonText, formFields, themeColor, isActive } = req.body;
  if (!name || !type || !title || !description) {
    res.status(400).json({ error: 'Tên, loại kích hoạt, tiêu đề và mô tả là bắt buộc' });
    return;
  }

  try {
    const popup = await prisma.popupWidget.create({
      data: {
        workspaceId: req.workspaceId!,
        name,
        type,
        delaySeconds: delaySeconds != null ? parseInt(delaySeconds) : 5,
        scrollDepth: scrollDepth != null ? parseInt(scrollDepth) : 50,
        title,
        description,
        buttonText: buttonText || 'Đăng ký',
        formFields: formFields || 'email',
        themeColor: themeColor || '#e85d26',
        isActive: isActive !== false,
      }
    });
    res.status(201).json(popup);
  } catch (error: any) {
    console.error('[POST /popups]', error);
    res.status(500).json({ error: error.message || 'Lỗi tạo cấu hình popup' });
  }
});

// 3. PUT /popups/:id - Update popup widget configuration
router.put('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { name, type, delaySeconds, scrollDepth, title, description, buttonText, formFields, themeColor, isActive } = req.body;

  try {
    const existing = await prisma.popupWidget.findFirst({
      where: { id, workspaceId: req.workspaceId! }
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy popup hoặc bạn không có quyền' });
      return;
    }

    const updated = await prisma.popupWidget.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        type: type !== undefined ? type : existing.type,
        delaySeconds: delaySeconds !== undefined ? parseInt(delaySeconds) : existing.delaySeconds,
        scrollDepth: scrollDepth !== undefined ? parseInt(scrollDepth) : existing.scrollDepth,
        title: title !== undefined ? title : existing.title,
        description: description !== undefined ? description : existing.description,
        buttonText: buttonText !== undefined ? buttonText : existing.buttonText,
        formFields: formFields !== undefined ? formFields : existing.formFields,
        themeColor: themeColor !== undefined ? themeColor : existing.themeColor,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      }
    });
    res.json(updated);
  } catch (error: any) {
    console.error('[PUT /popups/:id]', error);
    res.status(500).json({ error: error.message || 'Lỗi cập nhật popup' });
  }
});

// 4. DELETE /popups/:id - Delete popup widget configuration
router.delete('/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  try {
    const existing = await prisma.popupWidget.findFirst({
      where: { id, workspaceId: req.workspaceId! }
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy popup hoặc bạn không có quyền' });
      return;
    }

    await prisma.popupWidget.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa popup thành công' });
  } catch (error: any) {
    console.error('[DELETE /popups/:id]', error);
    res.status(500).json({ error: error.message || 'Lỗi xóa popup' });
  }
});

export default router;
