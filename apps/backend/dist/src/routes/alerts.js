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
router.get('/rules', async (req, res) => {
    const rules = await prisma_1.default.alertRule.findMany({
        where: { workspaceId: req.workspaceId },
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
        orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
});
router.post('/rules', auth_1.requireWrite, async (req, res) => {
    const { name, metric, threshold, comparison, notifyEmail, enabled } = req.body;
    if (!name || metric == null || threshold == null) {
        res.status(400).json({ error: 'name, metric, threshold là bắt buộc' });
        return;
    }
    const rule = await prisma_1.default.alertRule.create({
        data: {
            name,
            metric,
            threshold: parseFloat(threshold),
            comparison: comparison || 'lt',
            notifyEmail,
            enabled: enabled !== false,
            workspaceId: req.workspaceId,
        },
    });
    res.status(201).json(rule);
});
router.patch('/rules/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.alertRule.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy luật cảnh báo' });
        return;
    }
    const rule = await prisma_1.default.alertRule.update({ where: { id }, data: req.body });
    res.json(rule);
});
router.delete('/rules/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.alertRule.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy luật cảnh báo' });
        return;
    }
    await prisma_1.default.alertRule.delete({ where: { id } });
    res.status(204).send();
});
router.get('/logs', async (req, res) => {
    const rules = await prisma_1.default.alertRule.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true }
    });
    const ruleIds = rules.map((r) => r.id);
    const logs = ruleIds.length > 0
        ? await prisma_1.default.alertLog.findMany({
            where: { ruleId: { in: ruleIds } },
            include: { rule: { select: { name: true, metric: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })
        : [];
    res.json(logs);
});
exports.default = router;
