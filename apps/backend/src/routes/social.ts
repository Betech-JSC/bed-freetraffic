import { Router, Response } from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { isValidFacebookPageId } from '../lib/facebookPost';
import {
  getFacebookBotStatus,
  listPagesFromToken,
  saveFacebookConnection,
  testFacebookBotPost,
  verifyFacebookCredentials,
} from '../services/facebookConnect';
import { WorkspaceRequest } from '../middleware/workspace';

const router = Router();

/** Safe accessor — trả về workspaceId hoặc throw lỗi 400 nếu thiếu */
function requireWorkspaceId(req: WorkspaceRequest, res: Response): number | null {
  if (!req.workspaceId) {
    res.status(400).json({ error: 'Không xác định được Workspace. Vui lòng đăng nhập lại.' });
    return null;
  }
  return req.workspaceId;
}

// ==================== CHUNG ====================

// Lấy danh sách tất cả kết nối
router.get('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const connections = await prisma.socialConnection.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' }
    });
    // Ẩn token nhạy cảm
    const safe = connections.map(c => ({
      ...c,
      accessToken: c.accessToken ? c.accessToken.substring(0, 8) + '***' : ''
    }));
    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Ngắt kết nối một connection cụ thể
router.delete('/connections/:id', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await prisma.socialConnection.deleteMany({
      where: { id, workspaceId: req.workspaceId }
    });
    res.json({ message: `Đã xóa kết nối thành công` });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Ngắt kết nối bất kỳ nền tảng
router.delete('/:platform', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const platform = req.params.platform as string;
    await prisma.socialConnection.updateMany({
      where: { platform, workspaceId: req.workspaceId },
      data: { status: 'DISCONNECTED', accessToken: '' }
    });
    res.json({ message: `Đã ngắt kết nối ${platform}` });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// ==================== FACEBOOK ====================

router.get('/facebook/status', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const status = await getFacebookBotStatus(req.workspaceId ?? 0);
    res.json(status);
  } catch {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/facebook/verify', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { pageId, accessToken } = req.body;
    const result = await verifyFacebookCredentials(pageId, accessToken);
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
  } catch {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/facebook/list-pages', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { accessToken } = req.body;
    const { pages, error } = await listPagesFromToken(accessToken);
    if (error && pages.length === 0) {
      res.status(400).json({ success: false, error, pages: [] });
      return;
    }
    res.json({
      success: true,
      pages: pages.map((p) => ({ id: p.id, name: p.name, fanCount: p.fan_count })),
    });
  } catch {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

/** Kết nối chính — Page ID + Page Access Token (khuyến nghị) */
router.post('/facebook/connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { pageId, accessToken } = req.body;
    const verified = await saveFacebookConnection(pageId, accessToken, req.workspaceId ?? 0);
    res.json({
      success: true,
      pageName: verified.pageName,
      pageId: verified.pageId,
      fanCount: verified.fanCount,
      botReady: true,
      message: 'Bot có thể tự đăng bài lên Fanpage này.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Không thể kết nối';
    res.status(400).json({ success: false, error: msg });
  }
});

router.post('/facebook/test-bot', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const status = await getFacebookBotStatus(req.workspaceId ?? 0);
    if (!status.botReady) {
      res.status(400).json({ success: false, error: status.issues.join(' ') });
      return;
    }
    const result = await testFacebookBotPost();
    if (!result.success) {
      res.status(400).json({ success: false, error: result.message });
      return;
    }
    res.json({ success: true, message: result.message, postId: result.postId });
  } catch {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Bước 1: Tạo URL đăng nhập Facebook OAuth
router.post('/facebook/auth-url', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { appId, redirectUri } = req.body;
    if (!appId) {
      res.status(400).json({ error: 'Thiếu Facebook App ID' });
      return;
    }
    // pages_manage_posts chỉ hợp lệ sau khi thêm trong Meta → Use cases → Quản lý Page → Customize
    const scopes =
      process.env.FB_OAUTH_SCOPES ||
      'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts';
    const graphVersion = process.env.FB_GRAPH_VERSION || 'v21.0';
    const url = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

type FbPageRow = { id: string; name: string; access_token: string };

async function saveFacebookPage(page: FbPageRow, workspaceId: number) {
  const existing = await prisma.socialConnection.findFirst({
    where: { platform: 'facebook', pageId: page.id, workspaceId }
  });
  if (existing) {
    await prisma.socialConnection.update({
      where: { id: existing.id },
      data: {
        accessToken: page.access_token,
        pageName: page.name,
        status: 'CONNECTED',
      }
    });
  } else {
    await prisma.socialConnection.create({
      data: {
        platform: 'facebook',
        workspaceId,
        accessToken: page.access_token,
        pageName: page.name,
        pageId: page.id,
        status: 'CONNECTED',
      }
    });
  }
}

// Bước 2: Nhận callback code từ Facebook, đổi lấy token
router.post('/facebook/callback', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { code, appId, appSecret, redirectUri, preferredPageId } = req.body;

    // Đổi code lấy User Access Token
    const tokenRes = await fetch(
      `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      res.status(400).json({ error: tokenData.error.message });
      return;
    }

    // Lấy danh sách Pages của user
    const pagesRes = await fetch(
      `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/me/accounts?access_token=${tokenData.access_token}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      res.status(400).json({ error: 'Không tìm thấy Facebook Page nào. Bạn cần có ít nhất 1 Fanpage.' });
      return;
    }

    const pages: FbPageRow[] = pagesData.data.map(
      (p: { id: string; name: string; access_token: string }) => ({
        id: p.id,
        name: p.name,
        access_token: p.access_token,
      })
    );

    if (preferredPageId && isValidFacebookPageId(preferredPageId)) {
      const want = String(preferredPageId).trim();
      const matched = pages.find((p: FbPageRow) => p.id === want);
      if (matched) {
        await saveFacebookPage(matched, req.workspaceId ?? 0);
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
      await saveFacebookPage(page, req.workspaceId ?? 0);

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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
  }
});

// Cập nhật Page ID + token (sau khi đã kết nối hoặc đổi Fanpage)
router.post('/facebook/bind-page', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { pageId, pageAccessToken } = req.body;
    if (!isValidFacebookPageId(pageId)) {
      res.status(400).json({ error: 'Page ID không hợp lệ.' });
      return;
    }
    const token =
      pageAccessToken ||
      (await prisma.socialConnection.findFirst({ where: { platform: 'facebook', workspaceId: req.workspaceId } }))?.accessToken;
    if (!token) {
      res.status(400).json({ error: 'Thiếu Page Access Token. Dán token từ Graph API Explorer.' });
      return;
    }

    const verified = await saveFacebookConnection(pageId, token, req.workspaceId ?? 0);
    res.json({ success: true, pageName: verified.pageName, pageId: verified.pageId, fanCount: verified.fanCount });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/facebook/select-page', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { pageAccessToken, pageId, pageName } = req.body;
    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'facebook', pageId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: { accessToken: pageAccessToken, pageName, status: 'CONNECTED' }
      });
    } else {
      await prisma.socialConnection.create({
        data: { platform: 'facebook', workspaceId: req.workspaceId, accessToken: pageAccessToken, pageName, pageId, status: 'CONNECTED' }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// ==================== EMAIL (SMTP) ====================

// Auto-detect cấu hình SMTP từ email
function detectSmtp(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  const configs: Record<string, { host: string; port: number; secure: boolean }> = {
    'gmail.com': { host: 'smtp.gmail.com', port: 587, secure: false },
    'googlemail.com': { host: 'smtp.gmail.com', port: 587, secure: false },
    'outlook.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    'icloud.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  };
  return configs[domain] || { host: `smtp.${domain}`, port: 587, secure: false };
}

// Kết nối Email SMTP
router.post('/email/connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Thiếu email hoặc mật khẩu ứng dụng' });
      return;
    }

    const smtp = detectSmtp(email);

    // Test kết nối SMTP
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: email, pass: password },
      connectionTimeout: 8000, // 8 giây tối đa để kết nối tránh treo Vercel 502
      greetingTimeout: 8000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false // Bỏ qua lỗi SSL/TLS self-signed trên môi trường cloud
      }
    });

    console.log(`[SMTP] Đang kiểm tra kết nối tới ${smtp.host}:${smtp.port}...`);
    await transporter.verify();
    console.log(`[SMTP] Kết nối thành công tới ${smtp.host}:${smtp.port}!`);

    // Lưu config vào DB (dưới dạng JSON trong accessToken)
    const config = JSON.stringify({ email, password, ...smtp });
    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'email', workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: { accessToken: config, pageName: email, status: 'CONNECTED' }
      });
    } else {
      await prisma.socialConnection.create({
        data: { platform: 'email', workspaceId: req.workspaceId, accessToken: config, pageName: email, pageId: 'default', status: 'CONNECTED' }
      });
    }

    res.json({ success: true, email, smtpHost: smtp.host });
  } catch (error: any) {
    console.error('❌ [SMTP Connection Error]:', error);
    let msg = 'Không thể kết nối SMTP. ';
    if (error.code === 'EAUTH') msg += 'Sai mật khẩu hoặc chưa bật "Mật khẩu ứng dụng" (App Password).';
    else if (error.code === 'ESOCKET') msg += 'Không kết nối được tới máy chủ email.';
    else msg += error.message;
    res.status(400).json({ error: msg });
  }
});

