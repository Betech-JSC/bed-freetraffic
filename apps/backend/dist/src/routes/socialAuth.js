"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const zaloCrypto_1 = require("../lib/zaloCrypto");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-free-traffic-key';
// Helper to get URLs
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const getBackendUrl = () => process.env.API_PUBLIC_URL || 'http://localhost:4000';
/**
 * 1. Lấy URL OAuth cho Google, Facebook, Zalo
 * Cú pháp: GET /api/auth/social/:platform/url?action=login|connect&workspaceId=X
 */
router.get('/:platform/url', async (req, res) => {
    try {
        const platform = req.params.platform.toLowerCase();
        const action = req.query.action || 'login';
        const workspaceId = parseInt(req.query.workspaceId || '0', 10);
        const state = `${action}_${workspaceId}`;
        const frontendUrl = getFrontendUrl();
        const backendUrl = getBackendUrl();
        const redirectUri = `${backendUrl}/api/auth/social/${platform}/callback`;
        // Google
        if (platform === 'google') {
            const clientId = process.env.GOOGLE_CLIENT_ID;
            if (clientId) {
                const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}&access_type=offline&prompt=consent`;
                res.json({ url, isMock: false });
                return;
            }
            // Hàng giả lập (Sandbox)
            const mockUrl = `${frontendUrl}/oauth/mock?platform=google&action=${action}&workspaceId=${workspaceId}&state=${state}`;
            res.json({ url: mockUrl, isMock: true });
            return;
        }
        // Facebook
        if (platform === 'facebook') {
            const appId = process.env.META_APP_ID || process.env.FB_APP_ID;
            if (appId) {
                const scopes = action === 'connect'
                    ? 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts'
                    : 'public_profile,email';
                const graphVersion = process.env.FB_GRAPH_VERSION || 'v21.0';
                const url = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
                res.json({ url, isMock: false });
                return;
            }
            // Hàng giả lập (Sandbox)
            const mockUrl = `${frontendUrl}/oauth/mock?platform=facebook&action=${action}&workspaceId=${workspaceId}&state=${state}`;
            res.json({ url: mockUrl, isMock: true });
            return;
        }
        // Zalo
        if (platform === 'zalo') {
            const appId = process.env.ZALO_APP_ID;
            if (appId) {
                const verifier = (0, zaloCrypto_1.generateCodeVerifier)();
                const challenge = (0, zaloCrypto_1.generateCodeChallenge)(verifier);
                zaloCrypto_1.zaloVerifiers.set(state, verifier);
                // Tự động dọn dẹp sau 10 phút
                setTimeout(() => zaloCrypto_1.zaloVerifiers.delete(state), 10 * 60 * 1000);
                // OAuth Zalo User (Login) hay Zalo OA (Connect)?
                const baseUrl = action === 'connect'
                    ? `https://oauth.zaloapp.com/v4/oa/permission`
                    : `https://oauth.zaloapp.com/v4/permission`;
                const url = `${baseUrl}?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&state=${state}`;
                res.json({ url, isMock: false });
                return;
            }
            // Hàng giả lập (Sandbox)
            const mockUrl = `${frontendUrl}/oauth/mock?platform=zalo&action=${action}&workspaceId=${workspaceId}&state=${state}`;
            res.json({ url: mockUrl, isMock: true });
            return;
        }
        // TikTok Shop
        if (platform === 'tiktokshop') {
            const appKey = process.env.TIKTOK_SHOP_APP_KEY;
            if (appKey) {
                const url = `https://services.tiktokshop.com/open/authorize?app_key=${appKey}&state=${state}`;
                res.json({ url, isMock: false });
                return;
            }
            // Hàng giả lập (Sandbox)
            const mockUrl = `${frontendUrl}/oauth/mock?platform=tiktokshop&action=${action}&workspaceId=${workspaceId}&state=${state}`;
            res.json({ url: mockUrl, isMock: true });
            return;
        }
        // TikTok Creator
        if (platform === 'tiktok') {
            const clientKey = process.env.TIKTOK_CREATOR_CLIENT_KEY;
            if (clientKey) {
                const scopes = 'user.info.profile,video.upload';
                const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
                res.json({ url, isMock: false });
                return;
            }
            // Hàng giả lập (Sandbox)
            const mockUrl = `${frontendUrl}/oauth/mock?platform=tiktok&action=${action}&workspaceId=${workspaceId}&state=${state}`;
            res.json({ url: mockUrl, isMock: true });
            return;
        }
        res.status(400).json({ error: 'Nền tảng không hỗ trợ' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi liên kết' });
    }
});
/**
 * 2. Unified Callback cho Google, Facebook, Zalo OAuth
 * Nhận code & state từ nhà mạng, xác thực rồi login/connect
 */
router.get('/:platform/callback', async (req, res) => {
    const platform = req.params.platform.toLowerCase();
    const code = req.query.code;
    const state = req.query.state || 'login_0';
    const [action, workspaceIdStr] = state.split('_');
    const workspaceId = parseInt(workspaceIdStr || '0', 10);
    const frontendUrl = getFrontendUrl();
    const backendUrl = getBackendUrl();
    const redirectUri = `${backendUrl}/api/auth/social/${platform}/callback`;
    try {
        if (!code) {
            res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent('Không nhận được mã xác thực')}`);
            return;
        }
        let userProfile = null;
        let oaProfiles = [];
        let isMock = code.startsWith('mock_');
        // === MOCK (SANDBOX) PROCESSING ===
        if (isMock) {
            const emailSuffix = platform === 'zalo' ? 'zalo.betraffic.com' : `${platform}.com`;
            const mockId = code.replace('mock_code_', '');
            userProfile = {
                id: `mock_${platform}_${mockId}`,
                email: `demo.${platform}.${mockId}@${emailSuffix}`,
                name: `${platform.toUpperCase()} Demo User ${mockId}`,
                avatar: ''
            };
            if (action === 'connect') {
                oaProfiles.push({
                    pageId: `mock_${platform}_oa_id_${mockId}`,
                    pageName: `${platform.toUpperCase()} OA Demo ${mockId}`,
                    accessToken: `mock_access_token_${platform}_${mockId}`
                });
            }
        }
        // === REAL OAUTH PROCESSING ===
        else {
            // GOOGLE
            if (platform === 'google') {
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: process.env.GOOGLE_CLIENT_ID || '',
                        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code'
                    })
                });
                const tokens = await tokenRes.json();
                if (tokens.error)
                    throw new Error(tokens.error_description || 'Lỗi trao đổi token Google');
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                const profile = await profileRes.json();
                if (!profile.email)
                    throw new Error('Không thể lấy email từ Google OAuth');
                userProfile = {
                    id: profile.sub,
                    email: profile.email,
                    name: profile.name || profile.email.split('@')[0],
                    avatar: profile.picture
                };
                if (action === 'connect') {
                    // Lưu token Google OAuth để phục vụ đồng bộ GA4/GSC
                    oaProfiles.push({
                        pageId: profile.sub,
                        pageName: profile.email,
                        accessToken: tokens.access_token
                    });
                    // Lưu google credentials
                    const existing = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
                    const googleData = {
                        accessToken: tokens.access_token || '',
                        refreshToken: tokens.refresh_token || existing?.refreshToken || null,
                        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                        ga4PropertyId: process.env.GA4_PROPERTY_ID || existing?.ga4PropertyId,
                        gscSiteUrl: process.env.GSC_SITE_URL || existing?.gscSiteUrl,
                        syncStatus: 'CONNECTED',
                        workspaceId
                    };
                    if (existing) {
                        await prisma_1.default.googleIntegration.update({ where: { id: existing.id }, data: googleData });
                    }
                    else {
                        await prisma_1.default.googleIntegration.create({ data: googleData });
                    }
                }
            }
            // FACEBOOK
            else if (platform === 'facebook') {
                const appId = process.env.META_APP_ID || process.env.FB_APP_ID || '';
                const appSecret = process.env.META_APP_SECRET || '';
                const tokenRes = await fetch(`https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`);
                const tokenData = await tokenRes.json();
                if (tokenData.error)
                    throw new Error(tokenData.error.message);
                const profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`);
                const profile = await profileRes.json();
                userProfile = {
                    id: profile.id,
                    email: profile.email || `${profile.id}@facebook.betraffic.com`,
                    name: profile.name || 'Facebook User',
                    avatar: ''
                };
                if (action === 'connect') {
                    // Lấy Fanpages của user
                    const pagesRes = await fetch(`https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/me/accounts?access_token=${tokenData.access_token}`);
                    const pagesData = await pagesRes.json();
                    console.log(`[FB OAuth Callback] Raw pagesData from Facebook API:`, JSON.stringify(pagesData, null, 2));
                    if (!pagesData.data || pagesData.data.length === 0) {
                        throw new Error('Bạn cần quản lý ít nhất 1 Fanpage Facebook để thực hiện kết nối');
                    }
                    // Lọc các pages có access_token để lưu vào hệ thống
                    const validPages = pagesData.data.filter((page) => {
                        if (!page.access_token) {
                            console.warn(`[FB OAuth Callback] Page skipped due to missing access_token: Name="${page.name}", ID="${page.id}"`);
                            return false;
                        }
                        return true;
                    });
                    if (validPages.length === 0) {
                        throw new Error('Không lấy được Access Token của bất kỳ Trang nào. Hãy chắc chắn bạn là Quản trị viên/Biên tập viên của các Trang đã chọn.');
                    }
                    // Lấy toàn bộ các pages hợp lệ
                    oaProfiles = validPages.map((page) => ({
                        pageId: page.id,
                        pageName: page.name,
                        accessToken: page.access_token
                    }));
                }
            }
            // ZALO
            else if (platform === 'zalo') {
                const appId = process.env.ZALO_APP_ID || '';
                const appSecret = process.env.ZALO_APP_SECRET || '';
                const codeVerifier = zaloCrypto_1.zaloVerifiers.get(state) || '';
                zaloCrypto_1.zaloVerifiers.delete(state); // dùng xong xóa ngay
                // Đổi code lấy Access Token
                const tokenRes = await fetch(action === 'connect' ? 'https://oauth.zaloapp.com/v4/oa/access_token' : 'https://oauth.zaloapp.com/v4/access_token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'secret_key': appSecret
                    },
                    body: new URLSearchParams({
                        code,
                        app_id: appId,
                        grant_type: 'authorization_code',
                        code_verifier: codeVerifier
                    })
                });
                const tokenData = await tokenRes.json();
                if (tokenData.error)
                    throw new Error(tokenData.message || 'Lỗi xác thực Zalo');
                if (action === 'connect') {
                    // Lấy thông tin OA
                    const oaRes = await fetch('https://openapi.zalo.me/v2.0/oa/getoa', {
                        headers: { 'access_token': tokenData.access_token }
                    });
                    const oaData = await oaRes.json();
                    if (oaData.error)
                        throw new Error(oaData.message || 'Không lấy được thông tin OA');
                    oaProfiles.push({
                        pageId: oaData.data?.oa_id?.toString() || 'zalo_oa',
                        pageName: oaData.data?.name || 'Zalo OA',
                        accessToken: tokenData.access_token
                    });
                }
                else {
                    // Zalo user login
                    const userRes = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
                        headers: { 'access_token': tokenData.access_token }
                    });
                    const uData = await userRes.json();
                    userProfile = {
                        id: uData.id,
                        email: uData.email || `${uData.id}@zalo.betraffic.com`,
                        name: uData.name || 'Zalo User',
                        avatar: uData.picture?.data?.url
                    };
                }
            }
            // TIKTOK SHOP
            else if (platform === 'tiktokshop') {
                const appKey = process.env.TIKTOK_SHOP_APP_KEY || '';
                const appSecret = process.env.TIKTOK_SHOP_APP_SECRET || '';
                const tokenRes = await fetch('https://auth.tiktokshop.com/api/v2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        app_key: appKey,
                        app_secret: appSecret,
                        auth_code: code,
                        grant_type: 'authorized_code'
                    })
                });
                const tokenData = await tokenRes.json();
                if (tokenData.error || !tokenData.access_token) {
                    throw new Error(tokenData.message || 'Lỗi uỷ quyền TikTok Shop');
                }
                oaProfiles.push({
                    pageId: tokenData.shop_id || 'tiktok_shop_id',
                    pageName: tokenData.shop_name || 'TikTok Shop Store',
                    accessToken: JSON.stringify(tokenData)
                });
            }
            // TIKTOK CREATOR
            else if (platform === 'tiktok') {
                const clientKey = process.env.TIKTOK_CREATOR_CLIENT_KEY || '';
                const clientSecret = process.env.TIKTOK_CREATOR_CLIENT_SECRET || '';
                const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_key: clientKey,
                        client_secret: clientSecret,
                        code,
                        grant_type: 'authorization_code',
                        redirect_uri: redirectUri
                    })
                });
                const tokenData = await tokenRes.json();
                if (tokenData.error || !tokenData.access_token) {
                    throw new Error(tokenData.error_description || 'Lỗi uỷ quyền TikTok Creator');
                }
                const profileRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
                    headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
                });
                const profileData = await profileRes.json();
                const profile = profileData.data?.user || {};
                oaProfiles.push({
                    pageId: profile.open_id || 'tiktok_creator_id',
                    pageName: profile.display_name || 'TikTok Creator',
                    accessToken: JSON.stringify(tokenData)
                });
            }
        }
        // === HÀNH ĐỘNG 1: ĐĂNG NHẬP XÃ HỘI (LOGIN) ===
        if (action === 'login' && userProfile) {
            // Kiểm tra user có tồn tại chưa
            let user = await prisma_1.default.user.findUnique({ where: { email: userProfile.email } });
            if (!user) {
                // KHÔNG tự động đăng nhập khi chưa có tài khoản, chuyển hướng qua bước đăng ký để lấy thông tin cơ bản
                res.redirect(`${frontendUrl}/register?socialEmail=${encodeURIComponent(userProfile.email)}&socialName=${encodeURIComponent(userProfile.name)}&platform=${platform}`);
                return;
            }
            // Tạo JWT Token cho user
            const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
            const safeUser = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            };
            res.redirect(`${frontendUrl}/oauth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(safeUser))}`);
            return;
        }
        // === HÀNH ĐỘNG 2: KẾT NỐI KÊNH (CONNECT TO WORKSPACE) ===
        if (action === 'connect') {
            if (!workspaceId)
                throw new Error('Thiếu tham số ID không gian làm việc (workspaceId)');
            // Lưu kết nối Google (lưu dưới dạng SMTP email để gửi email marketing chiến dịch)
            if (platform === 'google' && userProfile) {
                const mockSmtp = JSON.stringify({
                    email: userProfile.email,
                    password: 'oauth_secured_pass',
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false,
                    oauthConnected: true
                });
                const existing = await prisma_1.default.socialConnection.findFirst({
                    where: { platform: 'email', workspaceId }
                });
                if (existing) {
                    await prisma_1.default.socialConnection.update({
                        where: { id: existing.id },
                        data: { accessToken: mockSmtp, pageName: userProfile.email, status: 'CONNECTED' }
                    });
                }
                else {
                    await prisma_1.default.socialConnection.create({
                        data: { platform: 'email', workspaceId, accessToken: mockSmtp, pageName: userProfile.email, pageId: 'default', status: 'CONNECTED' }
                    });
                }
            }
            // Facebook & Zalo OA connection
            if (oaProfiles.length > 0) {
                for (const oa of oaProfiles) {
                    const existing = await prisma_1.default.socialConnection.findFirst({
                        where: { platform, pageId: oa.pageId, workspaceId }
                    });
                    if (existing) {
                        await prisma_1.default.socialConnection.update({
                            where: { id: existing.id },
                            data: {
                                accessToken: oa.accessToken,
                                pageName: oa.pageName,
                                status: 'CONNECTED'
                            }
                        });
                    }
                    else {
                        await prisma_1.default.socialConnection.create({
                            data: {
                                platform,
                                workspaceId,
                                accessToken: oa.accessToken,
                                pageName: oa.pageName,
                                pageId: oa.pageId,
                                status: 'CONNECTED'
                            }
                        });
                    }
                }
            }
            res.redirect(`${frontendUrl}/oauth/callback?connect=success&platform=${platform}`);
            return;
        }
        throw new Error('Hành động không hợp lệ');
    }
    catch (err) {
        console.error(`❌ [OAuth callback error on ${platform}]:`, err);
        res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent(err.message || 'Lỗi xác thực mạng xã hội')}`);
    }
});
exports.default = router;
