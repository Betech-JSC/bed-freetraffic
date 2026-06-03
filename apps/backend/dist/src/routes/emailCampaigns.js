"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailCampaignSend_1 = require("../services/emailCampaignSend");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/track/open/:campaignId', async (req, res) => {
    const campaignId = parseInt(req.params.campaignId);
    try {
        await prisma_1.default.emailEvent.create({
            data: { campaignId, eventType: 'open', recipient: req.query.r || null },
        });
        await prisma_1.default.emailCampaign.update({
            where: { id: campaignId },
            data: { openCount: { increment: 1 } },
        });
    }
    catch {
        /* ignore */
    }
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(pixel);
});
router.get('/track/click/:campaignId', async (req, res) => {
    const campaignId = parseInt(req.params.campaignId);
    const target = req.query.url || '/';
    try {
        await prisma_1.default.emailEvent.create({
            data: { campaignId, eventType: 'click', recipient: req.query.r || null },
        });
        await prisma_1.default.emailCampaign.update({
            where: { id: campaignId },
            data: { clickCount: { increment: 1 } },
        });
    }
    catch {
        /* ignore */
    }
    res.redirect(target);
});
router.post('/dispatch-due', async (req, res) => {
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (process.env.CRON_SECRET) {
        if (secret !== process.env.CRON_SECRET) {
            res.status(401).json({ error: 'Cron secret không hợp lệ' });
            return;
        }
    }
    else if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ error: 'Chưa cấu hình CRON_SECRET trên server' });
        return;
    }
    const processed = await (0, emailCampaignSend_1.dispatchDueEmailCampaigns)(20);
    res.json({ processed, message: `Đã gửi ${processed} chiến dịch email đến hạn` });
});
const workspace_1 = require("../middleware/workspace");
router.use(auth_1.authenticate, workspace_1.workspaceMiddleware);
router.get('/', async (req, res) => {
    const campaigns = await prisma_1.default.emailCampaign.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
});
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { name, subject, htmlContent, recipients, scheduledAt } = req.body;
    if (!name || !subject || !htmlContent || !recipients) {
        res.status(400).json({ error: 'name, subject, htmlContent, recipients là bắt buộc' });
        return;
    }
    const campaign = await prisma_1.default.emailCampaign.create({
        data: {
            name,
            subject,
            htmlContent,
            recipients: typeof recipients === 'string' ? recipients : recipients.join(','),
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
            workspaceId: req.workspaceId,
        },
    });
    res.status(201).json(campaign);
});
router.post('/:id/send', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const campaign = await prisma_1.default.emailCampaign.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!campaign) {
        res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
        return;
    }
    try {
        const result = await (0, emailCampaignSend_1.sendEmailCampaign)(id);
        if (result.status === 'FAILED') {
            res.status(400).json({
                error: result.errors[0] || 'Không gửi được email nào. Kiểm tra SMTP trong Cài đặt.',
                sent: 0,
                total: result.total,
                errors: result.errors,
            });
            return;
        }
        res.json({
            message: `Đã gửi ${result.sent}/${result.total} email`,
            sent: result.sent,
            total: result.total,
            errors: result.errors.length ? result.errors : undefined,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Gửi thất bại';
        res.status(400).json({ error: msg });
    }
});
router.patch('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.emailCampaign.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy' });
        return;
    }
    if (existing.status === 'SENT') {
        res.status(400).json({ error: 'Chiến dịch đã gửi, không thể sửa' });
        return;
    }
    const { name, subject, htmlContent, recipients, scheduledAt } = req.body;
    const data = {};
    if (name != null)
        data.name = String(name).trim();
    if (subject != null)
        data.subject = String(subject).trim();
    if (htmlContent != null)
        data.htmlContent = String(htmlContent);
    if (recipients != null) {
        data.recipients =
            typeof recipients === 'string' ? recipients : recipients.join(',');
    }
    if (scheduledAt !== undefined) {
        if (scheduledAt === null || scheduledAt === '') {
            data.scheduledAt = null;
            data.status = 'DRAFT';
        }
        else {
            data.scheduledAt = new Date(scheduledAt);
            data.status = 'SCHEDULED';
        }
    }
    const updated = await prisma_1.default.emailCampaign.update({ where: { id }, data });
    res.json(updated);
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.emailCampaign.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy' });
        return;
    }
    await prisma_1.default.emailCampaign.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
