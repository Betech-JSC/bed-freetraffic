import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getGoogleTokensFromDb,
} from '../lib/google';
import { syncAnalyticsData } from '../services/analyticsSync';
import { authenticate, AuthRequest } from '../middleware/auth';

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
      await prisma.googleIntegration.update({ where: { id: existing.id }, data });
    } else {
      await prisma.googleIntegration.create({ data });
    }

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontend}/dashboard/settings?google=connected`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OAuth failed';
    res.status(500).send(msg);
  }
});

router.use(authenticate);

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

export default router;
