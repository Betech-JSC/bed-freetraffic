"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const socialListeningScraper_1 = require("../services/socialListeningScraper");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/campaigns', async (req, res) => {
    const campaigns = await prisma_1.default.socialListeningCampaign.findMany({
        where: { workspaceId: req.workspaceId },
        include: { knowledgeSources: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
});
router.post('/campaigns', auth_1.requireWrite, async (req, res) => {
    const { name, keywords, excludeKeywords, groupUrls, facebookCookie, useAi, telegramEnabled, telegramBotToken, telegramChatId, scanInterval, minScore, enableSemanticFilter, semanticThreshold, targetAudience, scrapeComments, autopilot, autopilotDelayMin, autopilotDelayMax, maxPostAgeHours, knowledgeSourceIds } = req.body;
    if (!name || !keywords || !groupUrls) {
        res.status(400).json({ error: 'Tên chiến dịch, từ khóa và danh sách nhóm Facebook là bắt buộc.' });
        return;
    }
    const testNormalized = facebookCookie ? (0, socialListeningScraper_1.normalizeCookie)(facebookCookie) : null;
    const interval = scanInterval ? Math.max(5, parseInt(scanInterval, 10)) : 15;
    let scoreThreshold = 50;
    if (minScore !== undefined) {
        scoreThreshold = Math.max(0, Math.min(100, parseInt(minScore, 10)));
    }
    const campaign = await prisma_1.default.socialListeningCampaign.create({
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
            workspaceId: req.workspaceId,
            scanInterval: interval,
            minScore: scoreThreshold,
            enableSemanticFilter: enableSemanticFilter === true,
            semanticThreshold: semanticThreshold !== undefined ? parseFloat(semanticThreshold) : 0.70,
            targetAudience: targetAudience || null,
            scrapeComments: scrapeComments === true,
            autopilot: autopilot === true,
            autopilotDelayMin: autopilotDelayMin ? parseInt(autopilotDelayMin, 10) : 3,
            autopilotDelayMax: autopilotDelayMax ? parseInt(autopilotDelayMax, 10) : 7,
            maxPostAgeHours: maxPostAgeHours ? parseInt(maxPostAgeHours, 10) : 0,
            knowledgeSources: knowledgeSourceIds && Array.isArray(knowledgeSourceIds) ? {
                connect: knowledgeSourceIds.map((id) => ({ id }))
            } : undefined
        },
        include: { knowledgeSources: true }
    });
    res.status(201).json(campaign);
});
/**
 * PUT /api/listening/campaigns/:id
 * Updates an existing social listening campaign
 */
router.put('/campaigns/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma_1.default.socialListeningCampaign.findFirst({
        where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy chiến dịch để cập nhật.' });
        return;
    }
    const { name, keywords, excludeKeywords, groupUrls, facebookCookie, useAi, telegramEnabled, telegramBotToken, telegramChatId, isActive, scanInterval, minScore, enableSemanticFilter, semanticThreshold, targetAudience, scrapeComments, autopilot, autopilotDelayMin, autopilotDelayMax, maxPostAgeHours, knowledgeSourceIds } = req.body;
    let cookieStatus = existing.cookieStatus;
    let savedCookie = existing.facebookCookie;
    if (facebookCookie !== undefined) {
        savedCookie = facebookCookie || null;
        const testNormalized = facebookCookie ? (0, socialListeningScraper_1.normalizeCookie)(facebookCookie) : null;
        cookieStatus = testNormalized ? 'ACTIVE' : 'ERROR';
    }
    let updatedInterval = existing.scanInterval;
    if (scanInterval !== undefined) {
        updatedInterval = Math.max(5, parseInt(scanInterval, 10));
    }
    let updatedMinScore = existing.minScore;
    if (minScore !== undefined) {
        updatedMinScore = Math.max(0, Math.min(100, parseInt(minScore, 10)));
    }
    const campaign = await prisma_1.default.socialListeningCampaign.update({
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
            semanticThreshold: semanticThreshold === undefined ? existing.semanticThreshold : parseFloat(semanticThreshold),
            targetAudience: targetAudience === undefined ? existing.targetAudience : (targetAudience || null),
            scrapeComments: scrapeComments === undefined ? existing.scrapeComments : (scrapeComments === true),
            autopilot: autopilot === undefined ? existing.autopilot : (autopilot === true),
            autopilotDelayMin: autopilotDelayMin === undefined ? existing.autopilotDelayMin : parseInt(autopilotDelayMin, 10),
            autopilotDelayMax: autopilotDelayMax === undefined ? existing.autopilotDelayMax : parseInt(autopilotDelayMax, 10),
            maxPostAgeHours: maxPostAgeHours === undefined ? existing.maxPostAgeHours : parseInt(maxPostAgeHours, 10),
            knowledgeSources: knowledgeSourceIds && Array.isArray(knowledgeSourceIds) ? {
                set: knowledgeSourceIds.map((id) => ({ id }))
            } : undefined
        },
        include: { knowledgeSources: true }
    });
    res.json(campaign);
});
/**
 * DELETE /api/listening/campaigns/:id
 * Deletes a social listening campaign
 */