// Gửi email test
router.post('/email/test', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const conn = await prisma.socialConnection.findFirst({ where: { platform: 'email', workspaceId: req.workspaceId } });
    if (!conn || conn.status !== 'CONNECTED') {
      res.status(400).json({ error: 'Chưa kết nối Email' });
      return;
    }

    const config = JSON.parse(conn.accessToken);
    const transporter = nodemailer.createTransport({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ZALO OA ====================

// Tạo URL đăng nhập Zalo OAuth
router.post('/zalo/auth-url', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { appId, redirectUri, codeChallenge } = req.body;
    if (!appId) {
      res.status(400).json({ error: 'Thiếu Zalo App ID' });
      return;
    }
    let url = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    if (codeChallenge) {
      url += `&code_challenge=${codeChallenge}`;
    }
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Callback Zalo OAuth
router.post('/zalo/callback', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { code, appId, appSecret, redirectUri, codeVerifier } = req.body;

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
        grant_type: 'authorization_code',
        code_verifier: codeVerifier || ''
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

    const pageId = oaData.data?.oa_id?.toString() || 'default';
    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'zalo', pageId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: tokenData.access_token,
          pageName: oaName,
          status: 'CONNECTED'
        }
      });
    } else {
      await prisma.socialConnection.create({
        data: {
          platform: 'zalo',
          workspaceId: req.workspaceId,
          accessToken: tokenData.access_token,
          pageName: oaName,
          pageId,
          status: 'CONNECTED'
        }
      });
    }

    res.json({ success: true, oaName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Kết nối nhanh Zalo bằng token trực tiếp
router.post('/zalo/quick-connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
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
    const pageId = oaData.data?.oa_id?.toString() || 'default';
    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'zalo', pageId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: { accessToken, pageName: oaName, status: 'CONNECTED' }
      });
    } else {
      await prisma.socialConnection.create({
        data: { platform: 'zalo', workspaceId: req.workspaceId, accessToken, pageName: oaName, pageId, status: 'CONNECTED' }
      });
    }

    res.json({ success: true, oaName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEST FACEBOOK (cũ, giữ lại) ====================
router.post('/test-facebook', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { accessToken, pageId } = req.body;
    const fbRes = await fetch(`https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v21.0'}/${pageId}?fields=name,fan_count&access_token=${accessToken}`);
    const data = await fbRes.json();
    if (data.error) {
      res.status(400).json({ success: false, error: data.error.message });
      return;
    }
    res.json({ success: true, pageName: data.name, fanCount: data.fan_count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể kết nối tới Facebook' });
  }
});

// ==================== MAILCHIMP ====================
router.post('/mailchimp/connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
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
      const err = await verifyRes.json() as { detail?: string };
      res.status(400).json({ error: err.detail || `Lỗi API Mailchimp: HTTP ${verifyRes.status}` });
      return;
    }

    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'mailchimp', pageId: serverPrefix, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: apiKey,
          pageName: 'Mailchimp API',
          status: 'CONNECTED',
        }
      });
    } else {
      await prisma.socialConnection.create({
        data: {
          platform: 'mailchimp',
          workspaceId: req.workspaceId,
          accessToken: apiKey,
          pageId: serverPrefix,
          pageName: 'Mailchimp API',
          status: 'CONNECTED',
        }
      });
    }

    res.json({ success: true, message: 'Kết nối Mailchimp thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
  }
});

