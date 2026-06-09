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
exports.startRssScannerEngine = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const dispatch_1 = require("../lib/dispatch");
const render_1 = require("../lib/dispatch/render");
const aiGenerate_1 = require("../services/aiGenerate");
const automationTemplate_1 = require("../services/automationTemplate");
function extractTag(xml, tag) {
    const regex = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
    const m = regex.exec(xml);
    return m ? m[1].trim() : '';
}
const startRssScannerEngine = () => {
    console.log('📰 RSS Reader Bot Engine Started...');
    // Run every 30 minutes
    node_cron_1.default.schedule('*/30 * * * *', async () => {
        try {
            const activeTasks = await prisma_1.default.automationTask.findMany({
                where: {
                    status: 'RUNNING',
                    rssUrl: { not: null }
                }
            });
            for (const task of activeTasks) {
                if (!task.rssUrl)
                    continue;
                console.log(`[RSS BOT] Quét RSS cho chiến dịch: ${task.name} (URL: ${task.rssUrl})`);
                try {
                    const response = await fetch(task.rssUrl, { signal: AbortSignal.timeout(15000) });
                    if (!response.ok) {
                        throw new Error(`Không tải được RSS, status: ${response.status}`);
                    }
                    const xmlText = await response.text();
                    const items = [];
                    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
                    let match;
                    while ((match = itemRegex.exec(xmlText)) !== null) {
                        const itemXml = match[1];
                        const title = extractTag(itemXml, 'title');
                        const link = extractTag(itemXml, 'link');
                        const pubDate = extractTag(itemXml, 'pubDate');
                        const description = extractTag(itemXml, 'description');
                        if (title && link) {
                            items.push({ title, link, pubDate, description });
                        }
                    }
                    if (items.length === 0) {
                        console.log(`[RSS BOT] Không tìm thấy bài viết nào trong RSS: ${task.rssUrl}`);
                        continue;
                    }
                    const parsedItems = items.map(item => {
                        const time = Date.parse(item.pubDate);
                        return {
                            ...item,
                            timestamp: Number.isNaN(time) ? Date.now() : time
                        };
                    });
                    // Sort oldest to newest
                    parsedItems.sort((a, b) => a.timestamp - b.timestamp);
                    const latestItem = parsedItems[parsedItems.length - 1];
                    let itemsToPublish = [];
                    const prevPubDate = task.rssLastPubDate;
                    if (!prevPubDate) {
                        // First run: just publish the single latest item to verify it works, then save state
                        itemsToPublish = [latestItem];
                    }
                    else {
                        const refTime = Date.parse(prevPubDate);
                        const refTimestamp = Number.isNaN(refTime) ? 0 : refTime;
                        itemsToPublish = parsedItems.filter(x => x.timestamp > refTimestamp);
                        // Cap to maximum 3 items to avoid spamming channels in one run
                        if (itemsToPublish.length > 3) {
                            itemsToPublish = itemsToPublish.slice(-3);
                        }
                    }
                    if (itemsToPublish.length === 0) {
                        console.log(`[RSS BOT] Không có bài viết mới kể từ ${prevPubDate || 'lần chạy trước'}`);
                        continue;
                    }
                    let targets = [];
                    if (task.targetConnectionsJson) {
                        try {
                            const parsed = JSON.parse(task.targetConnectionsJson);
                            if (Array.isArray(parsed)) {
                                targets = parsed.map((t) => ({
                                    connectionId: Number(t.connectionId),
                                    platform: String(t.platform).trim().toLowerCase(),
                                    pageName: t.pageName ? String(t.pageName) : undefined
                                })).filter(t => t.connectionId && t.platform);
                            }
                        }
                        catch {
                            // ignore
                        }
                    }
                    if (targets.length === 0) {
                        const platformList = (0, dispatch_1.parsePlatforms)(task.platforms);
                        for (const p of platformList) {
                            targets.push({ connectionId: 0, platform: p });
                        }
                    }
                    const { dispatchToPlatform } = await Promise.resolve().then(() => __importStar(require('../lib/dispatch')));
                    for (const item of itemsToPublish) {
                        console.log(`[RSS BOT] Đang đăng bài viết mới: "${item.title}"`);
                        for (const target of targets) {
                            let pageName = target.pageName;
                            if (!pageName && target.connectionId > 0) {
                                const conn = await prisma_1.default.socialConnection.findUnique({ where: { id: target.connectionId } });
                                pageName = conn?.pageName || undefined;
                            }
                            let title = item.title;
                            let content = '';
                            let imageUrl = null;
                            if (task.useAi) {
                                try {
                                    const originalPrompt = task.aiPrompt || '';
                                    const customPrompt = pageName
                                        ? `${originalPrompt}\n\n[Lưu ý quan trọng]: Viết nội dung này dành riêng cho đối tượng độc giả và mang bản sắc thương hiệu của trang '${pageName}'. Điều chỉnh giọng văn và cấu trúc câu để khác biệt so với các bài đăng khác.`
                                        : originalPrompt;
                                    const aiResult = await (0, aiGenerate_1.generateAiPostContent)(item.link, customPrompt);
                                    title = aiResult.title;
                                    content = aiResult.content;
                                    if (task.aiGenerateImage) {
                                        imageUrl = await (0, aiGenerate_1.generateAiImage)(title);
                                    }
                                }
                                catch (err) {
                                    console.error('[RSS BOT AI ERROR]:', err);
                                    // Fallback to template/default if AI fails
                                    const template = await (0, automationTemplate_1.getRandomTemplate)(task.id);
                                    if (template) {
                                        title = template.title;
                                        content = (0, render_1.renderContent)(template.content, {
                                            urlTarget: item.link,
                                            name: item.title,
                                            description: item.description,
                                            date: item.pubDate,
                                        });
                                        imageUrl = template.thumbnailUrl || template.imageUrl;
                                    }
                                    else {
                                        content = `${item.description || item.title}\n\nXem chi tiết tại: {url}`;
                                    }
                                }
                            }
                            else {
                                const template = await (0, automationTemplate_1.getRandomTemplate)(task.id);
                                if (template) {
                                    title = template.title;
                                    content = (0, render_1.renderContent)(template.content, {
                                        urlTarget: item.link,
                                        name: item.title,
                                        description: item.description,
                                        date: item.pubDate,
                                    });
                                    imageUrl = template.thumbnailUrl || template.imageUrl;
                                }
                                else {
                                    content = `${item.description || item.title}\n\nXem chi tiết tại: {url}`;
                                }
                            }
                            // Replace {url} placeholder with actual item link if not done by renderer/AI
                            content = content.replace(/\{url\}/g, item.link);
                            // Dispatch to the target connection
                            let result;
                            try {
                                result = await dispatchToPlatform(target.platform, {
                                    title,
                                    content,
                                    imageUrl,
                                    urlTarget: item.link,
                                    emailRecipients: task.emailRecipients || undefined,
                                    workspaceId: task.workspaceId || undefined,
                                    connectionId: target.connectionId > 0 ? target.connectionId : undefined,
                                });
                            }
                            catch (err) {
                                result = { success: false, message: `Lỗi thực thi: ${err.message}` };
                            }
                            // Log results
                            const displayTarget = pageName ? `${target.platform} (${pageName})` : target.platform;
                            await prisma_1.default.botLog.create({
                                data: {
                                    taskId: task.id,
                                    action: `RSS_POST_${target.platform.toUpperCase()}`,
                                    message: `[RSS][Trang: ${pageName || 'Mặc định'}] ${result.message} | Bài viết: "${item.title}"`,
                                    status: result.success ? 'SUCCESS' : 'ERROR'
                                }
                            });
                            console.log(`  -> [RSS][${displayTarget}] ${result.message}`);
                        }
                    }
                    // Update task rssLastPubDate to the latest processed item
                    await prisma_1.default.automationTask.update({
                        where: { id: task.id },
                        data: {
                            rssLastPubDate: latestItem.pubDate,
                            lastRunAt: new Date()
                        }
                    });
                }
                catch (err) {
                    console.error(`[RSS BOT ERROR] Lỗi khi xử lý tác vụ ${task.name}:`, err.message);
                    await prisma_1.default.botLog.create({
                        data: {
                            taskId: task.id,
                            action: 'RSS_SCAN',
                            message: `Lỗi quét RSS: ${err.message}`,
                            status: 'ERROR'
                        }
                    });
                }
            }
        }
        catch (error) {
            console.error('[RSS BOT GENERAL ERROR]:', error);
        }
    });
};
exports.startRssScannerEngine = startRssScannerEngine;
