import { Router, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { normalizeCookie } from '../services/socialListeningScraper';

const router = Router();
router.use(authenticate);

/**
 * GET /api/listening/campaigns
 * Retrieves all social listening campaigns under the active workspace
 */
router.get('/campaigns', async (req: AuthRequest, res: Response): Promise<void> => {
  const campaigns = await prisma.socialListeningCampaign.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(campaigns);
});

/**
 * POST /api/listening/campaigns
 * Creates a new social listening campaign
 */
router.post('/campaigns', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    name,
    keywords,
    excludeKeywords,
    groupUrls,
    facebookCookie,
    useAi,
    telegramEnabled,
    telegramBotToken,
    telegramChatId,
    scanInterval,
    minScore,
    enableSemanticFilter,
    semanticThreshold,
    targetAudience,
    scrapeComments
  } = req.body;

  if (!name || !keywords || !groupUrls) {
    res.status(400).json({ error: 'Tên chiến dịch, từ khóa và danh sách nhóm Facebook là bắt buộc.' });
    return;
  }

  const testNormalized = facebookCookie ? normalizeCookie(facebookCookie) : null;
  const interval = scanInterval ? Math.max(5, parseInt(scanInterval as string, 10)) : 15;
  
  let scoreThreshold = 50;
  if (minScore !== undefined) {
    scoreThreshold = Math.max(0, Math.min(100, parseInt(minScore as string, 10)));
  }

  const campaign = await prisma.socialListeningCampaign.create({
    data: {
      name,
      keywords,
      excludeKeywords: excludeKeywords || null,
      groupUrls,
      facebookCookie: facebookCookie || null,
      cookieStatus: testNormalized ? 'ACTIVE' : 'ERROR',
      useAi: useAi !== false,
      telegramEnabled: telegramEnabled !== false,
      telegramBotToken: telegramBotToken || null,
      telegramChatId: telegramChatId || null,
      workspaceId: req.workspaceId!,
      scanInterval: interval,
      minScore: scoreThreshold,
      enableSemanticFilter: enableSemanticFilter === true,
      semanticThreshold: semanticThreshold !== undefined ? parseFloat(semanticThreshold as string) : 0.70,
      targetAudience: targetAudience || null,
      scrapeComments: scrapeComments === true,
    },
  });

  res.status(201).json(campaign);
});

/**
 * PUT /api/listening/campaigns/:id
 * Updates an existing social listening campaign
 */
router.put('/campaigns/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.socialListeningCampaign.findFirst({
    where: { id, workspaceId: req.workspaceId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy chiến dịch để cập nhật.' });
    return;
  }

  const {
    name,
    keywords,
    excludeKeywords,
    groupUrls,
    facebookCookie,
    useAi,
    telegramEnabled,
    telegramBotToken,
    telegramChatId,
    isActive,
    scanInterval,
    minScore,
    enableSemanticFilter,
    semanticThreshold,
    targetAudience,
    scrapeComments
  } = req.body;

  let cookieStatus = existing.cookieStatus;
  let savedCookie = existing.facebookCookie;
  if (facebookCookie !== undefined) {
    savedCookie = facebookCookie || null;
    const testNormalized = facebookCookie ? normalizeCookie(facebookCookie) : null;
    cookieStatus = testNormalized ? 'ACTIVE' : 'ERROR';
  }

  let updatedInterval = existing.scanInterval;
  if (scanInterval !== undefined) {
    updatedInterval = Math.max(5, parseInt(scanInterval as string, 10));
  }

  let updatedMinScore = existing.minScore;
  if (minScore !== undefined) {
    updatedMinScore = Math.max(0, Math.min(100, parseInt(minScore as string, 10)));
  }

  const campaign = await prisma.socialListeningCampaign.update({
    where: { id },
    data: {
      name,
      keywords,
      excludeKeywords: excludeKeywords === undefined ? existing.excludeKeywords : (excludeKeywords || null),
      groupUrls: groupUrls === undefined ? existing.groupUrls : groupUrls,
      facebookCookie: facebookCookie === undefined ? existing.facebookCookie : savedCookie,
      cookieStatus,
      useAi: useAi === undefined ? existing.useAi : useAi,
      telegramEnabled: telegramEnabled === undefined ? existing.telegramEnabled : telegramEnabled,
      telegramBotToken: telegramBotToken === undefined ? existing.telegramBotToken : (telegramBotToken || null),
      telegramChatId: telegramChatId === undefined ? existing.telegramChatId : (telegramChatId || null),
      isActive: isActive === undefined ? existing.isActive : isActive,
      scanInterval: updatedInterval,
      minScore: updatedMinScore,
      enableSemanticFilter: enableSemanticFilter === undefined ? existing.enableSemanticFilter : (enableSemanticFilter === true),
      semanticThreshold: semanticThreshold === undefined ? existing.semanticThreshold : parseFloat(semanticThreshold as string),
      targetAudience: targetAudience === undefined ? existing.targetAudience : (targetAudience || null),
      scrapeComments: scrapeComments === undefined ? existing.scrapeComments : (scrapeComments === true),
    },
  });

  res.json(campaign);
});

