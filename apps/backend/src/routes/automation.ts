import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Lấy danh sách nhiệm vụ Automation
router.get('/tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await prisma.automationTask.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('[automation/tasks GET]', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Tạo nhiệm vụ mới (Thêm Bot)
router.post('/tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, urlTarget, platforms, interval, emailRecipients, abTestId, useAi, aiPrompt, aiGenerateImage, rssUrl } = req.body;
    
    if (!name || !urlTarget || !platforms) {
      res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
      return;
    }

    const newTask = await prisma.automationTask.create({
      data: {
        name,
        urlTarget,
        platforms: JSON.stringify(platforms),
        emailRecipients: emailRecipients || null,
        abTestId: abTestId ? parseInt(String(abTestId), 10) : null,
        interval: interval || 60,
        useAi: !!useAi,
        aiPrompt: aiPrompt || null,
        aiGenerateImage: !!aiGenerateImage,
        rssUrl: rssUrl || null,
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Công tắc Bật/Tắt Bot
router.post('/tasks/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const task = await prisma.automationTask.findUnique({ where: { id }});
    
    if (!task) {
      res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
      return;
    }

    const newStatus = task.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';
    const updatedTask = await prisma.automationTask.update({
      where: { id },
      data: { status: newStatus }
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Xóa chiến dịch Bot (log liên quan xóa theo cascade)
router.delete('/tasks/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'ID không hợp lệ' });
      return;
    }

    const task = await prisma.automationTask.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
      return;
    }

    await prisma.automationTask.delete({ where: { id } });
    res.json({ success: true, message: `Đã xóa chiến dịch "${task.name}"` });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Lấy Log của tất cả Bot để hiển thị lên bảng điều khiển Hacker-style
router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await prisma.botLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    const taskIds = [...new Set(logs.map((l) => l.taskId))];
    const tasks =
      taskIds.length > 0
        ? await prisma.automationTask.findMany({
            where: { id: { in: taskIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(tasks.map((t) => [t.id, t.name]));
    res.json(
      logs.map((log) => ({
        ...log,
        task: { name: nameById.get(log.taskId) ?? 'Chiến dịch đã xóa' },
      }))
    );
  } catch (error) {
    console.error('[automation/logs]', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

export default router;
