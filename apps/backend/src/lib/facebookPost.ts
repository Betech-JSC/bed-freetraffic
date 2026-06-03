import fs from 'fs';
import path from 'path';
import prisma from './prisma';

export const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v21.0';

export function isValidFacebookPageId(pageId: string | null | undefined): boolean {
  if (!pageId) return false;
  const id = String(pageId).trim();
  if (!id || id === '0') return false;
  return /^\d{5,}$/.test(id);
}

export function isValidPostLink(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) return false;
  const raw = String(url).trim();
  if (raw === '0') return false;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export type FacebookConnectionCheck =
  | { ok: true; pageId: string; accessToken: string; pageName: string | null }
  | { ok: false; message: string };

/** Đưa URL vào message thay vì field `link` — tránh lỗi (#100) khi Facebook không scrape được link */
export function buildFacebookMessage(message: string, link?: string | null): string {
  const text = message.trim();
  if (!isValidPostLink(link)) return text;
  const url = String(link).trim();
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  if (text.includes(withScheme) || text.includes(url)) return text;
  return text ? `${text}\n\n${withScheme}` : withScheme;
}

async function refreshFacebookPageTokenIfNeeded(): Promise<void> {
  const fb = await prisma.socialConnection.findUnique({ where: { platform: 'facebook' } });
  if (!fb?.pageId || !fb.accessToken) return;

  const res = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(fb.accessToken)}`
  );
  const data = (await res.json()) as { data?: { id: string; name: string; access_token: string }[] };
  const match = data.data?.find((p) => p.id === String(fb.pageId).trim());
  if (match?.access_token && match.access_token !== fb.accessToken) {
    await prisma.socialConnection.update({
      where: { platform: 'facebook' },
      data: { accessToken: match.access_token, pageName: match.name },
    });
  }
}

export async function getFacebookPageConnection(): Promise<FacebookConnectionCheck> {
  const fb = await prisma.socialConnection.findUnique({ where: { platform: 'facebook' } });
  if (!fb || fb.status !== 'CONNECTED' || !fb.accessToken) {
    return {
      ok: false,
      message: '⚠️ Chưa kết nối Facebook. Vào Cài đặt → Facebook Page để liên kết Fanpage.',
    };
  }
  if (!isValidFacebookPageId(fb.pageId)) {
    return {
      ok: false,
      message:
        '⚠️ Page ID chưa đúng (đang trống hoặc không hợp lệ). Ngắt kết nối và kết nối lại — dùng Page ID từ Graph API Explorer (me/accounts), không dùng App ID.',
    };
  }
  return {
    ok: true,
    pageId: String(fb.pageId).trim(),
    accessToken: fb.accessToken,
    pageName: fb.pageName,
  };
}

export async function publishToFacebookPage(opts: {
  message: string;
  link?: string | null;
  imagePath?: string | null;
  /** false = bài nháp / không publish feed công khai (dùng cho test kết nối) */
  published?: boolean;
}): Promise<{ success: boolean; message: string; postId?: string }> {
  await refreshFacebookPageTokenIfNeeded();

  const conn = await getFacebookPageConnection();
  if (!conn.ok) return { success: false, message: conn.message };

  const { pageId, accessToken } = conn;
  const base = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}`;
  const finalMessage = buildFacebookMessage(opts.message, opts.link);
  let data: { error?: { message: string }; id?: string; post_id?: string };

  try {
    if (opts.imagePath && fs.existsSync(opts.imagePath)) {
      const formData = new globalThis.FormData();
      const fileBuffer = fs.readFileSync(opts.imagePath);
      const blob = new globalThis.Blob([fileBuffer]);
      formData.append('source', blob, path.basename(opts.imagePath));
      formData.append('message', finalMessage);
      formData.append('access_token', accessToken);
      const response = await fetch(`${base}/photos`, { 
        method: 'POST', 
        body: formData as unknown as BodyInit
      });
      data = await response.json();
    } else {
      const body: Record<string, string | boolean> = {
        message: finalMessage,
        access_token: accessToken,
      };
      if (opts.published === false) body.published = false;
      const response = await fetch(`${base}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = await response.json();
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: `❌ Lỗi kết nối Facebook: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  if (data.error) {
    let hint = '';
    const errLower = data.error.message.toLowerCase();
    if (errLower.includes('permission') || errLower.includes('(#200)')) {
      hint = ' Bật quyền pages_manage_posts trong Meta app và tạo token mới.';
    } else if (errLower.includes('valid user id') || errLower.includes('(#100)')) {
      hint = ` Fanpage ${pageId}: thử Cài đặt → Gửi bài test. Nếu test OK mà Bot lỗi, tạo lại Page token trên Graph API Explorer.`;
    }
    return { success: false, message: `❌ Facebook API: ${data.error.message}${hint}` };
  }

  const postId = data.id || data.post_id;
  return {
    success: true,
    message: `✅ Đăng thành công! (Post ID: ${postId})`,
    postId,
  };
}
