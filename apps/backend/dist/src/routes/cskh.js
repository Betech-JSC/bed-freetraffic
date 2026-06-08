"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Load CSKH Config
router.get('/config', auth_1.authenticate, async (req, res) => {
    try {
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
        autoCareEnabled, autoCareScheduleType, autoCareDelayHours, autoCareIntervalDays, autoCareEmailSubject, autoCareEmailBody, autoCareChannels, } = req.body;
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
                },
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
exports.default = router;
