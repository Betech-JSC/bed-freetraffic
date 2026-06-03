"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRssScannerEngine = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const dispatch_1 = require("../lib/dispatch");
const aiGenerate_1 = require("../services/aiGenerate");
function extractTag(xml, tag) {
    const regex = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
    const m = regex.exec(xml);
    return m ? m[1].trim() : '';
}
async function getRandomTemplate(taskId) {
    const templates = await prisma_1.default.postTemplate.findMany({
        where: {
            isActive: true,
            OR: [{ taskId }, { taskId: null }],
        },
    });
    if (templates.length === 0)
        return null;
    return templates[Math.floor(Math.random() * templates.length)];
}
function renderContent(templateContent, article) {
    return templateContent
        .replace(/\{url\}/g, article.link)
        .replace(/\{name\}/g, article.title)
        .replace(/\{description\}/g, article.description)
        .replace(/\{date\}/g, new Date(article.pubDate).toLocaleDateString('vi-VN'));
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
                    let platformList = [];
                    try {
                        platformList = JSON.parse(task.platforms);
                        if (!Array.isArray(platformList)) {
                            platformList = [String(task.platforms)];
                        }
                    }
                    catch {
                        platformList = String(task.platforms).split(',').map(p => p.trim());
                    }
                    const platformsStr = platformList.join(',');
                    for (const item of itemsToPublish) {
                        console.log(`[RSS BOT] Đang đăng bài viết mới: "${item.title}"`);
                        let title = item.title;
                        let content = '';
                        let imageUrl = null;
                        if (task.useAi) {
                            try {
                                const aiResult = await (0, aiGenerate_1.generateAiPostContent)(item.link, task.aiPrompt);
                                title = aiResult.title;
                                content = aiResult.content;
                                if (task.aiGenerateImage) {
                                    imageUrl = await (0, aiGenerate_1.generateAiImage)(title);
                                }
                            }
                            catch (err) {
                                console.error('[RSS BOT AI ERROR]:', err);
                                // Fallback to template/default if AI fails
                                const template = await getRandomTemplate(task.id);
                                if (template) {
                                    title = template.title;
                                    content = renderContent(template.content, item);
                                    imageUrl = template.thumbnailUrl || template.imageUrl;
                                }
                                else {
                                    content = `${item.description || item.title}\n\nXem chi tiết tại: {url}`;
                                }
                            }
                        }
                        else {
                            const template = await getRandomTemplate(task.id);
                            if (template) {
                                title = template.title;
                                content = renderContent(template.content, item);
                                imageUrl = template.thumbnailUrl || template.imageUrl;
                            }
                            else {
                                content = `${item.description || item.title}\n\nXem chi tiết tại: {url}`;
                            }
                        }
                        // Replace {url} placeholder with actual item link if not done by renderer/AI
                        content = content.replace(/\{url\}/g, item.link);
                        // Dispatch
                        const results = await (0, dispatch_1.dispatchToAllPlatforms)(platformsStr, {
                            title,
                            content,
                            imageUrl,
                            urlTarget: item.link,
                            emailRecipients: task.emailRecipients || undefined
                        });
                        // Log results
                        for (const res of results) {
                            await prisma_1.default.botLog.create({
                                data: {
                                    taskId: task.id,
                                    action: `RSS_POST_${res.platform.toUpperCase()}`,
                                    message: `[RSS] ${res.message} | Bài viết: "${item.title}"`,
                                    status: res.success ? 'SUCCESS' : 'ERROR'
                                }
                            });
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
