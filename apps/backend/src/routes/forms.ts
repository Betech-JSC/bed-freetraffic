import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();

// Get list of forms
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const forms = await prisma.customForm.findMany({
      where: { workspaceId: req.workspaceId },
      include: { landingPage: { select: { title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(forms);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách form' });
  }
});

// Get single form details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const form = await prisma.customForm.findFirst({
      where: { id, workspaceId: req.workspaceId },
      include: { landingPage: true },
    });
    if (!form) {
      res.status(404).json({ error: 'Không tìm thấy form' });
      return;
    }
    res.json(form);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy chi tiết form' });
  }
});

// Get submissions for a form
router.get('/:id/submissions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const form = await prisma.customForm.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!form) {
      res.status(404).json({ error: 'Không tìm thấy form để xem dữ liệu' });
      return;
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId: id, workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách đăng ký form' });
  }
});

// Create new form
router.post('/', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, fieldsJson, landingPageId } = req.body;
    if (!name || !fieldsJson) {
      res.status(400).json({ error: 'Tên form và cấu trúc trường (fieldsJson) là bắt buộc.' });
      return;
    }

    // Parse fieldsJson to validate it is valid JSON
    try {
      JSON.parse(fieldsJson);
    } catch {
      res.status(400).json({ error: 'fieldsJson phải là một chuỗi JSON hợp lệ.' });
      return;
    }

    const form = await prisma.customForm.create({
      data: {
        name,
        fieldsJson,
        landingPageId: landingPageId ? parseInt(landingPageId) : null,
        workspaceId: req.workspaceId,
      },
    });

    res.status(201).json(form);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tạo form mới' });
  }
});

// Update form
router.put('/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, fieldsJson, landingPageId } = req.body;

    const existing = await prisma.customForm.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy form để cập nhật' });
      return;
    }

    if (fieldsJson) {
      try {
        JSON.parse(fieldsJson);
      } catch {
        res.status(400).json({ error: 'fieldsJson phải là một chuỗi JSON hợp lệ.' });
        return;
      }
    }

    const updated = await prisma.customForm.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        fieldsJson: fieldsJson !== undefined ? fieldsJson : existing.fieldsJson,
        landingPageId: landingPageId !== undefined ? (landingPageId ? parseInt(landingPageId) : null) : existing.landingPageId,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật form' });
  }
});

// Delete form
router.delete('/:id', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.customForm.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy form để xóa' });
      return;
    }
    await prisma.customForm.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xóa form' });
  }
});

export default router;
