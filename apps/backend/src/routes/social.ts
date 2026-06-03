import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { isValidFacebookPageId } from '../lib/facebookPost';
import {
  getFacebookBotStatus,
  listPagesFromToken,
  saveFacebookConnection,
  testFacebookBotPost,
  verifyFacebookCredentials,
} from '../services/facebookConnect';

const router = Router();

// ==================== CHUNG ====================

// Lấy danh sách tất cả kết nối
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const connections = await prisma.socialConnection.findMany({
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

// Ngắt kết nối bất kỳ nền tảng
router.delete('/:platform', async (req: Request, res: Response): Promise<void> => {
  try {
    const platform = req.params.platform as string;
    await prisma.socialConnection.update({
      where: { platform },
      data: { status: 'DISCONNECTED', accessToken: '' }
    });
    res.json({ message: `Đã ngắt kết nối ${platform}` });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// ==================== FACEBOOK ====================

router.get('/facebook/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getFacebookBotStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/facebook/verify', async (req: Request, res: Response): Promise<void> => {
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

router.post('/facebook/list-pages', async (req: Request, res: Response): Promise<void> => {
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
router.post('/facebook/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pageId, accessToken } = req.body;
    const verified = await saveFacebookConnection(pageId, accessToken);
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

router.post('/facebook/test-bot', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getFacebookBotStatus();
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
router.post('/facebook/auth-url', async (req: Request, res: Response): Promise<void> => {
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

async function saveFacebookPage(page: FbPageRow) {
  await prisma.socialConnection.upsert({
    where: { platform: 'facebook' },
    update: {
      accessToken: page.access_token,
      pageName: page.name,
      pageId: page.id,
      status: 'CONNECTED',
    },
    create: {
      platform: 'facebook',
      accessToken: page.access_token,
      pageName: page.name,
      pageId: page.id,
    },
  });
}

// Bước 2: Nhận callback code từ Facebook, đổi lấy token
router.post('/facebook/callback', async (req: Request, res: Response): Promise<void> => {
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
        await saveFacebookPage(matched);
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
      await saveFacebookPage(page);

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
    res.status(500).json({ error: error.message });
  }
});

// Alias — giữ tương thích UI cũ
router.post('/facebook/quick-connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { accessToken, pageId } = req.body;
    const verified = await saveFacebookConnection(pageId, accessToken);
    res.json({ success: true, pageName: verified.pageName, fanCount: verified.fanCount, pageId: verified.pageId });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Không thể kết nối' });
  }
});

// Cập nhật Page ID + token (sau khi đã kết nối hoặc đổi Fanpage)
router.post('/facebook/bind-page', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pageId, pageAccessToken } = req.body;
    if (!isValidFacebookPageId(pageId)) {
      res.status(400).json({ error: 'Page ID không hợp lệ.' });
      return;
    }
    const token =
      pageAccessToken ||
      (await prisma.socialConnection.findUnique({ where: { platform: 'facebook' } }))?.accessToken;
    if (!token) {
      res.status(400).json({ error: 'Thiếu Page Access Token. Dán token từ Graph API Explorer.' });
      return;
    }

    const verified = await saveFacebookConnection(pageId, token);
    res.json({ success: true, pageName: verified.pageName, pageId: verified.pageId, fanCount: verified.fanCount });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Chọn Page khác (khi user có nhiều page)
router.post('/facebook/select-page', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pageAccessToken, pageId, pageName } = req.body;
    await prisma.socialConnection.upsert({
      where: { platform: 'facebook' },
      update: { accessToken: pageAccessToken, pageName, pageId, status: 'CONNECTED' },
      create: { platform: 'facebook', accessToken: pageAccessToken, pageName, pageId }
    });
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
router.post('/email/connect', async (req: Request, res: Response): Promise<void> => {
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
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    // Lưu config vào DB (dưới dạng JSON trong accessToken)
    const config = JSON.stringify({ email, password, ...smtp });
    await prisma.socialConnection.upsert({
      where: { platform: 'email' },
      update: { accessToken: config, pageName: email, status: 'CONNECTED' },
      create: { platform: 'email', accessToken: config, pageName: email }
    });

    res.json({ success: true, email, smtpHost: smtp.host });
  } catch (error: any) {
    let msg = 'Không thể kết nối SMTP. ';
    if (error.code === 'EAUTH') msg += 'Sai mật khẩu hoặc chưa bật "Mật khẩu ứng dụng" (App Password).';
    else if (error.code === 'ESOCKET') msg += 'Không kết nối được tới máy chủ email.';
    else msg += error.message;
    res.status(400).json({ error: msg });
  }
});

// Gửi email test
router.post('/email/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const conn = await prisma.socialConnection.findUnique({ where: { platform: 'email' } });
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
router.post('/zalo/auth-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { appId, redirectUri } = req.body;
    if (!appId) {
      res.status(400).json({ error: 'Thiếu Zalo App ID' });
      return;
    }
    const url = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Callback Zalo OAuth
router.post('/zalo/callback', async (req: Request, res: Response): Promise<void> => {
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

    await prisma.socialConnection.upsert({
      where: { platform: 'zalo' },
      update: {
        accessToken: tokenData.access_token,
        pageName: oaName,
        pageId: oaData.data?.oa_id?.toString(),
        status: 'CONNECTED'
      },
      create: {
        platform: 'zalo',
        accessToken: tokenData.access_token,
        pageName: oaName,
        pageId: oaData.data?.oa_id?.toString()
      }
    });

    res.json({ success: true, oaName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Kết nối nhanh Zalo bằng token trực tiếp
router.post('/zalo/quick-connect', async (req: Request, res: Response): Promise<void> => {
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
    await prisma.socialConnection.upsert({
      where: { platform: 'zalo' },
      update: { accessToken, pageName: oaName, pageId: oaData.data?.oa_id?.toString(), status: 'CONNECTED' },
      create: { platform: 'zalo', accessToken, pageName: oaName, pageId: oaData.data?.oa_id?.toString() }
    });

    res.json({ success: true, oaName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEST FACEBOOK (cũ, giữ lại) ====================
router.post('/test-facebook', async (req: Request, res: Response): Promise<void> => {
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

export default router;
