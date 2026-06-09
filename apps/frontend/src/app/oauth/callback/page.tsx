'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function UnifiedOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [msg, setMsg] = useState('Đang xử lý xác thực...');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setStatus('error');
      setMsg(decodeURIComponent(error));
      return;
    }

    const token = searchParams.get('token');
    const user = searchParams.get('user');
    const connect = searchParams.get('connect');
    const platform = searchParams.get('platform');

    // Luồng 1: Đăng nhập xã hội (Social Login)
    if (token && user) {
      try {
        setStatus('success');
        setMsg('Đăng nhập thành công! Đang chuyển hướng...');
        
        // Lưu cookie & localStorage
        document.cookie = `token=${token}; path=/; max-age=604800`;
        localStorage.setItem('user', decodeURIComponent(user));
        
        // Chuyển hướng về trang chủ dashboard
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 1200);
      } catch (err: any) {
        setStatus('error');
        setMsg(err.message || 'Lỗi lưu thông tin phiên đăng nhập');
      }
      return;
    }

    // Luồng 2: Kết nối tài khoản / Kênh (Social Connection)
    if (connect === 'success' && platform) {
      setStatus('success');
      setMsg(`Đã kết nối tài khoản ${platform.toUpperCase()} thành công!`);

      // Gửi message thông báo cho trang Cài đặt (nếu mở dạng Popup)
      if (typeof window !== 'undefined' && window.opener) {
        try {
          window.opener.postMessage({ type: 'social_connected', platform }, '*');
        } catch (err) {
          console.error('Không thể truyền tin sang cửa sổ chính:', err);
        }
      }

      // Đóng popup tự động sau 1.5s
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.close();
        }
      }, 1500);
      return;
    }

    // Lỗi không xác định
    setStatus('error');
    setMsg('Yêu cầu OAuth không hợp lệ hoặc thiếu tham số chuyển tiếp.');
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 p-8 max-w-sm w-full text-center space-y-4">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-extrabold text-slate-500 uppercase tracking-widest animate-pulse">XÁC THỰC...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto">
              ✓
            </div>
            <h2 className="text-lg font-black text-slate-800">Thành Công</h2>
            <p className="text-xs text-slate-550 leading-relaxed font-medium">{msg}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto">
              !
            </div>
            <h2 className="text-lg font-black text-slate-800">Lỗi Xác Thực</h2>
            <p className="text-xs text-red-600 leading-relaxed font-medium">{msg}</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.opener) {
                    window.close();
                  } else {
                    router.push('/login');
                  }
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
