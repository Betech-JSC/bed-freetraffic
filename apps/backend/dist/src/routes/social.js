"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nodemailer_1 = __importDefault(require("nodemailer"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const facebookPost_1 = require("../lib/facebookPost");
const facebookConnect_1 = require("../services/facebookConnect");
const router = (0, express_1.Router)();
// ==================== CHUNG ====================
// Lấy danh sách tất cả kết nối
router.get('/', async (req, res) => {
    try {
        const connections = await prisma_1.default.socialConnection.findMany({
            where: { workspaceId: req.workspaceId },
            orderBy: { createdAt: 'desc' }
        });
        // Ẩn token nhạy cảm
        const safe = connections.map(c => ({
            ...c,
            accessToken: c.accessToken ? c.accessToken.substring(0, 8) + '***' : ''
        }));
        res.json(safe);
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Ngắt kết nối bất kỳ nền tảng
router.delete('/:platform', async (req, res) => {
    try {
        const platform = req.params.platform;
        await prisma_1.default.socialConnection.updateMany({
            where: { platform, workspaceId: req.workspaceId },
            data: { status: 'DISCONNECTED', accessToken: '' }
        });
        res.json({ message: `Đã ngắt kết nối ${platform}` });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// ==================== FACEBOOK ====================
router.get('/facebook/status', async (req, res) => {
    try {
        const status = await (0, facebookConnect_1.getFacebookBotStatus)(req.workspaceId);
        res.json(status);
    }
    catch {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
router.post('/facebook/verify', async (req, res) => {
    try {
        const { pageId, accessToken } = req.body;
        const result = await (0, facebookConnect_1.verifyFacebookCredentials)(pageId, accessToken);
        if (!result.valid) {
            res.status(400).json({
                success: false,
                error: result.error,
                availablePages: result.availablePages,
            });
            return;
        }
        res.json({
            success: true,
            pageName: result.pageName,
            pageId: result.pageId,
            fanCount: result.fanCount,
            usesPageToken: !!result.pageAccessToken,
        });
    }
    catch {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
router.post('/facebook/list-pages', async (req, res) => {
    try {
        const { accessToken } = req.body;
        const { pages, error } = await (0, facebookConnect_1.listPagesFromToken)(accessToken);
        if (error && pages.length === 0) {
            res.status(400).json({ success: false, error, pages: [] });
            return;
        }
        res.json({
            success: true,
            pages: pages.map((p) => ({ id: p.id, name: p.name, fanCount: p.fan_count })),
        });
    }
    catch {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
/** Kết nối chính — Page ID + Page Access Token (khuyến nghị) */
router.post('/facebook/connect', async (req, res) => {
    try {
        const { pageId, accessToken } = req.body;
        const verified = await (0, facebookConnect_1.saveFacebookConnection)(pageId, accessToken, req.workspaceId);
        res.json({
            success: true,
            pageName: verified.pageName,
            pageId: verified.pageId,
            fanCount: verified.fanCount,
            botReady: true,
            message: 'Bot có thể tự đăng bài lên Fanpage này.',
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Không thể kết nối';
        res.status(400).json({ success: false, error: msg });
    }
});
router.post('/facebook/test-bot', async (req, res) => {
    try {
        const status = await (0, facebookConnect_1.getFacebookBotStatus)(req.workspaceId);
        if (!status.botReady) {
            res.status(400).json({ success: false, error: status.issues.join(' ') });
            return;
        }
        const result = await (0, facebookConnect_1.testFacebookBotPost)();
        if (!result.success) {
            res.status(400).json({ success: false, error: result.message });
            return;
        }
        res.json({ success: true, message: result.message, postId: result.postId });
    }
    catch {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Bước 1: Tạo URL đăng nhập Facebook OAuth
router.post('/facebook/auth-url', async (req, res) => {
    try {
        const { appId, redirectUri } = req.body;
        if (!appId) {
            res.status(400).json({ error: 'Thiếu Facebook App ID' });
            return;
        }
        // pages_manage_posts chỉ hợp lệ sau khi thêm trong Meta → Use cases → Quản lý Page → Customize
        const scopes = process.env.FB_OAUTH_SCOPES ||
            'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts';
        const graphVersion = process.env.FB_GRAPH_VERSION || 'v21.0';
        const url = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
async function saveFacebookPage(page, workspaceId) {
    await prisma_1.default.socialConnection.upsert({
        where: {
            platform_workspaceId: {
                platform: 'facebook',
                workspaceId
            }
        },
        update: {
            accessToken: page.access_token,
            pageName: page.name,
            pageId: page.id,
            status: 'CONNECTED',
        },
        create: {
            platform: 'facebook',
            workspaceId,
            accessToken: page.access_token,
            pageName: page.name,
            pageId: page.id,
        },
    });
}
// Bước 2: Nhận callback code từ Facebook, đổi lấy token
router.post('/facebook/callback', async (req, res) => {
    try {
        const { code, appId, appSecret, redirectUri, preferredPageId } = req.body;
        // Đổi code lấy User Access Token
        const tokenRes = await fetch(`https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`);
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            res.status(400).json({ error: tokenData.error.message });
            return;
        }
        // Lấy danh sách Pages của user
        const pagesRes = await fetch(`https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/me/accounts?access_token=${tokenData.access_token}`);
        const pagesData = await pagesRes.json();
        if (!pagesData.data || pagesData.data.length === 0) {
            res.status(400).json({ error: 'Không tìm thấy Facebook Page nào. Bạn cần có ít nhất 1 Fanpage.' });
            return;
        }
        const pages = pagesData.data.map((p) => ({
            id: p.id,
            name: p.name,
            access_token: p.access_token,
        }));
        if (preferredPageId && (0, facebookPost_1.isValidFacebookPageId)(preferredPageId)) {
            const want = String(preferredPageId).trim();
            const matched = pages.find((p) => p.id === want);
            if (matched) {
                await saveFacebookPage(matched, req.workspaceId);
                res.json({
                    success: true,
                    pages,
                    connectedPage: { id: matched.id, name: matched.name },
                });
                return;
            }
            res.status(400).json({
                error: `Page ID ${want} không nằm trong Fanpage bạn quản lý. Chọn Page trong danh sách hoặc kiểm tra lại ID.`,
                pages,
            });
            return;
        }
        // Một Page → lưu luôn; nhiều Page → để frontend chọn
        if (pages.length === 1) {
            const page = pages[0];
            await saveFacebookPage(page, req.workspaceId);
            res.json({
                success: true,
                pages,
                connectedPage: { id: page.id, name: page.name },
            });
            return;
        }
        res.json({
            success: true,
            pages,
            needsPageSelection: true,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
    }
});
// Cập nhật Page ID + token (sau khi đã kết nối hoặc đổi Fanpage)
router.post('/facebook/bind-page', async (req, res) => {
    try {
        const { pageId, pageAccessToken } = req.body;
        if (!(0, facebookPost_1.isValidFacebookPageId)(pageId)) {
            res.status(400).json({ error: 'Page ID không hợp lệ.' });
            return;
        }
        const token = pageAccessToken ||
            (await prisma_1.default.socialConnection.findFirst({ where: { platform: 'facebook', workspaceId: req.workspaceId } }))?.accessToken;
        if (!token) {
            res.status(400).json({ error: 'Thiếu Page Access Token. Dán token từ Graph API Explorer.' });
            return;
        }
        const verified = await (0, facebookConnect_1.saveFacebookConnection)(pageId, token, req.workspaceId);
        res.json({ success: true, pageName: verified.pageName, pageId: verified.pageId, fanCount: verified.fanCount });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Chọn Page khác (khi user có nhiều page)
router.post('/facebook/select-page', async (req, res) => {
    try {
        const { pageAccessToken, pageId, pageName } = req.body;
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'facebook',
                    workspaceId: req.workspaceId
                }
            },
            update: { accessToken: pageAccessToken, pageName, pageId, status: 'CONNECTED' },
            create: { platform: 'facebook', workspaceId: req.workspaceId, accessToken: pageAccessToken, pageName, pageId }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// ==================== EMAIL (SMTP) ====================
// Auto-detect cấu hình SMTP từ email
function detectSmtp(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    const configs = {
        'gmail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
        'googlemail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
        'outlook.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
        'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
        'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
        'icloud.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
    };
    return configs[domain] || { host: `smtp.${domain}`, port: 587, secure: false };
}
// Kết nối Email SMTP
router.post('/email/connect', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Thiếu email hoặc mật khẩu ứng dụng' });
            return;
        }
        const smtp = detectSmtp(email);
        // Test kết nối SMTP
        const transporter = nodemailer_1.default.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: { user: email, pass: password }
        });
        await transporter.verify();
        // Lưu config vào DB (dưới dạng JSON trong accessToken)
        const config = JSON.stringify({ email, password, ...smtp });
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'email',
                    workspaceId: req.workspaceId
                }
            },
            update: { accessToken: config, pageName: email, status: 'CONNECTED' },
            create: { platform: 'email', workspaceId: req.workspaceId, accessToken: config, pageName: email }
        });
        res.json({ success: true, email, smtpHost: smtp.host });
    }
    catch (error) {
        let msg = 'Không thể kết nối SMTP. ';
        if (error.code === 'EAUTH')
            msg += 'Sai mật khẩu hoặc chưa bật "Mật khẩu ứng dụng" (App Password).';
        else if (error.code === 'ESOCKET')
            msg += 'Không kết nối được tới máy chủ email.';
        else
            msg += error.message;
        res.status(400).json({ error: msg });
    }
});
// Gửi email test
router.post('/email/test', async (req, res) => {
    try {
        const conn = await prisma_1.default.socialConnection.findFirst({ where: { platform: 'email', workspaceId: req.workspaceId } });
        if (!conn || conn.status !== 'CONNECTED') {
            res.status(400).json({ error: 'Chưa kết nối Email' });
            return;
        }
        const config = JSON.parse(conn.accessToken);
        const transporter = nodemailer_1.default.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: { user: config.email, pass: config.password }
        });
        await transporter.sendMail({
            from: config.email,
            to: config.email,
            subject: '✅ Free Traffic - Kết nối Email thành công!',
            html: '<h2>Chúc mừng!</h2><p>Hệ thống Free Traffic đã kết nối thành công với email của bạn.</p>'
        });
        res.json({ success: true, message: 'Đã gửi email test thành công!' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ==================== ZALO OA ====================
// Tạo URL đăng nhập Zalo OAuth
router.post('/zalo/auth-url', async (req, res) => {
    try {
        const { appId, redirectUri } = req.body;
        if (!appId) {
            res.status(400).json({ error: 'Thiếu Zalo App ID' });
            return;
        }
        const url = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
// Callback Zalo OAuth
router.post('/zalo/callback', async (req, res) => {
    try {
        const { code, appId, appSecret, redirectUri } = req.body;
        // Đổi code lấy Access Token từ Zalo
        const tokenRes = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'secret_key': appSecret
            },
            body: new URLSearchParams({
                code,
                app_id: appId,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            res.status(400).json({ error: tokenData.message || 'Lỗi xác thực Zalo' });
            return;
        }
        // Lấy thông tin OA
        const oaRes = await fetch('https://openapi.zalo.me/v2.0/oa/getoa', {
            headers: { 'access_token': tokenData.access_token }
        });
        const oaData = await oaRes.json();
        const oaName = oaData.data?.name || 'Zalo OA';
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'zalo',
                    workspaceId: req.workspaceId
                }
            },
            update: {
                accessToken: tokenData.access_token,
                pageName: oaName,
                pageId: oaData.data?.oa_id?.toString(),
                status: 'CONNECTED'
            },
            create: {
                platform: 'zalo',
                workspaceId: req.workspaceId,
                accessToken: tokenData.access_token,
                pageName: oaName,
                pageId: oaData.data?.oa_id?.toString()
            }
        });
        res.json({ success: true, oaName });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Kết nối nhanh Zalo bằng token trực tiếp
router.post('/zalo/quick-connect', async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            res.status(400).json({ error: 'Thiếu Access Token' });
            return;
        }
        const oaRes = await fetch('https://openapi.zalo.me/v2.0/oa/getoa', {
            headers: { 'access_token': accessToken }
        });
        const oaData = await oaRes.json();
        if (oaData.error) {
            res.status(400).json({ error: oaData.message || 'Token không hợp lệ' });
            return;
        }
        const oaName = oaData.data?.name || 'Zalo OA';
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'zalo',
                    workspaceId: req.workspaceId
                }
            },
            update: { accessToken, pageName: oaName, pageId: oaData.data?.oa_id?.toString(), status: 'CONNECTED' },
            create: { platform: 'zalo', workspaceId: req.workspaceId, accessToken, pageName: oaName, pageId: oaData.data?.oa_id?.toString() }
        });
        res.json({ success: true, oaName });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ==================== TEST FACEBOOK (cũ, giữ lại) ====================
router.post('/test-facebook', async (req, res) => {
    try {
        const { accessToken, pageId } = req.body;
        const fbRes = await fetch(`https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/${pageId}?fields=name,fan_count&access_token=${accessToken}`);
        const data = await fbRes.json();
        if (data.error) {
            res.status(400).json({ success: false, error: data.error.message });
            return;
        }
        res.json({ success: true, pageName: data.name, fanCount: data.fan_count });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Không thể kết nối tới Facebook' });
    }
});
// ==================== MAILCHIMP ====================
router.post('/mailchimp/connect', async (req, res) => {
    try {
        const { apiKey, serverPrefix } = req.body;
        if (!apiKey || !serverPrefix) {
            res.status(400).json({ error: 'Thiếu API Key hoặc Server Prefix' });
            return;
        }
        const encoded = Buffer.from(`any:${apiKey}`).toString('base64');
        const verifyRes = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0/lists?count=1`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${encoded}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
        });
        if (!verifyRes.ok) {
            const err = await verifyRes.json();
            res.status(400).json({ error: err.detail || `Lỗi API Mailchimp: HTTP ${verifyRes.status}` });
            return;
        }
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'mailchimp',
                    workspaceId: req.workspaceId
                }
            },
            update: {
                accessToken: apiKey,
                pageId: serverPrefix,
                pageName: 'Mailchimp API',
                status: 'CONNECTED',
            },
            create: {
                platform: 'mailchimp',
                workspaceId: req.workspaceId,
                accessToken: apiKey,
                pageId: serverPrefix,
                pageName: 'Mailchimp API',
                status: 'CONNECTED',
            },
        });
        res.json({ success: true, message: 'Kết nối Mailchimp thành công!' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
    }
});
// ==================== TELEGRAM ====================
router.post('/telegram/connect', async (req, res) => {
    try {
        const { botToken, chatId } = req.body;
        if (!botToken || !chatId) {
            res.status(400).json({ error: 'Thiếu Telegram Bot Token hoặc Chat ID' });
            return;
        }
        const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!meRes.ok) {
            res.status(400).json({ error: 'Token Bot Telegram không hợp lệ' });
            return;
        }
        const meData = await meRes.json();
        const botUsername = meData.result?.username || 'Telegram Bot';
        const chatRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!chatRes.ok) {
            res.status(400).json({ error: `Bot chưa được thêm vào chat/channel hoặc Chat ID không tồn tại (HTTP ${chatRes.status})` });
            return;
        }
        const chatData = await chatRes.json();
        const chatTitle = chatData.result?.title || chatData.result?.username || chatId;
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'telegram',
                    workspaceId: req.workspaceId
                }
            },
            update: {
                accessToken: botToken,
                pageId: chatId,
                pageName: `@${botUsername} → ${chatTitle}`,
                status: 'CONNECTED',
            },
            create: {
                platform: 'telegram',
                workspaceId: req.workspaceId,
                accessToken: botToken,
                pageId: chatId,
                pageName: `@${botUsername} → ${chatTitle}`,
                status: 'CONNECTED',
            },
        });
        res.json({ success: true, message: 'Kết nối Telegram Bot thành công!' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
    }
});
// ==================== REDDIT ====================
router.post('/reddit/connect', async (req, res) => {
    try {
        const { clientId, clientSecret, username, password, subreddit } = req.body;
        if (!clientId || !clientSecret || !username || !password || !subreddit) {
            res.status(400).json({ error: 'Thiếu thông tin kết nối Reddit' });
            return;
        }
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenUrl = 'https://www.reddit.com/api/v1/access_token';
        const tokenBody = new URLSearchParams({
            grant_type: 'password',
            username,
            password,
        });
        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'User-Agent': `BeTrafficBot/1.0 (by /u/${username})`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenBody.toString(),
            signal: AbortSignal.timeout(5000),
        });
        if (!tokenRes.ok) {
            res.status(400).json({ error: `Xác thực Reddit thất bại: HTTP ${tokenRes.status}` });
            return;
        }
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            res.status(400).json({ error: `Xác thực Reddit thất bại: ${tokenData.error || 'không nhận được token'}` });
            return;
        }
        const config = JSON.stringify({ clientId, clientSecret, username, password, subreddit });
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'reddit',
                    workspaceId: req.workspaceId
                }
            },
            update: {
                accessToken: config,
                pageId: subreddit,
                pageName: `/r/${subreddit} (u/${username})`,
                status: 'CONNECTED',
            },
            create: {
                platform: 'reddit',
                workspaceId: req.workspaceId,
                accessToken: config,
                pageId: subreddit,
                pageName: `/r/${subreddit} (u/${username})`,
                status: 'CONNECTED',
            },
        });
        res.json({ success: true, message: 'Kết nối Reddit thành công!' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
    }
});
// ==================== MOZ API ====================
router.post('/moz/connect', async (req, res) => {
    try {
        const { accessId, secretKey } = req.body;
        if (!accessId || !secretKey) {
            res.status(400).json({ error: 'Thiếu Moz Access ID hoặc Secret Key' });
            return;
        }
        const expires = Math.floor(Date.now() / 1000) + 300;
        const stringToSign = `${accessId}\n${expires}`;
        const hmac = crypto_1.default.createHmac('sha1', secretKey);
        hmac.update(stringToSign);
        const signature = encodeURIComponent(hmac.digest('base64'));
        const cols = '103079215104';
        const url = `https://lsapi.seomoz.com/linkscape/url-metrics/google.com?Cols=${cols}&AccessID=${accessId}&Expires=${expires}&Signature=${signature}`;
        const verifyRes = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        if (!verifyRes.ok) {
            res.status(400).json({ error: `Xác thực Moz thất bại: API trả về HTTP ${verifyRes.status}` });
            return;
        }
        await prisma_1.default.socialConnection.upsert({
            where: {
                platform_workspaceId: {
                    platform: 'moz',
                    workspaceId: req.workspaceId
                }
            },
            update: {
                accessToken: secretKey,
                pageId: accessId,
                pageName: 'Moz API',
                status: 'CONNECTED',
            },
            create: {
                platform: 'moz',
                workspaceId: req.workspaceId,
                accessToken: secretKey,
                pageId: accessId,
                pageName: 'Moz API',
                status: 'CONNECTED',
            },
        });
        res.json({ success: true, message: 'Kết nối Moz API thành công!' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
    }
});
exports.default = router;
