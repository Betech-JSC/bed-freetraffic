'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode: totpCode || undefined }),
      });
      const data = await res.json();
      if (res.status === 403 && data.requiresTotp) {
        setNeedsTotp(true);
        setError('Nhập mã 6 số từ ứng dụng Authenticator');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

      document.cookie = `token=${data.token}; path=/; max-age=604800`;
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[48%] bg-[var(--color-sidebar)] relative overflow-hidden p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-transparent to-blue-600/10" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand/30 rounded-full blur-3xl" />
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand/40">
            Be
          </div>
        </div>
        <div className="relative space-y-6 max-w-md">
          <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Kéo traffic tự động, đo lường rõ ràng.
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Quản lý SEO, Bot đăng bài đa kênh và phân tích hiệu suất — tất cả trong một nền tảng.
          </p>
          <ul className="space-y-3 text-sm text-slate-400">
            {['Facebook · Email · Zalo OA', 'Google Analytics & Search Console', 'Automation Bot thông minh'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-600">© Be Traffic Optimization System</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-app-mesh">
        <div className="card w-full max-w-md p-8 md:p-10 shadow-2xl">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-orange-600 text-white font-bold flex items-center justify-center">
              Be
            </div>
            <span className="font-bold text-slate-900 text-lg">Be Traffic</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng nhập</h1>
          <p className="text-slate-500 text-sm mt-1 mb-8">Truy cập bảng điều khiển của bạn</p>

          {error && <div className="alert-error mb-6">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@freetraffic.com"
                required
              />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            {needsTotp && (
              <div>
                <label className="label">Mã 2FA (6 số)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="input"
                  placeholder="000000"
                  required
                />
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
