"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    const channels = await prisma_1.default.channel.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(channels);
});
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { name, type, url, apiConfig, connectionStatus } = req.body;
    if (!name || !type) {
        res.status(400).json({ error: 'Tên và loại kênh là bắt buộc' });
        return;
    }
    const channel = await prisma_1.default.channel.create({
        data: {
            name,
            type,
            url,
            status: 'ACTIVE',
            apiConfig: apiConfig ? JSON.stringify(apiConfig) : null,
            connectionStatus: connectionStatus || 'DISCONNECTED',
            workspaceId: req.workspaceId,
        },
    });
    res.status(201).json(channel);
});
router.put('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, type, url, status, apiConfig, connectionStatus } = req.body;
    const existing = await prisma_1.default.channel.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy kênh' });
        return;
    }
    const channel = await prisma_1.default.channel.update({
        where: { id },
        data: {
            name,
            type,
            url,
            status,
            connectionStatus,
            apiConfig: apiConfig != null ? JSON.stringify(apiConfig) : undefined,
        },
    });
    res.json(channel);
});
router.post('/:id/test', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const channel = await prisma_1.default.channel.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!channel) {
        res.status(404).json({ error: 'Không tìm thấy kênh' });
        return;
    }
    const connected = channel.connectionStatus === 'CONNECTED' || !!channel.apiConfig;
    await prisma_1.default.channel.update({
        where: { id },
        data: { connectionStatus: connected ? 'CONNECTED' : 'ERROR' },
    });
    res.json({
        ok: connected,
        message: connected ? 'Kết nối ổn định' : 'Chưa cấu hình API — cập nhật apiConfig trong kênh',
    });
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.channel.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy kênh' });
        return;
    }
    await prisma_1.default.channel.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
