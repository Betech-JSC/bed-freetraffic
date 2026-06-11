import prisma from '../prisma';
import type { DispatchPayload, DispatchResult } from './types';

export async function dispatchTiktok(payload: DispatchPayload): Promise<DispatchResult> {
  const tiktokConn = payload.connectionId
    ? await prisma.socialConnection.findUnique({ where: { id: payload.connectionId } })
    : await prisma.socialConnection.findFirst({
        where: { platform: 'tiktok', workspaceId: payload.workspaceId }
      });

  if (!tiktokConn?.accessToken || tiktokConn.status !== 'CONNECTED') {
    return { success: false, message: 'Chưa kết nối tài khoản TikTok Creator (Cài đặt)' };
  }

  // 1. Sandbox / Mock Mode
  if (tiktokConn.accessToken.startsWith('mock_')) {
    console.log(`[TikTokDispatch] [MOCK] Đang đăng video lên kênh TikTok: ${tiktokConn.pageName}`);
    return { success: true, message: `[Mock] Đăng tải video lên TikTok "${tiktokConn.pageName}" thành công` };
  }

  // 2. Real TikTok API
  const videoUrl = payload.imageUrl;
  if (!videoUrl) {
    return { success: false, message: 'TikTok yêu cầu tệp video (imageUrl) để đăng tải.' };
  }

  try {
    console.log(`[TikTokDispatch] Đang gọi TikTok Direct Publish API cho kênh: ${tiktokConn.pageName}...`);
    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tiktokConn.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: payload.title,
          description: payload.content.slice(0, 150), // TikTok title limit is short
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_url: videoUrl
        }
      }),
    });

    const data = await response.json() as any;
    if (data.error && data.error.code !== 'ok' && data.error.code !== 0) {
      return { success: false, message: data.error.message || `Lỗi TikTok API (code: ${data.error.code})` };
    }

    return { success: true, message: 'Đăng tải video lên TikTok Creator thành công' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi kết nối TikTok API' };
  }
}
