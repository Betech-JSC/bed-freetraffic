import prisma from '../lib/prisma';
import {
  FB_GRAPH_VERSION,
  isValidFacebookPageId,
  publishToFacebookPage,
} from '../lib/facebookPost';

export type FbPageFromGraph = {
  id: string;
  name: string;
  access_token: string;
  fan_count?: number;
};

export type FacebookPageVerifyResult = {
  valid: boolean;
  pageId?: string;
  pageName?: string;
  fanCount?: number;
  /** Token Fanpage thật (từ me/accounts) — dùng khi lưu DB */
  pageAccessToken?: string;
  error?: string;
  availablePages?: { id: string; name: string }[];
};

async function graphGet<T>(path: string, accessToken: string): Promise<T & { error?: { message: string } }> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${path}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchManagedPages(accessToken: string): Promise<FbPageFromGraph[]> {
  const data = await graphGet<{ data?: FbPageFromGraph[]; error?: { message: string } }>(
    'me/accounts?fields=id,name,access_token,fan_count',
    accessToken.trim()
  );
  if (data.error) {
    return [];
  }
  return data.data ?? [];
}

function friendlyGraphError(message: string, availablePages: FbPageFromGraph[]): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('does not exist') ||
    lower.includes('unsupported get request') ||
    lower.includes('missing permissions')
  ) {
    if (availablePages.length > 0) {
      const list = availablePages.map((p) => `• ${p.name} → ID ${p.id}`).join('\n');
      return (
        'Page ID hoặc token không khớp Fanpage.\n\n' +
        'Thường do:\n' +
        '1) Dán nhầm User ID (tài khoản cá nhân) thay vì id Fanpage\n' +
        '2) Dán User Access Token thay vì access_token trong me/accounts\n\n' +
        `Fanpage bạn quản lý (gọi me/accounts):\n${list}\n\n` +
        'Hãy copy đúng cột id và access_token của Fanpage cần đăng bài.'
      );
    }
    return (
      'Không truy cập được Fanpage với token này.\n\n' +
      'Trên Graph API Explorer:\n' +
      '• Generate Token → chọn quyền pages_show_list, pages_manage_posts\n' +
      '• Gọi GET me/accounts → copy id + access_token (cùng một dòng Fanpage)\n' +
      '• Không dùng ID tài khoản Facebook cá nhân.'
    );
  }
  return message;
}

export async function verifyFacebookCredentials(
  pageId: string,
  accessToken: string
): Promise<FacebookPageVerifyResult> {
  if (!isValidFacebookPageId(pageId)) {
    return {
      valid: false,
      error: 'Page ID không hợp lệ. Lấy từ Graph API Explorer → GET me/accounts (cột id). Không dùng App ID.',
    };
  }
  if (!accessToken?.trim()) {
    return { valid: false, error: 'Thiếu Page Access Token.' };
  }

  const token = accessToken.trim();
  const want = pageId.trim();
  const managed = await fetchManagedPages(token);

  const matched = managed.find((p) => p.id === want);
  if (matched) {
    return {
      valid: true,
      pageId: matched.id,
      pageName: matched.name,
      fanCount: matched.fan_count,
      pageAccessToken: matched.access_token,
    };
  }

  if (managed.length > 0) {
    return {
      valid: false,
      error: friendlyGraphError('Page ID not in managed pages', managed),
      availablePages: managed.map((p) => ({ id: p.id, name: p.name })),
    };
  }

  // Token có thể đã là Page Access Token — thử GET trực tiếp
  const direct = await graphGet<{ id?: string; name?: string; fan_count?: number; error?: { message: string } }>(
    `${want}?fields=id,name,fan_count`,
    token
  );
  if (!direct.error && direct.id) {
    return {
      valid: true,
      pageId: direct.id,
      pageName: direct.name,
      fanCount: direct.fan_count,
      pageAccessToken: token,
    };
  }

  const errMsg = direct.error?.message ?? 'Không xác minh được Fanpage.';
  return {
    valid: false,
    error: friendlyGraphError(errMsg, managed),
    availablePages: managed.map((p) => ({ id: p.id, name: p.name })),
  };
}

export async function listPagesFromToken(accessToken: string): Promise<{
  pages: FbPageFromGraph[];
  error?: string;
}> {
  if (!accessToken?.trim()) {
    return { pages: [], error: 'Thiếu Access Token.' };
  }
  const pages = await fetchManagedPages(accessToken);
  if (pages.length === 0) {
    const probe = await graphGet<{ id?: string; name?: string; error?: { message: string } }>(
      'me?fields=id,name',
      accessToken.trim()
    );
    if (probe.error) {
      return {
        pages: [],
        error:
          'Token không lấy được danh sách Fanpage. Tạo token mới với quyền Page (pages_show_list) rồi gọi me/accounts.',
      };
    }
    return {
      pages: [],
      error: `Token thuộc tài khoản "${probe.name || probe.id}" — cần token Fanpage từ me/accounts, không phải profile cá nhân.`,
    };
  }
  return { pages };
}

