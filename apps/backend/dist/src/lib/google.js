"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGa4PropertyId = getGa4PropertyId;
exports.getGscSiteUrl = getGscSiteUrl;
exports.getGa4Client = getGa4Client;
exports.hasGa4Access = hasGa4Access;
exports.getSearchConsoleClient = getSearchConsoleClient;
exports.toIsoDate = toIsoDate;
exports.formatChartDay = formatChartDay;
exports.fetchGscSummary = fetchGscSummary;
exports.createOAuth2Client = createOAuth2Client;
exports.getGoogleAuthUrl = getGoogleAuthUrl;
exports.exchangeGoogleCode = exchangeGoogleCode;
exports.getOAuth2Client = getOAuth2Client;
exports.getGoogleTokensFromDb = getGoogleTokensFromDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const data_1 = require("@google-analytics/data");
const prisma_1 = __importDefault(require("./prisma"));
const CREDENTIALS_PATH = path_1.default.join(__dirname, '../../google-credentials.json');
function getGa4PropertyId() {
    return process.env.GA4_PROPERTY_ID || '539718603';
}
function getGscSiteUrl() {
    return process.env.GSC_SITE_URL || '';
}
function hasCredentials() {
    try {
        return fs_1.default.existsSync(CREDENTIALS_PATH);
    }
    catch {
        return false;
    }
}
/** GA4: ưu tiên OAuth (Gmail admin) — không cần thêm service account trong GA4 Admin */
async function getGa4Client(workspaceId) {
    const oauth = await getOAuth2Client(workspaceId);
    if (oauth) {
        try {
            return new data_1.BetaAnalyticsDataClient({ authClient: oauth });
        }
        catch (err) {
            console.error('GA4 OAuth client:', err instanceof Error ? err.message : err);
        }
    }
    if (!hasCredentials())
        return null;
    try {
        return new data_1.BetaAnalyticsDataClient({ keyFilename: CREDENTIALS_PATH });
    }
    catch {
        return null;
    }
}
async function hasGa4Access(workspaceId) {
    if (await getOAuth2Client(workspaceId))
        return true;
    return hasCredentials();
}
function getSearchConsoleClient() {
    if (!hasCredentials() || !getGscSiteUrl())
        return null;
    try {
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        });
        return googleapis_1.google.searchconsole({ version: 'v1', auth });
    }
    catch {
        return null;
    }
}
function toIsoDate(d) {
    return d.toISOString().slice(0, 10);
}
function formatChartDay(isoDate) {
    const parts = isoDate.includes('-')
        ? isoDate.split('-')
        : [isoDate.slice(0, 4), isoDate.slice(4, 6), isoDate.slice(6, 8)];
    const day = parts[2] || '01';
    const month = parts[1] || '01';
    return `${day}/${month}`;
}
async function getGscApiClient(workspaceId) {
    const oauth = await getOAuth2Client(workspaceId);
    if (oauth) {
        return googleapis_1.google.searchconsole({ version: 'v1', auth: oauth });
    }
    return getSearchConsoleClient();
}
async function fetchGscSummary(days = 30, workspaceId) {
    const integration = await getGoogleTokensFromDb(workspaceId);
    const siteUrl = integration?.gscSiteUrl || getGscSiteUrl();
    const client = await getGscApiClient(workspaceId);
    if (!client || !siteUrl) {
        return { connected: false, clicks: 0, impressions: 0, daily: [] };
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    try {
        const { data: totalData } = await client.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate: toIsoDate(start),
                endDate: toIsoDate(end),
                rowLimit: 1,
            },
        });
        const chartStart = new Date();
        chartStart.setDate(chartStart.getDate() - 6);
        const { data: dailyData } = await client.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate: toIsoDate(chartStart),
                endDate: toIsoDate(end),
                dimensions: ['date'],
                rowLimit: 31,
            },
        });
        const daily = (dailyData.rows || [])
            .map((row) => ({
            date: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
        }))
            .sort((a, b) => a.date.localeCompare(b.date));
        const totalRow = totalData.rows?.[0];
        return {
            connected: true,
            clicks: totalRow?.clicks || 0,
            impressions: totalRow?.impressions || 0,
            daily,
        };
    }
    catch (err) {
        console.error('GSC API:', err.message);
        return { connected: false, clicks: 0, impressions: 0, daily: [] };
    }
}
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
];
function createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/google/callback';
    if (!clientId || !clientSecret)
        return null;
    return new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
function getGoogleAuthUrl(workspaceId) {
    const oauth2 = createOAuth2Client();
    if (!oauth2)
        return null;
    return oauth2.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GOOGLE_SCOPES,
        state: workspaceId ? String(workspaceId) : undefined
    });
}
async function exchangeGoogleCode(code) {
    const oauth2 = createOAuth2Client();
    if (!oauth2)
        throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID/SECRET');
    const { tokens } = await oauth2.getToken(code);
    return tokens;
}
async function getOAuth2Client(workspaceId) {
    const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
    if (!integration?.refreshToken && !integration?.accessToken)
        return null;
    const oauth2 = createOAuth2Client();
    if (!oauth2)
        return null;
    oauth2.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken || undefined,
        expiry_date: integration.expiresAt?.getTime(),
    });
    oauth2.on('tokens', async (tokens) => {
        if (!integration)
            return;
        await prisma_1.default.googleIntegration.update({
            where: { id: integration.id },
            data: {
                accessToken: tokens.access_token || integration.accessToken,
                refreshToken: tokens.refresh_token || integration.refreshToken,
                expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : integration.expiresAt,
            },
        });
    });
    return oauth2;
}
async function getGoogleTokensFromDb(workspaceId) {
    return prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
}
