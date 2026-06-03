"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/track/click/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const variant = req.query.variant === 'B' ? 'B' : 'A';
    const target = req.query.url || '/';
    try {
        const test = await prisma_1.default.abTest.findUnique({ where: { id } });
        if (test?.status === 'RUNNING') {
            await prisma_1.default.abTest.update({
                where: { id },
                data: variant === 'B' ? { clicksB: { increment: 1 } } : { clicksA: { increment: 1 } },
            });
        }
    }
    catch {
        /* ignore */
    }
    res.redirect(target);
});
const workspace_1 = require("../middleware/workspace");
router.use(auth_1.authenticate, workspace_1.workspaceMiddleware);
router.get('/running', async (req, res) => {
    const tests = await prisma_1.default.abTest.findMany({
        where: { status: 'RUNNING', workspaceId: req.workspaceId },
        select: { id: true, name: true, templateAId: true, templateBId: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(tests);
});
router.get('/', async (req, res) => {
    const tests = await prisma_1.default.abTest.findMany({
        where: { workspaceId: req.workspaceId },
        include: { templateA: true, templateB: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(tests);
});
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { name, templateAId, templateBId } = req.body;
    if (!name) {
        res.status(400).json({ error: 'name là bắt buộc' });
        return;
    }
    const test = await prisma_1.default.abTest.create({
        data: {
            name,
            templateAId: templateAId ? parseInt(templateAId) : null,
            templateBId: templateBId ? parseInt(templateBId) : null,
            status: 'RUNNING',
            workspaceId: req.workspaceId,
        },
        include: { templateA: true, templateB: true },
    });
    res.status(201).json(test);
});
router.post('/:id/impression', async (req, res) => {
    const id = parseInt(req.params.id);
    const variant = req.body.variant || 'A';
    const test = await prisma_1.default.abTest.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!test || test.status !== 'RUNNING') {
        res.status(400).json({ error: 'Test không hợp lệ' });
        return;
    }
    const updated = await prisma_1.default.abTest.update({
        where: { id },
        data: variant === 'B' ? { impressionsB: { increment: 1 } } : { impressionsA: { increment: 1 } },
    });
    res.json(updated);
});
router.post('/:id/click', async (req, res) => {
    const id = parseInt(req.params.id);
    const variant = req.body.variant || 'A';
    const test = await prisma_1.default.abTest.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!test || test.status !== 'RUNNING') {
        res.status(400).json({ error: 'Test không hợp lệ' });
        return;
    }
    const updated = await prisma_1.default.abTest.update({
        where: { id },
        data: variant === 'B' ? { clicksB: { increment: 1 } } : { clicksA: { increment: 1 } },
    });
    res.json(updated);
});
router.post('/:id/complete', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const test = await prisma_1.default.abTest.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!test) {
        res.status(404).json({ error: 'Không tìm thấy' });
        return;
    }
    const scoreA = test.impressionsA > 0 ? test.clicksA / test.impressionsA : 0;
    const scoreB = test.impressionsB > 0 ? test.clicksB / test.impressionsB : 0;
    let winner;
    if (test.clicksA + test.clicksB > 0) {
        winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie';
    }
    else {
        winner =
            test.impressionsA > test.impressionsB
                ? 'A'
                : test.impressionsB > test.impressionsA
                    ? 'B'
                    : 'tie';
    }
    const updated = await prisma_1.default.abTest.update({
        where: { id },
        data: { status: 'COMPLETED', winner },
    });
    res.json(updated);
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.abTest.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy test A/B' });
        return;
    }
    await prisma_1.default.abTest.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
