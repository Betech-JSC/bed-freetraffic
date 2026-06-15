import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv'; // Reloader trigger comment
import path from 'path';
import { createServer } from 'http';
import { initSocket } from './lib/socket';
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
import shortLinkRoutes from './routes/shortlinks';
import popupRoutes from './routes/popups';
import repurposeRoutes from './routes/repurpose';
import referralsRoutes from './routes/referrals';
import ogImageRoutes from './routes/ogImage';
import widgetsRoutes from './routes/widgets';
import backlinksRoutes, { discoverBacklinksHandler } from './routes/backlinks';
import { requireWrite } from './middleware/auth';
import emailCampaignsRoutes from './routes/emailCampaigns';
import alertsRoutes from './routes/alerts';
import abtestsRoutes from './routes/abtests';
import customersRoutes from './routes/customers';
import insightsRoutes from './routes/insights';
import integrationsRoutes from './routes/integrations';
import mailchimpRoutes from './routes/mailchimp';
import workspacesRoutes from './routes/workspaces';
import blogRoutes from './routes/blog';
import landingPagesRoutes from './routes/landingPages';
import publicRoutes from './routes/public';
import formsRoutes from './routes/forms';
import paymentsRoutes from './routes/payments';
import ordersRoutes from './routes/orders';
import cskhRoutes from './routes/cskh';
import socialAuthRoutes from './routes/socialAuth';
import { workspaceMiddleware } from './middleware/workspace';
import { authenticate } from './middleware/auth';
import { API_FEATURES, API_VERSION } from './lib/apiMeta';
import { startBots } from './workers/botEngine';
import { startRssScannerEngine } from './workers/rssScannerEngine';
import { startBacklinkAuditorEngine } from './workers/backlinkAuditorEngine';
import { startSyncEngine } from './workers/syncEngine';
import { startSchedulerEngine } from './workers/schedulerEngine';
import { startAlertEngine } from './workers/alertEngine';
import { startEmailCampaignEngine } from './workers/emailCampaignEngine';
import { startEmailWorkflowEngine } from './workers/emailWorkflowEngine';
import { startCskhFollowupWorker } from './workers/cskhFollowupWorker';
import { startPageSpeedAuditorEngine } from './workers/pagespeedAuditorEngine';
import { startTikTokSyncWorker } from './workers/tiktokSyncWorker';
import { startKeywordCrawlerEngine } from './workers/keywordCrawlerWorker';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

dotenv.config();

if (process.env.GSC_SITE_URL) {
  console.log(`✅ GSC_SITE_URL: ${process.env.GSC_SITE_URL}`);
} else {
  console.log('⚠️ Chưa cấu hình GSC_SITE_URL — Organic Search dùng dữ liệu mẫu');
}

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({
  verify: (req: any, res: any, buf: Buffer) => {
    req.rawBody = buf;
  }
}));
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