/**
 * DELETE /api/listening/campaigns/:id
 * Deletes a social listening campaign
 */
router.delete('/campaigns/:id', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.socialListeningCampaign.findFirst({
    where: { id, workspaceId: req.workspaceId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy chiến dịch để xóa.' });
    return;
  }

  await prisma.socialListeningCampaign.delete({
    where: { id },
  });

  res.status(204).send();
});

/**
 * GET /api/listening/logs
 * Retrieves lead qualification logs for campaigns inside the active workspace
 */
router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const campaigns = await prisma.socialListeningCampaign.findMany({
    where: { workspaceId: req.workspaceId },
    select: { id: true },
  });

  const campaignIds = campaigns.map(c => c.id);
  const logs = campaignIds.length > 0
    ? await prisma.socialListeningLog.findMany({
        where: { campaignId: { in: campaignIds } },
        include: { campaign: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : [];

  const convertedCustomers = await prisma.customer.findMany({
    where: {
      workspaceId: req.workspaceId!,
      trafficSource: 'FACEBOOK_LISTENING'
    },
    select: {
      name: true,
      utmCampaign: true
    }
  });

  const logsWithConverted = logs.map(log => {
    const isConverted = convertedCustomers.some(
      c => c.name === log.postAuthor && c.utmCampaign === log.campaign.name
    );
    return {
      ...log,
      isConverted
    };
  });

  res.json(logsWithConverted);
});

/**
 * POST /api/listening/campaigns/:id/test-scan
 * Triggers an immediate crawler and qualifier test scan for a campaign
 */
router.post('/campaigns/:id/test-scan', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await prisma.socialListeningCampaign.findFirst({
    where: { id, workspaceId: req.workspaceId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy chiến dịch để chạy thử.' });
    return;
  }

  if (!existing.facebookCookie) {
    res.status(400).json({ error: 'Chiến dịch chưa được kết nối cookie Facebook. Vui lòng kết nối trước.' });
    return;
  }

  try {
    const { executeCampaignScan } = await import('../workers/socialListeningWorker');
    const result = await executeCampaignScan(existing.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi bất ngờ xảy ra khi chạy tiến trình.' });
  }
});

/**
 * POST /api/listening/update-cookie
 * Updates cookies for a specific campaign or all campaigns in the workspace
 */
router.post('/update-cookie', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { cookie, campaignId } = req.body;

  if (!cookie) {
    res.status(400).json({ error: 'Dữ liệu Cookie là bắt buộc.' });
    return;
  }

  const testNormalized = normalizeCookie(cookie);

  if (campaignId) {
    const parsedId = parseInt(campaignId, 10);
    const campaign = await prisma.socialListeningCampaign.findFirst({
      where: { id: parsedId, workspaceId: req.workspaceId },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Không tìm thấy chiến dịch chỉ định.' });
      return;
    }

    const updated = await prisma.socialListeningCampaign.update({
      where: { id: parsedId },
      data: {
        facebookCookie: cookie,
        cookieStatus: testNormalized ? 'ACTIVE' : 'EXPIRED',
      },
    });

    res.json({
      success: true,
      message: 'Kết nối Facebook thành công cho chiến dịch này.',
      campaign: updated,
    });
  } else {
    // Update all campaigns in this workspace
    const updated = await prisma.socialListeningCampaign.updateMany({
      where: { workspaceId: req.workspaceId },
      data: {
        facebookCookie: cookie,
        cookieStatus: testNormalized ? 'ACTIVE' : 'EXPIRED',
      },
    });

    res.json({
      success: true,
      message: `Đã kết nối tài khoản Facebook thành công cho toàn bộ ${updated.count} chiến dịch của Không gian làm việc.`,
    });
  }
});

/**
 * GET /api/listening/telegram/bot-info
 * Returns system bot status and username if configured in the environment variables
 */
router.get('/telegram/bot-info', async (req: AuthRequest, res: Response): Promise<void> => {
  const systemToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!systemToken) {
    res.json({ systemBotEnabled: false });
    return;
  }

  try {
    const response = await axios.get(`https://api.telegram.org/bot${systemToken}/getMe`, { timeout: 8000 });
    res.json({
      systemBotEnabled: true,
      systemBotUsername: response.data.result.username
    });
  } catch (err: any) {
    console.error('⚠️ [Telegram Bot Info Error]:', err.message);
    res.json({ systemBotEnabled: false, error: err.message });
  }
});

/**
 * POST /api/listening/telegram/recent-chats
 * Fetches recent active chats from /getUpdates for either custom bot token or default system bot
 */
router.post('/telegram/recent-chats', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { botToken } = req.body;
  const token = (botToken || '').trim() || process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    res.status(400).json({ error: 'Bot Token là bắt buộc (hoặc chưa cấu hình Telegram Bot hệ thống).' });
    return;
  }

  let response;
  try {
    response = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, { timeout: 10000 });
  } catch (err: any) {
    const errorMsg = err.response?.data?.description || err.message || '';
    if (errorMsg.toLowerCase().includes('webhook')) {
      console.log(`⚠️ Webhook conflict detected for token, attempting to deleteWebhook...`);
      try {
        await axios.get(`https://api.telegram.org/bot${token}/deleteWebhook`);
        // Retry getUpdates
        response = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, { timeout: 10000 });
      } catch (retryErr: any) {
        console.error('❌ [Telegram Recent Chats Retry Error]:', retryErr.response?.data || retryErr.message);
        const retryErrorMsg = retryErr.response?.data?.description || retryErr.message;
        res.status(500).json({ error: `Lỗi kết nối Telegram sau khi xóa webhook: ${retryErrorMsg}` });
        return;
      }
    } else {
      console.error('❌ [Telegram Recent Chats Error]:', err.response?.data || err.message);
      res.status(500).json({ error: `Lỗi kết nối Telegram: ${errorMsg}` });
      return;
    }
  }

  try {
    const updates = response.data.result || [];

    if (updates.length === 0) {
      res.status(400).json({
        error: 'Chưa có tương tác nào. Vui lòng bấm Bắt đầu (Start) hoặc gửi tin nhắn cho Bot trước.'
      });
      return;
    }

    const chatsMap = new Map<string, { chatId: string; chatTitle: string; chatType: string }>();

    // Scan backwards to list most recent updates first
    for (let i = updates.length - 1; i >= 0; i--) {
      const update = updates[i];
      const message = update.message || update.edited_message || update.channel_post;
      const chat = message?.chat || update.my_chat_member?.chat || update.callback_query?.message?.chat;

      if (chat && chat.id) {
        const chatId = String(chat.id);
        if (!chatsMap.has(chatId)) {
          chatsMap.set(chatId, {
            chatId,
            chatTitle: chat.first_name || chat.title || 'Người dùng Telegram',
            chatType: chat.type === 'private' ? 'Cá nhân' : 'Nhóm/Kênh'
          });
        }
      }
    }

    const chats = Array.from(chatsMap.values()).slice(0, 5);
    res.json(chats);
  } catch (err: any) {
    console.error('❌ [Telegram Recent Chats Processing Error]:', err.message);
    res.status(500).json({ error: `Lỗi xử lý dữ liệu Telegram: ${err.message}` });
  }
});

