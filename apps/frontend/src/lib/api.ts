/** Gọi API qua Next.js rewrite → backend */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p.startsWith('/api') ? p : `/api${p}`;
}

export function getAuthToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  const token = getAuthToken();
  const headers = new Headers(init?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (typeof window !== 'undefined') {
    const wsId = localStorage.getItem('workspaceId');
    if (wsId && !headers.has('x-workspace-id')) {
      headers.set('x-workspace-id', wsId);
    }
  }

  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(url, { ...init, headers });
  } catch {
    throw new Error(
      'Không kết nối được API. Hãy chạy backend: npm run dev -w apps/backend (cổng 4000).'
    );
  }
}

export async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error;
    if (res.status === 404) {
      throw new Error(
        msg ||
          `API không tìm thấy (404) tại ${apiUrl(path)}. Dừng mọi terminal backend cũ, rồi chạy: npm run dev -w apps/backend`
      );
    }
    if (res.status === 500 && !msg) {
      throw new Error(
        'Không kết nối được Backend API (500). Hãy đảm bảo Backend đang chạy cổng 4000 ổn định (chạy: npm run dev hoặc kiểm tra xem Backend có bị crash/dừng đột ngột không).'
      );
    }
    throw new Error(msg || `API lỗi (${res.status})`);
  }
  return data as T;
}