export async function saveFacebookConnection(pageId: string, accessToken: string, workspaceId: number) {
  const verified = await verifyFacebookCredentials(pageId, accessToken);
  if (!verified.valid) {
    throw new Error(verified.error || 'Không xác minh được Fanpage');
  }

  const tokenToStore = verified.pageAccessToken?.trim() || accessToken.trim();

  await prisma.socialConnection.upsert({
    where: {
      platform_workspaceId: {
        platform: 'facebook',
        workspaceId
      }
    },
    update: {
      accessToken: tokenToStore,
      pageName: verified.pageName,
      pageId: verified.pageId!,
      status: 'CONNECTED',
    },
    create: {
      platform: 'facebook',
      workspaceId,
      accessToken: tokenToStore,
      pageName: verified.pageName,
      pageId: verified.pageId!,
    },
  });

  return verified;
}

const REQUIRED_POST_SCOPES = ['pages_manage_posts', 'pages_read_engagement'] as const;

/** Kiểm tra scope token qua debug_token (cần META_APP_ID + META_APP_SECRET trong .env) */
export async function getFacebookTokenScopes(accessToken: string): Promise<string[] | null> {
  const appId = process.env.META_APP_ID || process.env.FB_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.FB_APP_SECRET;
  if (!appId || !appSecret) return null;

  const appToken = `${appId}|${appSecret}`;
  const res = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
  );
  const data = (await res.json()) as {
    data?: { scopes?: string[]; is_valid?: boolean };
    error?: { message: string };
  };
  if (data.error || !data.data?.is_valid) return null;
  return data.data.scopes ?? null;
}

export function missingPostScopes(scopes: string[] | null): string[] {
  if (!scopes) return [];
  return REQUIRED_POST_SCOPES.filter((s) => !scopes.includes(s));
}

export type FacebookBotStatus = {
  connected: boolean;
  botReady: boolean;
  pageId: string | null;
  pageName: string | null;
  fanCount?: number;
  issues: string[];
  tokenScopes?: string[];
  lastCheckedAt: string;
};

export async function getFacebookBotStatus(workspaceId: number): Promise<FacebookBotStatus> {
  const issues: string[] = [];
  const fb = await prisma.socialConnection.findFirst({
    where: { platform: 'facebook', workspaceId }
  });

  if (!fb || fb.status !== 'CONNECTED') {
    return {
      connected: false,
      botReady: false,
      pageId: null,
      pageName: null,
      issues: ['Chưa kết nối Fanpage. Hoàn tất 3 bước trong Cài đặt → Facebook.'],
      lastCheckedAt: new Date().toISOString(),
    };
  }

  if (!isValidFacebookPageId(fb.pageId)) {
    issues.push('Page ID thiếu hoặc sai — kết nối lại bằng Page ID từ me/accounts.');
  }
  if (!fb.accessToken) {
    issues.push('Thiếu Page Access Token.');
  }

  let fanCount: number | undefined;
  if (fb.pageId && fb.accessToken && issues.length === 0) {
    const verified = await verifyFacebookCredentials(fb.pageId, fb.accessToken);
    if (!verified.valid) {
      issues.push(
        verified.error?.split('\n')[0] ||
          'Token hết hạn hoặc không hợp lệ — tạo token mới trên Graph API Explorer.'
      );
    } else {
      fanCount = verified.fanCount;
      const scopes = await getFacebookTokenScopes(fb.accessToken);
      const missing = missingPostScopes(scopes);
      if (missing.length > 0) {
        issues.push(
          `Token thiếu quyền: ${missing.join(', ')}. Meta Developers → app BeTraffic → Trường hợp sử dụng → Quản lý Page → bật quyền → Generate token mới trên Graph API Explorer.`
        );
      }
    }
  }

  return {
    connected: true,
    botReady: issues.length === 0,
    pageId: fb.pageId,
    pageName: fb.pageName,
    fanCount,
    issues,
    lastCheckedAt: new Date().toISOString(),
  };
}

/** Bài test không hiển thị công khai (published=false) */
export async function testFacebookBotPost() {
  return publishToFacebookPage({
    message: '🔧 Be Traffic — kiểm tra kết nối Bot (bài test, có thể xóa trên Fanpage).',
    link: null,
    imagePath: null,
    published: false,
  });
}
