'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');

      setSuccess('Đăng ký tài khoản thành công! Đang chuyển hướng sang trang đăng nhập...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại');
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
            Khởi tạo tài khoản, trải nghiệm ngay.
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Tham gia cùng hàng ngàn doanh nghiệp sử dụng Be Traffic để tối ưu hóa tăng trưởng tự động.
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

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng ký</h1>
          <p className="text-slate-500 text-sm mt-1 mb-8">Bắt đầu hành trình tăng trưởng của bạn</p>

          {error && <div className="alert-error mb-6">{error}</div>}
          {success && <div className="alert-info mb-6">{success}</div>}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="label">Họ và tên</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Nguyễn Văn A"
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="partner@freetraffic.com"
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
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-6">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-brand font-bold hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