// ==================== TELEGRAM ====================
router.post('/telegram/connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
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
    const meData = await meRes.json() as { result?: { username: string } };
    const botUsername = meData.result?.username || 'Telegram Bot';

    const chatRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!chatRes.ok) {
      res.status(400).json({ error: `Bot chưa được thêm vào chat/channel hoặc Chat ID không tồn tại (HTTP ${chatRes.status})` });
      return;
    }
    const chatData = await chatRes.json() as { result?: { title?: string; username?: string } };
    const chatTitle = chatData.result?.title || chatData.result?.username || chatId;

    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'telegram', pageId: chatId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: botToken,
          pageName: `@${botUsername} → ${chatTitle}`,
          status: 'CONNECTED',
        }
      });
    } else {
      await prisma.socialConnection.create({
        data: {
          platform: 'telegram',
          workspaceId: req.workspaceId,
          accessToken: botToken,
          pageId: chatId,
          pageName: `@${botUsername} → ${chatTitle}`,
          status: 'CONNECTED',
        }
      });
    }

    res.json({ success: true, message: 'Kết nối Telegram Bot thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
  }
});

// ==================== REDDIT ====================
router.post('/reddit/connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
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

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      res.status(400).json({ error: `Xác thực Reddit thất bại: ${tokenData.error || 'không nhận được token'}` });
      return;
    }

    const config = JSON.stringify({ clientId, clientSecret, username, password, subreddit });
    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'reddit', pageId: subreddit, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: config,
          pageName: `/r/${subreddit} (u/${username})`,
          status: 'CONNECTED',
        }
      });
    } else {
      await prisma.socialConnection.create({
        data: {
          platform: 'reddit',
          workspaceId: req.workspaceId,
          accessToken: config,
          pageId: subreddit,
          pageName: `/r/${subreddit} (u/${username})`,
          status: 'CONNECTED',
        }
      });
    }

    res.json({ success: true, message: 'Kết nối Reddit thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
  }
});

