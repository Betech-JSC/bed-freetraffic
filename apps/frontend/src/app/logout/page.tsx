'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    document.cookie = 'token=; path=/; max-age=0';
    localStorage.removeItem('user');
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <p className="text-gray-500 text-sm">Đang đăng xuất...</p>
    </div>
  );
}
