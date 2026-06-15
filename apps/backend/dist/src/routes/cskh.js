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
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const socket_1 = require("../lib/socket");
const cache_1 = require("../lib/cache");
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const embeddings_1 = require("../lib/embeddings");
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});
// Load CSKH Config (Real-time Config)
router.get('/config', auth_1.authenticate, async (req, res) => {
    const cacheKey = `ws:${req.workspaceId}:cskh-config`;
    try {
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        let config = await prisma_1.default.cskhConfig.findUnique({
            where: { workspaceId: req.workspaceId },
        });
        if (!config) {
            config = await prisma_1.default.cskhConfig.create({
                data: {
                    workspaceId: req.workspaceId,
                    liveChatEnabled: false,
                    aiChatbotEnabled: false,
                },
            });
        }
        await cache_1.cache.set(cacheKey, config, 600); // Cache for 10 minutes
        res.json(config);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy cấu hình CSKH' });
    }
});
// Save CSKH Config
router.post('/config', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const { liveChatEnabled, aiChatbotEnabled, knowledgeBaseText, notificationChannels, followUpDelayHours, followUpEmailSubject, followUpEmailBody, 
        // new fields
        autoCareEnabled, autoCareScheduleType, autoCareDelayHours, autoCareIntervalDays, autoCareEmailSubject, autoCareEmailBody, autoCareChannels, widgetSettings, } = req.body;
        const existing = await prisma_1.default.cskhConfig.findUnique({
            where: { workspaceId: req.workspaceId },
        });
        const delayHours = followUpDelayHours !== undefined ? (followUpDelayHours === null ? null : parseInt(String(followUpDelayHours), 10)) : undefined;
        let config;
        if (existing) {
            config = await prisma_1.default.cskhConfig.update({
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
                    widgetSettings: widgetSettings !== undefined ? widgetSettings : existing.widgetSettings,
                },
            });
        }
        else {
            config = await prisma_1.default.cskhConfig.create({
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
                    widgetSettings: widgetSettings || null,
                },
            });
        }
        if (knowledgeBaseText !== undefined || !existing) {
            void (0, embeddings_1.syncKnowledgeBaseEmbeddings)(req.workspaceId, config.knowledgeBaseText || '');
        }
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['cskh-config', 'rag']).catch(err => {
                console.error('[Cache Invalidation Error]:', err);
            });
        }
        res.json({ success: true, config });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình CSKH' });
    }
});
// Get all Chat Sessions for the Workspace
router.get('/sessions', auth_1.authenticate, async (req, res) => {
    try {
        const sessions = await prisma_1.default.chatSession.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách hội thoại' });
    }
});
// Get Chat Messages for a Chat Session
router.get('/sessions/:id/messages', auth_1.authenticate, async (req, res) => {
    try {
        const id = req.params.id;
        const session = await prisma_1.default.chatSession.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!session) {
            res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
            return;
        }
        const messages = await prisma_1.default.chatMessage.findMany({
            where: { sessionId: id },
            orderBy: { createdAt: 'asc' },
        });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy tin nhắn hội thoại' });
    }
});
// Send Agent Reply (Human Takeover)
router.post('/sessions/:id/send-agent', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { content } = req.body;
        if (!content?.trim()) {
            res.status(400).json({ error: 'Nội dung tin nhắn không được trống' });
            return;
        }
        const session = await prisma_1.default.chatSession.findFirst({
            where: { id: sessionId, workspaceId: req.workspaceId },
        });
        if (!session) {
            res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
            return;
        }
        const message = await prisma_1.default.chatMessage.create({
            data: {
                sessionId,
                sender: 'agent',
                content: content.trim(),
            },
        });
        await prisma_1.default.chatSession.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
        });
        try {
            const io = (0, socket_1.getIo)();
            if (io) {
                io.to(`session:${sessionId}`).emit('new_message', message);
                io.to(`workspace:${req.workspaceId}`).emit('new_message', message);
            }
        }
        catch (socketErr) {
            console.error('[Socket.io] Error broadcasting agent message:', socketErr);
        }
        res.json({ success: true, message });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi gửi tin nhắn agent' });
    }
});
// Delete a Chat Session
router.delete('/sessions/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = req.params.id;
        const session = await prisma_1.default.chatSession.findFirst({
            where: { id, workspaceId: req.workspaceId },
        });
        if (!session) {
            res.status(404).json({ error: 'Không tìm thấy phiên hội thoại này' });
            return;
        }
        await prisma_1.default.chatSession.delete({
            where: { id },
        });
        res.json({ success: true, message: 'Đã xóa phiên hội thoại thành công' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi xóa phiên hội thoại' });
    }
});
// Get all Knowledge Sources
router.get('/knowledge/sources', auth_1.authenticate, async (req, res) => {
    const cacheKey = `ws:${req.workspaceId}:knowledge-sources`;
    try {
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const sources = await prisma_1.default.knowledgeSource.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { chunks: true }
                }
            }
        });
        await cache_1.cache.set(cacheKey, sources, 600); // Cache for 10 minutes
        res.json(sources);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách tài liệu tri thức' });
    }
});
// Preview Knowledge Source Text
router.get('/knowledge/sources/:id/preview', auth_1.authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const source = await prisma_1.default.knowledgeSource.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!source) {
            res.status(404).json({ error: 'Không tìm thấy tài liệu này' });
            return;
        }
        res.json({
            id: source.id,
            name: source.name,
            extractedText: source.extractedText
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi xem trước tài liệu' });
    }
});
// Delete Knowledge Source
router.delete('/knowledge/sources/:id', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const source = await prisma_1.default.knowledgeSource.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!source) {
            res.status(404).json({ error: 'Không tìm thấy tài liệu này' });
            return;
        }
        await prisma_1.default.knowledgeSource.delete({
            where: { id }
        });
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['rag', 'knowledge-sources']).catch(err => {
                console.error('[Cache Invalidation Error]:', err);
            });
        }
        res.json({ success: true, message: `Đã xóa tài liệu: ${source.name}` });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi xóa tài liệu' });
    }
});
// Re-sync Knowledge Source
router.post('/knowledge/sources/:id/re-sync', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const source = await prisma_1.default.knowledgeSource.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!source) {
            res.status(404).json({ error: 'Không tìm thấy tài liệu này' });
            return;
        }
        if (source.type === 'URL' && source.url) {
            const response = await axios_1.default.get(source.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });
            const html = response.data;
            const $ = cheerio.load(html);
            $('script, style, iframe, nav, header, footer, noscript').remove();
            const title = $('title').text().trim() || source.name;
            const texts = [];
            $('h1, h2, h3, h4, h5, p, li').each((_, element) => {
                const text = $(element).text().trim();
                if (text.length > 20) {
                    texts.push(text);
                }
            });
            const extractedText = texts.join('\n');
            if (!extractedText.trim()) {
                res.status(400).json({ error: 'Không thể thu thập đủ nội dung văn bản từ URL này.' });
                return;
            }
            await prisma_1.default.knowledgeSource.update({
                where: { id },
                data: {
                    name: title,
                    extractedText,
                    status: 'PROCESSING'
                }
            });
        }
        else {
            await prisma_1.default.knowledgeSource.update({
                where: { id },
                data: { status: 'PROCESSING' }
            });
        }
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['knowledge-sources']).catch(() => { });
        }
        const { syncSourceEmbeddings } = require('../lib/embeddings');
        void syncSourceEmbeddings(id);
        res.json({ success: true, message: 'Đang tiến hành đồng bộ lại tri thức...' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi đồng bộ lại tài liệu' });
    }
});
// Upload File tri thức (PDF, DOCX, TXT)
router.post('/knowledge/upload', auth_1.authenticate, auth_1.requireWrite, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'Vui lòng cung cấp tệp tin tải lên (PDF, DOCX, TXT)' });
            return;
        }
        let extractedText = '';
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        if (extension === 'txt') {
            extractedText = file.buffer.toString('utf-8');
        }
        else if (extension === 'pdf') {
            const parser = new pdfParse.PDFParse({ data: file.buffer });
            const parsed = await parser.getText();
            extractedText = parsed.text;
        }
        else if (extension === 'docx') {
            const parsed = await mammoth.extractRawText({ buffer: file.buffer });
            extractedText = parsed.value;
        }
        else {
            res.status(400).json({ error: 'Định dạng tệp không được hỗ trợ. Vui lòng tải lên .pdf, .docx, hoặc .txt' });
            return;
        }
        if (!extractedText.trim()) {
            res.status(400).json({ error: 'Không thể trích xuất văn bản từ tệp tin hoặc tệp rỗng.' });
            return;
        }
        const source = await prisma_1.default.knowledgeSource.create({
            data: {
                workspaceId: req.workspaceId,
                name: file.originalname,
                type: 'FILE',
                fileSize: file.size,
                extractedText: extractedText.trim(),
                status: 'PROCESSING'
            }
        });
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['knowledge-sources']).catch(() => { });
        }
        const { syncSourceEmbeddings } = require('../lib/embeddings');
        void syncSourceEmbeddings(source.id);
        res.json({
            success: true,
            message: `Đang xử lý tài liệu: ${file.originalname}`,
            source
        });
    }
    catch (error) {
        console.error('Lỗi upload tri thức:', error);
        res.status(500).json({ error: error.message || 'Lỗi xử lý tệp tin tri thức' });
    }
});
// Crawl Website
router.post('/knowledge/crawl', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ error: 'Vui lòng cung cấp URL trang web muốn học' });
            return;
        }
        const source = await prisma_1.default.knowledgeSource.create({
            data: {
                workspaceId: req.workspaceId,
                name: url,
                type: 'URL',
                url: url,
                status: 'PROCESSING'
            }
        });
        const crawlAndSync = async () => {
            try {
                const response = await axios_1.default.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 10000
                });
                const html = response.data;
                const $ = cheerio.load(html);
                $('script, style, iframe, nav, header, footer, noscript').remove();
                const title = $('title').text().trim() || url;
                const texts = [];
                $('h1, h2, h3, h4, h5, p, li').each((_, element) => {
                    const text = $(element).text().trim();
                    if (text.length > 20) {
                        texts.push(text);
                    }
                });
                const extractedText = texts.join('\n');
                if (!extractedText.trim()) {
                    throw new Error('Không thể thu thập đủ nội dung văn bản từ URL này hoặc trang rỗng.');
                }
                await prisma_1.default.knowledgeSource.update({
                    where: { id: source.id },
                    data: {
                        name: title,
                        extractedText: extractedText.trim()
                    }
                });
                const { syncSourceEmbeddings } = require('../lib/embeddings');
                await syncSourceEmbeddings(source.id);
                void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['knowledge-sources']).catch(() => { });
            }
            catch (err) {
                console.error(`[Crawl RAG] Lỗi crawl URL ${url}:`, err);
                await prisma_1.default.knowledgeSource.update({
                    where: { id: source.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: err.message || String(err)
                    }
                });
                void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['knowledge-sources']).catch(() => { });
            }
        };
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['knowledge-sources']).catch(() => { });
        }
        void crawlAndSync();
        res.json({
            success: true,
            message: `Đang bắt đầu cào dữ liệu từ URL: ${url}`,
            source
        });
    }
    catch (error) {
        console.error('Lỗi crawl tri thức:', error);
        res.status(500).json({ error: error.message || 'Lỗi cào dữ liệu từ URL' });
    }
});
// Reset Tri thức
router.post('/knowledge/reset', auth_1.authenticate, auth_1.requireWrite, async (req, res) => {
    try {
        await prisma_1.default.knowledgeSource.deleteMany({
            where: { workspaceId: req.workspaceId }
        });
        if (req.workspaceId) {
            void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['rag', 'knowledge-sources']).catch(err => {
                console.error('[Cache Invalidation Error]:', err);
            });
        }
        res.json({ success: true, message: 'Đã đặt lại và xóa sạch tri thức doanh nghiệp.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi đặt lại tri thức' });
    }
});
exports.default = router;
