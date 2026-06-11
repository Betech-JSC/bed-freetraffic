import React from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[260px] min-h-screen">
        <Topbar />
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-app-mesh p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
