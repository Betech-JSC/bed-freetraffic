"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverBacklinksHandler = discoverBacklinksHandler;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const backlinkDiscover_1 = require("../services/backlinkDiscover");
const auth_1 = require("../middleware/auth");
const backlinkAuditorEngine_1 = require("../workers/backlinkAuditorEngine");
const mozService_1 = require("../services/mozService");
/** Đăng ký thêm ở index.ts để tránh 404 khi process backend cũ / mount router lỗi */
async function discoverBacklinksHandler(req, res) {
    const body = req.body;
    const q = req.query;
    const targetUrl = String(body?.targetUrl ?? q.targetUrl ?? '').trim();
    const scanUrlRaw = body?.scanUrl ?? q.scanUrl;
    const scanUrl = scanUrlRaw != null && String(scanUrlRaw).trim() ? String(scanUrlRaw).trim() : undefined;
    if (!targetUrl) {
        res.status(400).json({ error: 'targetUrl (URL site của bạn) là bắt buộc' });
        return;
    }
    try {
        const result = await (0, backlinkDiscover_1.discoverBacklinksFromUrl)(targetUrl, scanUrl, req.workspaceId);
        res.json({
            message: `Quét xong: ${result.discovered} liên kết ngoài, thêm mới ${result.created}`,
            ...result,
        });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Quét thất bại' });
    }
}
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    const links = await prisma_1.default.backlink.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { discoveredAt: 'desc' }
    });
    res.json(links);
});
router.post('/audit-now', auth_1.requireWrite, async (_req, res) => {
    try {
        void (0, backlinkAuditorEngine_1.auditAllBacklinks)();
        res.json({ message: 'Đã kích hoạt quét kiểm tra chất lượng backlink tự động.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/** Fallback POST discover (cùng handler; route chính: GET/POST /api/backlinks/scan ở index.ts) */
router.post('/discover', auth_1.requireWrite, discoverBacklinksHandler);
function isDiscoverRequest(body) {
    if (!body)
        return false;
    if (body.action === 'discover')
        return true;
    const target = String(body.targetUrl ?? '').trim();
    const source = String(body.sourceUrl ?? '').trim();
    return Boolean(target) && !source;
}
router.post('/', auth_1.requireWrite, async (req, res) => {
    if (isDiscoverRequest(req.body)) {
        await discoverBacklinksHandler(req, res);
        return;
    }
    const { sourceUrl, targetUrl, domainAuthority, linkType, status } = req.body;
    if (!sourceUrl || !targetUrl) {
        res.status(400).json({ error: 'sourceUrl và targetUrl là bắt buộc' });
        return;
    }
    const link = await prisma_1.default.backlink.create({
        data: {
            sourceUrl,
            targetUrl,
            domainAuthority: domainAuthority ? parseInt(domainAuthority) : null,
            linkType: linkType || 'inbound',
            status: status || 'active',
            workspaceId: req.workspaceId,
        },
    });
    res.status(201).json(link);
});
router.patch('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.backlink.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy backlink' });
        return;
    }
    const link = await prisma_1.default.backlink.update({ where: { id }, data: req.body });
    res.json(link);
});
router.post('/:id/estimate-da', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const link = await prisma_1.default.backlink.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!link) {
        res.status(404).json({ error: 'Không tìm thấy' });
        return;
    }
    let host = 'unknown';
    try {
        host = new URL(link.sourceUrl).hostname;
    }
    catch {
        // Fallback: strip protocols and grab first section before slash
        const stripped = link.sourceUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
        host = stripped.split('/')[0] || 'unknown';
    }
    const tld = host.split('.').pop()?.toLowerCase() || '';
    let domainAuthority = ['edu', 'gov'].includes(tld) ? 48 : ['org'].includes(tld) ? 35 : 28;
    let pageAuthority = null;
    let estimated = true;
    let message = 'DA ước lượng theo TLD — thêm MOZ_ACCESS_ID + MOZ_SECRET_KEY cho DA chính xác.';
    const mozConfigured = !!(process.env.MOZ_ACCESS_ID && process.env.MOZ_SECRET_KEY);
    if (mozConfigured) {
        const realMetrics = await (0, mozService_1.fetchMozMetrics)(link.sourceUrl, link.workspaceId || req.workspaceId);
        if (realMetrics) {
            domainAuthority = realMetrics.domainAuthority;
            pageAuthority = realMetrics.pageAuthority;
            estimated = false;
            message = 'Đã cập nhật chỉ số DA & PA thực tế từ Moz API.';
        }
        else {
            domainAuthority = Math.min(60, domainAuthority + 5);
            message = 'Lỗi truy vấn Moz API, sử dụng DA ước lượng.';
        }
    }
    const updated = await prisma_1.default.backlink.update({
        where: { id },
        data: { domainAuthority, pageAuthority },
    });
    res.json({
        link: updated,
        estimated,
        message,
    });
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.backlink.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy backlink' });
        return;
    }
    await prisma_1.default.backlink.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
