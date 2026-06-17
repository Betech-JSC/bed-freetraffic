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
exports.executeCampaignScan = executeCampaignScan;
exports.runSocialListeningScan = runSocialListeningScan;
exports.startSocialListeningEngine = startSocialListeningEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const socialListeningScraper_1 = require("../services/socialListeningScraper");
const leadQualifierService_1 = require("../services/leadQualifierService");
const telegramService_1 = require("../services/telegramService");
const embeddings_1 = require("../lib/embeddings");
/**
 * Executes the social listening scraping, filtering, AI qualification,
 * and Telegram alert routing for a specific campaign.
 */
async function executeCampaignScan(campaignId) {
    const campaign = await prisma_1.default.socialListeningCampaign.findUnique({
        where: { id: campaignId },
    });
    if (!campaign) {
        throw new Error(`Campaign with ID ${campaignId} not found.`);
    }
    if (!campaign.facebookCookie) {
        return { success: false, postsCount: 0, leadsFound: 0, error: 'Facebook Cookie not configured.' };
    }
    // Resolve Telegram Credentials: use campaign level or fallback to workspace connection settings
    let finalBotToken = campaign.telegramBotToken;
    let finalChatId = campaign.telegramChatId;
    if (campaign.telegramEnabled && (!finalBotToken || !finalChatId)) {
        const defaultTgConn = await prisma_1.default.socialConnection.findFirst({
            where: {
                platform: 'telegram',
                workspaceId: campaign.workspaceId,
                status: 'CONNECTED',
            },
        });
        if (defaultTgConn) {
            if (!finalBotToken)
                finalBotToken = defaultTgConn.accessToken;
            if (!finalChatId)
                finalChatId = defaultTgConn.pageId;
        }
    }
    const groupUrlsList = campaign.groupUrls
        .split(',')
        .map(g => g.trim())
        .filter(Boolean);
    let totalPostsScraped = 0;
    let totalLeadsFound = 0;
    for (const groupUrl of groupUrlsList) {
        try {
            console.log(`[Social Listening] Scraping group: ${groupUrl} for campaign: ${campaign.name}`);
            const posts = await (0, socialListeningScraper_1.scrapeFacebookGroup)(groupUrl, campaign.facebookCookie);
            totalPostsScraped += posts.length;
            // Ensure cookie status is marked ACTIVE if we successfully scrape
            if (campaign.cookieStatus !== 'ACTIVE') {
                await prisma_1.default.socialListeningCampaign.update({
                    where: { id: campaign.id },
                    data: { cookieStatus: 'ACTIVE' },
                });
            }
            // Accent removal helper for Vietnamese search matching
            const removeAccents = (str) => {
                return str
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/đ/g, 'd')
                    .replace(/Đ/g, 'd');
            };
            // Helper to check if a single keyword (which could be a phrase) matches the content flexibly
            const checkSingleKeywordMatch = (kw, contentLower, contentNoAccent) => {
                // 1. Try exact match
                if (contentLower.includes(kw))
                    return true;
                // 2. Try web/website synonyms
                if (kw.includes('web') && !kw.includes('website')) {
                    const alt = kw.replace(/\bweb\b/g, 'website');
                    if (contentLower.includes(alt))
                        return true;
                }
                if (kw.includes('website')) {
                    const alt = kw.replace(/\bwebsite\b/g, 'web');
                    if (contentLower.includes(alt))
                        return true;
                }
                // 3. Try accent-insensitive exact match
                const kwNoAccent = removeAccents(kw);
                if (contentNoAccent.includes(kwNoAccent))
                    return true;
                // 4. Try word-proximity / all words match (for phrases)
                const kwWords = kwNoAccent.split(/\s+/).filter(w => w.length > 1); // ignore single chars
                if (kwWords.length > 1) {
                    const allWordsPresent = kwWords.every(word => {
                        if (word === 'web' || word === 'website') {
                            return contentNoAccent.includes('web') || contentNoAccent.includes('website');
                        }
                        return contentNoAccent.includes(word);
                    });
                    if (allWordsPresent)
                        return true;
                }
                return false;
            };
            // Keyword pre-filtering
            const keywords = campaign.keywords
                .split(',')
                .map(k => k.trim().toLowerCase())
                .filter(Boolean);
            const excludeKeywords = campaign.excludeKeywords
                ? campaign.excludeKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
                : [];
            // Pre-compute query embedding if semantic filter is enabled
            let queryEmbedding = null;
            if (campaign.enableSemanticFilter) {
                queryEmbedding = await (0, embeddings_1.getEmbedding)(campaign.keywords);
            }
            for (const post of posts) {
                // Filter by maxPostAgeHours if set (greater than 0)
                if (campaign.maxPostAgeHours && campaign.maxPostAgeHours > 0) {
                    const maxAgeMs = campaign.maxPostAgeHours * 60 * 60 * 1000;
                    const postTimeMs = post.creationTime
                        ? post.creationTime * 1000
                        : post.createdAtText ? new Date(post.createdAtText).getTime() : null;
                    if (postTimeMs && (Date.now() - postTimeMs > maxAgeMs)) {
                        console.log(`[Social Listening] Post ${post.postId} ignored: age (${Math.round((Date.now() - postTimeMs) / 3600000)}h) exceeds limit of ${campaign.maxPostAgeHours} hours.`);
                        continue;
                    }
                }
                // ----------------------------------------------------
                // A. PROCESS MAIN POST
                // ----------------------------------------------------
                const processPost = async () => {
                    // Check if log already exists
                    const existingLog = await prisma_1.default.socialListeningLog.findFirst({
                        where: {
                            campaignId: campaign.id,
                            postUrl: post.postUrl,
                            isComment: false,
                        },
                    });
                    if (existingLog)
                        return; // Skip already processed posts
                    const contentLower = post.content.toLowerCase();
                    const contentNoAccent = removeAccents(contentLower);
                    // 1. Negative keyword check first
                    const matchesExclude = excludeKeywords.some(ex => {
                        const exNoAccent = removeAccents(ex);
                        return contentLower.includes(ex) || contentNoAccent.includes(exNoAccent);
                    });
                    if (matchesExclude)
                        return;
                    // 2. Keyword check or Semantic Filter
                    let isMatch = false;
                    if (campaign.enableSemanticFilter && queryEmbedding) {
                        const postEmbedding = await (0, embeddings_1.getEmbedding)(post.content);
                        if (postEmbedding) {
                            const similarity = (0, embeddings_1.cosineSimilarity)(queryEmbedding, postEmbedding);
                            isMatch = similarity >= campaign.semanticThreshold;
                            console.log(`[Social Listening] Semantic similarity for post: ${similarity.toFixed(3)} (Threshold: ${campaign.semanticThreshold})`);
                        }
                    }
                    else {
                        isMatch = keywords.some(k => checkSingleKeywordMatch(k, contentLower, contentNoAccent));
                    }
                    if (!isMatch)
                        return;
                    // 3. AI Qualification
                    console.log(`[Social Listening] Qualifying potential lead from: ${post.authorName}`);
                    const aiResult = await (0, leadQualifierService_1.qualifyLead)(campaign.workspaceId, post.content, campaign.keywords, campaign.excludeKeywords, campaign.targetAudience, campaign.id);
                    // 4. Create log
                    const log = await prisma_1.default.socialListeningLog.create({
                        data: {
                            campaignId: campaign.id,
                            postUrl: post.postUrl,
                            postAuthor: post.authorName,
                            authorAvatar: post.authorAvatar,
                            postContent: post.content,
                            aiScore: aiResult.score,
                            aiDecision: aiResult.decision,
                            aiReason: aiResult.reason,
                            aiDraftMsg: aiResult.draftMsg,
                            isComment: false,
                            status: 'PENDING',
                        },
                    });
                    // 5. Telegram Notifications
                    if (campaign.telegramEnabled && aiResult.score >= campaign.minScore && aiResult.decision !== 'SPAM') {
                        totalLeadsFound++;
                        const draftMsgBlock = aiResult.draftMsg
                            ? `💬 *Kịch bản phản hồi gợi ý (chạm để copy)*:\n\`\`\`\n${aiResult.draftMsg}\n\`\`\`\n\n`
                            : '';
                        const alertText = `🔥 *PHÁT HIỆN KHÁCH HÀNG TIỀM NĂNG (${aiResult.decision})* - Điểm: *${aiResult.score}/100*\n\n` +
                            `👥 *Người đăng*: ${post.authorName}\n` +
                            `📌 *Chiến dịch*: ${campaign.name}\n\n` +
                            `📝 *Nội dung bài viết*:\n"${post.content.slice(0, 350)}${post.content.length > 350 ? '...' : ''}"\n\n` +
                            `💡 *Nhận định AI*:\n${aiResult.reason}\n\n` +
                            draftMsgBlock +
                            `🔗 [Xem bài viết trên Facebook](${post.postUrl})`;
                        const replyMarkup = {
                            inline_keyboard: [
                                [
                                    {
                                        text: '🔗 Đi tới bài viết Facebook',
                                        url: post.postUrl
                                    }
                                ]
                            ]
                        };
                        try {
                            await (0, telegramService_1.sendTelegramAlert)(finalBotToken, finalChatId, alertText, replyMarkup);
                            await prisma_1.default.socialListeningLog.update({
                                where: { id: log.id },
                                data: { status: 'NOTIFIED' },
                            });
                        }
                        catch (teleErr) {
                            console.error(`[Social Listening] Telegram Alert Error: ${teleErr.message}`);
                            await prisma_1.default.socialListeningLog.update({
                                where: { id: log.id },
                                data: { status: 'ERROR', errorMessage: teleErr.message },
                            });
                        }
                        // Autopilot comment reply trigger for post
                        if (campaign.autopilot && aiResult.draftMsg) {
                            const minDelay = campaign.autopilotDelayMin || 3;
                            const maxDelay = campaign.autopilotDelayMax || 7;
                            const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 60;
                            console.log(`[Social Listening Autopilot] Scheduling comment reply for post ${post.postUrl} in ${delaySeconds} seconds...`);
                            setTimeout(async () => {
                                try {
                                    // Fetch the latest state of the log to ensure it wasn't cancelled
                                    const currentLog = await prisma_1.default.socialListeningLog.findUnique({
                                        where: { id: log.id }
                                    });
                                    if (!currentLog || currentLog.autopilotCancelled || currentLog.repliedContent) {
                                        console.log(`[Social Listening Autopilot] Comment reply skipped for log #${log.id} (cancelled or already replied)`);
                                        return;
                                    }
                                    const { postFacebookComment } = await Promise.resolve().then(() => __importStar(require('../services/facebookReply')));
                                    if (campaign.facebookCookie) {
                                        const success = await postFacebookComment(campaign.facebookCookie, post.postUrl, aiResult.draftMsg);
                                        if (success) {
                                            await prisma_1.default.socialListeningLog.update({
                                                where: { id: log.id },
                                                data: {
                                                    repliedContent: aiResult.draftMsg,
                                                    repliedAt: new Date(),
                                                    status: 'NOTIFIED'
                                                }
                                            });
                                            console.log(`[Social Listening Autopilot] Comment reply sent successfully for log #${log.id}`);
                                        }
                                    }
                                }
                                catch (autoErr) {
                                    console.error(`❌ [Social Listening Autopilot Error] Failed to send comment reply for log #${log.id}:`, autoErr.message);
                                }
                            }, delaySeconds * 1000);
                        }
                    }
                    else {
                        // Qualification is COLD, SPAM or below minScore threshold, mark ignored
                        await prisma_1.default.socialListeningLog.update({
                            where: { id: log.id },
                            data: { status: 'IGNORED' },
                        });
                    }
                };
                await processPost();
                // ----------------------------------------------------
                // B. PROCESS COMMENTS (IF ENABLED)
                // ----------------------------------------------------
                if (campaign.scrapeComments && post.comments && post.comments.length > 0) {
                    for (const comment of post.comments) {
                        const processComment = async () => {
                            // Check if log already exists
                            const existingLog = await prisma_1.default.socialListeningLog.findFirst({
                                where: {
                                    campaignId: campaign.id,
                                    commentId: comment.commentId,
                                    isComment: true,
                                },
                            });
                            if (existingLog)
                                return; // Skip already processed comments
                            const contentLower = comment.content.toLowerCase();
                            const contentNoAccent = removeAccents(contentLower);
                            // 1. Negative keyword check first
                            const matchesExclude = excludeKeywords.some(ex => {
                                const exNoAccent = removeAccents(ex);
                                return contentLower.includes(ex) || contentNoAccent.includes(exNoAccent);
                            });
                            if (matchesExclude)
                                return;
                            // 2. Keyword check or Semantic Filter
                            let isMatch = false;
                            if (campaign.enableSemanticFilter && queryEmbedding) {
                                const commentEmbedding = await (0, embeddings_1.getEmbedding)(comment.content);
                                if (commentEmbedding) {
                                    const similarity = (0, embeddings_1.cosineSimilarity)(queryEmbedding, commentEmbedding);
                                    isMatch = similarity >= campaign.semanticThreshold;
                                    console.log(`[Social Listening] Semantic similarity for comment by ${comment.authorName}: ${similarity.toFixed(3)} (Threshold: ${campaign.semanticThreshold})`);
                                }
                            }
                            else {
                                isMatch = keywords.some(k => checkSingleKeywordMatch(k, contentLower, contentNoAccent));
                            }
                            if (!isMatch)
                                return;
                            // 3. AI Qualification
                            console.log(`[Social Listening] Qualifying potential comment lead from: ${comment.authorName}`);
                            const aiResult = await (0, leadQualifierService_1.qualifyLead)(campaign.workspaceId, comment.content, campaign.keywords, campaign.excludeKeywords, campaign.targetAudience, campaign.id);
                            // 4. Create log
                            const log = await prisma_1.default.socialListeningLog.create({
                                data: {
                                    campaignId: campaign.id,
                                    postUrl: post.postUrl, // point to parent post url
                                    postAuthor: comment.authorName,
                                    authorAvatar: null,
                                    postContent: comment.content,
                                    aiScore: aiResult.score,
                                    aiDecision: aiResult.decision,
                                    aiReason: aiResult.reason,
                                    aiDraftMsg: aiResult.draftMsg,
                                    isComment: true,
                                    commentId: comment.commentId,
                                    parentPostAuthor: post.authorName,
                                    status: 'PENDING',
                                },
                            });
                            // 5. Telegram Notifications
                            if (campaign.telegramEnabled && aiResult.score >= campaign.minScore && aiResult.decision !== 'SPAM') {
                                totalLeadsFound++;
                                const draftMsgBlock = aiResult.draftMsg
                                    ? `💬 *Kịch bản phản hồi gợi ý (chạm để copy)*:\n\`\`\`\n${aiResult.draftMsg}\n\`\`\`\n\n`
                                    : '';
                                const alertText = `💬 *PHÁT HIỆN BÌNH LUẬN TIỀM NĂNG (${aiResult.decision})* - Điểm: *${aiResult.score}/100*\n\n` +
                                    `👤 *Người bình luận*: ${comment.authorName}\n` +
                                    `📝 *Tại bài đăng của*: ${post.authorName}\n` +
                                    `📌 *Chiến dịch*: ${campaign.name}\n\n` +
                                    `💬 *Nội dung bình luận*:\n"${comment.content.slice(0, 350)}${comment.content.length > 350 ? '...' : ''}"\n\n` +
                                    `💡 *Nhận định AI*:\n${aiResult.reason}\n\n` +
                                    draftMsgBlock +
                                    `🔗 [Xem bình luận trên Facebook](${post.postUrl})`;
                                const replyMarkup = {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: '🔗 Đi tới bài viết Facebook',
                                                url: post.postUrl
                                            }
                                        ]
                                    ]
                                };
                                try {
                                    await (0, telegramService_1.sendTelegramAlert)(finalBotToken, finalChatId, alertText, replyMarkup);
                                    await prisma_1.default.socialListeningLog.update({
                                        where: { id: log.id },
                                        data: { status: 'NOTIFIED' },
                                    });
                                }
                                catch (teleErr) {
                                    console.error(`[Social Listening] Telegram Alert Error for comment: ${teleErr.message}`);
                                    await prisma_1.default.socialListeningLog.update({
                                        where: { id: log.id },
                                        data: { status: 'ERROR', errorMessage: teleErr.message },
                                    });
                                }
                                // Autopilot comment reply trigger for comment
                                if (campaign.autopilot && aiResult.draftMsg) {
                                    const minDelay = campaign.autopilotDelayMin || 3;
                                    const maxDelay = campaign.autopilotDelayMax || 7;
                                    const delaySeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 60;
                                    console.log(`[Social Listening Autopilot] Scheduling reply for comment ${comment.commentId} in ${delaySeconds} seconds...`);
                                    setTimeout(async () => {
                                        try {
                                            // Fetch the latest state of the log to ensure it wasn't cancelled
                                            const currentLog = await prisma_1.default.socialListeningLog.findUnique({
                                                where: { id: log.id }
                                            });
                                            if (!currentLog || currentLog.autopilotCancelled || currentLog.repliedContent) {
                                                console.log(`[Social Listening Autopilot] Comment reply skipped for comment log #${log.id} (cancelled or already replied)`);
                                                return;
                                            }
                                            const { postFacebookComment } = await Promise.resolve().then(() => __importStar(require('../services/facebookReply')));
                                            if (campaign.facebookCookie) {
                                                const success = await postFacebookComment(campaign.facebookCookie, post.postUrl, aiResult.draftMsg, comment.commentId);
                                                if (success) {
                                                    await prisma_1.default.socialListeningLog.update({
                                                        where: { id: log.id },
                                                        data: {
                                                            repliedContent: aiResult.draftMsg,
                                                            repliedAt: new Date(),
                                                            status: 'NOTIFIED'
                                                        }
                                                    });
                                                    console.log(`[Social Listening Autopilot] Reply sent successfully for comment log #${log.id}`);
                                                }
                                            }
                                        }
                                        catch (autoErr) {
                                            console.error(`❌ [Social Listening Autopilot Error] Failed to send reply for comment log #${log.id}:`, autoErr.message);
                                        }
                                    }, delaySeconds * 1000);
                                }
                            }
                            else {
                                // Qualification is COLD, SPAM or below minScore threshold, mark ignored
                                await prisma_1.default.socialListeningLog.update({
                                    where: { id: log.id },
                                    data: { status: 'IGNORED' },
                                });
                            }
                        };
                        await processComment();
                    }
                }
            }
        }
        catch (err) {
            console.error(`[Social Listening Campaign Scan Error]:`, err.message);
            if (err.message === 'COOKIE_EXPIRED') {
                // Mark cookie status as EXPIRED
                await prisma_1.default.socialListeningCampaign.update({
                    where: { id: campaign.id },
                    data: { cookieStatus: 'EXPIRED' },
                });
                // Notify user about expired cookie
                const warningText = `⚠️ *Cảnh báo: Cookie Facebook Hết Hạn*\n\n` +
                    `Chiến dịch: *${campaign.name}*\n` +
                    `Phiên quét facebook đã bị ngắt kết nối do Cookie hết hạn hoặc không hoạt động. Vui lòng kết nối lại tài khoản Facebook bằng cách nhập Cookie thủ công trên Dashboard Be Traffic.`;
                try {
                    await (0, telegramService_1.sendTelegramAlert)(finalBotToken, finalChatId, warningText);
                }
                catch (teleErr) {
                    console.error(`Failed to send Telegram cookie warning: ${teleErr.message}`);
                }
                return { success: false, postsCount: totalPostsScraped, leadsFound: totalLeadsFound, error: 'COOKIE_EXPIRED' };
            }
            return { success: false, postsCount: totalPostsScraped, leadsFound: totalLeadsFound, error: err.message };
        }
    }
    try {
        await prisma_1.default.socialListeningCampaign.update({
            where: { id: campaign.id },
            data: { lastScannedAt: new Date() },
        });
    }
    catch (dbErr) {
        console.error(`[Social Listening] Failed to update lastScannedAt: ${dbErr.message}`);
    }
    return { success: true, postsCount: totalPostsScraped, leadsFound: totalLeadsFound };
}
/**
 * Scrapes all active campaigns that are due for scanning
 */