/**
 * POST /api/listening/telegram/send-welcome
 * Sends a welcome verification message to a chosen Chat ID
 */
router.post('/telegram/send-welcome', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const { botToken, chatId, chatTitle } = req.body;
  const token = (botToken || '').trim() || process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !chatId) {
    res.status(400).json({ error: 'Bot Token và Chat ID là bắt buộc.' });
    return;
  }

  try {
    const title = chatTitle || 'Thành viên Telegram';
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: `🎉 *KẾT NỐI THÀNH CÔNG!*\n\nBot đã được liên kết thành công với hệ thống AI Social Listening của Be Traffic.\n👤 *Cuộc trò chuyện*: ${title}\n🆔 *Chat ID*: \`${chatId}\`\n\nTừ bây giờ, các cơ hội bán hàng tiềm năng quét từ Facebook Group sẽ được gửi về đây.`,
      parse_mode: 'Markdown'
    });
    res.json({ success: true, message: 'Đã gửi tin nhắn chào mừng thành công.' });
  } catch (err: any) {
    console.error('❌ [Telegram Send Welcome Error]:', err.response?.data || err.message);
    res.status(500).json({ error: `Không thể gửi tin nhắn chào mừng: ${err.message}` });
  }
});

/**
 * POST /api/listening/logs/:id/convert-to-customer
 * Converts a social listening log (qualified lead) to a CRM Customer with auto-tagging.
 */
