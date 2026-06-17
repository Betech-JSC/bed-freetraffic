"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const googleapis_1 = require("googleapis");
const google_1 = require("../lib/google");
const analyticsSync_1 = require("../services/analyticsSync");
const auth_1 = require("../middleware/auth");
const workspace_1 = require("../middleware/workspace");
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
        // Initialize credentials helper to fetch properties automatically
        const oauth2 = (0, google_1.createOAuth2Client)();
        let ga4PropertyId = existing?.ga4PropertyId || null;
        let gscSiteUrl = existing?.gscSiteUrl || null;
        if (oauth2) {
            oauth2.setCredentials({
                access_token: tokens.access_token || undefined,
                refresh_token: tokens.refresh_token || existing?.refreshToken || undefined,
                expiry_date: tokens.expiry_date || undefined,
            });
            // 1. Automatically fetch GSC sites list
            try {
                const sc = googleapis_1.google.searchconsole({ version: 'v1', auth: oauth2 });
                const { data: siteList } = await sc.sites.list();
                if (siteList.siteEntry && siteList.siteEntry.length > 0) {
                    // Select the first verified site URL
                    gscSiteUrl = siteList.siteEntry[0].siteUrl || null;
                }
            }
            catch (scErr) {
                console.error('[Google OAuth] Error fetching GSC sites:', scErr.message);
            }
            // 2. Automatically fetch GA4 account property summaries
            try {
                const adminClient = googleapis_1.google.analyticsadmin({ version: 'v1beta', auth: oauth2 });
                const { data: accounts } = await adminClient.accountSummaries.list();
                if (accounts.accountSummaries && accounts.accountSummaries.length > 0) {
                    const firstProp = accounts.accountSummaries[0].propertySummaries?.[0]?.property;
                    if (firstProp) {
                        ga4PropertyId = firstProp.replace('properties/', '') || null;
                    }
                }
            }
            catch (gaErr) {
                console.error('[Google OAuth] Error fetching GA4 properties:', gaErr.message);
            }
        }
        const data = {
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || existing?.refreshToken || null,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            ga4PropertyId,
            gscSiteUrl,
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
        // Automatically trigger background sync for GA4/GSC stats immediately
        if (workspaceId) {
            (0, analyticsSync_1.syncAnalyticsData)(workspaceId).catch(err => console.error('[Google OAuth] Error triggering post-connect sync:', err));
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
router.use(workspace_1.workspaceMiddleware);
router.get('/status', async (req, res) => {
    const integration = await (0, google_1.getGoogleTokensFromDb)(req.workspaceId);
    res.json({
        connected: !!integration,
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
router.delete('/', async (req, res) => {
    try {
        await prisma_1.default.googleIntegration.deleteMany({
            where: { workspaceId: req.workspaceId },
        });
        res.json({ success: true, message: 'Đã ngắt kết nối Google thành công' });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Disconnect failed';
        res.status(500).json({ error: msg });
    }
});
exports.default = router;
