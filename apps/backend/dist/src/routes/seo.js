"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const seoAuditService_1 = require("../services/seoAuditService");
const pagespeedAuditService_1 = require("../services/pagespeedAuditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/audits', async (req, res) => {
    const audits = await prisma_1.default.seoAudit.findMany({
        where: { workspaceId: req.workspaceId },
        include: { issues: true },
        orderBy: { auditedAt: 'desc' },
        take: 50,
    });
    res.json(audits);
});
router.post('/audit', auth_1.requireWrite, async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: 'URL là bắt buộc' });
        return;
    }
    const maxPerDay = parseInt(process.env.MAX_SEO_AUDITS_PER_DAY || '20', 10);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await prisma_1.default.seoAudit.count({
        where: { auditedAt: { gte: startOfDay }, workspaceId: req.workspaceId },
    });
    if (todayCount >= maxPerDay) {
        res.status(429).json({
            error: `Đã đạt giới hạn ${maxPerDay} lần audit/ngày (SRS OI-01). Thử lại ngày mai.`,
        });
        return;
    }
    const result = await (0, seoAuditService_1.runSeoAudit)(url);
    const audit = await prisma_1.default.seoAudit.create({
        data: {
            url,
            score: result.score,
            technicalScore: result.technicalScore,
            contentScore: result.contentScore,
            uxScore: result.uxScore,
            issues: { create: result.issues },
            workspaceId: req.workspaceId,
        },
        include: { issues: true },
    });
    res.status(201).json(audit);
});
router.post('/pagespeed', auth_1.requireWrite, async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: 'URL là bắt buộc' });
        return;
    }
    try {
        const result = await (0, pagespeedAuditService_1.runPageSpeedAudit)(url);
        const audit = await prisma_1.default.seoAudit.create({
            data: {
                url,
                score: result.score,
                technicalScore: result.technicalScore,
                contentScore: result.contentScore,
                uxScore: result.uxScore,
                issues: { create: result.issues },
                workspaceId: req.workspaceId,
            },
            include: { issues: true },
        });
        res.status(201).json(audit);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'PageSpeed Audit thất bại' });
    }
});
router.get('/history', async (req, res) => {
    const url = req.query.url?.trim();
    if (!url) {
        res.status(400).json({ error: 'Tham số url là bắt buộc' });
        return;
    }
    const audits = await prisma_1.default.seoAudit.findMany({
        where: { url, workspaceId: req.workspaceId },
        include: { issues: true },
        orderBy: { auditedAt: 'asc' },
        take: 20,
    });
    res.json(audits);
});
router.get('/audits/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const audit = await prisma_1.default.seoAudit.findFirst({
        where: { id, workspaceId: req.workspaceId },
        include: { issues: true },
    });
    if (!audit) {
        res.status(404).json({ error: 'Không tìm thấy audit' });
        return;
    }
    res.json(audit);
});
exports.default = router;
