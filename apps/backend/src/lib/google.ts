import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import prisma from './prisma';

const CREDENTIALS_PATH = path.join(__dirname, '../../google-credentials.json');

export function getGa4PropertyId(): string {
  return process.env.GA4_PROPERTY_ID || '539718603';
}

export function getGscSiteUrl(): string {
  return process.env.GSC_SITE_URL || '';
}

function hasCredentials(): boolean {
  try {
    return fs.existsSync(CREDENTIALS_PATH);
  } catch {
    return false;
  }
}

/** GA4: ưu tiên OAuth (Gmail admin) — không cần thêm service account trong GA4 Admin */
export async function getGa4Client(workspaceId?: number): Promise<BetaAnalyticsDataClient | null> {
  const oauth = await getOAuth2Client(workspaceId);
  if (oauth) {
    try {
      return new BetaAnalyticsDataClient({ authClient: oauth });
    } catch (err: unknown) {
      console.error('GA4 OAuth client:', err instanceof Error ? err.message : err);
    }
  }
  if (!hasCredentials()) return null;
  try {
    return new BetaAnalyticsDataClient({ keyFilename: CREDENTIALS_PATH });
  } catch {
    return null;
  }
}

export async function hasGa4Access(workspaceId?: number): Promise<boolean> {
  if (await getOAuth2Client(workspaceId)) return true;
  return hasCredentials();
}

export function getSearchConsoleClient() {
  if (!hasCredentials() || !getGscSiteUrl()) return null;
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    return google.searchconsole({ version: 'v1', auth });
  } catch {
    return null;
  }
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatChartDay(isoDate: string): string {
  const parts = isoDate.includes('-')
    ? isoDate.split('-')
    : [isoDate.slice(0, 4), isoDate.slice(4, 6), isoDate.slice(6, 8)];
  const day = parts[2] || '01';
  const month = parts[1] || '01';
  return `${day}/${month}`;
}

export interface GscDailyRow {
  date: string;
  clicks: number;
  impressions: number;
}

async function getGscApiClient(workspaceId?: number) {
  const oauth = await getOAuth2Client(workspaceId);
  if (oauth) {
    return google.searchconsole({ version: 'v1', auth: oauth });
  }
  return getSearchConsoleClient();
}

export async function fetchGscSummary(days = 30, workspaceId?: number): Promise<{
  connected: boolean;
  clicks: number;
  impressions: number;
  daily: GscDailyRow[];
}> {
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

    const daily: GscDailyRow[] = (dailyData.rows || [])
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
  } catch (err: any) {
    console.error('GSC API:', err.message);
    return { connected: false, clicks: 0, impressions: 0, daily: [] };
  }
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/google/callback';

  if (!clientId || !clientSecret) return null;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(workspaceId?: number): string | null {
  const oauth2 = createOAuth2Client();
  if (!oauth2) return null;
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state: workspaceId ? String(workspaceId) : undefined
  });
}

export async function exchangeGoogleCode(code: string) {
  const oauth2 = createOAuth2Client();
  if (!oauth2) throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID/SECRET');
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

export async function getOAuth2Client(workspaceId?: number) {
  const integration = await prisma.googleIntegration.findFirst({ where: { workspaceId } });
  if (!integration?.refreshToken && !integration?.accessToken) return null;

  const oauth2 = createOAuth2Client();
  if (!oauth2) return null;

  oauth2.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken || undefined,
    expiry_date: integration.expiresAt?.getTime(),
  });

  oauth2.on('tokens', async (tokens) => {
    if (!integration) return;
    await prisma.googleIntegration.update({
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

export async function getGoogleTokensFromDb(workspaceId?: number) {
  return prisma.googleIntegration.findFirst({ where: { workspaceId } });
}
