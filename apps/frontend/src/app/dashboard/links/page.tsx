'use client';

import React, { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

type ShortLink = {
  id: number;
  code: string;
  originalUrl: string;
  title: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  clickCount: number;
};

type AnalyticsData = {
  link: ShortLink;
  clicksTimeline: { date: string; count: number }[];
  referrerBreakdown: { referrer: string; count: number }[];
  deviceBreakdown: { device: string; count: number }[];
};

const COLORS = ['#f25c22', '#38bdf8', '#34d399', '#a855f7', '#f59e0b', '#64748b'];

export default function ShortLinksPage() {
  const { t } = useLocale();
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal & form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    title: '',
    originalUrl: '',
    code: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
  });

  // Analytics states
  const [activeAnalytics, setActiveAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const data = await apiJson<ShortLink[]>('/shortlinks');
      setLinks(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách liên kết');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.originalUrl) {
      setError('Vui lòng nhập đường dẫn gốc');
      return;
    }
    setCreateLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiJson('/shortlinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: form.originalUrl,
          code: form.code || undefined,
          title: form.title || undefined,
          utmSource: form.utmSource || undefined,
          utmMedium: form.utmMedium || undefined,
          utmCampaign: form.utmCampaign || undefined,
        }),
      });
      setSuccess('Tạo liên kết rút gọn thành công');
      setShowCreateModal(false);
      setForm({
        title: '',
        originalUrl: '',
        code: '',
        utmSource: '',
        utmMedium: '',
        utmCampaign: '',
      });
      loadLinks();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo liên kết');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa liên kết rút gọn này không?')) return;
    try {
      await apiJson(`/shortlinks/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa liên kết rút gọn thành công');
      if (activeAnalytics?.link.id === id) {
        setActiveAnalytics(null);
      }
      loadLinks();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa liên kết');
    }
  };

  const loadAnalytics = async (id: number) => {
    try {
      setAnalyticsLoading(true);
      const data = await apiJson<AnalyticsData>(`/shortlinks/${id}/analytics`);
      setActiveAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải thống kê liên kết');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const getShortUrl = (code: string) => {
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '') 
      : (typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':4000') : 'http://localhost:4000');
    return `${host}/api/public/r/${code}`;
  };

  const handleCopy = (code: string) => {
    const url = getShortUrl(code);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    });
  };

  const getPreviewUrl = () => {
    if (!form.originalUrl) return '';
    let cleanUrl = form.originalUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const params = [];
    if (form.utmSource) params.push(`utm_source=${encodeURIComponent(form.utmSource)}`);
    if (form.utmMedium) params.push(`utm_medium=${encodeURIComponent(form.utmMedium)}`);
    if (form.utmCampaign) params.push(`utm_campaign=${encodeURIComponent(form.utmCampaign)}`);
    
    if (params.length === 0) return cleanUrl;
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return cleanUrl + separator + params.join('&');
  };

  return (
    <div className="space-y-8 page-container">
      <div className="flex justify-between items-center">
        <PageHeader
          title={t('Smart Links & UTM Campaigns')}
          description={t('Rút gọn liên kết doanh nghiệp, tự động xây dựng thẻ UTM chiến dịch marketing và đo lường clicks real-time.')}
        />
        <button
          onClick={() => { setShowCreateModal(true); setError(''); setSuccess(''); }}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('Tạo Smart Link')}
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-slate-800 text-xs font-semibold">Đóng</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-slate-800 text-xs font-semibold">Đóng</button>
        </div>
      )}

      {/* Main Grid: Links Table & Analytics View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Table Panel */}
        <div className="lg:col-span-2 card overflow-hidden shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-extrabold text-slate-850 text-sm">{t('Danh sách liên kết chiến dịch')}</h3>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                Đang tải danh sách liên kết...
              </div>
            ) : links.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm">
                {t('Chưa có liên kết nào được tạo. Hãy nhấn nút phía trên để tạo link đầu tiên!')}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">{t('Tiêu đề / Link gốc')}</th>
                    <th className="p-4">{t('Link rút gọn')}</th>
                    <th className="p-4">{t('Chiến dịch (UTM)')}</th>
                    <th className="p-4 text-center">{t('Clicks')}</th>
                    <th className="p-4 text-right">{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {links.map((link) => (
                    <tr key={link.id} className="hover:bg-slate-50/45 transition-colors">
                      <td className="p-4 max-w-[200px] truncate">
                        <div className="font-bold text-slate-800 text-sm mb-0.5">{link.title || 'Không có tiêu đề'}</div>
                        <div className="text-slate-450 text-[10px] truncate" title={link.originalUrl}>
                          {link.originalUrl}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-brand font-semibold select-all break-all">
                          {getShortUrl(link.code)}
                        </span>
                      </td>
                      <td className="p-4">
                        {link.utmCampaign ? (
                          <div className="flex flex-wrap gap-1">
                            <span className="bg-orange-50 text-brand text-[9px] px-1.5 py-0.5 rounded border border-orange-100/50 font-bold">
                              {link.utmCampaign}
                            </span>
                            {link.utmSource && (
                              <span className="bg-sky-50 text-sky-600 text-[9px] px-1.5 py-0.5 rounded border border-sky-100/50 font-bold">
                                {link.utmSource}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Không có UTM</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-extrabold text-slate-700 text-sm">
                        {link.clickCount}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          <button
                            type="button"
                            onClick={() => handleCopy(link.code)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              copiedCode === link.code
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                            title={t('Sao chép link rút gọn')}
                          >
                            {copiedCode === link.code ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => loadAnalytics(link.id)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              activeAnalytics?.link.id === link.id
                                ? 'bg-brand/10 text-brand border-brand/20'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                            title={t('Xem thống kê chi tiết')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(link.id)}
                            className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title={t('Xóa link')}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Analytics Panel */}
        <div className="card shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-850 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {t('Phân tích chiến dịch')}
            </h3>
          </div>

          {analyticsLoading ? (
            <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <div>Đang tải thống kê liên kết...</div>
            </div>
          ) : !activeAnalytics ? (
            <div className="py-20 text-center text-slate-400 text-xs leading-relaxed font-medium">
              {t('Chọn biểu tượng đồ thị của liên kết bất kỳ bên danh sách để xem biểu đồ clicks, nguồn truy cập (referrers) và thiết bị.')}
            </div>
          ) : (
            <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm truncate">{activeAnalytics.link.title || 'Chi tiết liên kết'}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{getShortUrl(activeAnalytics.link.code)}</p>
              </div>

              {/* Line Chart: Clicks timeline */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('Xu hướng click chuột (7 ngày qua)')}</h5>
                <div className="h-[150px] w-full pt-1 border border-slate-100 rounded-xl bg-slate-50/20 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeAnalytics.clicksTimeline} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" tickLine={false} style={{ fontSize: 9, fill: '#94A3B8' }} />
                      <YAxis allowDecimals={false} tickLine={false} style={{ fontSize: 9, fill: '#94A3B8' }} />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="count" name={t('Clicks')} stroke="#f25c22" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart: Devices */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('Cơ cấu thiết bị (Devices)')}</h5>
                <div className="h-[140px] w-full flex items-center justify-between border border-slate-100 rounded-xl bg-slate-50/20 p-2">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeAnalytics.deviceBreakdown}
                        dataKey="count"
                        nameKey="device"
                        cx="50%"
                        cy="50%"
                        outerRadius={45}
                        fill="#8884d8"
                      >
                        {activeAnalytics.deviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-[45%] text-[10px] space-y-1.5 overflow-y-auto max-h-[120px] pr-1">
                    {activeAnalytics.deviceBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="capitalize truncate text-slate-600 font-semibold">{item.device}</span>
                        </span>
                        <span className="font-extrabold text-slate-800 shrink-0">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pie Chart: Referrers */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('Nguồn truy cập (Referrers)')}</h5>
                <div className="h-[140px] w-full flex items-center justify-between border border-slate-100 rounded-xl bg-slate-50/20 p-2">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeAnalytics.referrerBreakdown}
                        dataKey="count"
                        nameKey="referrer"
                        cx="50%"
                        cy="50%"
                        outerRadius={45}
                        fill="#8884d8"
                      >
                        {activeAnalytics.referrerBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-[45%] text-[10px] space-y-1.5 overflow-y-auto max-h-[120px] pr-1">
                    {activeAnalytics.referrerBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5 truncate" title={item.referrer}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="truncate text-slate-600 font-semibold">{item.referrer}</span>
                        </span>
                        <span className="font-extrabold text-slate-800 shrink-0">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Short Link Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-orange-50/50 to-amber-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-brand shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{t('Tạo Smart Link mới')}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('Rút gọn liên kết và tích hợp các thông số thẻ chiến dịch.')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('Tiêu đề gợi nhớ')}</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Ví dụ: Chiến dịch Summer Sale 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  disabled={createLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('Đường dẫn gốc (Original URL)')} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="https://website-cua-ban.com/landing-page"
                  value={form.originalUrl}
                  onChange={(e) => setForm({ ...form, originalUrl: e.target.value })}
                  required
                  disabled={createLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-slate-500">{t('Mã rút gọn tùy chỉnh')}</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Ví dụ: summer26 (tùy chọn)"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-slate-500">{t('Chiến dịch (Campaign Name)')}</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="utm_campaign (Ví dụ: summer_sale)"
                    value={form.utmCampaign}
                    onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-slate-500">{t('Nguồn chiến dịch (Source)')}</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="utm_source (Ví dụ: facebook)"
                    value={form.utmSource}
                    onChange={(e) => setForm({ ...form, utmSource: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-slate-500">{t('Phương thức (Medium)')}</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="utm_medium (Ví dụ: cpc)"
                    value={form.utmMedium}
                    onChange={(e) => setForm({ ...form, utmMedium: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
              </div>

              {/* URL Preview */}
              {form.originalUrl && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">{t('Liên kết chiến dịch hoàn chỉnh (Preview)')}</span>
                  <div className="text-[11px] font-mono text-slate-600 break-all select-all font-medium">
                    {getPreviewUrl()}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                  disabled={createLoading}
                >
                  {t('Hủy bỏ')}
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-5 py-2 cursor-pointer"
                  disabled={createLoading}
                >
                  {createLoading ? t('Đang tạo...') : t('Tạo Link')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
