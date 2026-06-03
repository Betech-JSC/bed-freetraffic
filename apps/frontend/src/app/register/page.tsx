'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError('Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách bảo mật');
      return;
    }
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

      setSuccess('Tạo tài khoản thành công! Đang chuyển hướng...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* LEFT PANEL: Brand Info & Testimonial Mockup (Screenshot 1) */}
      <div className="hidden lg:flex lg:w-[48%] bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Soft Radial Gradients */}
        <div className="absolute top-0 right-0 -mt-24 -mr-24 w-96 h-96 bg-brand/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Top Header Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand to-orange-600 flex items-center justify-center text-[11px] font-black text-white shadow-md">Be</span>
            <span className="text-xl font-bold tracking-tight text-white">Be Traffic</span>
          </Link>
        </div>

        {/* Middle Area: Headline, Mockup Image & Testimonial Overlays */}
        <div className="relative z-10 space-y-8 my-auto">
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight max-w-lg">
            Thúc đẩy tăng trưởng bằng dữ liệu thực.
          </h2>

          {/* Premium mockup display */}
          <div className="relative rounded-2xl border border-white/10 bg-slate-950/40 p-1.5 shadow-2xl backdrop-blur-sm group overflow-hidden max-w-xl">
            <img 
              src="/dashboard_preview.png" 
              alt="Be Traffic Analytics Dashboard" 
              className="w-full h-auto rounded-xl object-cover border border-white/5 opacity-90 transition-all duration-500 group-hover:scale-[1.01]" 
            />
            {/* Absolute Testimonial Overlay exactly as in screenshot */}
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 border border-white/10 backdrop-blur-md rounded-2xl p-5 shadow-lg max-w-md animate-in slide-in-from-bottom-2 duration-300">
              <p className="text-xs text-slate-800 font-medium leading-relaxed italic">
                &ldquo;Hệ thống đã giúp chúng tôi tăng 150% lượng truy cập tự nhiên chỉ trong quý đầu tiên.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                  AT
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Anh Tuấn</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Marketing Director</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metrics row */}
        <div className="relative z-10 flex gap-12 border-t border-white/10 pt-6 text-xs text-slate-400 font-bold uppercase tracking-wider">
          <div>
            <p className="opacity-50">Sẵn sàng</p>
            <p className="text-white text-lg font-black mt-1">99.9%</p>
          </div>
          <div>
            <p className="opacity-50">Người dùng</p>
            <p className="text-white text-lg font-black mt-1">10k+</p>
          </div>
          <div>
            <p className="opacity-50">Quốc gia</p>
            <p className="text-white text-lg font-black mt-1">24</p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Registration Form (Screenshot 1) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 md:p-16 bg-white overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Bắt đầu hành trình
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              Tạo tài khoản miễn phí và trải nghiệm sức mạnh của dữ liệu thực.
            </p>
          </div>

          {error && <p className="alert-error text-xs sm:text-sm py-2.5">{error}</p>}
          {success && <p className="alert-info text-xs sm:text-sm py-2.5">{success}</p>}

          {/* Social signup OAuth */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-sm"
              onClick={() => alert('Đăng ký qua Google chưa được cấu hình Client ID.')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button 
              type="button" 
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-sm"
              onClick={() => alert('Đăng ký qua GitHub chưa được cấu hình Client ID.')}
            >
              <svg className="w-4 h-4 fill-current text-slate-800" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Hoặc đăng ký bằng email
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">Họ và tên</label>
              <div className="relative flex items-center">
                <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-11 pr-4 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">Email công việc</label>
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
              <label className="text-xs font-bold text-slate-600 block">Mật khẩu</label>
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
                  className="absolute right-3.5 text-slate-450 hover:text-slate-600 cursor-pointer"
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
              <p className="text-[10px] text-slate-400 mt-1">Mật khẩu phải chứa ít nhất 8 ký tự.</p>
            </div>

            {/* Agree Terms Checkbox */}
            <label className="flex items-start gap-2.5 pt-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="w-4.5 h-4.5 text-brand focus:ring-brand border-slate-250 rounded mt-0.5"
              />
              <span className="text-[11px] leading-relaxed text-slate-650 font-medium">
                Tôi đồng ý với{' '}
                <a href="#" className="text-orange-850 font-bold hover:underline">Điều khoản dịch vụ</a>
                {' '}và{' '}
                <a href="#" className="text-orange-850 font-bold hover:underline">Chính sách bảo mật</a>
                {' '}của Be Traffic.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-orange-850 hover:bg-orange-800 text-white font-extrabold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-4 cursor-pointer"
            >
              {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
            </button>
          </form>

          {/* Footer Link */}
          <p className="text-xs text-slate-500 text-center pt-2">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-orange-850 font-extrabold hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
