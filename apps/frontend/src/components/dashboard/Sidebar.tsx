'use client';

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

  const nav = [
    { href: '/dashboard', label: t('dashboard'), exact: true },
    { href: '/dashboard/campaigns', label: t('Chiến dịch') },
    { href: '/dashboard/sources', label: t('sources') },
    { href: '/dashboard/reports', label: t('Báo cáo') },
    { href: '/dashboard/schedule', label: t('schedule') },
    
    // SEO & Content CMS
    { href: '/dashboard/seo', label: t('seoAudit') },
    { href: '/dashboard/backlinks', label: t('backlinks') },
    { href: '/dashboard/blog', label: 'Blog CMS' },
    { href: '/dashboard/landing', label: 'Landing Pages' },
    
    // Leads & CRM
    { href: '/dashboard/forms', label: 'Custom Forms' },
    { href: '/dashboard/customers', label: t('customers') },
    
    // Email & Automation Campaigns
    { href: '/dashboard/email', label: t('emailCampaigns') },
    { href: '/dashboard/automation', label: t('automation') + ' Bot', exact: true },
    { href: '/dashboard/automation/workflows', label: 'Email Automation' },
    
    // Store & Sales
    { href: '/dashboard/store/products', label: 'Sản phẩm số' },
    { href: '/dashboard/store/orders', label: 'Đơn hàng & Doanh thu' },
    
    // AI Copilot & Bot
    { href: '/dashboard/copilot', label: t('copilot') },
    { href: '/dashboard/content', label: t('Soạn thảo nội dung') },
    { href: '/dashboard/analytics', label: t('Phân tích Bot') },
    
    // Insights & CSKH Settings
    { href: '/dashboard/insights', label: t('insights') },
    { href: '/dashboard/alerts', label: t('alerts') },
    { href: '/dashboard/abtests', label: t('abtests') },
    { href: '/dashboard/cskh/settings', label: 'CSKH & Chatbot AI' },
    { href: '/dashboard/users', label: t('Người dùng') },
    { href: '/dashboard/settings', label: t('settings') },
  ];

  return (
    <aside className="w-[260px] bg-[var(--color-sidebar)] text-slate-300 flex flex-col fixed h-full z-30 shadow-xl shadow-slate-900/20">
      <div className="h-[72px] flex items-center px-5 border-b border-white/5 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand/30 group-hover:scale-105 transition-transform">
            Be
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Be Traffic</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Growth OS</p>
          </div>
        </Link>
      </div>

      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar py-5 px-3 space-y-0.5">
        {nav.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
        <Link
          href="/dashboard/campaigns"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-brand to-orange-600 text-white text-sm font-bold shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:brightness-110 transition-all"
        >
          {t('Tạo chiến dịch')}
        </Link>
        <Link
          href="/logout"
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          {t('logout')}
        </Link>
      </div>
    </aside>
  );
}
