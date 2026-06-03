import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';

const router = Router();

// Load CSKH Config
router.get('/config', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
router.post('/config', authenticate, requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { liveChatEnabled, aiChatbotEnabled, knowledgeBaseText, notificationChannels } = req.body;

    const existing = await prisma.cskhConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    let config;
    if (existing) {
      config = await prisma.cskhConfig.update({
        where: { id: existing.id },
        data: {
          liveChatEnabled: liveChatEnabled !== undefined ? !!liveChatEnabled : existing.liveChatEnabled,
          aiChatbotEnabled: aiChatbotEnabled !== undefined ? !!aiChatbotEnabled : existing.aiChatbotEnabled,
          knowledgeBaseText: knowledgeBaseText !== undefined ? knowledgeBaseText : existing.knowledgeBaseText,
          notificationChannels: notificationChannels !== undefined ? notificationChannels : existing.notificationChannels,
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
        },
      });
    }

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình CSKH' });
  }
});

export default router;
