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
        select: { id: true, name: true, templateAId: true, templateBId: true, landingPageAId: true, landingPageBId: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(tests);
});
router.get('/', async (req, res) => {
    const tests = await prisma_1.default.abTest.findMany({
        where: { workspaceId: req.workspaceId },
        include: { templateA: true, templateB: true, landingPageA: true, landingPageB: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(tests);
});
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { name, templateAId, templateBId, landingPageAId, landingPageBId } = req.body;
    if (!name) {
        res.status(400).json({ error: 'name là bắt buộc' });
        return;
    }
    const test = await prisma_1.default.abTest.create({
        data: {
            name,
            templateAId: templateAId ? parseInt(templateAId) : null,
            templateBId: templateBId ? parseInt(templateBId) : null,
            landingPageAId: landingPageAId ? parseInt(landingPageAId) : null,
            landingPageBId: landingPageBId ? parseInt(landingPageBId) : null,
            status: 'RUNNING',
            workspaceId: req.workspaceId,
        },
        include: { templateA: true, templateB: true, landingPageA: true, landingPageB: true },
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
    let winner = req.body.winner;
    if (!winner) {
        const clicksA = test.clicksA;
        const clicksB = test.clicksB;
        const impressionsA = test.impressionsA;
        const impressionsB = test.impressionsB;
        const scoreA = impressionsA > 0 ? clicksA / impressionsA : 0;
        const scoreB = impressionsB > 0 ? clicksB / impressionsB : 0;
        const totalConversions = clicksA + clicksB;
        const totalImpressions = impressionsA + impressionsB;
        const totalNonConversions = totalImpressions - totalConversions;
        let isSignificant = false;
        let chiSquare = 0;
        if (impressionsA > 0 && impressionsB > 0 && totalConversions > 0 && totalNonConversions > 0) {
            const o11 = clicksA;
            const o12 = impressionsA - clicksA;
            const o21 = clicksB;
            const o22 = impressionsB - clicksB;
            const numerator = totalImpressions * Math.pow(o11 * o22 - o12 * o21, 2);
            const denominator = impressionsA * impressionsB * totalConversions * totalNonConversions;
            if (denominator > 0) {
                chiSquare = numerator / denominator;
                // Critical value for alpha = 0.05 (df = 1) is 3.841
                if (chiSquare > 3.841) {
                    isSignificant = true;
                }
            }
        }
        if (isSignificant) {
            winner = scoreA > scoreB ? 'A' : 'B';
        }
        else {
            winner = 'tie';
        }
    }
    const updated = await prisma_1.default.abTest.update({
        where: { id },
        data: { status: 'COMPLETED', winner },
    });
    res.json(updated);
});
router.get('/:id/stats', async (req, res) => {
    const id = parseInt(req.params.id);
    const test = await prisma_1.default.abTest.findFirst({
        where: { id, workspaceId: req.workspaceId },
        include: { templateA: true, templateB: true, landingPageA: true, landingPageB: true }
    });
    if (!test) {
        res.status(404).json({ error: 'Không tìm thấy chiến dịch A/B Test' });
        return;
    }
    const { clicksA, clicksB, impressionsA, impressionsB } = test;
    const crA = impressionsA > 0 ? clicksA / impressionsA : 0;
    const crB = impressionsB > 0 ? clicksB / impressionsB : 0;
    let improvement = 0;
    if (crA > 0) {
        improvement = ((crB - crA) / crA) * 100;
    }
    const totalConversions = clicksA + clicksB;
    const totalImpressions = impressionsA + impressionsB;
    const totalNonConversions = totalImpressions - totalConversions;
    let isSignificant = false;
    let chiSquare = 0;
    let confidenceLevel = 'Không đáng kể';
    if (impressionsA > 0 && impressionsB > 0 && totalConversions > 0 && totalNonConversions > 0) {
        const o11 = clicksA;
        const o12 = impressionsA - clicksA;
        const o21 = clicksB;
        const o22 = impressionsB - clicksB;
        const numerator = totalImpressions * Math.pow(o11 * o22 - o12 * o21, 2);
        const denominator = impressionsA * impressionsB * totalConversions * totalNonConversions;
        if (denominator > 0) {
            chiSquare = numerator / denominator;
            if (chiSquare > 6.635) {
                isSignificant = true;
                confidenceLevel = '99%';
            }
            else if (chiSquare > 3.841) {
                isSignificant = true;
                confidenceLevel = '95%';
            }
            else if (chiSquare > 2.706) {
                isSignificant = false;
                confidenceLevel = '90%';
            }
        }
    }
    let currentLeader = 'tie';
    if (crA > crB) {
        currentLeader = 'A';
    }
    else if (crB > crA) {
        currentLeader = 'B';
    }
    res.json({
        test,
        stats: {
            crA,
            crB,
            improvement,
            chiSquare,
            isSignificant,
            confidenceLevel,
            currentLeader,
            totalImpressions,
            totalConversions
        }
    });
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