// ==================== MOZ API ====================
router.post('/moz/connect', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { accessId, secretKey } = req.body;
    if (!accessId || !secretKey) {
      res.status(400).json({ error: 'Thiếu Moz Access ID hoặc Secret Key' });
      return;
    }

    const expires = Math.floor(Date.now() / 1000) + 300;
    const stringToSign = `${accessId}\n${expires}`;
    const hmac = crypto.createHmac('sha1', secretKey);
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

    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'moz', pageId: accessId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: secretKey,
          pageName: 'Moz API',
          status: 'CONNECTED',
        }
      });
    } else {
      await prisma.socialConnection.create({
        data: {
          platform: 'moz',
          workspaceId: req.workspaceId,
          accessToken: secretKey,
          pageId: accessId,
          pageName: 'Moz API',
          status: 'CONNECTED',
        }
      });
    }

    res.json({ success: true, message: 'Kết nối Moz API thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi kết nối máy chủ' });
  }
});

// ==================== TIKTOK SHOP ====================

// Kết nối thủ công bằng token cho TikTok Shop
router.post('/tiktokshop/bind-page', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { pageId, pageAccessToken, pageName } = req.body;
    if (!pageId || !pageAccessToken) {
      res.status(400).json({ error: 'Thiếu Shop ID hoặc Access Token.' });
      return;
    }

    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'tiktokshop', pageId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: { accessToken: pageAccessToken, pageName: pageName || 'TikTok Shop Store', status: 'CONNECTED' }
      });
    } else {
      await prisma.socialConnection.create({
        data: { platform: 'tiktokshop', workspaceId: req.workspaceId, accessToken: pageAccessToken, pageName: pageName || 'TikTok Shop Store', pageId, status: 'CONNECTED' }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// ==================== TIKTOK CREATOR ====================

// Kết nối thủ công bằng token cho TikTok Creator
router.post('/tiktok/bind-page', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { pageId, pageAccessToken, pageName } = req.body;
    if (!pageId || !pageAccessToken) {
      res.status(400).json({ error: 'Thiếu Channel Open ID hoặc Access Token.' });
      return;
    }

    const existing = await prisma.socialConnection.findFirst({
      where: { platform: 'tiktok', pageId, workspaceId: req.workspaceId }
    });
    if (existing) {
      await prisma.socialConnection.update({
        where: { id: existing.id },
        data: { accessToken: pageAccessToken, pageName: pageName || 'TikTok Creator', status: 'CONNECTED' }
      });
    } else {
      await prisma.socialConnection.create({
        data: { platform: 'tiktok', workspaceId: req.workspaceId, accessToken: pageAccessToken, pageName: pageName || 'TikTok Creator', pageId, status: 'CONNECTED' }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

export default router;
