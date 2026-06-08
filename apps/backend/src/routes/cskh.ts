import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWrite } from '../middleware/auth';
import { WorkspaceRequest } from '../middleware/workspace';

const router = Router();

// Load CSKH Config
router.get('/config', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    let config = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });
    if (!config) {
      config = await prisma.cskhConfig.create({
        data: {
          workspaceId: req.workspaceId,
          liveChatEnabled: false,
          aiChatbotEnabled: false,
        },
      });
    }
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy cấu hình CSKH' });
  }
});

// Save CSKH Config
router.post('/config', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const {
      liveChatEnabled,
      aiChatbotEnabled,
      knowledgeBaseText,
      notificationChannels,
      followUpDelayHours,
      followUpEmailSubject,
      followUpEmailBody,
      // new fields
      autoCareEnabled,
      autoCareScheduleType,
      autoCareDelayHours,
      autoCareIntervalDays,
      autoCareEmailSubject,
      autoCareEmailBody,
      autoCareChannels,
    } = req.body;

    const existing = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    const delayHours = followUpDelayHours !== undefined ? (followUpDelayHours === null ? null : parseInt(String(followUpDelayHours), 10)) : undefined;

    let config;
    if (existing) {
      config = await prisma.cskhConfig.update({
        where: { id: existing.id },
        data: {
          liveChatEnabled: liveChatEnabled !== undefined ? !!liveChatEnabled : existing.liveChatEnabled,
          aiChatbotEnabled: aiChatbotEnabled !== undefined ? !!aiChatbotEnabled : existing.aiChatbotEnabled,
          knowledgeBaseText: knowledgeBaseText !== undefined ? knowledgeBaseText : existing.knowledgeBaseText,
          notificationChannels: notificationChannels !== undefined ? notificationChannels : existing.notificationChannels,
          followUpDelayHours: delayHours !== undefined ? delayHours : existing.followUpDelayHours,
          followUpEmailSubject: followUpEmailSubject !== undefined ? followUpEmailSubject : existing.followUpEmailSubject,
          followUpEmailBody: followUpEmailBody !== undefined ? followUpEmailBody : existing.followUpEmailBody,
          // new fields
          autoCareEnabled: autoCareEnabled !== undefined ? !!autoCareEnabled : existing.autoCareEnabled,
          autoCareScheduleType: autoCareScheduleType !== undefined ? autoCareScheduleType : existing.autoCareScheduleType,
          autoCareDelayHours: autoCareDelayHours !== undefined ? parseInt(String(autoCareDelayHours), 10) : existing.autoCareDelayHours,
          autoCareIntervalDays: autoCareIntervalDays !== undefined ? parseInt(String(autoCareIntervalDays), 10) : existing.autoCareIntervalDays,
          autoCareEmailSubject: autoCareEmailSubject !== undefined ? autoCareEmailSubject : existing.autoCareEmailSubject,
          autoCareEmailBody: autoCareEmailBody !== undefined ? autoCareEmailBody : existing.autoCareEmailBody,
          autoCareChannels: autoCareChannels !== undefined ? autoCareChannels : existing.autoCareChannels,
        },
      });
    } else {
      config = await prisma.cskhConfig.create({
        data: {
          workspaceId: req.workspaceId,
          liveChatEnabled: !!liveChatEnabled,
          aiChatbotEnabled: !!aiChatbotEnabled,
          knowledgeBaseText: knowledgeBaseText || null,
          notificationChannels: notificationChannels || null,
          followUpDelayHours: delayHours !== undefined ? delayHours : 0,
          followUpEmailSubject: followUpEmailSubject || null,
          followUpEmailBody: followUpEmailBody || null,
          // new fields
          autoCareEnabled: !!autoCareEnabled,
          autoCareScheduleType: autoCareScheduleType || "AFTER_CREATION",
          autoCareDelayHours: autoCareDelayHours !== undefined ? parseInt(String(autoCareDelayHours), 10) : 24,
          autoCareIntervalDays: autoCareIntervalDays !== undefined ? parseInt(String(autoCareIntervalDays), 10) : 7,
          autoCareEmailSubject: autoCareEmailSubject || null,
          autoCareEmailBody: autoCareEmailBody || null,
          autoCareChannels: autoCareChannels || "email",
        },
      });
    }

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình CSKH' });
  }
});

// Get all Chat Sessions for the Workspace
router.get('/sessions', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách hội thoại' });
  }
});

// Get Chat Messages for a Chat Session
router.get('/sessions/:id/messages', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const session = await prisma.chatSession.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
      return;
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy tin nhắn hội thoại' });
  }
});

// Send Agent Reply (Human Takeover)
router.post('/sessions/:id/send-agent', authenticate, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id as string;
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: 'Nội dung tin nhắn không được trống' });
      return;
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, workspaceId: req.workspaceId },
    });

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
      return;
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        sender: 'agent',
        content: content.trim(),
      },
    });

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi gửi tin nhắn agent' });
  }
});

// Delete a Chat Session
router.delete('/sessions/:id', authenticate, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const session = await prisma.chatSession.findFirst({
      where: { id, workspaceId: req.workspaceId },
    });

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
      return;
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Đã xóa phiên hội thoại thành công' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi xóa phiên hội thoại' });
  }
});

export default router;
