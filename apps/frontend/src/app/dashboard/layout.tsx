'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { SupportWidget } from '@/components/dashboard/SupportWidget';
import { apiJson } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kiểm tra trạng thái Onboarding của tài khoản
    apiJson<any>('/workspaces/onboard-status')
      .then((ws) => {
        if (ws && ws.onboardingCompleted === false) {
          router.push('/onboarding');
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        // Lỗi xác thực hoặc API offline, cho phép đi qua để xử lý ở trang login/middleware khác
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase animate-pulse">ĐANG KHỞI ĐỘNG HỆ THỐNG...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[260px] min-h-screen">
        <Topbar />
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-app-mesh p-6 lg:p-8">
          {children}
        </main>
      </div>
      <SupportWidget />
    </div>
  );
}
