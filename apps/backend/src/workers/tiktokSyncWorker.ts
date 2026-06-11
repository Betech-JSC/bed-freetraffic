import prisma from '../lib/prisma';

// 4 hours in milliseconds (run check periodically)
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Xử lý refresh token cho TikTok Shop
 */
async function refreshTikTokShopToken(conn: any): Promise<void> {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;

  if (!appKey || !appSecret) {
    console.warn(`[TikTokSyncWorker] Thiếu TIKTOK_SHOP_APP_KEY hoặc TIKTOK_SHOP_APP_SECRET để tự động refresh token.`);
    return;
  }

  try {
    let tokenData = JSON.parse(conn.accessToken);
    if (!tokenData.refresh_token) return;

    console.log(`[TikTokSyncWorker] Đang gia hạn token cho TikTok Shop ID: ${conn.pageId}...`);

    const res = await fetch('https://auth.tiktokshop.com/api/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key: appKey,
        app_secret: appSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await res.json() as any;
    if (res.ok && data.access_token) {
      await prisma.socialConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: JSON.stringify(data),
          updatedAt: new Date()
        }
      });
      console.log(`[TikTokSyncWorker] Đã làm mới thành công token cho TikTok Shop: ${conn.pageName}`);
    } else {
      console.error(`[TikTokSyncWorker] Phản hồi lỗi từ TikTok Shop Token API:`, data.message || 'Unknown error');
    }
  } catch (error: any) {
    console.error(`[TikTokSyncWorker] Thất bại khi làm mới token cho connection #${conn.id}:`, error.message);
  }
}

/**
 * Xử lý refresh token cho TikTok Creator (User)
 */
async function refreshTikTokCreatorToken(conn: any): Promise<void> {
  const clientKey = process.env.TIKTOK_CREATOR_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CREATOR_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    return;
  }

  try {
    let tokenData = JSON.parse(conn.accessToken);
    if (!tokenData.refresh_token) return;

    console.log(`[TikTokSyncWorker] Đang gia hạn token cho TikTok Creator ID: ${conn.pageId}...`);

    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await res.json() as any;
    if (res.ok && data.access_token) {
      await prisma.socialConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: JSON.stringify(data),
          updatedAt: new Date()
        }
      });
      console.log(`[TikTokSyncWorker] Đã làm mới thành công token cho TikTok Creator: ${conn.pageName}`);
    } else {
      console.error(`[TikTokSyncWorker] Lỗi refresh token Creator từ TikTok API:`, data.error_description || 'Unknown error');
    }
  } catch (error: any) {
    console.error(`[TikTokSyncWorker] Thất bại khi làm mới token Creator:`, error.message);
  }
}

/**
 * Quét toàn bộ kết nối và thực hiện refresh token nếu cần
 */
export async function runTokenRefreshTask(): Promise<void> {
  try {
    const thresholdDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 ngày trước

    // Lấy các connection Zalo/TikTok có thể cần làm mới (hoặc kiểm tra token để tránh hết hạn)
    const connections = await prisma.socialConnection.findMany({
      where: {
        platform: { in: ['tiktok', 'tiktokshop'] },
        status: 'CONNECTED',
        updatedAt: { lte: thresholdDate }
      }
    });

    if (connections.length === 0) return;

    console.log(`[TikTokSyncWorker] Quét thấy ${connections.length} kết nối cần làm mới token.`);

    for (const conn of connections) {
      if (conn.platform === 'tiktokshop') {
        await refreshTikTokShopToken(conn);
      } else if (conn.platform === 'tiktok') {
        await refreshTikTokCreatorToken(conn);
      }
    }
  } catch (error) {
    console.error('[TikTokSyncWorker] Lỗi thực thi tiến trình refresh token:', error);
  }
}

/**
 * Đồng bộ đơn hàng từ TikTok Shop về CRM (Giả lập/Chạy thực)
 */
export async function runOrderSyncTask(): Promise<void> {
  try {
    const connections = await prisma.socialConnection.findMany({
      where: { platform: 'tiktokshop', status: 'CONNECTED' }
    });

    for (const conn of connections) {
      const workspaceId = conn.workspaceId;
      if (!workspaceId) continue;

      // Trong production: Gọi API của TikTok Shop lấy danh sách đơn hàng mới thay đổi trong 24h qua
      // API: GET /api/v2/shops/{shop_id}/orders/search
      let tokenData: any;
      try {
        tokenData = JSON.parse(conn.accessToken);
      } catch {
        console.warn(`[TikTokSyncWorker] Bỏ qua connection #${conn.id} - Token không hợp lệ.`);
        continue;
      }

      if (!tokenData?.access_token) {
        console.warn(`[TikTokSyncWorker] Bỏ qua connection #${conn.id} - Không có access_token.`);
        continue;
      }

      console.log(`[TikTokSyncWorker] Đang đồng bộ đơn hàng cho Shop ID: ${conn.pageId}...`);
      // Gọi API thực tế nếu có token thật
      // Sau khi lấy đơn hàng thành công, upsert khách hàng vào bảng Customer và Order
    }
  } catch (error) {
    console.error('[TikTokSyncWorker] Lỗi đồng bộ đơn hàng TikTok:', error);
  }
}

/**
 * Khởi chạy worker chạy định kỳ
 */
export function startTikTokSyncWorker(): void {
  // Chạy lập tức lần đầu khi server khởi động
  setTimeout(() => {
    void runTokenRefreshTask();
    void runOrderSyncTask();
  }, 5000);

  // Lập lịch định kỳ
  setInterval(() => {
    void runTokenRefreshTask().catch((err) => {
      console.error('[TikTokSyncWorker] Lỗi chạy task refresh token:', err);
    });
    void runOrderSyncTask().catch((err) => {
      console.error('[TikTokSyncWorker] Lỗi chạy task sync đơn hàng:', err);
    });
  }, CHECK_INTERVAL_MS);

  console.log('✅ TikTok Sync Worker — Tự động refresh token & đồng bộ đơn hàng hoạt động định kỳ');
}