router.delete('/campaigns/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma_1.default.socialListeningCampaign.findFirst({
        where: { id, workspaceId: req.workspaceId },
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy chiến dịch để xóa.' });
        return;
    }
    await prisma_1.default.socialListeningCampaign.delete({
        where: { id },
    });
    res.status(204).send();
});
/**
 * GET /api/listening/logs
 * Retrieves lead qualification logs for campaigns inside the active workspace
 */
router.get('/logs', async (req, res) => {
    const campaigns = await prisma_1.default.socialListeningCampaign.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true },
    });
    const campaignIds = campaigns.map(c => c.id);
    const logs = campaignIds.length > 0
        ? await prisma_1.default.socialListeningLog.findMany({
            where: { campaignId: { in: campaignIds } },
            include: { campaign: { select: { name: true, autopilot: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        })
        : [];
    const convertedCustomers = await prisma_1.default.customer.findMany({
        where: {
            workspaceId: req.workspaceId,
            trafficSource: 'FACEBOOK_LISTENING'
        },
        select: {
            name: true,
            utmCampaign: true
        }
    });
    const logsWithConverted = logs.map(log => {
        const isConverted = convertedCustomers.some(c => c.name === log.postAuthor && c.utmCampaign === log.campaign.name);
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
router.post('/campaigns/:id/test-scan', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma_1.default.socialListeningCampaign.findFirst({
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
        const { executeCampaignScan } = await Promise.resolve().then(() => __importStar(require('../workers/socialListeningWorker')));
        const result = await executeCampaignScan(existing.id);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi bất ngờ xảy ra khi chạy tiến trình.' });
    }
});
/**
 * POST /api/listening/update-cookie
 * Updates cookies for a specific campaign or all campaigns in the workspace
 */
router.post('/update-cookie', auth_1.requireWrite, async (req, res) => {
    const { cookie, campaignId } = req.body;
    if (!cookie) {
        res.status(400).json({ error: 'Dữ liệu Cookie là bắt buộc.' });
        return;
    }
    const testNormalized = (0, socialListeningScraper_1.normalizeCookie)(cookie);
    if (campaignId) {
        const parsedId = parseInt(campaignId, 10);
        const campaign = await prisma_1.default.socialListeningCampaign.findFirst({
            where: { id: parsedId, workspaceId: req.workspaceId },
        });
        if (!campaign) {
            res.status(404).json({ error: 'Không tìm thấy chiến dịch chỉ định.' });
            return;
        }
        const updated = await prisma_1.default.socialListeningCampaign.update({
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
    }
    else {
        // Update all campaigns in this workspace
        const updated = await prisma_1.default.socialListeningCampaign.updateMany({
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
router.get('/telegram/bot-info', async (req, res) => {
    const systemToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!systemToken) {
        res.json({ systemBotEnabled: false });
        return;
    }
    try {
        const response = await axios_1.default.get(`https://api.telegram.org/bot${systemToken}/getMe`, { timeout: 8000 });
        res.json({
            systemBotEnabled: true,
            systemBotUsername: response.data.result.username
        });
    }
    catch (err) {
        console.error('⚠️ [Telegram Bot Info Error]:', err.message);
        res.json({ systemBotEnabled: false, error: err.message });
    }
});
/**
 * POST /api/listening/telegram/recent-chats
 * Fetches recent active chats from /getUpdates for either custom bot token or default system bot
 */
router.post('/telegram/recent-chats', auth_1.requireWrite, async (req, res) => {
    const { botToken } = req.body;
    let token = (botToken || '').trim();
    if (!token) {
        const defaultTgConn = await prisma_1.default.socialConnection.findFirst({
            where: {
                platform: 'telegram',
                workspaceId: req.workspaceId,
                status: 'CONNECTED',
            },
        });
        if (defaultTgConn) {
            token = defaultTgConn.accessToken;
        }
    }
    // fallback to system token if still empty
    if (!token) {
        token = process.env.TELEGRAM_BOT_TOKEN || '';
    }
    if (!token) {
        res.status(400).json({ error: 'Bot Token là bắt buộc (hoặc chưa cấu hình Telegram Bot hệ thống).' });
        return;
    }
    let response;
    try {
        response = await axios_1.default.get(`https://api.telegram.org/bot${token}/getUpdates`, { timeout: 10000 });
    }
    catch (err) {
        const errorMsg = err.response?.data?.description || err.message || '';
        if (errorMsg.toLowerCase().includes('webhook')) {
            console.log(`⚠️ Webhook conflict detected for token, attempting to deleteWebhook...`);
            try {
                await axios_1.default.get(`https://api.telegram.org/bot${token}/deleteWebhook`);
                // Retry getUpdates
                response = await axios_1.default.get(`https://api.telegram.org/bot${token}/getUpdates`, { timeout: 10000 });
            }
            catch (retryErr) {
                console.error('❌ [Telegram Recent Chats Retry Error]:', retryErr.response?.data || retryErr.message);
                const retryErrorMsg = retryErr.response?.data?.description || retryErr.message;
                res.status(500).json({ error: `Lỗi kết nối Telegram sau khi xóa webhook: ${retryErrorMsg}` });
                return;
            }
        }
        else {
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
        const chatsMap = new Map();
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
    }
    catch (err) {
        console.error('❌ [Telegram Recent Chats Processing Error]:', err.message);
        res.status(500).json({ error: `Lỗi xử lý dữ liệu Telegram: ${err.message}` });
    }
});
/**
 * POST /api/listening/telegram/send-welcome
 * Sends a welcome verification message to a chosen Chat ID
 */
router.post('/telegram/send-welcome', auth_1.requireWrite, async (req, res) => {
    const { botToken, chatId, chatTitle } = req.body;
    let token = (botToken || '').trim();
    let finalChatId = chatId;
    if (!token || !finalChatId) {
        const defaultTgConn = await prisma_1.default.socialConnection.findFirst({
            where: {
                platform: 'telegram',
                workspaceId: req.workspaceId,
                status: 'CONNECTED',
            },
        });
        if (defaultTgConn) {
            if (!token)
                token = defaultTgConn.accessToken;
            if (!finalChatId)
                finalChatId = defaultTgConn.pageId;
        }
    }
    if (!token) {
        token = process.env.TELEGRAM_BOT_TOKEN || '';
    }
    if (!finalChatId) {
        finalChatId = process.env.TELEGRAM_CHAT_ID || '';
    }
    if (!token || !finalChatId) {
        res.status(400).json({ error: 'Bot Token và Chat ID là bắt buộc.' });
        return;
    }
    try {
        const title = chatTitle || 'Thành viên Telegram';
        await axios_1.default.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: finalChatId,
            text: `🎉 *KẾT NỐI THÀNH CÔNG!*\n\nBot đã được liên kết thành công với hệ thống AI Social Listening của Be Traffic.\n👤 *Cuộc trò chuyện*: ${title}\n🆔 *Chat ID*: \`${finalChatId}\`\n\nTừ bây giờ, các cơ hội bán hàng tiềm năng quét từ Facebook Group sẽ được gửi về đây.`,
            parse_mode: 'Markdown'
        });
        res.json({ success: true, message: 'Đã gửi tin nhắn chào mừng thành công.' });
    }
    catch (err) {
        console.error('❌ [Telegram Send Welcome Error]:', err.response?.data || err.message);
        res.status(500).json({ error: `Không thể gửi tin nhắn chào mừng: ${err.message}` });
    }
});
/**
 * POST /api/listening/logs/:id/convert-to-customer
 * Converts a social listening log (qualified lead) to a CRM Customer with auto-tagging.
 */
router.post('/logs/:id/convert-to-customer', auth_1.requireWrite, async (req, res) => {
    const logId = parseInt(req.params.id, 10);
    const log = await prisma_1.default.socialListeningLog.findFirst({
        where: { id: logId, campaign: { workspaceId: req.workspaceId } },
        include: { campaign: true }
    });
    if (!log) {
        res.status(404).json({ error: 'Không tìm thấy nhật ký bài viết này.' });
        return;
    }
    try {
        // Check if customer with the same name, campaign name, traffic source and workspaceId already exists
        const existingCustomer = await prisma_1.default.customer.findFirst({
            where: {
                name: log.postAuthor,
                utmCampaign: log.campaign.name,
                trafficSource: 'FACEBOOK_LISTENING',
                workspaceId: req.workspaceId
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
        const customer = await prisma_1.default.customer.create({
            data: {
                name: log.postAuthor,
                email: emailPlaceholder,
                phone: null,
                company: null,
                status: 'NEW',
                trafficSource: 'FACEBOOK_LISTENING',
                utmCampaign: log.campaign.name,
                workspaceId: req.workspaceId,
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
            const { logActivity } = await Promise.resolve().then(() => __importStar(require('../lib/auditLogger')));
            await logActivity({
                userId: req.user.userId,
                workspaceId: req.workspaceId,
                action: 'CREATE_CUSTOMER',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { customerId: customer.id, customerName: customer.name, email: customer.email, source: 'SOCIAL_LISTENING' }
            });
        }
        catch (auditErr) {
            console.warn('Failed to log CREATE_CUSTOMER activity:', auditErr);
        }
        res.status(201).json({ success: true, customerId: customer.id });
    }
    catch (err) {
        console.error('Failed to convert log to customer:', err);
        res.status(500).json({ error: err.message || 'Lỗi hệ thống khi lưu khách hàng vào CRM.' });
    }
});
/**
 * POST /api/listening/logs/:id/toggle-autopilot
 * Toggles (cancels or reactivates) autopilot for a specific log/lead
 */
router.post('/logs/:id/toggle-autopilot', auth_1.requireWrite, async (req, res) => {
    const logId = parseInt(req.params.id, 10);
    const { cancel } = req.body;
    const log = await prisma_1.default.socialListeningLog.findFirst({
        where: { id: logId, campaign: { workspaceId: req.workspaceId } },
    });
    if (!log) {
        res.status(404).json({ error: 'Không tìm thấy nhật ký bài viết này.' });
        return;
    }
    try {
        const updated = await prisma_1.default.socialListeningLog.update({
            where: { id: logId },
            data: {
                autopilotCancelled: cancel === true
            }
        });
        res.json({
            success: true,
            autopilotCancelled: updated.autopilotCancelled,
            message: updated.autopilotCancelled
                ? 'Đã hủy tự động phản hồi (Autopilot) cho bài viết này.'
                : 'Đã kích hoạt lại tự động phản hồi (Autopilot) cho bài viết này.'
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lỗi hệ thống khi cập nhật trạng thái Autopilot.' });
    }
});
/**
 * POST /api/listening/logs/:id/generate-outreach
 * Generates an AI outreach suggestion for comment or DM
 */
router.post('/logs/:id/generate-outreach', async (req, res) => {
    const logId = parseInt(req.params.id, 10);
    const { customPrompt, tone, type } = req.body; // type: 'comment' | 'dm'
    const log = await prisma_1.default.socialListeningLog.findFirst({
        where: { id: logId, campaign: { workspaceId: req.workspaceId } },
        include: { campaign: true }
    });
    if (!log) {
        res.status(404).json({ error: 'Không tìm thấy nhật ký bài viết này.' });
        return;
    }
    try {
        const { generateCustomOutreach } = await Promise.resolve().then(() => __importStar(require('../services/leadQualifierService')));
        const outreach = await generateCustomOutreach(req.workspaceId, log.postContent, log.campaign.keywords, log.campaign.targetAudience, customPrompt, tone || 'lịch sự', type || 'comment', log.campaignId);
        res.json({ success: true, outreach });
    }
    catch (err) {
        console.error('❌ Failed to generate custom AI outreach:', err);
        res.status(500).json({ error: err.message || 'Lỗi hệ thống khi sinh kịch bản tiếp cận.' });
    }
});
/**
 * POST /api/listening/logs/:id/reply
 * Posts a simulated Facebook comment reply using the campaign's cookie
 */
router.post('/logs/:id/reply', auth_1.requireWrite, async (req, res) => {
    const logId = parseInt(req.params.id, 10);
    const { replyText } = req.body;
    if (!replyText || !replyText.trim()) {
        res.status(400).json({ error: 'Nội dung phản hồi không được để trống.' });
        return;
    }
    const log = await prisma_1.default.socialListeningLog.findFirst({
        where: { id: logId, campaign: { workspaceId: req.workspaceId } },
        include: { campaign: true }
    });
    if (!log) {
        res.status(404).json({ error: 'Không tìm thấy nhật ký bài viết này.' });
        return;
    }
    const cookie = log.campaign.facebookCookie;
    if (!cookie) {
        res.status(400).json({ error: 'Chiến dịch này chưa được cấu hình Facebook Cookie để gửi bình luận.' });
        return;
    }
    try {
        const { postFacebookComment } = await Promise.resolve().then(() => __importStar(require('../services/facebookReply')));
        // If it is a comment, pass log.commentId, otherwise pass null
        const success = await postFacebookComment(cookie, log.postUrl, replyText, log.isComment ? log.commentId : null);
        if (success) {
            await prisma_1.default.socialListeningLog.update({
                where: { id: logId },
                data: {
                    repliedContent: replyText,
                    repliedAt: new Date(),
                    status: 'NOTIFIED' // Mark as notified/replied
                }
            });
            res.json({ success: true, message: 'Đã gửi bình luận phản hồi thành công lên Facebook!' });
        }
        else {
            res.status(500).json({ error: 'Gửi bình luận phản hồi thất bại.' });
        }
    }
    catch (err) {
        console.error('❌ Failed to post Facebook reply comment:', err);
        if (err.message === 'COOKIE_EXPIRED') {
            // Mark campaign cookie as EXPIRED
            await prisma_1.default.socialListeningCampaign.update({
                where: { id: log.campaignId },
                data: { cookieStatus: 'EXPIRED' }
            });
            res.status(400).json({ error: 'Cookie Facebook đã hết hạn. Vui lòng kết nối lại tài khoản Facebook trong trang cấu hình chiến dịch.' });
        }
        else {
            res.status(500).json({ error: err.message || 'Lỗi khi gửi bình luận lên Facebook.' });
        }
    }
});
exports.default = router;
