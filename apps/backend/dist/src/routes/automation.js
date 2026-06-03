"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
// Lấy danh sách nhiệm vụ Automation
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await prisma_1.default.automationTask.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tasks);
    }
    catch (error) {
        console.error('[automation/tasks GET]', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Tạo nhiệm vụ mới (Thêm Bot)
router.post('/tasks', async (req, res) => {
    try {
        const { name, urlTarget, platforms, interval, emailRecipients, abTestId, useAi, aiPrompt, aiGenerateImage, rssUrl } = req.body;
        if (!name || !urlTarget || !platforms) {
            res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
            return;
        }
        const newTask = await prisma_1.default.automationTask.create({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Công tắc Bật/Tắt Bot
router.post('/tasks/:id/toggle', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const task = await prisma_1.default.automationTask.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!task) {
            res.status(404).json({ error: 'Không tìm thấy nhiệm vụ' });
            return;
        }
        const newStatus = task.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';
        const updatedTask = await prisma_1.default.automationTask.update({
            where: { id },
            data: { status: newStatus }
        });
        res.json(updatedTask);
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Xóa chiến dịch Bot (log liên quan xóa theo cascade)
router.delete('/tasks/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'ID không hợp lệ' });
            return;
        }
        const task = await prisma_1.default.automationTask.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!task) {
            res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
            return;
        }
        await prisma_1.default.automationTask.delete({ where: { id } });
        res.json({ success: true, message: `Đã xóa chiến dịch "${task.name}"` });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Lấy Log của tất cả Bot để hiển thị lên bảng điều khiển Hacker-style
router.get('/logs', async (req, res) => {
    try {
        const tasksInWorkspace = await prisma_1.default.automationTask.findMany({
            where: { workspaceId: req.workspaceId },
            select: { id: true, name: true }
        });
        const taskIds = tasksInWorkspace.map((t) => t.id);
        const logs = taskIds.length > 0
            ? await prisma_1.default.botLog.findMany({
                where: { taskId: { in: taskIds } },
                take: 100,
                orderBy: { createdAt: 'desc' },
            })
            : [];
        const nameById = new Map(tasksInWorkspace.map((t) => [t.id, t.name]));
        res.json(logs.map((log) => ({
            ...log,
            task: { name: nameById.get(log.taskId) ?? 'Chiến dịch đã xóa' },
        })));
    }
    catch (error) {
        console.error('[automation/logs]', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
exports.default = router;
