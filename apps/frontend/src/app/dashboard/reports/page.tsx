'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend
} from 'recharts';

type TrafficRow = {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  clicks: number;
  impressions: number;
};

type KeywordRow = {
  keyword: string;
  url: string | null;
  position: number | null;
  searchVolume: number | null;
  channel?: string;
  lastClicks?: number;
  lastImpressions?: number;
};

export default function ReportsPage() {
  const { t } = useLocale();
  const [traffic, setTraffic] = useState<{ rows: TrafficRow[] } | null>(null);
  const [keywords, setKeywords] = useState<{ rows: KeywordRow[] } | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [tData, kData] = await Promise.all([
          apiJson<{ rows: TrafficRow[] }>(`/reports/traffic?days=${days}`),
          apiJson<{ rows: KeywordRow[] }>('/reports/keywords'),
        ]);
        setTraffic(tData);
        setKeywords(kData);
        setError('');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t('Lỗi tải báo cáo'));
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  const download = async (type: string, format: 'csv' | 'pdf' | 'xlsx') => {
    setError('');
    try {
      const res = await apiFetch(`/reports/export/${format}?type=${type}&days=${days}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `${t('Không xuất được')} ${format.toUpperCase()}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xls' : 'csv';
      a.download = type === 'keywords' ? `keywords-report.${ext}` : `traffic-report.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `${t('Lỗi xuất')} ${format.toUpperCase()}`);
    }
  };

  // Compute Metrics
  const totalSessions = traffic?.rows?.reduce((sum, r) => sum + r.sessions, 0) ?? 0;
  const totalPageviews = traffic?.rows?.reduce((sum, r) => sum + r.pageviews, 0) ?? 0;
  
  const keywordsWithRank = keywords?.rows?.filter(k => k.position !== null && k.position > 0) ?? [];
  const avgRank = keywordsWithRank.length > 0 
    ? (keywordsWithRank.reduce((sum, k) => sum + (k.position || 0), 0) / keywordsWithRank.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={t('Báo cáo tiếp thị')}
        description={t('FR-06 — Phân tích lượng truy cập (Traffic) và Từ khóa SEO. Hỗ trợ xem trực quan và xuất file.')}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-bold uppercase">{t('Khoảng thời gian:')}</span>
            <select className="input w-auto font-medium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>{t('7 ngày qua')}</option>
              <option value={30}>{t('30 ngày qua')}</option>
              <option value={90}>{t('90 ngày qua')}</option>
            </select>
          </div>
        }
      />

      {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">{error}</div>}

      {/* Quick Help Onboarding Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{t('Hướng dẫn đọc Báo cáo')}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t('Dữ liệu')} <strong>Traffic</strong> {t('được đồng bộ tự động từ Google Analytics (GA4), phản ánh số người dùng và lượt xem trang thật.')}{' '}
            {t('Dữ liệu')} <strong>{t('Từ khóa (Keywords)')}</strong> {t('thống kê vị trí trung bình trên Google.')}{' '}
            {t('Bạn có thể xem trước 5 dòng dữ liệu mới nhất bên dưới và sử dụng các nút xuất báo cáo chuyên dụng để tải về tài liệu (CSV, Excel hoặc PDF) trình bày cho khách hàng / đối tác.')}
          </p>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">REP</div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('Tổng Sessions (Lượt truy cập)')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{totalSessions.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold uppercase">PVS</div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('Lượt xem trang (Pageviews)')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{totalPageviews.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold uppercase">SEO</div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('Vị trí Từ khóa trung bình')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{avgRank}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500 font-medium">{t('Đang tải dữ liệu báo cáo...')}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Traffic Report */}
          <div className="card p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{t('Báo cáo lượng truy cập (Traffic)')}</h3>
                  <p className="text-xs text-slate-500 mt-1">{t('Xu hướng lượt truy cập & lượt xem trang đồng bộ từ GA4.')}</p>
                </div>
                {/* Export Dropdown buttons grouped */}
                <div className="flex items-center gap-1.5 bg-gray-50 p-1 border rounded-lg">
                  <button type="button" onClick={() => download('traffic', 'csv')} className="text-xs font-bold px-2.5 py-1 text-slate-600 hover:bg-white rounded transition-all">CSV</button>
                  <button type="button" onClick={() => download('traffic', 'xlsx')} className="text-xs font-bold px-2.5 py-1 text-slate-600 hover:bg-white rounded transition-all">Excel</button>
                  <button type="button" onClick={() => download('traffic', 'pdf')} className="text-xs font-bold px-2.5 py-1 bg-brand text-white rounded shadow-sm transition-all">PDF</button>
                </div>
              </div>

              {/* Traffic Chart */}
              <div className="h-[220px] w-full pt-2">
                {traffic?.rows && traffic.rows.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={traffic.rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FB6F1D" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#FB6F1D" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" tickLine={false} tickFormatter={(str) => String(str).slice(5)} style={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tickLine={false} style={{ fontSize: 10, fill: '#64748B' }} />
                      <ChartTooltip />
                      <Legend style={{ fontSize: 10 }} />
                      <Area type="monotone" name="Sessions" dataKey="sessions" stroke="#FB6F1D" strokeWidth={2} fillOpacity={1} fill="url(#colorSessions)" />
                      <Area type="monotone" name="Pageviews" dataKey="pageviews" stroke="#10B981" strokeWidth={2} fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">{t('Chưa có dữ liệu xu hướng truy cập')}</div>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">{t('Xem trước dữ liệu mới nhất')}</h4>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b font-semibold text-slate-600">
                      <th className="p-2.5">{t('Ngày')}</th>
                      <th className="p-2.5">Sessions</th>
                      <th className="p-2.5">Users</th>
                      <th className="p-2.5">Pageviews</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-500">
                    {traffic?.rows && traffic.rows.length > 0 ? (
                      traffic.rows.slice(-5).reverse().map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-700">{r.date}</td>
                          <td className="p-2.5">{r.sessions.toLocaleString()}</td>
                          <td className="p-2.5">{r.users.toLocaleString()}</td>
                          <td className="p-2.5">{r.pageviews.toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center">{t('Chưa có dữ liệu lịch sử')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card 2: Keywords Report */}
          <div className="card p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{t('Báo cáo từ khóa SEO (Keywords)')}</h3>
                  <p className="text-xs text-slate-500 mt-1">{t('Quản lý thứ hạng từ khóa trên Google Search Console.')}</p>
                </div>
                {/* Export Dropdown buttons grouped */}
                <div className="flex items-center gap-1.5 bg-gray-50 p-1 border rounded-lg">
                  <button type="button" onClick={() => download('keywords', 'csv')} className="text-xs font-bold px-2.5 py-1 text-slate-600 hover:bg-white rounded transition-all">CSV</button>
                  <button type="button" onClick={() => download('keywords', 'xlsx')} className="text-xs font-bold px-2.5 py-1 text-slate-600 hover:bg-white rounded transition-all">Excel</button>
                  <button type="button" onClick={() => download('keywords', 'pdf')} className="text-xs font-bold px-2.5 py-1 bg-brand text-white rounded shadow-sm transition-all">PDF</button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">{t('Tổng từ khóa theo dõi')}</span>
                  <div className="text-2xl font-black text-slate-800 mt-1">{keywords?.rows?.length ?? 0} {t('từ khóa')}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase">{t('Độ bao phủ trung bình')}</span>
                  <div className="text-sm font-semibold text-emerald-600 mt-1">{t('Đã đồng bộ thành công')}</div>
                </div>
              </div>
              
              <p className="text-xs text-slate-400 leading-relaxed mt-4">
                {t('Báo cáo từ khóa hiển thị thứ hạng hiện tại của trang web trên công cụ tìm kiếm của Google, giúp bạn dễ dàng theo dõi hiệu suất tối ưu hóa nội dung (SEO) và độ tăng trưởng thứ hạng.')}
              </p>
            </div>

            {/* Preview Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">{t('Danh sách xem trước từ khóa')}</h4>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b font-semibold text-slate-600">
                      <th className="p-2.5">{t('Từ khóa')}</th>
                      <th className="p-2.5">{t('Vị trí Rank')}</th>
                      <th className="p-2.5">{t('Volume tìm kiếm')}</th>
                      <th className="p-2.5">{t('Kênh nguồn')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-500">
                    {keywords?.rows && keywords.rows.length > 0 ? (
                      keywords.rows.slice(0, 5).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-700">{r.keyword}</td>
                          <td className="p-2.5">
                            {r.position !== null ? (
                              <span className={`px-1.5 py-0.5 rounded font-bold ${
                                r.position <= 3 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                #{r.position}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-2.5">{r.searchVolume?.toLocaleString() ?? '—'}</td>
                          <td className="p-2.5 capitalize">{r.channel || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center">{t('Chưa có dữ liệu từ khóa nào')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
