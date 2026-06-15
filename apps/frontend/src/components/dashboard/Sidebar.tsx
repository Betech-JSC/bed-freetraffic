'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/context/LocaleContext';
import WorkspaceSwitcher from './WorkspaceSwitcher';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  const navGroups = [
    {
      title: t('Tổng quan & Báo cáo'),
      items: [
        { href: '/dashboard', label: t('dashboard'), exact: true },
        { href: '/dashboard/reports', label: t('Báo cáo') },
        { href: '/dashboard/sources', label: t('sources') },
        { href: '/dashboard/abtests', label: t('abtests') },
      ]
    },
    {
      title: t('SEO & Tiếp thị Nội dung'),
      items: [
        { href: '/dashboard/seo', label: t('seoAudit') },
        { href: '/dashboard/links', label: 'Smart Links' },
        { href: '/dashboard/backlinks', label: t('backlinks') },
        { href: '/dashboard/blog', label: 'Blog CMS' },
        { href: '/dashboard/landing', label: 'Landing Pages' },
        { href: '/dashboard/automation', label: t('automation') + ' Bot', exact: true },
        { href: '/dashboard/schedule', label: t('Lịch trình đăng bài') },
      ]
    },
    {
      title: t('CRM, Bán hàng & Chăm sóc'),
      items: [
        { href: '/dashboard/customers', label: t('customers') },
        { href: '/dashboard/forms', label: 'Custom Forms' },
        { href: '/dashboard/popups', label: 'Lead Popups' },
        { href: '/dashboard/email', label: t('emailCampaigns') },
        { href: '/dashboard/automation/workflows', label: 'Email Automation' },
        { href: '/dashboard/cskh/settings', label: 'CSKH & Chatbot AI' },
        { href: '/dashboard/store/products', label: 'Sản phẩm số' },
        { href: '/dashboard/store/orders', label: 'Đơn hàng & Doanh thu' },
      ]
    },
    {
      title: t('Trí tuệ Nhân tạo & Cài đặt'),
      items: [
        { href: '/dashboard/copilot', label: t('copilot') },
        { href: '/dashboard/cskh/knowledge', label: 'Tri thức RAG (AI)' },
        { href: '/dashboard/content', label: t('Soạn thảo nội dung') },
        { href: '/dashboard/analytics', label: t('Phân tích Bot') },
        { href: '/dashboard/settings', label: t('settings') },
        { href: '/dashboard/users', label: t('Người dùng') },
        { href: '/dashboard/guide', label: 'Hướng dẫn sử dụng' },
      ]
    }
  ];

  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  // When mounting, load user preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded_groups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTimeout(() => {
          setExpandedGroups(parsed);
        }, 0);
      } catch (e) {
        console.error('Failed to parse sidebar_expanded_groups', e);
      }
    }
  }, []);

  const isDefaultExpanded = (index: number) => {
    const group = navGroups[index];
    const hasActive = group.items.some(item => isActive(pathname, item.href, item.exact));
    if (hasActive) return true;
    
    // Default the first group to expanded if nothing else is active
    if (index === 0) {
      const anyActive = navGroups.some(g => g.items.some(item => isActive(pathname, item.href, item.exact)));
      if (!anyActive) return true;
    }
    return false;
  };

  const isGroupExpanded = (index: number) => {
    return expandedGroups[index] !== undefined ? expandedGroups[index] : isDefaultExpanded(index);
  };

  const toggleGroup = (index: number) => {
    const currentVal = isGroupExpanded(index);
    const next = { ...expandedGroups, [index]: !currentVal };
    setExpandedGroups(next);
    localStorage.setItem('sidebar_expanded_groups', JSON.stringify(next));
  };

  return (
    <aside className="w-[260px] bg-white border-r border-orange-100/60 text-slate-700 flex flex-col fixed h-full z-30 shadow-lg shadow-orange-950/5">
      <div className="h-[72px] flex items-center px-5 border-b border-orange-100/60 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand/30 group-hover:scale-105 transition-transform">
            Be
          </div>
          <div>
            <p className="text-slate-800 font-bold text-base leading-tight">Be Traffic</p>
            <p className="text-[10px] text-orange-600 uppercase tracking-[0.2em] font-semibold">Growth OS</p>
          </div>
        </Link>
      </div>

      <div className="px-4 py-3 border-b border-orange-100/60 shrink-0">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-4">
        {navGroups.map((group, gIdx) => {
          const isExpanded = isGroupExpanded(gIdx);
          return (
            <div key={gIdx} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(gIdx)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-brand uppercase tracking-widest transition-colors duration-200 group/title text-left cursor-pointer animate-none"
              >
                <span>{group.title}</span>
              </button>

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          active
                            ? 'bg-brand text-white shadow-md shadow-brand/10 font-semibold'
                            : 'text-slate-600 hover:text-brand hover:bg-brand-light'
                        }`}
                      >
                        {item.label}
                        {active && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-orange-100/60 space-y-3 shrink-0">
        <Link
          href="/dashboard/campaigns"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-brand to-orange-600 text-white text-sm font-bold shadow-lg shadow-brand/15 hover:shadow-brand/35 hover:brightness-110 transition-all"
        >
          {t('Tạo chiến dịch')}
        </Link>
        <Link
          href="/logout"
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          {t('logout')}
        </Link>
      </div>
    </aside>
  );
}
