"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const upload_1 = require("../lib/upload");
const scheduleDispatch_1 = require("../services/scheduleDispatch");
const router = (0, express_1.Router)();
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
    const processed = await (0, scheduleDispatch_1.dispatchDueSchedules)(20);
    res.json({ processed, message: `Đã xử lý ${processed} lịch đến hạn` });
});
router.use(auth_1.authenticate);
router.get('/channels-status', async (req, res) => {
    res.json(await (0, scheduleDispatch_1.getChannelConnectionStatus)(req.workspaceId));
});
router.get('/golden-hour', async (req, res) => {
    try {
        const campaigns = await prisma_1.default.emailCampaign.findMany({
            where: { workspaceId: req.workspaceId },
            select: { id: true }
        });
        const campaignIds = campaigns.map(c => c.id);
        const events = campaignIds.length > 0
            ? await prisma_1.default.emailEvent.findMany({
                where: { campaignId: { in: campaignIds } },
                select: { createdAt: true, eventType: true }
            })
            : [];
        if (events.length < 5) {
            res.json({
                recommendedHours: [9, 12, 20],
                isFallback: true,
                message: 'Dữ liệu tương tác thưa thớt. Sử dụng khung giờ vàng mặc định (9:00, 12:00, 20:00).'
            });
            return;
        }
        const hourWeights = Array(24).fill(0);
        events.forEach(e => {
            const hr = new Date(e.createdAt).getHours();
            const weight = e.eventType === 'click' ? 3 : 1;
            hourWeights[hr] += weight;
        });
        const sorted = hourWeights
            .map((weight, hour) => ({ hour, weight }))
            .sort((a, b) => b.weight - a.weight);
        const recommendedHours = sorted.slice(0, 3).map(h => h.hour);
        res.json({
            recommendedHours,
            isFallback: false,
            message: `Khung giờ vàng được đề xuất dựa trên phân tích ${events.length} lượt tương tác.`
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi phân tích giờ vàng' });
    }
});
router.get('/', async (req, res) => {
    const items = await prisma_1.default.contentSchedule.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { scheduledAt: 'desc' }
    });
    res.json(items);
});
async function createSchedule(req, res) {
    try {
        const body = req.body ?? {};
        const { title, content, platforms, targetConnectionsJson, urlTarget, recipients, scheduledAt, repeatRule, repeatUntil, abTestId, cronExpression, overlayText, overlayWatermark, overlayPosition, overlayFontSize, } = body;
        if (!title?.trim() || !content?.trim() || !platforms || !scheduledAt) {
            res.status(400).json({ error: 'Tiêu đề, nội dung, kênh gửi và thời gian là bắt buộc' });
            return;
        }
        const platformStr = typeof platforms === 'string' ? platforms : Array.isArray(platforms) ? platforms.join(',') : '';
        if (!platformStr.trim()) {
            res.status(400).json({ error: 'Chọn ít nhất một kênh: Facebook, Email hoặc Zalo' });
            return;
        }
        if (platformStr.includes('email') && !recipients?.trim() && !process.env.SCHEDULE_EMAIL_RECIPIENTS) {
            res.status(400).json({
                error: 'Kênh Email cần danh sách người nhận (email1@x.com, email2@x.com)',
            });
            return;
        }
        const scheduledDate = new Date(scheduledAt);
        if (Number.isNaN(scheduledDate.getTime())) {
            res.status(400).json({ error: 'Ngày giờ không hợp lệ' });
            return;
        }
        const imageUrl = req.file ? (0, upload_1.uploadedImageUrl)(req.file.filename) : body.imageUrl || null;
        let repeatUntilDate = null;
        if (repeatUntil) {
            repeatUntilDate = new Date(repeatUntil);
            if (Number.isNaN(repeatUntilDate.getTime())) {
                res.status(400).json({ error: 'repeatUntil không hợp lệ' });
                return;
            }
        }
        const rule = repeatRule && ['daily', 'weekly', 'cron'].includes(String(repeatRule).toLowerCase())
            ? String(repeatRule).toLowerCase()
            : null;
        const item = await prisma_1.default.contentSchedule.create({
            data: {
                title: String(title).trim(),
                content: String(content).trim(),
                imageUrl: imageUrl || null,
                platforms: platformStr,
                targetConnectionsJson: targetConnectionsJson ? String(targetConnectionsJson).trim() : null,
                urlTarget: urlTarget?.trim() || null,
                recipients: recipients?.trim() || null,
                scheduledAt: scheduledDate,
                repeatRule: rule,
                cronExpression: rule === 'cron' ? (cronExpression ? String(cronExpression).trim() : null) : null,
                repeatUntil: repeatUntilDate,
                abTestId: abTestId ? parseInt(String(abTestId), 10) : null,
                overlayText: overlayText ? String(overlayText).trim() : null,
                overlayWatermark: overlayWatermark ? String(overlayWatermark).trim() : null,
                overlayPosition: overlayPosition ? String(overlayPosition).trim() : 'bottom-right',
                overlayFontSize: overlayFontSize ? parseInt(String(overlayFontSize), 10) : 32,
                status: body.status === 'DRAFT' ? 'DRAFT' : 'PENDING',
                workspaceId: req.workspaceId,
            },
        });
        res.status(201).json(item);
    }
    catch (error) {
        console.error('POST /schedules:', error);
        const msg = error instanceof Error ? error.message : 'Không tạo được lịch';
        res.status(500).json({ error: msg });
    }
}
router.post('/', (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        upload_1.imageUpload.single('image')(req, res, (err) => {
            if (err) {
                const msg = err instanceof Error ? err.message : 'Lỗi upload ảnh';
                res.status(400).json({ error: msg });
                return;
            }
            (0, auth_1.requireWrite)(req, res, () => {
                void createSchedule(req, res);
            });
        });
        return;
    }
    (0, auth_1.requireWrite)(req, res, () => {
        void createSchedule(req, res);
    });
});
router.post('/:id/send-now', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const item = await prisma_1.default.contentSchedule.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!item) {
        res.status(404).json({ error: 'Không tìm thấy lịch' });
        return;
    }
    if (item.status === 'SENDING') {
        res.status(409).json({ error: 'Lịch đang được gửi' });
        return;
    }
    try {
        const result = await (0, scheduleDispatch_1.executeContentSchedule)(item);
        const updated = await prisma_1.default.contentSchedule.findUnique({ where: { id } });
        res.json({ ...result, schedule: updated });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Gửi thất bại';
        res.status(500).json({ error: msg });
    }
});
router.patch('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma_1.default.contentSchedule.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy lịch' });
        return;
    }
    if (!['PENDING', 'FAILED', 'DRAFT'].includes(existing.status)) {
        res.status(400).json({ error: 'Chỉ sửa lịch ở trạng thái Nháp, Chờ gửi hoặc Lỗi' });
        return;
    }
    const body = req.body ?? {};
    const data = {};
    if (body.title != null)
        data.title = String(body.title).trim();
    if (body.content != null)
        data.content = String(body.content).trim();
    if (body.abTestId !== undefined) {
        data.abTestId = body.abTestId ? parseInt(String(body.abTestId), 10) : null;
    }
    if (body.repeatRule !== undefined) {
        const r = body.repeatRule ? String(body.repeatRule).toLowerCase() : null;
        data.repeatRule = r && ['daily', 'weekly', 'cron'].includes(r) ? r : null;
    }
    if (body.cronExpression !== undefined) {
        data.cronExpression = body.cronExpression ? String(body.cronExpression).trim() : null;
    }
    if (body.repeatUntil !== undefined) {
        if (!body.repeatUntil)
            data.repeatUntil = null;
        else {
            const d = new Date(body.repeatUntil);
            if (Number.isNaN(d.getTime())) {
                res.status(400).json({ error: 'repeatUntil không hợp lệ' });
                return;
            }
            data.repeatUntil = d;
        }
    }
    if (body.platforms != null) {
        const platformStr = typeof body.platforms === 'string'
            ? body.platforms
            : Array.isArray(body.platforms)
                ? body.platforms.join(',')
                : '';
        if (!platformStr.trim()) {
            res.status(400).json({ error: 'Chọn ít nhất một kênh' });
            return;
        }
        data.platforms = platformStr;
    }
    if (body.targetConnectionsJson !== undefined) {
        data.targetConnectionsJson = body.targetConnectionsJson ? String(body.targetConnectionsJson).trim() : null;
    }
    if (body.urlTarget !== undefined)
        data.urlTarget = body.urlTarget?.trim() || null;
    if (body.recipients !== undefined)
        data.recipients = body.recipients?.trim() || null;
    if (body.overlayText !== undefined)
        data.overlayText = body.overlayText ? String(body.overlayText).trim() : null;
    if (body.overlayWatermark !== undefined)
        data.overlayWatermark = body.overlayWatermark ? String(body.overlayWatermark).trim() : null;
    if (body.overlayPosition !== undefined)
        data.overlayPosition = body.overlayPosition ? String(body.overlayPosition).trim() : 'bottom-right';
    if (body.overlayFontSize !== undefined) {
        data.overlayFontSize = body.overlayFontSize ? parseInt(String(body.overlayFontSize), 10) : 32;
    }
    if (body.scheduledAt != null) {
        const scheduledDate = new Date(body.scheduledAt);
        if (Number.isNaN(scheduledDate.getTime())) {
            res.status(400).json({ error: 'Ngày giờ không hợp lệ' });
            return;
        }
        data.scheduledAt = scheduledDate;
    }
    if (Object.keys(data).length === 0) {
        res.status(400).json({ error: 'Không có trường nào để cập nhật' });
        return;
    }
    data.status = body.status === 'DRAFT' ? 'DRAFT' : 'PENDING';
    data.errorMessage = null;
    data.channelResults = null;
    const item = await prisma_1.default.contentSchedule.update({ where: { id }, data });
    res.json(item);
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma_1.default.contentSchedule.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy lịch' });
        return;
    }
    await prisma_1.default.contentSchedule.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
