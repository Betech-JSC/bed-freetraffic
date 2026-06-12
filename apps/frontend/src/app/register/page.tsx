'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';


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

  const handleSocialLogin = async (platform: string) => {
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/auth/social/${platform}/url?action=login`));
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Không tạo được đường dẫn đăng ký mạng xã hội.');
      }
    } catch {
      setError('Lỗi kết nối máy chủ.');
    }
  };

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
      const res = await fetch(apiUrl('/api/auth/register'), {
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
      <div className="hidden lg:flex lg:w-[48%] bg-gradient-to-br from-brand to-orange-600 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Soft Radial Gradients */}
        <div className="absolute top-0 right-0 -mt-24 -mr-24 w-96 h-96 bg-white/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-96 h-96 bg-white/10 rounded-full blur-[120px] pointer-events-none" />
        
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
          <div className="relative rounded-2xl border border-white/20 bg-white/10 p-1.5 shadow-2xl backdrop-blur-sm group overflow-hidden max-w-xl">
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
          <div className="grid grid-cols-2 gap-2.5">
            <button 
              type="button" 
              className="flex items-center justify-center flex-col gap-1 py-2 rounded-xl bg-[#ea4335]/5 hover:bg-[#ea4335]/10 border border-[#ea4335]/15 text-[#ea4335] text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleSocialLogin('google')}
            >
              <span className="text-sm">🔴</span>
              <span>Google</span>
            </button>
            <button 
              type="button" 
              className="flex items-center justify-center flex-col gap-1 py-2 rounded-xl bg-[#0068ff]/5 hover:bg-[#0068ff]/10 border border-[#0068ff]/15 text-[#0068ff] text-[10px] font-extrabold tracking-wider uppercase transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleSocialLogin('zalo')}
            >
              <span className="text-sm">💬</span>
              <span>Zalo</span>
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
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-4 py-2.5 w-full rounded-xl border border-slate-200 focus:border-brand/40 focus:ring-1 focus:ring-brand/40 outline-none text-slate-800 text-sm shadow-sm placeholder-slate-350"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">Email công việc</label>
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
              <label className="text-xs font-bold text-slate-600 block">Mật khẩu</label>
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
                  className="absolute right-3.5 text-slate-450 hover:text-slate-600 cursor-pointer text-xs font-bold"
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
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
                <a href="#" className="text-brand font-bold hover:underline">Điều khoản dịch vụ</a>
                {' '}và{' '}
                <a href="#" className="text-brand font-bold hover:underline">Chính sách bảo mật</a>
                {' '}của Be Traffic.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-4 cursor-pointer"
            >
              {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
            </button>
          </form>

          {/* Footer Link */}
          <p className="text-xs text-slate-500 text-center pt-2">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-brand font-extrabold hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
