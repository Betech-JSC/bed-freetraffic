"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const google_1 = require("../lib/google");
const analyticsSync_1 = require("../services/analyticsSync");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const state = req.query.state;
        const workspaceId = state ? parseInt(state, 10) : undefined;
        if (!code) {
            res.status(400).send('Thiếu mã xác thực Google');
            return;
        }
        const tokens = await (0, google_1.exchangeGoogleCode)(code);
        const existing = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
        const data = {
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || existing?.refreshToken || null,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            ga4PropertyId: process.env.GA4_PROPERTY_ID || existing?.ga4PropertyId,
            gscSiteUrl: process.env.GSC_SITE_URL || existing?.gscSiteUrl,
            syncStatus: 'CONNECTED',
            syncError: null,
            workspaceId,
        };
        if (existing) {
            await prisma_1.default.googleIntegration.update({ where: { id: existing.id }, data });
        }
        else {
            await prisma_1.default.googleIntegration.create({ data });
        }
        const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontend}/dashboard/settings?google=connected`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'OAuth failed';
        res.status(500).send(msg);
    }
});
router.use(auth_1.authenticate);
router.get('/status', async (req, res) => {
    const integration = await (0, google_1.getGoogleTokensFromDb)(req.workspaceId);
    res.json({
        connected: integration?.syncStatus === 'CONNECTED',
        ga4PropertyId: integration?.ga4PropertyId || process.env.GA4_PROPERTY_ID,
        gscSiteUrl: integration?.gscSiteUrl || process.env.GSC_SITE_URL,
        lastSyncAt: integration?.lastSyncAt,
        syncStatus: integration?.syncStatus || 'DISCONNECTED',
        syncError: integration?.syncError,
        oauthAvailable: !!(0, google_1.getGoogleAuthUrl)(req.workspaceId),
    });
});
router.get('/auth-url', (req, res) => {
    const url = (0, google_1.getGoogleAuthUrl)(req.workspaceId);
    if (!url) {
        res.status(400).json({
            error: 'Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trong .env',
        });
        return;
    }
    res.json({ url });
});
router.post('/sync', async (req, res) => {
    const result = await (0, analyticsSync_1.syncAnalyticsData)(req.workspaceId);
    res.json(result);
});
router.patch('/config', async (req, res) => {
    const { ga4PropertyId, gscSiteUrl } = req.body;
    const existing = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId: req.workspaceId } });
    if (existing) {
        const updated = await prisma_1.default.googleIntegration.update({
            where: { id: existing.id },
            data: {
                ga4PropertyId: ga4PropertyId ?? existing.ga4PropertyId,
                gscSiteUrl: gscSiteUrl ?? existing.gscSiteUrl,
            },
        });
        res.json(updated);
        return;
    }
    res.status(400).json({ error: 'Kết nối Google trước khi cấu hình property' });
});
exports.default = router;
