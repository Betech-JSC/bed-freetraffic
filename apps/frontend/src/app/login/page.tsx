'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 font-sans">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* LEFT PANEL: Form centered */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 md:p-16 bg-app-mesh">
          <div className="w-full max-w-md space-y-6">
            
            {/* Brand Logo & Tagline */}
            <div className="text-center space-y-2">
              <Link href="/" className="inline-block hover:opacity-90 transition-opacity cursor-pointer">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-1">
                  <span className="text-brand">Be</span>
                  <span className="text-[#c44a18]">Traffic</span>
                </h1>
              </Link>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">
                Chào mừng bạn quay trở lại
              </p>
            </div>

            {/* Login Card */}
            <div className="bg-white border border-[#fce8de] rounded-2xl p-8 md:p-10 shadow-sm">
              {error && (
                <div className="alert-error mb-5 text-xs sm:text-sm py-2.5 flex items-start gap-2.5">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 tracking-widest uppercase block">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative flex items-center">
                    <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 pr-4 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 tracking-widest uppercase block">
                    PASSWORD
                  </label>
                  <div className="relative flex items-center">
                    <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-11 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-slate-650 cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* TOTP Code Input if needed */}
                {needsTotp && (
                  <div className="space-y-1 animate-in fade-in duration-300">
                    <label className="text-[10px] font-extrabold text-slate-500 tracking-widest uppercase block">
                      Mã xác thực 2FA
                    </label>
                    <div className="relative flex items-center">
                      <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        className="pl-11 pr-4 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
                        placeholder="000000"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Nhập mã 6 số từ ứng dụng Authenticator.</p>
                  </div>
                )}

                {/* Sub-options row: Ghi nhớ mật khẩu & Quên mật khẩu? */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 select-none cursor-pointer text-slate-650 font-medium">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4.5 h-4.5 text-brand focus:ring-brand border-slate-250 rounded cursor-pointer"
                    />
                    <span>Ghi nhớ mật khẩu</span>
                  </label>
                  <a href="#" className="text-brand font-bold hover:underline" onClick={(e) => { e.preventDefault(); alert('Vui lòng liên hệ quản trị viên để khôi phục mật khẩu.'); }}>
                    Quên mật khẩu?
                  </a>
                </div>

                {/* Submit button with arrow */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-4 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? 'Đang xác thực...' : 'Đăng nhập'}
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-slate-150"></div>
                <span className="flex-shrink mx-4 text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">
                  HOẶC TIẾP TỤC VỚI
                </span>
                <div className="flex-grow border-t border-slate-150"></div>
              </div>

              {/* Google OAuth Button */}
              <button 
                type="button" 
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#f0f4f9] hover:bg-[#e2e8f0] text-xs font-bold text-slate-700 transition-colors shadow-sm w-full border border-slate-200/50 cursor-pointer"
                onClick={() => alert('Đăng nhập qua Google chưa được cấu hình Client ID.')}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Tiếp tục với Google
              </button>
            </div>

            {/* Footer Registration text */}
            <p className="text-xs text-slate-500 text-center font-medium">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="text-brand font-bold hover:underline">
                Đăng ký ngay
              </Link>
            </p>

          </div>
        </div>

        {/* RIGHT PANEL: Traffic Lights Blur Banner */}
        <div 
          className="hidden lg:block lg:w-[42%] relative overflow-hidden bg-cover bg-center border-l border-slate-200/50" 
          style={{ backgroundImage: 'url(/traffic_lights_blur.png)' }}
        >
          {/* Journey Optimization Card */}
          <div className="absolute bottom-16 right-8 left-8 bg-white border border-[#fce8de] rounded-2xl p-6 shadow-xl max-w-sm ml-auto animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Tối ưu hóa hành trình
            </h3>
            <p className="text-xs text-slate-550 leading-relaxed font-medium mt-2">
              Be Traffic cung cấp các giải pháp phân tích lưu lượng thời gian thực, giúp bạn đưa ra quyết định chính xác và nhanh chóng hơn.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200/50 py-4.5 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 font-mono tracking-wider">
        <div>© 2024 Be Traffic. All rights reserved.</div>
        <div className="flex gap-6">
          <Link href="#" className="hover:text-slate-800 transition-colors">Privacy Policy</Link>
          <Link href="#" className="hover:text-slate-800 transition-colors">Terms of Service</Link>
          <Link href="#" className="hover:text-slate-800 transition-colors">Contact Support</Link>
        </div>
      </footer>
    </div>
  );
}
