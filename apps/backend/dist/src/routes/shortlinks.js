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
// Generate unique short code
function generateCode(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
// 1. GET /shortlinks - List short links for workspace
router.get('/', async (req, res) => {
    try {
        const links = await prisma_1.default.shortLink.findMany({
            where: { workspaceId: req.workspaceId },
            include: {
                _count: {
                    select: { clicks: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        // Map click count cleanly
        const mapped = links.map(link => ({
            ...link,
            clickCount: link._count.clicks,
        }));
        res.json(mapped);
    }
    catch (error) {
        console.error('[GET /shortlinks]', error);
        res.status(500).json({ error: error.message || 'Lỗi lấy danh sách links' });
    }
});
// 2. POST /shortlinks - Create a short link
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { originalUrl, code, title, utmSource, utmMedium, utmCampaign } = req.body;
    if (!originalUrl) {
        res.status(400).json({ error: 'Đường dẫn gốc (originalUrl) là bắt buộc' });
        return;
    }
    try {
        let finalCode = code?.trim();
        if (finalCode) {
            // Check if code is alphanumeric and correct length
            if (!/^[a-zA-Z0-9_-]{3,30}$/.test(finalCode)) {
                res.status(400).json({ error: 'Mã rút gọn chỉ chứa ký tự chữ, số, gạch dưới, gạch ngang và dài từ 3-30 ký tự' });
                return;
            }
            // Check code uniqueness
            const existing = await prisma_1.default.shortLink.findUnique({
                where: { code: finalCode }
            });
            if (existing) {
                res.status(400).json({ error: 'Mã rút gọn này đã tồn tại, vui lòng chọn mã khác' });
                return;
            }
        }
        else {
            // Generate unique random code
            let attempts = 0;
            while (attempts < 10) {
                const candidate = generateCode(6);
                const existing = await prisma_1.default.shortLink.findUnique({
                    where: { code: candidate }
                });
                if (!existing) {
                    finalCode = candidate;
                    break;
                }
                attempts++;
            }
            if (!finalCode) {
                res.status(500).json({ error: 'Không thể tạo mã rút gọn ngẫu nhiên. Vui lòng thử lại.' });
                return;
            }
        }
        const shortLink = await prisma_1.default.shortLink.create({
            data: {
                workspaceId: req.workspaceId,
                code: finalCode,
                originalUrl: originalUrl.trim(),
                title: title?.trim() || null,
                utmSource: utmSource?.trim() || null,
                utmMedium: utmMedium?.trim() || null,
                utmCampaign: utmCampaign?.trim() || null,
            }
        });
        res.status(201).json(shortLink);
    }
    catch (error) {
        console.error('[POST /shortlinks]', error);
        res.status(500).json({ error: error.message || 'Lỗi tạo link rút gọn' });
    }
});
// 3. DELETE /shortlinks/:id - Delete short link
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const link = await prisma_1.default.shortLink.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!link) {
            res.status(404).json({ error: 'Không tìm thấy link rút gọn hoặc bạn không có quyền' });
            return;
        }
        await prisma_1.default.shortLink.delete({ where: { id } });
        res.json({ success: true, message: 'Đã xóa link rút gọn thành công' });
    }
    catch (error) {
        console.error('[DELETE /shortlinks/:id]', error);
        res.status(500).json({ error: error.message || 'Lỗi xóa link rút gọn' });
    }
});
// 4. GET /shortlinks/:id/analytics - Get short link click analytics
router.get('/:id/analytics', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const link = await prisma_1.default.shortLink.findFirst({
            where: { id, workspaceId: req.workspaceId }
        });
        if (!link) {
            res.status(404).json({ error: 'Không tìm thấy link rút gọn hoặc bạn không có quyền' });
            return;
        }
        // Get all clicks for this link
        const clicks = await prisma_1.default.shortLinkClick.findMany({
            where: { shortLinkId: id },
            orderBy: { clickedAt: 'asc' },
        });
        // Group clicks by date (last 7 days)
        const clicksByDate = {};
        const referrers = {};
        const devices = {};
        // Initialize dates for last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            clicksByDate[dateStr] = 0;
        }
        clicks.forEach(click => {
            const dateStr = click.clickedAt.toISOString().split('T')[0];
            clicksByDate[dateStr] = (clicksByDate[dateStr] || 0) + 1;
            // Group by referrer domain
            let ref = 'Direct/None';
            if (click.referrer) {
                try {
                    ref = new URL(click.referrer).hostname;
                }
                catch {
                    ref = click.referrer;
                }
            }
            referrers[ref] = (referrers[ref] || 0) + 1;
            // Group by device
            const dev = click.deviceType || 'desktop';
            devices[dev] = (devices[dev] || 0) + 1;
        });
        // Format response arrays
        const clicksTimeline = Object.entries(clicksByDate).map(([date, count]) => ({ date, count }));
        const referrerBreakdown = Object.entries(referrers).map(([referrer, count]) => ({ referrer, count }));
        const deviceBreakdown = Object.entries(devices).map(([device, count]) => ({ device, count }));
        res.json({
            link,
            clicksTimeline,
            referrerBreakdown,
            deviceBreakdown,
        });
    }
    catch (error) {
        console.error('[GET /shortlinks/:id/analytics]', error);
        res.status(500).json({ error: error.message || 'Lỗi lấy thống kê phân tích' });
    }
});
exports.default = router;
