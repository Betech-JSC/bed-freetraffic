'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

export default function DashboardPage() {
  const [days, setDays] = useState(7);
  const { t } = useLocale();
  const [data, setData] = useState<{ stats: any; chartData: any[] }>({
    stats: {
      totalTraffic: 0,
      organicSearch: 0,
      activeChannels: 0,
      totalKeywords: 0,
      growth: '0%',
    },
    chartData: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiJson<{ stats: any; chartData: any[] }>(`/dashboard?days=${days}`)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  return (
    <div className="page-container">
      <PageHeader
        title={t('dashboardTitle')}
        description={t('dashboardDesc')}
        actions={
          <>
            <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>{t('sevenDays')}</option>
              <option value={30}>{t('thirtyDays')}</option>
            </select>
            <Link href="/dashboard/sources" className="btn-secondary">
              {t('sources')}
            </Link>
            <Link href="/dashboard/campaigns" className="btn-primary">
              {t('newCampaign')}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label={t('traffic30d')}
          value={loading ? '—' : data.stats.totalTraffic.toLocaleString()}
          trend={data.stats.growth}
          accent="brand"
        />
        <StatCard
          label={t('keywordsTracked')}
          value={loading ? '—' : data.stats.totalKeywords.toLocaleString()}
          accent="slate"
        />
        <StatCard
          label={t('activeChannels')}
          value={loading ? '—' : data.stats.activeChannels}
          accent="brand"
        />
        <StatCard
          label={t('organicClicks')}
          value={loading ? '—' : data.stats.organicSearch.toLocaleString()}
          accent="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 flex flex-col min-h-[420px]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('sevenDaysTrend')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">GA4 active users · GSC clicks</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand" /> {t('totalTraffic')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                {data.stats.gscConnected ? 'GSC Clicks' : 'Keywords'}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full" style={{ height: 300 }}>
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-9 h-9 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.chartData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v >= 1000 ? v / 1000 + 'k' : v}`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e8edf4',
                      boxShadow: 'var(--shadow-card)',
                      fontSize: '13px',
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="traffic" stroke="#e85d26" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Line yAxisId="right" type="monotone" dataKey="keywords" stroke="#94a3b8" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-1">{t('integrations')}</h3>
          <p className="text-xs text-slate-500 mb-6">{t('thirdPartyServices')}</p>
 
          {[
            { label: 'Google Analytics 4', ok: data.stats.ga4Connected },
            { label: 'Google Search Console', ok: data.stats.gscConnected },
            { label: 'Facebook Page', ok: data.stats.facebookConnected },
          ].map((api) => (
            <div key={api.label} className="mb-5 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">{api.label}</span>
                <span className={api.ok ? 'badge-brand' : 'badge-neutral'}>
                  {api.ok ? t('connected') : t('notConnected')}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${api.ok ? 'bg-gradient-to-r from-brand to-orange-500' : 'bg-slate-200 w-1/5'}`}
                  style={{ width: api.ok ? '100%' : '20%' }}
                />
              </div>
            </div>
          ))}

          {!data.stats.gscConnected && (
            <p className="alert-info mt-4 text-xs leading-relaxed">
              {data.stats.ga4Connected ? (
                <span>
                  Đã kết nối tài khoản Google. Để bật dữ liệu Search Console, vui lòng đảm bảo website của bạn đã được xác minh quyền sở hữu trong{' '}
                  <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="underline hover:text-brand font-semibold">
                    Google Search Console
                  </a>.
                </span>
              ) : (
                <span>
                  Kết nối Google OAuth trong phần <strong>Cài đặt</strong> để bắt đầu đồng bộ dữ liệu Search Console và Analytics.
                </span>
              )}
            </p>
          )}

          <Link href="/dashboard/settings" className="btn-secondary w-full mt-6">
            {t('manageConnections')}
          </Link>
        </div>
      </div>
    </div>
  );
}