router.post('/logs/:id/convert-to-customer', requireWrite, async (req: AuthRequest, res: Response): Promise<void> => {
  const logId = parseInt(req.params.id as string, 10);
  
  const log = await prisma.socialListeningLog.findFirst({
    where: { id: logId, campaign: { workspaceId: req.workspaceId } },
    include: { campaign: true }
  });

  if (!log) {
    res.status(404).json({ error: 'Không tìm thấy nhật ký bài viết này.' });
    return;
  }

  try {
    // Check if customer with the same name, campaign name, traffic source and workspaceId already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        name: log.postAuthor,
        utmCampaign: log.campaign.name,
        trafficSource: 'FACEBOOK_LISTENING',
        workspaceId: req.workspaceId!
      }
    });

    if (existingCustomer) {
      res.status(200).json({ success: true, customerId: existingCustomer.id, alreadyConverted: true });
      return;
    }

    // Generate a unique placeholder email since email is @unique in schema
    const emailPlaceholder = `fb-${logId}-${Date.now()}@facebook-lead.com`;
    
    // Extract potential tags from AI Decision or keywords
    const tags = `#SocialListening, #${log.aiDecision}`;

    const leadTypeLabel = log.isComment ? 'bình luận' : 'bài viết';
    const parentAuthorLabel = log.parentPostAuthor ? ` (trong bài đăng của ${log.parentPostAuthor})` : '';
    const noteContent = `🎯 Khách hàng tiềm năng từ Social Listening (${leadTypeLabel}${parentAuthorLabel}).\n🔗 Link bài viết: ${log.postUrl}\n📌 Nội dung: "${log.postContent}"\n💡 AI đánh giá: ${log.aiDecision} (${log.aiScore} điểm) - Lý do: ${log.aiReason}\n🏷️ Thẻ phân loại: ${tags}`;

    // Create the customer
    const customer = await prisma.customer.create({
      data: {
        name: log.postAuthor,
        email: emailPlaceholder,
        phone: null,
        company: null,
        status: 'NEW',
        trafficSource: 'FACEBOOK_LISTENING',
        utmCampaign: log.campaign.name,
        workspaceId: req.workspaceId!,
        notes: {
          create: [
            {
              content: noteContent
            }
          ]
        }
      }
    });

    try {
      const { logActivity } = await import('../lib/auditLogger');
      await logActivity({
        userId: req.user!.userId,
        workspaceId: req.workspaceId!,
        action: 'CREATE_CUSTOMER',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { customerId: customer.id, customerName: customer.name, email: customer.email, source: 'SOCIAL_LISTENING' }
      });
    } catch (auditErr) {
      console.warn('Failed to log CREATE_CUSTOMER activity:', auditErr);
    }

    res.status(201).json({ success: true, customerId: customer.id });
  } catch (err: any) {
    console.error('Failed to convert log to customer:', err);
    res.status(500).json({ error: err.message || 'Lỗi hệ thống khi lưu khách hàng vào CRM.' });
  }
});

export default router;
