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
const cache_1 = require("../lib/cache");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
async function getLiveDashboard(days, workspaceId) {
    const totalKeywords = await prisma_1.default.seoKeyword.count({ where: { workspaceId } });
    const activeChannels = await prisma_1.default.channel.count({ where: { status: 'ACTIVE', workspaceId } });
    const facebookConnected = !!(await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'facebook', status: 'CONNECTED', workspaceId },
    }));
    let totalTraffic = 0;
    let organicSearch = 0;
    let ga4Connected = false;
    let gscConnected = false;
    let gscImpressions = 0;
    let chartData = [];
    const gscByDate = new Map();
    const gsc = await (0, google_1.fetchGscSummary)(days);
    if (gsc.connected) {
        gscConnected = true;
        organicSearch = gsc.clicks;
        gscImpressions = gsc.impressions;
        for (const row of gsc.daily)
            gscByDate.set(row.date, row.clicks);
    }
    const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
    const ga4PropertyId = integration?.ga4PropertyId || (0, google_1.getGa4PropertyId)();
    const analyticsDataClient = await (0, google_1.getGa4Client)();
    if (analyticsDataClient) {
        try {
            const [response] = await analyticsDataClient.runReport({
                property: `properties/${ga4PropertyId}`,
                dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
                metrics: [{ name: 'activeUsers' }],
            });
            if (response?.rows?.length) {
                totalTraffic = parseInt(response.rows[0].metricValues[0].value) || 0;
                ga4Connected = true;
            }
            const chartDays = Math.min(days, 30);
            const [chartRes] = await analyticsDataClient.runReport({
                property: `properties/${ga4PropertyId}`,
                dateRanges: [{ startDate: `${chartDays}daysAgo`, endDate: 'today' }],
                dimensions: [{ name: 'date' }],
                metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
            });
            if (chartRes?.rows?.length) {
                chartData = chartRes.rows
                    .sort((a, b) => a.dimensionValues[0].value.localeCompare(b.dimensionValues[0].value))
                    .map((row) => {
                    const dateStr = row.dimensionValues[0].value;
                    const iso = dateStr.length === 8
                        ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
                        : dateStr;
                    return {
                        name: (0, google_1.formatChartDay)(iso),
                        traffic: parseInt(row.metricValues[0].value) || 0,
                        keywords: gscByDate.get(iso) ?? 0,
                        pageviews: parseInt(row.metricValues[1]?.value || '0') || 0,
                    };
                });
            }
        }
        catch (err) {
            console.error('GA4:', err instanceof Error ? err.message : err);
        }
    }
    if (chartData.length === 0 && gsc.daily.length > 0) {
        chartData = gsc.daily.map((row) => ({
            name: (0, google_1.formatChartDay)(row.date),
            traffic: 0,
            keywords: row.clicks,
            pageviews: 0,
        }));
    }
    return {
        stats: {
            totalTraffic,
            organicSearch,
            referral: gscConnected ? Math.max(0, gscImpressions - organicSearch) : 0,
            activeChannels,
            totalKeywords,
            growth: ga4Connected || gscConnected ? '+5.4%' : '+0%',
            ga4Connected,
            gscConnected,
            facebookConnected,
            gscImpressions,
        },
        chartData: chartData.length > 0
            ? chartData
            : [{ name: '—', traffic: 0, keywords: 0, pageviews: 0 }],
        channelBreakdown: [],
    };
}
router.get('/', async (req, res) => {
    try {
        const days = parseInt(req.query.days || '7');
        const channelType = req.query.channel || undefined;
        const cacheKey = `ws:${req.workspaceId}:dashboard:days:${days}:channel:${channelType || 'all'}`;
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const snapshotCount = await prisma_1.default.analyticsSnapshot.count({
            where: { channelType: channelType || 'all', workspaceId: req.workspaceId },
        });
        let data;
        if (snapshotCount > 0) {
            data = await (0, analyticsSync_1.getDashboardFromSnapshots)(days, channelType, req.workspaceId);
        }
        else {
            data = await getLiveDashboard(days, req.workspaceId);
        }
        await cache_1.cache.set(cacheKey, data, 60); // Cache for 60 seconds
        res.json(data);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});
exports.default = router;
