import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { generateAiPostContent, generateAiImage } from '../services/aiGenerate';

const router = Router();

// Cấu hình thư mục lưu ảnh upload
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
  }
});

import { AuthRequest } from '../middleware/auth';
import { generateAiContentPlan } from '../services/aiGenerate';

// Lấy danh sách tất cả nội dung mẫu
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
    const templates = await prisma.postTemplate.findMany({
      where: taskId ? { taskId, workspaceId: req.workspaceId } : { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { task: { select: { name: true } } }
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Tạo nội dung mẫu mới (có kèm ảnh)
router.post('/', upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, taskId } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });
      return;
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const template = await prisma.postTemplate.create({
      data: {
        title,
        content,
        imageUrl,
        taskId: taskId ? parseInt(taskId) : null,
        workspaceId: req.workspaceId
      }
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Cập nhật nội dung mẫu
router.put('/:id', upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { title, content, taskId, isActive } = req.body;

    const existing = await prisma.postTemplate.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy mẫu nội dung' });
      return;
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (taskId !== undefined) updateData.taskId = taskId ? parseInt(taskId) : null;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;

    const template = await prisma.postTemplate.update({
      where: { id },
      data: updateData
    });

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Xóa nội dung mẫu
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    
    const existing = await prisma.postTemplate.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy mẫu nội dung' });
      return;
    }

    if (existing.imageUrl) {
      const filePath = path.join(__dirname, '../../', existing.imageUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.postTemplate.delete({ where: { id } });
    res.json({ message: 'Đã xóa thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Tạo bài viết tự động bằng AI (GPT + DALL-E)
router.post('/generate-ai', async (req: AuthRequest, res: Response): Promise<void> => {
  const { urlTarget, aiPrompt, generateImage } = req.body;
  if (!urlTarget?.trim()) {
    res.status(400).json({ error: 'URL đích là bắt buộc để AI phân tích' });
    return;
  }

  try {
    let result;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      let domain = 'website';
      try {
        domain = new URL(urlTarget).hostname.replace('www.', '');
      } catch {}
      result = {
        title: `⚡ Khám phá giải pháp từ ${domain}`,
        content: `🔥 Giải pháp tối ưu hóa doanh số và thu hút khách hàng tiềm năng bền vững. Khám phá chi tiết ngay tại {url}!\n\n#freeship #sales #traffic #viral`
      };
    } else {
      result = await generateAiPostContent(urlTarget, aiPrompt);
    }

    let imageUrl: string | null = null;
    if (generateImage) {
      if (!apiKey) {
        imageUrl = `https://picsum.photos/seed/${Math.round(Math.random() * 1000)}/800/600`;
      } else {
        imageUrl = await generateAiImage(aiPrompt || result.title || 'Marketing banner');
      }
    }

    res.json({
      title: result.title,
      content: result.content,
      imageUrl,
      isDemo: !apiKey
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi gọi AI GPT' });
  }
});

// Lên kế hoạch nội dung tự động bằng AI Copilot
router.post('/copilot-plan', async (req: AuthRequest, res: Response): Promise<void> => {
  const { topic, industry, tone, postCount } = req.body;
  if (!topic || !industry || !tone) {
    res.status(400).json({ error: 'Chủ đề, ngành nghề và giọng điệu là bắt buộc' });
    return;
  }

  try {
    const plan = await generateAiContentPlan(topic, industry, tone, postCount ? parseInt(postCount) : 5);
    res.json({
      plan,
      isDemo: !process.env.OPENAI_API_KEY
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi sinh kế hoạch nội dung' });
  }
});

// Lưu kế hoạch Copilot thành các mẫu nội dung
router.post('/copilot-save', async (req: AuthRequest, res: Response): Promise<void> => {
  const { plan } = req.body;
  if (!Array.isArray(plan) || plan.length === 0) {
    res.status(400).json({ error: 'Kế hoạch không hợp lệ' });
    return;
  }

  try {
    const createdTemplates = [];
    for (const item of plan) {
      const template = await prisma.postTemplate.create({
        data: {
          title: item.title,
          content: item.content,
          workspaceId: req.workspaceId
        }
      });
      createdTemplates.push(template);
    }
    res.status(201).json({
      message: `Đã lưu thành công ${createdTemplates.length} mẫu nội dung`,
      templates: createdTemplates
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu mẫu nội dung' });
  }
});

export default router;
