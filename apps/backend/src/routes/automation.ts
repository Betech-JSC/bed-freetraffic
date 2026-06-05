import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Lấy danh sách nhiệm vụ Automation
router.get('/tasks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tasks = await prisma.automationTask.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('[automation/tasks GET]', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Tạo nhiệm vụ mới (Thêm Bot)
router.post('/tasks', async (req: AuthRequest, res: Response): Promise<void> => {
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
        workspaceId: req.workspaceId,
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Công tắc Bật/Tắt Bot
router.post('/tasks/:id/toggle', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const task = await prisma.automationTask.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
    
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
router.delete('/tasks/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'ID không hợp lệ' });
      return;
    }

    const task = await prisma.automationTask.findFirst({
      where: { id, workspaceId: req.workspaceId }
    });
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
router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tasksInWorkspace = await prisma.automationTask.findMany({
      where: { workspaceId: req.workspaceId },
      select: { id: true, name: true }
    });
    
    const taskIds = tasksInWorkspace.map((t) => t.id);
    const logs = taskIds.length > 0
      ? await prisma.botLog.findMany({
          where: { taskId: { in: taskIds } },
          take: 100,
          orderBy: { createdAt: 'desc' },
        })
      : [];
      
    const nameById = new Map(tasksInWorkspace.map((t) => [t.id, t.name]));
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

// GET list of email workflows in workspace
router.get('/workflows', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workflows = await prisma.emailWorkflow.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        form: { select: { id: true, name: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(workflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách kịch bản email' });
  }
});

// CREATE a new email workflow
router.post('/workflows', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, triggerType, triggerFormId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Tên kịch bản là bắt buộc.' });
      return;
    }
    const workflow = await prisma.emailWorkflow.create({
      data: {
        name,
        triggerType: triggerType || 'FORM_SUBMISSION',
        triggerFormId: triggerFormId ? parseInt(String(triggerFormId), 10) : null,
        workspaceId: req.workspaceId,
        isActive: false,
      },
    });
    res.status(201).json(workflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi tạo kịch bản email mới' });
  }
});

// UPDATE email workflow details
router.put('/workflows/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, triggerType, triggerFormId } = req.body;

    const existing = await prisma.emailWorkflow.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy kịch bản' });
      return;
    }

    const updated = await prisma.emailWorkflow.update({
      where: { id },
      data: {
        name: name || existing.name,
        triggerType: triggerType || existing.triggerType,
        triggerFormId: triggerFormId !== undefined ? (triggerFormId ? parseInt(String(triggerFormId), 10) : null) : existing.triggerFormId,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi cập nhật kịch bản' });
  }
});

// DELETE email workflow
router.delete('/workflows/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const existing = await prisma.emailWorkflow.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy kịch bản' });
      return;
    }

    await prisma.emailWorkflow.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa kịch bản thành công' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xóa kịch bản' });
  }
});

// TOGGLE email workflow active status
router.post('/workflows/:id/toggle', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { isActive } = req.body;

    const existing = await prisma.emailWorkflow.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy kịch bản' });
      return;
    }

    const updated = await prisma.emailWorkflow.update({
      where: { id },
      data: { isActive: isActive !== undefined ? !!isActive : !existing.isActive },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi đổi trạng thái hoạt động' });
  }
});

// SAVE email workflow steps (recreate all steps under a transaction)
router.put('/workflows/:id/steps', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { steps } = req.body;

    if (!Array.isArray(steps)) {
      res.status(400).json({ error: 'Danh sách các bước steps phải là mảng.' });
      return;
    }

    const existing = await prisma.emailWorkflow.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy kịch bản' });
      return;
    }

    await prisma.$transaction([
      prisma.emailWorkflowStep.deleteMany({
        where: { workflowId: id },
      }),
      prisma.emailWorkflowStep.createMany({
        data: steps.map((step: any, index: number) => ({
          workflowId: id,
          stepOrder: index + 1,
          actionType: step.actionType || 'SEND_EMAIL',
          delaySeconds: parseInt(String(step.delaySeconds), 10) || 0,
          emailSubject: step.emailSubject || 'Email tự động từ hệ thống',
          emailBody: step.emailBody || '',
        })),
      }),
    ]);

    res.json({ success: true, message: 'Đã lưu các bước của kịch bản thành công.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu các bước của kịch bản' });
  }
});

export default router;
