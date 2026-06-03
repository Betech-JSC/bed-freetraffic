import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channel';
import keywordRoutes from './routes/keyword';
import dashboardRoutes from './routes/dashboard';
import automationRoutes from './routes/automation';
import socialRoutes from './routes/social';
import templateRoutes from './routes/templates';
import analyticsRoutes from './routes/analytics';
import usersRoutes from './routes/users';
import googleRoutes from './routes/google';
import reportsRoutes from './routes/reports';
import schedulesRoutes from './routes/schedules';
import seoRoutes from './routes/seo';
import backlinksRoutes, { discoverBacklinksHandler } from './routes/backlinks';
import { requireWrite } from './middleware/auth';
import emailCampaignsRoutes from './routes/emailCampaigns';
import alertsRoutes from './routes/alerts';
import abtestsRoutes from './routes/abtests';
import customersRoutes from './routes/customers';
import insightsRoutes from './routes/insights';
import integrationsRoutes from './routes/integrations';
import { authenticate } from './middleware/auth';
import { API_FEATURES, API_VERSION } from './lib/apiMeta';
import { startBots } from './workers/botEngine';
import { startRssScannerEngine } from './workers/rssScannerEngine';
import { startBacklinkAuditorEngine } from './workers/backlinkAuditorEngine';
import { startSyncEngine } from './workers/syncEngine';
import { startSchedulerEngine } from './workers/schedulerEngine';
import { startAlertEngine } from './workers/alertEngine';
import { startEmailCampaignEngine } from './workers/emailCampaignEngine';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

dotenv.config();

if (process.env.GSC_SITE_URL) {
  console.log(`✅ GSC_SITE_URL: ${process.env.GSC_SITE_URL}`);
} else {
  console.log('⚠️ Chưa cấu hình GSC_SITE_URL — Organic Search dùng dữ liệu mẫu');
}

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Validate numeric params globally to prevent parsing NaN issues
app.param('id', (req: Request, res: Response, next: NextFunction, val: string) => {
  const parsedId = parseInt(val, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    res.status(400).json({ error: 'Tham số ID trong đường dẫn phải là số nguyên dương hợp lệ.' });
    return;
  }
  next();
});

app.param('campaignId', (req: Request, res: Response, next: NextFunction, val: string) => {
  const parsedCampaignId = parseInt(val, 10);
  if (isNaN(parsedCampaignId) || parsedCampaignId <= 0) {
    res.status(400).json({ error: 'Tham số campaignId trong đường dẫn phải là số nguyên dương hợp lệ.' });
    return;
  }
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Free Traffic API is running',
    apiVersion: API_VERSION,
    features: [...API_FEATURES],
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/email-campaigns', emailCampaignsRoutes);

app.use('/api/channels', authenticate, channelRoutes);
app.use('/api/keywords', authenticate, keywordRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/automation', authenticate, automationRoutes);
app.use('/api/social', authenticate, socialRoutes);
app.use('/api/templates', authenticate, templateRoutes);
app.use('/api/analytics', authenticate, analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', authenticate, reportsRoutes);
app.use('/api/schedules', authenticate, schedulesRoutes);
app.use('/api/seo', authenticate, seoRoutes);
app.get('/api/backlinks/scan', authenticate, requireWrite, discoverBacklinksHandler);
app.post('/api/backlinks/scan', authenticate, requireWrite, discoverBacklinksHandler);
app.use('/api/backlinks', authenticate, backlinksRoutes);
app.use('/api/alerts', authenticate, alertsRoutes);
app.use('/api/abtests', abtestsRoutes);
app.use('/api/customers', authenticate, customersRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/integrations', integrationsRoutes);

// Fallback 404 for any unregistered /api routes
app.use('/api', notFoundHandler);

// Global Error Handler (must be registered last)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend is running at http://localhost:${port}`);
  console.log(`✅ API ${API_VERSION} — Quét backlink: GET/POST /api/backlinks/scan`);
  startBots();
  startRssScannerEngine();
  startBacklinkAuditorEngine();
  startSyncEngine();
  startSchedulerEngine();
  startAlertEngine();
  startEmailCampaignEngine();
});
