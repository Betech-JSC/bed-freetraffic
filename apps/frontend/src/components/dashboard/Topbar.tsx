'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/context/LocaleContext';

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
  const [user, setUser] = useState<StoredUser>({ name: 'Admin' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as StoredUser);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => setApiOnline(h?.status === 'ok'))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
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
            <span className="hidden lg:inline-flex items-center gap-2 h-10 px-3.5 shrink-0 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold ring-1 ring-emerald-600/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {t("Hệ thống hoạt động")}
            </span>
          )}
          {apiOnline === false && (
            <span className="hidden lg:inline-flex items-center gap-2 h-10 px-3.5 shrink-0 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold ring-1 ring-amber-600/15">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
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
