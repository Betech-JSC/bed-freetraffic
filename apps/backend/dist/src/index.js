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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv")); // Reloader trigger comment - updated telegram token
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_1 = require("./lib/socket");
const auth_1 = __importDefault(require("./routes/auth"));
const channel_1 = __importDefault(require("./routes/channel"));
const keyword_1 = __importDefault(require("./routes/keyword"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const automation_1 = __importDefault(require("./routes/automation"));
const social_1 = __importDefault(require("./routes/social"));
const templates_1 = __importDefault(require("./routes/templates"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const users_1 = __importDefault(require("./routes/users"));
const google_1 = __importDefault(require("./routes/google"));
const reports_1 = __importDefault(require("./routes/reports"));
const schedules_1 = __importDefault(require("./routes/schedules"));
const seo_1 = __importDefault(require("./routes/seo"));
const shortlinks_1 = __importDefault(require("./routes/shortlinks"));
const popups_1 = __importDefault(require("./routes/popups"));
const repurpose_1 = __importDefault(require("./routes/repurpose"));
const referrals_1 = __importDefault(require("./routes/referrals"));
const ogImage_1 = __importDefault(require("./routes/ogImage"));
const widgets_1 = __importDefault(require("./routes/widgets"));
const backlinks_1 = __importStar(require("./routes/backlinks"));
const auth_2 = require("./middleware/auth");
const emailCampaigns_1 = __importDefault(require("./routes/emailCampaigns"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const abtests_1 = __importDefault(require("./routes/abtests"));
const customers_1 = __importDefault(require("./routes/customers"));
const insights_1 = __importDefault(require("./routes/insights"));
const integrations_1 = __importDefault(require("./routes/integrations"));
const mailchimp_1 = __importDefault(require("./routes/mailchimp"));
const workspaces_1 = __importDefault(require("./routes/workspaces"));
const blog_1 = __importDefault(require("./routes/blog"));
const landingPages_1 = __importDefault(require("./routes/landingPages"));
const public_1 = __importDefault(require("./routes/public"));
const forms_1 = __importDefault(require("./routes/forms"));
const payments_1 = __importDefault(require("./routes/payments"));
const orders_1 = __importDefault(require("./routes/orders"));
const cskh_1 = __importDefault(require("./routes/cskh"));
const socialAuth_1 = __importDefault(require("./routes/socialAuth"));
const listening_1 = __importDefault(require("./routes/listening"));
const workspace_1 = require("./middleware/workspace");
const auth_3 = require("./middleware/auth");
const apiMeta_1 = require("./lib/apiMeta");
const botEngine_1 = require("./workers/botEngine");
const rssScannerEngine_1 = require("./workers/rssScannerEngine");
const backlinkAuditorEngine_1 = require("./workers/backlinkAuditorEngine");
const syncEngine_1 = require("./workers/syncEngine");
const schedulerEngine_1 = require("./workers/schedulerEngine");
const alertEngine_1 = require("./workers/alertEngine");
const emailCampaignEngine_1 = require("./workers/emailCampaignEngine");
const emailWorkflowEngine_1 = require("./workers/emailWorkflowEngine");
const cskhFollowupWorker_1 = require("./workers/cskhFollowupWorker");
const pagespeedAuditorEngine_1 = require("./workers/pagespeedAuditorEngine");
const tiktokSyncWorker_1 = require("./workers/tiktokSyncWorker");
const keywordCrawlerWorker_1 = require("./workers/keywordCrawlerWorker");
const socialListeningWorker_1 = require("./workers/socialListeningWorker");
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
dotenv_1.default.config();
if (process.env.GSC_SITE_URL) {
    console.log(`✅ GSC_SITE_URL: ${process.env.GSC_SITE_URL}`);
}
else {
    console.log('⚠️ Chưa cấu hình GSC_SITE_URL — Organic Search dùng dữ liệu mẫu');
}
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const port = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Validate numeric params globally to prevent parsing NaN issues
app.param('id', (req, res, next, val) => {
    const parsedId = parseInt(val, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        res.status(400).json({ error: 'Tham số ID trong đường dẫn phải là số nguyên dương hợp lệ.' });
        return;
    }
    next();
});
app.param('campaignId', (req, res, next, val) => {
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
    return (0, rateLimiter_1.apiLimiter)(req, res, next);
});
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'Free Traffic API is running',
        apiVersion: apiMeta_1.API_VERSION,
        features: [...apiMeta_1.API_FEATURES],
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/auth/social', socialAuth_1.default);
app.use('/api/workspaces', workspaces_1.default);
app.use('/api/google', google_1.default);
app.use('/api/email-campaigns', emailCampaigns_1.default);
app.use('/api/channels', auth_3.authenticate, workspace_1.workspaceMiddleware, channel_1.default);
app.use('/api/keywords', auth_3.authenticate, workspace_1.workspaceMiddleware, keyword_1.default);
app.use('/api/dashboard', auth_3.authenticate, workspace_1.workspaceMiddleware, dashboard_1.default);
app.use('/api/automation', auth_3.authenticate, workspace_1.workspaceMiddleware, automation_1.default);
app.use('/api/social', auth_3.authenticate, workspace_1.workspaceMiddleware, social_1.default);
app.use('/api/templates', auth_3.authenticate, workspace_1.workspaceMiddleware, templates_1.default);
app.use('/api/analytics', auth_3.authenticate, workspace_1.workspaceMiddleware, analytics_1.default);
app.use('/api/users', users_1.default);
app.use('/api/reports', auth_3.authenticate, workspace_1.workspaceMiddleware, reports_1.default);
app.use('/api/schedules', auth_3.authenticate, workspace_1.workspaceMiddleware, schedules_1.default);
app.use('/api/seo', auth_3.authenticate, workspace_1.workspaceMiddleware, seo_1.default);
app.use('/api/shortlinks', auth_3.authenticate, workspace_1.workspaceMiddleware, shortlinks_1.default);
app.use('/api/popups', auth_3.authenticate, workspace_1.workspaceMiddleware, popups_1.default);
app.use('/api/repurpose', auth_3.authenticate, workspace_1.workspaceMiddleware, repurpose_1.default);
app.use('/api/referrals', referrals_1.default);
app.use('/api/og-image', ogImage_1.default);
app.use('/api/widgets', widgets_1.default);
app.get('/api/backlinks/scan', auth_3.authenticate, workspace_1.workspaceMiddleware, auth_2.requireWrite, backlinks_1.discoverBacklinksHandler);
app.post('/api/backlinks/scan', auth_3.authenticate, workspace_1.workspaceMiddleware, auth_2.requireWrite, backlinks_1.discoverBacklinksHandler);
app.use('/api/backlinks', auth_3.authenticate, workspace_1.workspaceMiddleware, backlinks_1.default);
app.use('/api/alerts', auth_3.authenticate, workspace_1.workspaceMiddleware, alerts_1.default);
app.use('/api/abtests', abtests_1.default);
app.use('/api/customers', auth_3.authenticate, workspace_1.workspaceMiddleware, customers_1.default);
app.use('/api/insights', auth_3.authenticate, workspace_1.workspaceMiddleware, insights_1.default);
app.use('/api/integrations', auth_3.authenticate, workspace_1.workspaceMiddleware, integrations_1.default);
app.use('/api/integrations/mailchimp', auth_3.authenticate, workspace_1.workspaceMiddleware, mailchimp_1.default);
app.use('/api/blog', auth_3.authenticate, workspace_1.workspaceMiddleware, blog_1.default);
app.use('/api/landing-pages', auth_3.authenticate, workspace_1.workspaceMiddleware, landingPages_1.default);
app.use('/api/forms', auth_3.authenticate, workspace_1.workspaceMiddleware, forms_1.default);
app.use('/api/public', public_1.default);
app.use('/api/payments', payments_1.default); // auth handled internally per-route (webhooks are public)
app.use('/api/orders', auth_3.authenticate, workspace_1.workspaceMiddleware, orders_1.default);
app.use('/api/cskh', auth_3.authenticate, workspace_1.workspaceMiddleware, cskh_1.default);
app.use('/api/listening', auth_3.authenticate, workspace_1.workspaceMiddleware, listening_1.default);
// Fallback 404 for any unregistered /api routes
app.use('/api', errorHandler_1.notFoundHandler);
// Global Error Handler (must be registered last)
app.use(errorHandler_1.errorHandler);
const embeddings_1 = require("./lib/embeddings");
const auditInit_1 = require("./lib/auditInit");
const server = (0, http_1.createServer)(app);
(0, socket_1.initSocket)(server);
server.listen(port, () => {
    console.log(`Backend is running at http://localhost:${port}`);
    console.log(`✅ API ${apiMeta_1.API_VERSION} — Quét backlink: GET/POST /api/backlinks/scan`);
    // Khởi tạo Vector DB cho RAG (Neon)
    void (0, embeddings_1.initVectorDb)();
    // Khởi tạo bảng Audit Log
    void (0, auditInit_1.initAuditLogDb)();
    if (process.env.DISABLE_LOCAL_WORKERS !== 'true') {
        (0, botEngine_1.startBots)();
        (0, rssScannerEngine_1.startRssScannerEngine)();
        (0, backlinkAuditorEngine_1.startBacklinkAuditorEngine)();
        (0, syncEngine_1.startSyncEngine)();
        (0, schedulerEngine_1.startSchedulerEngine)();
        (0, alertEngine_1.startAlertEngine)();
        (0, emailCampaignEngine_1.startEmailCampaignEngine)();
        (0, emailWorkflowEngine_1.startEmailWorkflowEngine)();
        (0, cskhFollowupWorker_1.startCskhFollowupWorker)();
        (0, pagespeedAuditorEngine_1.startPageSpeedAuditorEngine)();
        (0, tiktokSyncWorker_1.startTikTokSyncWorker)();
        (0, keywordCrawlerWorker_1.startKeywordCrawlerEngine)();
        (0, socialListeningWorker_1.startSocialListeningEngine)();
    }
    else {
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
                    const httpsTunnel = tunnels.find((t) => t.proto === 'https' || t.public_url.startsWith('https:'));
                    const publicUrl = httpsTunnel ? httpsTunnel.public_url : tunnels[0].public_url;
                    console.log('\n==================================================================');
                    console.log(`🚀 [Ngrok Detected] Phát hiện ngrok tunnel đang hoạt động tại: ${publicUrl}`);
                    console.log(`🔗 Webhook SePay:   \x1b[36m${publicUrl}/api/payments/sepay-webhook\x1b[0m`);
                    console.log(`🔗 Webhook Zalo OA: \x1b[36m${publicUrl}/api/public/zalo/webhook\x1b[0m`);
                    console.log('==================================================================\n');
                }
            }
        }
        catch (err) {
            // ngrok không chạy, không cần báo lỗi
        }
    }, 3000);
});
