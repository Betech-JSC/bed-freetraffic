'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';


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

  const handleSocialLogin = async (platform: string) => {
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/auth/social/${platform}/url?action=login`));
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Không tạo được đường dẫn đăng nhập mạng xã hội.');
      }
    } catch {
      setError('Lỗi kết nối máy chủ.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
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

            <div className="bg-white border border-[#fce8de] rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
              {error && (
                <div className="alert-error mb-5 text-xs sm:text-sm py-2.5 flex items-start gap-2.5">
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
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="px-4 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
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
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-4 pr-11 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-slate-650 cursor-pointer text-xs font-bold"
                    >
                      {showPassword ? 'Ẩn' : 'Hiện'}
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
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        className="px-4 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
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

              {/* Social OAuth Buttons */}
              <div className="grid grid-cols-3 gap-2.5">
                <button 
                  type="button" 
                  className="flex items-center justify-center flex-col gap-1 py-2.5 rounded-xl bg-[#ea4335]/5 hover:bg-[#ea4335]/10 border border-[#ea4335]/15 text-[#ea4335] text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => handleSocialLogin('google')}
                >
                  <span className="text-base">🔴</span>
                  <span>Google</span>
                </button>
                <button 
                  type="button" 
                  className="flex items-center justify-center flex-col gap-1 py-2.5 rounded-xl bg-[#1877f2]/5 hover:bg-[#1877f2]/10 border border-[#1877f2]/15 text-[#1877f2] text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => handleSocialLogin('facebook')}
                >
                  <span className="text-base">📘</span>
                  <span>Facebook</span>
                </button>
                <button 
                  type="button" 
                  className="flex items-center justify-center flex-col gap-1 py-2.5 rounded-xl bg-[#0068ff]/5 hover:bg-[#0068ff]/10 border border-[#0068ff]/15 text-[#0068ff] text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => handleSocialLogin('zalo')}
                >
                  <span className="text-base">💬</span>
                  <span>Zalo</span>
                </button>
              </div>
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
