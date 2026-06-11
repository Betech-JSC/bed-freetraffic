import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { google } from 'googleapis';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getGoogleTokensFromDb,
  createOAuth2Client,
} from '../lib/google';
import { syncAnalyticsData } from '../services/analyticsSync';
import { authenticate, AuthRequest } from '../middleware/auth';
import { workspaceMiddleware } from '../middleware/workspace';

const router = Router();

router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const workspaceId = state ? parseInt(state, 10) : undefined;

    if (!code) {
      res.status(400).send('Thiếu mã xác thực Google');
      return;
    }
    const tokens = await exchangeGoogleCode(code);
    const existing = await prisma.googleIntegration.findFirst({ where: { workspaceId } });

    // Initialize credentials helper to fetch properties automatically
    const oauth2 = createOAuth2Client();
    let ga4PropertyId = process.env.GA4_PROPERTY_ID || existing?.ga4PropertyId || null;
    let gscSiteUrl = process.env.GSC_SITE_URL || existing?.gscSiteUrl || null;

    if (oauth2) {
      oauth2.setCredentials({
        access_token: tokens.access_token || undefined,
        refresh_token: tokens.refresh_token || existing?.refreshToken || undefined,
        expiry_date: tokens.expiry_date || undefined,
      });

      // 1. Automatically fetch GSC sites list
      try {
        const sc = google.searchconsole({ version: 'v1', auth: oauth2 });
        const { data: siteList } = await sc.sites.list();
        if (siteList.siteEntry && siteList.siteEntry.length > 0) {
          // Select the first verified site URL
          gscSiteUrl = siteList.siteEntry[0].siteUrl || null;
        }
      } catch (scErr: any) {
        console.error('[Google OAuth] Error fetching GSC sites:', scErr.message);
      }

      // 2. Automatically fetch GA4 account property summaries
      try {
        const adminClient = google.analyticsadmin({ version: 'v1beta', auth: oauth2 });
        const { data: accounts } = await adminClient.accountSummaries.list();
        if (accounts.accountSummaries && accounts.accountSummaries.length > 0) {
          const firstProp = accounts.accountSummaries[0].propertySummaries?.[0]?.property;
          if (firstProp) {
            ga4PropertyId = firstProp.replace('properties/', '') || null;
          }
        }
      } catch (gaErr: any) {
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
      await prisma.googleIntegration.update({ where: { id: existing.id }, data });
    } else {
      await prisma.googleIntegration.create({ data });
    }

    // Automatically trigger background sync for GA4/GSC stats immediately
    if (workspaceId) {
      syncAnalyticsData(workspaceId).catch(err => 
        console.error('[Google OAuth] Error triggering post-connect sync:', err)
      );
    }

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontend}/dashboard/settings?google=connected`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OAuth failed';
    res.status(500).send(msg);
  }
});

router.use(authenticate);
router.use(workspaceMiddleware);

router.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const integration = await getGoogleTokensFromDb(req.workspaceId);
  res.json({
    connected: integration?.syncStatus === 'CONNECTED',
    ga4PropertyId: integration?.ga4PropertyId || process.env.GA4_PROPERTY_ID,
    gscSiteUrl: integration?.gscSiteUrl || process.env.GSC_SITE_URL,
    lastSyncAt: integration?.lastSyncAt,
    syncStatus: integration?.syncStatus || 'DISCONNECTED',
    syncError: integration?.syncError,
    oauthAvailable: !!getGoogleAuthUrl(req.workspaceId),
  });
});

router.get('/auth-url', (req: AuthRequest, res: Response): void => {
  const url = getGoogleAuthUrl(req.workspaceId);
  if (!url) {
    res.status(400).json({
      error: 'Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trong .env',
    });
    return;
  }
  res.json({ url });
});

router.post('/sync', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await syncAnalyticsData(req.workspaceId);
  res.json(result);
});

router.patch('/config', async (req: AuthRequest, res: Response): Promise<void> => {
  const { ga4PropertyId, gscSiteUrl } = req.body;
  const existing = await prisma.googleIntegration.findFirst({ where: { workspaceId: req.workspaceId } });
  if (existing) {
    const updated = await prisma.googleIntegration.update({
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

router.delete('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.googleIntegration.deleteMany({
      where: { workspaceId: req.workspaceId },
    });
    res.json({ success: true, message: 'Đã ngắt kết nối Google thành công' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Disconnect failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
