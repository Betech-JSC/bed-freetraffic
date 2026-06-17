'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/context/LocaleContext';
import { apiUrl, apiFetch } from '@/lib/api';

interface NotificationItem {
  id: string;
  type: 'alert' | 'chat' | 'submission';
  title: string;
  message: string;
  createdAt: string;
  severity?: string;
  link: string;
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 0) return 'Vừa xong';
    
    const intervals = [
      { label: 'năm', seconds: 31536000 },
      { label: 'tháng', seconds: 2592000 },
      { label: 'ngày', seconds: 86400 },
      { label: 'giờ', seconds: 3600 },
      { label: 'phút', seconds: 60 },
    ];
    
    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count >= 1) {
        return `${count} ${interval.label} trước`;
      }
    }
    
    return 'Vừa xong';
  } catch {
    return '';
  }
}

type StoredUser = {
  name?: string;
  email?: string;
  role?: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  EDITOR: 'Biên tập viên',
  VIEWER: 'Chỉ xem',
};

function roleLabel(role?: string) {
  if (!role) return 'Thành viên';
  return ROLE_LABELS[role] ?? role;
}

export function Topbar() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<StoredUser>({ name: 'Admin' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw) as StoredUser;
        setTimeout(() => {
          setUser(parsed);
        }, 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/dashboard/notifications');
      if (res.ok) {
        const data = (await res.json()) as NotificationItem[];
        setNotifications(data);

        // Tính toán số lượng chưa đọc dựa trên lastReadNotifications trong localStorage
        const lastRead = localStorage.getItem('lastReadNotifications') || '';
        if (lastRead) {
          const count = data.filter((n) => new Date(n.createdAt) > new Date(lastRead)).length;
          setUnreadCount(count);
        } else {
          setUnreadCount(data.length);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải thông báo:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleToggleBell = () => {
    setBellOpen((o) => {
      const next = !o;
      if (next) {
        const now = new Date().toISOString();
        localStorage.setItem('lastReadNotifications', now);
        setUnreadCount(0);
      }
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem('lastReadNotifications', now);
    setUnreadCount(0);
  };

  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => setApiOnline(h?.status === 'ok'))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const displayName = user.name || user.email?.split('@')[0] || 'Admin';
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const logout = useCallback(() => {
    document.cookie = 'token=; path=/; max-age=0';
    localStorage.removeItem('user');
    setMenuOpen(false);
    router.push('/logout');
  }, [router]);

  return (
    <header className="h-16 shrink-0 sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="h-full flex items-center justify-between gap-6 px-6 lg:px-8">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative w-full max-w-md hidden sm:block">
            <input
              type="search"
              placeholder={t("Tìm chiến dịch, từ khóa...")}
              className="w-full h-10 pl-4 pr-3 text-sm text-slate-800 bg-slate-100/80 border border-transparent rounded-xl outline-none transition-all placeholder:text-slate-400 hover:bg-slate-100 focus:bg-white focus:border-brand/25 focus:ring-2 focus:ring-brand/10"
            />
          </div>

          {apiOnline === true && (
            <span className="hidden lg:inline-flex items-center gap-2 h-10 px-3.5 shrink-0 rounded-xl bg-orange-50/60 text-brand text-xs font-semibold ring-1 ring-brand/15">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand/60 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
              </span>
              {t("Hệ thống hoạt động")}
            </span>
          )}
          {apiOnline === false && (
            <span className="hidden lg:inline-flex items-center gap-2 h-10 px-3.5 shrink-0 rounded-xl bg-slate-50 text-slate-500 text-xs font-semibold ring-1 ring-slate-200/50 border border-slate-200/80">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              {t("API offline")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Language Selector */}
          <div className="flex items-center border border-slate-200/80 rounded-xl overflow-hidden h-10 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setLocale('vi')}
              className={`px-2.5 h-full rounded-lg text-xs font-bold transition-all cursor-pointer ${
                locale === 'vi' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              VN
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2.5 h-full rounded-lg text-xs font-bold transition-all cursor-pointer ${
                locale === 'en' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              EN
            </button>
          </div>

          {/* Styles for Bell ring animation */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes bellRing {
              0%, 100% { transform: rotate(0deg); }
              5% { transform: rotate(12deg); }
              10% { transform: rotate(-12deg); }
              15% { transform: rotate(10deg); }
              20% { transform: rotate(-10deg); }
              25% { transform: rotate(6deg); }
              30% { transform: rotate(-6deg); }
              35% { transform: rotate(3deg); }
              40% { transform: rotate(-3deg); }
              45% { transform: rotate(0deg); }
            }
          ` }} />

          {/* Notification Bell */}
          <div className="relative shrink-0" ref={bellRef}>
            <button
              type="button"
              onClick={handleToggleBell}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer ${
                bellOpen
                  ? 'bg-slate-50 border-slate-200 shadow-sm ring-2 ring-brand/10'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-200'
              }`}
              title="Thông báo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                style={{
                  animation: unreadCount > 0 ? 'bellRing 2.2s infinite ease-in-out' : 'none',
                  transformOrigin: 'top center'
                }}
                className="w-5 h-5 text-slate-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none border border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 py-0 animate-[modalIn_0.15s_ease-out] z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                  >
                    Đánh dấu đã đọc
                  </button>
                </div>

                {/* List */}
                <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                  {notifications.length > 0 ? (
                    notifications.map((item) => (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={() => setBellOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Type Icon Badge */}
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          item.type === 'alert'
                            ? 'bg-red-50 text-red-600'
                            : item.type === 'chat'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {item.type === 'alert' && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                          {item.type === 'chat' && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          )}
                          {item.type === 'submission' && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>

                        {/* Title & Message */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate leading-snug">{item.title}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed break-words">{item.message}</p>
                          <p className="text-[9px] text-slate-400 font-medium mt-1 font-mono">{formatTimeAgo(item.createdAt)}</p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <svg className="w-10 h-10 text-slate-350" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.961 8.961 0 012.3-5.541m3.155 6.851a24.252 24.252 0 003.844.148m-3.844 0a23.856 23.856 0 005.455-1.31 8.961 8.961 0 00-2.3-5.541m3.155 6.85a24.2 24.2 0 003.844-.149m-3.844.149a23.856 23.856 0 015.455-1.31 8.961 8.961 0 00-2.3-5.541m-3.155 6.85a24.2 24.2 0 003.844-.149m0 0a23.856 23.856 0 005.455-1.31 8.961 8.961 0 00-2.3-5.541M9.143 9.75a3 3 0 116 0M9.143 9.75a6 6 0 0112 0v1.5a1.875 1.875 0 001.875 1.875h.75" />
                      </svg>
                      <p className="text-xs text-slate-400 mt-2 font-medium">Không có thông báo nào</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className={`flex items-center gap-3 h-10 pl-2 pr-3 rounded-xl border transition-all ${
                  menuOpen
                    ? 'bg-slate-50 border-slate-200 shadow-sm ring-2 ring-brand/10'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-200'
                }`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-orange-600 text-white text-xs font-bold">
                  {initials}
                </span>
                <span className="hidden md:block text-left min-w-0 max-w-[148px] pr-0.5">
                  <span className="block text-sm font-semibold text-slate-900 truncate leading-tight">{displayName}</span>
                  <span className="block text-[11px] text-slate-500 truncate leading-snug">{roleLabel(user.role)}</span>
                </span>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 py-2 animate-[modalIn_0.15s_ease-out] z-50"
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user.email ?? '—'}</p>
                    <span className="inline-flex mt-2 badge-brand text-[10px]">{roleLabel(user.role)}</span>
                  </div>

                  <div className="py-1.5 px-1.5">
                    <Link
                      href="/dashboard/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {t("Cài đặt tài khoản")}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={logout}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      {t("Đăng xuất")}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </header>
  );
}
