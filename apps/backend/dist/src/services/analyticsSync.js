"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAnalyticsData = syncAnalyticsData;
exports.getDashboardFromSnapshots = getDashboardFromSnapshots;
const prisma_1 = __importDefault(require("../lib/prisma"));
const google_1 = require("../lib/google");
async function syncAnalyticsData(workspaceId) {
    try {
        const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
        const ga4 = await (0, google_1.getGa4Client)(workspaceId);
        const propertyId = integration ? integration.ga4PropertyId : (0, google_1.getGa4PropertyId)();
        const gscSite = integration ? integration.gscSiteUrl : (0, google_1.getGscSiteUrl)();
        if (integration && !propertyId) {
            return { success: false, message: 'Vui lòng cấu hình GA4 Property ID trong phần Cài đặt' };
        }
        let sessionsTotal = 0;
        let usersTotal = 0;
        if (ga4) {
            // 1. Sync daily summary
            const [response] = await ga4.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
                metrics: [
                    { name: 'sessions' },
                    { name: 'activeUsers' },
                    { name: 'screenPageViews' },
                    { name: 'bounceRate' },
                ],
            });
            const row = response.rows?.[0];
            if (row?.metricValues) {
                sessionsTotal = parseInt(row.metricValues[0]?.value || '0');
                usersTotal = parseInt(row.metricValues[1]?.value || '0');
            }
            const [chartRes] = await ga4.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'date' }],
                metrics: [
                    { name: 'sessions' },
                    { name: 'activeUsers' },
                    { name: 'screenPageViews' },
                ],
            });
            const gsc = gscSite ? await (0, google_1.fetchGscSummary)(30, workspaceId) : { connected: false, daily: [], clicks: 0, impressions: 0 };
            const gscByDate = new Map(gsc.daily.map((d) => [d.date, d]));
            if (chartRes.rows) {
                for (const r of chartRes.rows) {
                    const dateStr = r.dimensionValues?.[0]?.value || '';
                    const iso = dateStr.length === 8
                        ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
                        : dateStr;
                    const gscRow = gscByDate.get(iso);
                    const date = new Date(iso);
                    await prisma_1.default.analyticsSnapshot.upsert({
                        where: {
                            date_channelType_workspaceId: { date, channelType: 'all', workspaceId: (workspaceId || null) },
                        },
                        create: {
                            date,
                            channelType: 'all',
                            sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                            users: parseInt(r.metricValues?.[1]?.value || '0'),
                            pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                            clicks: gscRow?.clicks || 0,
                            impressions: gscRow?.impressions || 0,
                            workspaceId,
                        },
                        update: {
                            sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                            users: parseInt(r.metricValues?.[1]?.value || '0'),
                            pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                            clicks: gscRow?.clicks || 0,
                            impressions: gscRow?.impressions || 0,
                        },
                    });
                }
            }
            // 2. Sync Traffic Sources
            try {
                const [sourcesRes] = await ga4.runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
                    dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'activeUsers' },
                        { name: 'screenPageViews' },
                    ],
                });
                if (sourcesRes.rows) {
                    for (const r of sourcesRes.rows) {
                        const dateStr = r.dimensionValues?.[0]?.value || '';
                        const iso = dateStr.length === 8 ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}` : dateStr;
                        const date = new Date(iso);
                        const source = r.dimensionValues?.[1]?.value || '(direct)';
                        const medium = r.dimensionValues?.[2]?.value || '(none)';
                        const channelType = `source:${source} / ${medium}`;
                        await prisma_1.default.analyticsSnapshot.upsert({
                            where: {
                                date_channelType_workspaceId: { date, channelType, workspaceId: (workspaceId || null) },
                            },
                            create: {
                                date,
                                channelType,
                                sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                                users: parseInt(r.metricValues?.[1]?.value || '0'),
                                pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                                workspaceId,
                            },
                            update: {
                                sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                                users: parseInt(r.metricValues?.[1]?.value || '0'),
                                pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                            },
                        });
                    }
                }
            }
            catch (err) {
                console.error('Lỗi đồng bộ nguồn truy cập GA4:', err);
            }
            // 3. Sync Top Landing Pages
            try {
                const [landingRes] = await ga4.runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
                    dimensions: [{ name: 'date' }, { name: 'landingPage' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'activeUsers' },
                        { name: 'screenPageViews' },
                    ],
                });
                if (landingRes.rows) {
                    for (const r of landingRes.rows) {
                        const dateStr = r.dimensionValues?.[0]?.value || '';
                        const iso = dateStr.length === 8 ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}` : dateStr;
                        const date = new Date(iso);
                        const landingPage = r.dimensionValues?.[1]?.value || '/';
                        const channelType = `landing:${landingPage}`;
                        await prisma_1.default.analyticsSnapshot.upsert({
                            where: {
                                date_channelType_workspaceId: { date, channelType, workspaceId: (workspaceId || null) },
                            },
                            create: {
                                date,
                                channelType,
                                sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                                users: parseInt(r.metricValues?.[1]?.value || '0'),
                                pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                                workspaceId,
                            },
                            update: {
                                sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                                users: parseInt(r.metricValues?.[1]?.value || '0'),
                                pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                            },
                        });
                    }
                }
            }
            catch (err) {
                console.error('Lỗi đồng bộ Landing Pages GA4:', err);
            }
            // 4. Sync Campaign Clicks
            try {
                const [campaignRes] = await ga4.runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
                    dimensions: [{ name: 'date' }, { name: 'sessionCampaign' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'activeUsers' },
                        { name: 'screenPageViews' },
                    ],
                });
                if (campaignRes.rows) {
                    for (const r of campaignRes.rows) {
                        const dateStr = r.dimensionValues?.[0]?.value || '';
                        const iso = dateStr.length === 8 ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}` : dateStr;
                        const date = new Date(iso);
                        const campaign = r.dimensionValues?.[1]?.value || '';
                        if (!campaign || campaign === '(organic)' || campaign === '(referral)' || campaign === '(direct)')
                            continue;
                        const channelType = `campaign:${campaign}`;
                        await prisma_1.default.analyticsSnapshot.upsert({
                            where: {
                                date_channelType_workspaceId: { date, channelType, workspaceId: (workspaceId || null) },
                            },
                            create: {
                                date,
                                channelType,
                                sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                                users: parseInt(r.metricValues?.[1]?.value || '0'),
                                pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                                workspaceId,
                            },
                            update: {
                                sessions: parseInt(r.metricValues?.[0]?.value || '0'),
                                users: parseInt(r.metricValues?.[1]?.value || '0'),
                                pageviews: parseInt(r.metricValues?.[2]?.value || '0'),
                            },
                        });
                    }
                }
            }
            catch (err) {
                console.error('Lỗi đồng bộ Chiến dịch UTM GA4:', err);
            }
        }
        else {
            return { success: false, message: 'Chưa kết nối tài khoản Google Analytics' };
        }
        if (integration) {
            await prisma_1.default.googleIntegration.update({
                where: { id: integration.id },
                data: {
                    lastSyncAt: new Date(),
                    syncStatus: 'CONNECTED',
                    syncError: null,
                },
            });
        }
        await syncKeywordRanksFromGsc(workspaceId);
        return { success: true, message: `Đồng bộ thành công (${sessionsTotal} sessions / 30 ngày)` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ';
        const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
        if (integration) {
            await prisma_1.default.googleIntegration.update({
                where: { id: integration.id },
                data: { syncStatus: 'ERROR', syncError: msg },
            });
        }
        return { success: false, message: msg };
    }
}
async function syncKeywordRanksFromGsc(workspaceId) {
    const integration = await (0, google_1.getGoogleTokensFromDb)(workspaceId);
    const siteUrl = integration?.gscSiteUrl || (0, google_1.getGscSiteUrl)();
    if (!siteUrl)
        return;
    const oauth = await (0, google_1.getOAuth2Client)(workspaceId);
    if (!oauth)
        return;
    const { google } = await Promise.resolve().then(() => __importStar(require('googleapis')));
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth });
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
            dimensions: ['query'],
            rowLimit: 100,
        },
    });
    const keywords = await prisma_1.default.seoKeyword.findMany({ where: { workspaceId } });
    const keywordMap = new Map(keywords.map((k) => [k.keyword.toLowerCase(), k]));
    for (const row of data.rows || []) {
        const query = row.keys?.[0]?.toLowerCase();
        if (!query)
            continue;
        const kw = keywordMap.get(query);
        if (!kw)
            continue;
        const position = row.position != null ? Math.round(row.position) : null;
        await prisma_1.default.seoKeyword.update({
            where: { id: kw.id },
            data: { currentPosition: position },
        });
        await prisma_1.default.keywordRankHistory.create({
            data: {
                keywordId: kw.id,
                position,
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                source: 'gsc',
            },
        });
    }
}
async function getDashboardFromSnapshots(days = 7, channelType, workspaceId) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
        where: {
            date: { gte: since },
            channelType: channelType || 'all',
            workspaceId,
        },
        orderBy: { date: 'asc' },
    });
    const totalKeywords = await prisma_1.default.seoKeyword.count({ where: { workspaceId } });
    const activeChannels = await prisma_1.default.channel.count({ where: { status: 'ACTIVE', workspaceId } });
    const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
    const fbConn = await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'facebook', status: 'CONNECTED', workspaceId },
    });
    // Calculate dynamic growth rate
    const prevSince = new Date();
    prevSince.setDate(prevSince.getDate() - (days * 2));
    const previousSnapshots = await prisma_1.default.analyticsSnapshot.findMany({
        where: {
            date: { gte: prevSince, lt: since },
            channelType: 'all',
            workspaceId,
        }
    });
    const currentSessions = snapshots.reduce((s, r) => s + r.sessions, 0);
    const previousSessions = previousSnapshots.reduce((s, r) => s + r.sessions, 0);
    let growthStr = '+0.0%';
    if (previousSessions > 0) {
        const change = ((currentSessions - previousSessions) / previousSessions) * 100;
        growthStr = (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
    }
    else if (currentSessions > 0) {
        growthStr = '+100.0%';
    }
    const latest = snapshots[snapshots.length - 1];
    const totalTraffic = snapshots.reduce((s, r) => s + r.sessions, 0);
    const organicSearch = snapshots.reduce((s, r) => s + r.clicks, 0);
    const chartData = snapshots.map((r) => ({
        name: (0, google_1.formatChartDay)(r.date.toISOString().slice(0, 10)),
        traffic: r.sessions,
        keywords: r.clicks,
        pageviews: r.pageviews,
    }));
    return {
        stats: {
            totalTraffic: totalTraffic || latest?.sessions || 0,
            organicSearch: organicSearch || 0,
            activeChannels,
            totalKeywords,
            growth: growthStr,
            ga4Connected: integration?.syncStatus === 'CONNECTED',
            gscConnected: !!integration?.gscSiteUrl || !!(0, google_1.getGscSiteUrl)(),
            facebookConnected: !!fbConn,
            gscImpressions: snapshots.reduce((s, r) => s + r.impressions, 0),
            lastSyncAt: integration?.lastSyncAt,
        },
        chartData: chartData.length > 0
            ? chartData
            : [
                { name: 'T1', traffic: 0, keywords: 0, pageviews: 0 },
                { name: 'T2', traffic: 0, keywords: 0, pageviews: 0 },
            ],
        channelBreakdown: await getChannelBreakdown(workspaceId),
    };
}
async function getChannelBreakdown(workspaceId) {
    const channels = await prisma_1.default.channel.findMany({ where: { workspaceId } });
    const types = ['SEO', 'Social', 'Email', 'Referral', 'Video', 'Content', 'Community', 'Push'];
    return types.map((type) => ({
        type,
        count: channels.filter((c) => c.type.toLowerCase().includes(type.toLowerCase().slice(0, 4))).length,
        active: channels.filter((c) => c.type === type && c.status === 'ACTIVE').length,
    }));
}
