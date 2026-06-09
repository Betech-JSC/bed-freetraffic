import prisma from '../prisma';
import { renderContent } from './render';
import type { DispatchPayload, DispatchResult } from './types';

export async function dispatchZalo(payload: DispatchPayload): Promise<DispatchResult> {
  const zaloConn = payload.connectionId
    ? await prisma.socialConnection.findUnique({ where: { id: payload.connectionId } })
    : await prisma.socialConnection.findFirst({
        where: { platform: 'zalo', workspaceId: payload.workspaceId }
      });
  if (!zaloConn?.accessToken || zaloConn.status !== 'CONNECTED') {
    return { success: false, message: 'Chưa kết nối Zalo OA (Cài đặt)' };
  }

  const postContent = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });

  try {
    const response = await fetch('https://openapi.zalo.me/v2.0/article/create', {
      method: 'POST',
      headers: {
        access_token: zaloConn.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'normal',
        title: payload.title,
        author: zaloConn.pageName || 'OA',
        description: postContent.slice(0, 300),
        body: [
          { type: 'text', content: postContent },
          ...(payload.urlTarget ? [{ type: 'text', content: `\n👉 ${payload.urlTarget}` }] : []),
        ],
      }),
    });
    const data = await response.json();
    if (data.error !== 0 && data.error !== undefined) {
      return { success: false, message: data.message || 'Zalo API lỗi' };
    }
    return { success: true, message: 'Đăng bài Zalo OA thành công' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi Zalo' };
  }
}