async function runSocialListeningScan() {
    console.log('🤖 [Social Listening Worker] Starting periodic scan of all active campaigns...');
    try {
        const activeCampaigns = await prisma_1.default.socialListeningCampaign.findMany({
            where: { isActive: true },
        });
        const now = new Date();
        const campaignsToScan = activeCampaigns.filter(campaign => {
            if (!campaign.lastScannedAt)
                return true; // Never scanned before
            const nextScanTime = new Date(campaign.lastScannedAt.getTime() + campaign.scanInterval * 60 * 1000);
            return nextScanTime <= now;
        });
        console.log(`[Social Listening Worker] Found ${activeCampaigns.length} active campaigns. ${campaignsToScan.length} are due for scan.`);
        for (const campaign of campaignsToScan) {
            await executeCampaignScan(campaign.id);
        }
        console.log('🤖 [Social Listening Worker] Periodic scan completed.');
    }
    catch (err) {
        console.error('❌ [Social Listening Worker Error]:', err.message);
    }
}
/**
 * Registers the node-cron task to scan social listening campaigns periodically.
 */
function startSocialListeningEngine() {
    console.log('🤖 AI Social Listening Engine Registered (Every minute check)');
    // Run every minute to check for campaigns due for scanning
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            await runSocialListeningScan();
        }
        catch (err) {
            console.error('[Social Listening Engine Cron Error]:', err);
        }
    });
    // Run once immediately on start for testing unless disabled
    if (process.env.TRIGGER_LISTENING_ON_START === 'true') {
        console.log('[Social Listening Engine] Triggering immediate scan (TRIGGER_LISTENING_ON_START=true)...');
        runSocialListeningScan().catch(err => {
            console.error('[Social Listening Engine] Immediate scan error:', err);
        });
    }
}