// Apply global rate limiter for /api/ routes, excluding public endpoints
app.use('/api', (req, res, next) => {
  if (req.originalUrl.startsWith('/api/public')) {
    return next();
  }
  return apiLimiter(req, res, next);
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
app.use('/api/auth/social', socialAuthRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/email-campaigns', emailCampaignsRoutes);

app.use('/api/channels', authenticate, workspaceMiddleware, channelRoutes);
app.use('/api/keywords', authenticate, workspaceMiddleware, keywordRoutes);
app.use('/api/dashboard', authenticate, workspaceMiddleware, dashboardRoutes);
app.use('/api/automation', authenticate, workspaceMiddleware, automationRoutes);
app.use('/api/social', authenticate, workspaceMiddleware, socialRoutes);
app.use('/api/templates', authenticate, workspaceMiddleware, templateRoutes);
app.use('/api/analytics', authenticate, workspaceMiddleware, analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', authenticate, workspaceMiddleware, reportsRoutes);
app.use('/api/schedules', authenticate, workspaceMiddleware, schedulesRoutes);
app.use('/api/seo', authenticate, workspaceMiddleware, seoRoutes);
app.use('/api/shortlinks', authenticate, workspaceMiddleware, shortLinkRoutes);
app.use('/api/popups', authenticate, workspaceMiddleware, popupRoutes);
app.use('/api/repurpose', authenticate, workspaceMiddleware, repurposeRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/og-image', ogImageRoutes);
app.use('/api/widgets', widgetsRoutes);
app.get('/api/backlinks/scan', authenticate, workspaceMiddleware, requireWrite, discoverBacklinksHandler);
app.post('/api/backlinks/scan', authenticate, workspaceMiddleware, requireWrite, discoverBacklinksHandler);
app.use('/api/backlinks', authenticate, workspaceMiddleware, backlinksRoutes);
app.use('/api/alerts', authenticate, workspaceMiddleware, alertsRoutes);
app.use('/api/abtests', abtestsRoutes);
app.use('/api/customers', authenticate, workspaceMiddleware, customersRoutes);
app.use('/api/insights', authenticate, workspaceMiddleware, insightsRoutes);
app.use('/api/integrations', authenticate, workspaceMiddleware, integrationsRoutes);
app.use('/api/integrations/mailchimp', authenticate, workspaceMiddleware, mailchimpRoutes);

app.use('/api/blog', authenticate, workspaceMiddleware, blogRoutes);
app.use('/api/landing-pages', authenticate, workspaceMiddleware, landingPagesRoutes);
app.use('/api/forms', authenticate, workspaceMiddleware, formsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/payments', paymentsRoutes); // auth handled internally per-route (webhooks are public)
app.use('/api/orders', authenticate, workspaceMiddleware, ordersRoutes);
app.use('/api/cskh', authenticate, workspaceMiddleware, cskhRoutes);

// Fallback 404 for any unregistered /api routes
app.use('/api', notFoundHandler);

// Global Error Handler (must be registered last)
app.use(errorHandler);

import { initVectorDb } from './lib/embeddings';
import { initAuditLogDb } from './lib/auditInit';

const server = createServer(app);
initSocket(server);

server.listen(port, () => {
  console.log(`Backend is running at http://localhost:${port}`);
  console.log(`✅ API ${API_VERSION} — Quét backlink: GET/POST /api/backlinks/scan`);
  
  // Khởi tạo Vector DB cho RAG (Neon)
  void initVectorDb();
  // Khởi tạo bảng Audit Log
  void initAuditLogDb();

  if (process.env.DISABLE_LOCAL_WORKERS !== 'true') {
    startBots();
    startRssScannerEngine();
    startBacklinkAuditorEngine();
    startSyncEngine();
    startSchedulerEngine();
    startAlertEngine();
    startEmailCampaignEngine();
    startEmailWorkflowEngine();
    startCskhFollowupWorker();
    startPageSpeedAuditorEngine();
    startTikTokSyncWorker();
    startKeywordCrawlerEngine();
  } else {
    console.log('👷 DISABLE_LOCAL_WORKERS=true: Đang chạy ở chế độ API thuần. Bỏ qua chạy các tác vụ nền cục bộ.');
  }

  // Tự động phát hiện ngrok tunnel đang hoạt động và in các địa chỉ Webhook công khai
  setTimeout(async () => {
    try {
      const axios = require('axios');
      const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
      if (response.status === 200 && response.data) {
        const tunnels = response.data.tunnels;
        if (tunnels && tunnels.length > 0) {
          const httpsTunnel = tunnels.find((t: any) => t.proto === 'https' || t.public_url.startsWith('https:'));
          const publicUrl = httpsTunnel ? httpsTunnel.public_url : tunnels[0].public_url;
          console.log('\n==================================================================');
          console.log(`🚀 [Ngrok Detected] Phát hiện ngrok tunnel đang hoạt động tại: ${publicUrl}`);
          console.log(`🔗 Webhook SePay:   \x1b[36m${publicUrl}/api/payments/sepay-webhook\x1b[0m`);
          console.log(`🔗 Webhook Zalo OA: \x1b[36m${publicUrl}/api/public/zalo/webhook\x1b[0m`);
          console.log('==================================================================\n');
        }
      }
    } catch (err) {
      // ngrok không chạy, không cần báo lỗi
    }
  }, 3000);
});
