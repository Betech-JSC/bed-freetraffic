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
  Legend,
  PieChart,
  Pie,
  Cell
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

type TrafficSourceRow = {
  source: string;
  sessions: number;
  users: number;
  pageviews: number;
};

type LandingPageRow = {
  path: string;
  sessions: number;
  users: number;
  pageviews: number;
};

type ContentRoiRow = {
  id: number;
  title: string;
  platforms: string;
  publishedAt: string;
  clicks: number;
  leads: number;
  orders: number;
  revenue: number;
  conversionRate: number;
};

export default function ReportsPage() {
  const { t } = useLocale();
  const [traffic, setTraffic] = useState<{ rows: TrafficRow[] } | null>(null);
  const [keywords, setKeywords] = useState<{ rows: KeywordRow[] } | null>(null);
  const [trafficSources, setTrafficSources] = useState<{ sources: TrafficSourceRow[]; landingPages: LandingPageRow[] } | null>(null);
  const [contentRoi, setContentRoi] = useState<{ rows: ContentRoiRow[] } | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'roi'>('overview');

  // AI report state variables
  const [aiReport, setAiReport] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState('');
  const [aiTab, setAiTab] = useState<'summary' | 'markdown'>('summary');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [tData, kData, sData, rData] = await Promise.all([
          apiJson<{ rows: TrafficRow[] }>(`/reports/traffic?days=${days}`),
          apiJson<{ rows: KeywordRow[] }>('/reports/keywords'),
          apiJson<{ sources: TrafficSourceRow[]; landingPages: LandingPageRow[] }>(`/reports/traffic-sources?days=${days}`),
          apiJson<{ rows: ContentRoiRow[] }>('/reports/content-roi'),
        ]);
        setTraffic(tData);
        setKeywords(kData);
        setTrafficSources(sData);
        setContentRoi(rData);
        setError('');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t('Lỗi tải báo cáo'));
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  const handleAiAnalyze = async (refresh = false) => {
    setAiLoading(true);
    setAiError('');
    setAiReport(null);
    setShowAiModal(true);

    const messages = [
      t('AI đang kết nối cơ sở dữ liệu tiếp thị...'),
      t('AI đang tổng hợp xu hướng lượng truy cập (Traffic)...'),
      t('AI đang kiểm tra biến động thứ hạng từ khóa...'),
      t('AI đang thống kê các chiến dịch email marketing...'),
      t('AI đang phân tích danh sách đơn hàng & doanh thu CRM...'),
      t('AI đang quét nhật ký hoạt động hệ thống...'),
      t('AI đang biên soạn các đề xuất tăng trưởng tối ưu...'),
      t('AI đang hoàn thiện bản báo cáo chiến lược dạng Markdown...')
    ];

    let messageIndex = 0;
    setAiLoadingMessage(messages[0]);
    
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setAiLoadingMessage(messages[messageIndex]);
    }, 2000);

    try {
      const response = await apiFetch('/reports/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, refresh })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || t('Lỗi kết nối dịch vụ AI'));
      }

      const data = await response.json() as AiAnalysisResult;
      setAiReport(data);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : t('Lỗi phân tích báo cáo AI'));
    } finally {
      clearInterval(interval);
      setAiLoading(false);
    }
  };

  const handleCopy = () => {
    if (!aiReport) return;
    const textToCopy = `BÁO CÁO PHÂN TÍCH TIẾP THỊ BẰNG AI (${days} ngày qua)
==================================================
TÓM TẮT TỔNG QUAN:
${aiReport.summary}

ĐIỂM SÁNG NỔI BẬT:
${aiReport.highlights.map(h => `- ${h}`).join('\n')}

VẤN ĐỀ CẦN LƯU Ý:
${aiReport.issues.map(i => `- ${i}`).join('\n')}

KHUYẾN NGHỊ ĐỀ XUẤT:
${aiReport.recommendations.map(r => `- ${r}`).join('\n')}

BÁO CÁO CHI TIẾT:
${aiReport.markdown}`;

    navigator.clipboard.writeText(textToCopy);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

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

  // Calculate dynamic growth rate
  const currentPeriodRows = traffic?.rows || [];
  const midPoint = Math.floor(currentPeriodRows.length / 2);
  const prevPeriodSessions = currentPeriodRows.slice(0, midPoint).reduce((sum, r) => sum + r.sessions, 0);
  const currPeriodSessions = currentPeriodRows.slice(midPoint).reduce((sum, r) => sum + r.sessions, 0);
  let growthPercent = '+0.0%';
  if (prevPeriodSessions > 0) {
    const diff = ((currPeriodSessions - prevPeriodSessions) / prevPeriodSessions) * 100;
    growthPercent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  } else if (currPeriodSessions > 0) {
    growthPercent = '+100.0%';
  }

  const PIE_COLORS = ['#e85d26', '#10b981', '#6366f1', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={t('Báo cáo tiếp thị')}
        description={t('Phân tích lượng truy cập (Traffic), Từ khóa SEO và ROI nội dung. Hỗ trợ xem trực quan và xuất file.')}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold uppercase">{t('Khoảng thời gian:')}</span>
            <select className="input w-auto font-medium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>{t('1 ngày qua')}</option>
              <option value={7}>{t('7 ngày qua')}</option>
              <option value={30}>{t('30 ngày qua')}</option>
              <option value={90}>{t('90 ngày qua')}</option>
            </select>
            <button
              type="button"
              onClick={() => handleAiAnalyze(false)}
              className="text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ml-1"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)'
              }}
            >
              <SparklesIcon />
              {t('Phân tích bằng AI')}
            </button>
          </div>
        }
      />

      {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">{error}</div>}

      {/* Tab Selector */}
      <div className="flex border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-extrabold px-6 transition-all border-b-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          {t('Lưu lượng & SEO')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roi')}
          className={`pb-3 text-sm font-extrabold px-6 transition-all border-b-2 cursor-pointer ${
            activeTab === 'roi'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          {t('Hiệu quả nội dung (Content ROI)')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500 font-medium">{t('Đang tải dữ liệu báo cáo...')}</div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">REP</div>
              <div className="flex-1">
                <div className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                  <span>{t('Tổng Sessions')}</span>
                  <span className={`badge text-[9px] font-bold ${growthPercent.startsWith('+') ? 'badge-success' : 'badge-warning'}`}>
                    {growthPercent}
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1">{totalSessions.toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold uppercase">PVS</div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">{t('Lượt xem trang (Pageviews)')}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1">{totalPageviews.toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold uppercase">SEO</div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">{t('Vị trí Từ khóa trung bình')}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1">{avgRank}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Card 1: Traffic Report */}
            <div className="card p-6 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{t('Báo cáo lượng truy cập (Traffic)')}</h3>
                    <p className="text-xs text-slate-500 mt-1">{t('Xu hướng lượt truy cập & lượt xem trang đồng bộ từ GA4.')}</p>
                  </div>
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

            {/* Card 2: Traffic Sources Distribution */}
            <div className="card p-6 flex flex-col justify-between space-y-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{t('Phân bố nguồn lưu lượng (Traffic Sources)')}</h3>
                <p className="text-xs text-slate-500 mb-6">{t('Kênh thu hút khách hàng dựa trên sessions của GA4.')}</p>
                
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="w-full md:w-1/2 flex justify-center">
                    {trafficSources?.sources && trafficSources.sources.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={trafficSources.sources}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="sessions"
                            nameKey="source"
                          >
                            {trafficSources.sources.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip formatter={(value: any) => [`${Number(value || 0).toLocaleString()} sessions`, t('Nguồn')]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 font-medium">{t('Chưa có dữ liệu nguồn truy cập')}</div>
                    )}
                  </div>
                  
                  <div className="w-full md:w-1/2 space-y-2">
                    {trafficSources?.sources?.slice(0, 5).map((src, index) => {
                      const totalSess = trafficSources.sources.reduce((sum, s) => sum + s.sessions, 0) || 1;
                      const percent = Math.round((src.sessions / totalSess) * 100);
                      return (
                        <div key={src.source} className="flex justify-between items-center text-xs font-semibold p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="text-slate-700 capitalize truncate max-w-[120px]">{src.source}</span>
                          </div>
                          <div className="text-slate-500 font-bold whitespace-nowrap">
                            {src.sessions.toLocaleString()} <span className="text-[10px] text-slate-450 font-normal">({percent}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {t('Biểu đồ phân bổ nguồn lưu lượng phản ánh kênh kéo khách trực tiếp từ Internet, giúp bạn nhận diện bài viết social hay SEO từ khóa mang lại hiệu suất tiếp cận thực tế cao nhất.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Card 3: Top Landing Pages */}
            <div className="card p-6 flex flex-col justify-between space-y-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{t('Trang đích phổ biến nhất (Landing Pages)')}</h3>
                <p className="text-xs text-slate-500 mb-4">{t('Các trang nội dung thu hút được nhiều lượt truy cập trực tiếp nhất.')}</p>
                
                <div className="overflow-x-auto border border-slate-100 rounded-lg mt-3">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b font-semibold text-slate-600">
                        <th className="p-3">{t('Đường dẫn')}</th>
                        <th className="p-3 text-right">Sessions</th>
                        <th className="p-3 text-right">Pageviews</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-500">
                      {trafficSources?.landingPages && trafficSources.landingPages.length > 0 ? (
                        trafficSources.landingPages.slice(0, 5).map((page, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-brand hover:underline cursor-pointer truncate max-w-[200px]">{page.path}</td>
                            <td className="p-3 text-right">{page.sessions.toLocaleString()}</td>
                            <td className="p-3 text-right">{page.pageviews.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-6 text-center">{t('Chưa có dữ liệu trang đích')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {t('Việc theo dõi Landing Pages giúp tối ưu hóa luồng trải nghiệm khách hàng (UX/UI) và nâng cấp nội dung cho các trang có tỷ lệ bounce rate thấp nhằm tăng tỷ lệ chuyển đổi.')}
              </p>
            </div>

            {/* Card 4: Keywords Report */}
            <div className="card p-6 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{t('Báo cáo từ khóa SEO (Keywords)')}</h3>
                    <p className="text-xs text-slate-500 mt-1">{t('Quản lý thứ hạng từ khóa trên Google Search Console.')}</p>
                  </div>
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
        </div>
      ) : (
        <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
          {/* Content ROI Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold uppercase">LDS</div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">{t('Leads từ Content')}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1">
                  {contentRoi?.rows?.reduce((sum, r) => sum + r.leads, 0).toLocaleString() ?? 0} {t('khách hàng')}
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">REV</div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">{t('Doanh thu ghi nhận')}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1">
                  {(contentRoi?.rows?.reduce((sum, r) => sum + r.revenue, 0) ?? 0).toLocaleString()} ₫
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-xs font-bold uppercase">VAL</div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase">{t('Giá trị truyền thông (CPC)')}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1">
                  {((contentRoi?.rows?.reduce((sum, r) => sum + r.clicks, 0) ?? 0) * 15000).toLocaleString()} ₫
                </div>
              </div>
            </div>
          </div>

          {/* Content ROI Table */}
          <div className="card p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{t('Hiệu quả chuyển đổi Nội dung (Content ROI)')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('Phân tích số khách hàng (Leads) và đơn hàng phát sinh từ từng bài đăng qua thẻ UTM.')}</p>
              </div>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b font-bold text-slate-600 uppercase text-[10px]">
                    <th className="p-4">{t('Nội dung / Tiêu đề')}</th>
                    <th className="p-4">{t('Kênh đăng')}</th>
                    <th className="p-4 text-center">{t('Clicks (GA4)')}</th>
                    <th className="p-4 text-center">{t('Leads (CRM)')}</th>
                    <th className="p-4 text-center">{t('Đơn hàng')}</th>
                    <th className="p-4 text-right">{t('Doanh thu')}</th>
                    <th className="p-4 text-center">{t('Tỷ lệ chuyển đổi')}</th>
                    <th className="p-4">{t('Đánh giá')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-500">
                  {contentRoi?.rows && contentRoi.rows.length > 0 ? (
                    contentRoi.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-sm line-clamp-1 max-w-[280px]">{row.title}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Campaign ID: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">post-{row.id}</code></div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {row.platforms.split(',').map((p) => {
                              const platform = p.trim().toLowerCase();
                              return (
                                <span key={platform} className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                                  platform === 'wordpress' ? 'bg-blue-100 text-blue-800' :
                                  platform === 'facebook' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {platform}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-700">{row.clicks.toLocaleString()}</td>
                        <td className="p-4 text-center font-bold text-emerald-600">{row.leads.toLocaleString()}</td>
                        <td className="p-4 text-center font-semibold text-slate-600">{row.orders.toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-slate-800">{row.revenue > 0 ? `${row.revenue.toLocaleString()} ₫` : '—'}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold text-slate-700">{row.conversionRate}%</span>
                            {row.conversionRate > 0 && (
                              <div className="w-10 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(row.conversionRate * 4, 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {row.revenue > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-800 uppercase ring-1 ring-green-600/10">High converting</span>
                          ) : row.leads > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 uppercase ring-1 ring-blue-600/10">Active leads</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-650 uppercase">Traffic only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">{t('Chưa có dữ liệu bài viết đã xuất bản')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md animate-fade-in"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                  }}
                >
                  <SparklesIcon />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    {t('AI Phân tích Tiếp thị')}
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                      {days === 1 ? t('24 giờ qua') : `${days} ${t('ngày qua')}`}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t('Được phân tích tự động bởi mô hình AI dựa trên số liệu thực tế.')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {aiLoading ? (
                <div className="h-[40vh] flex flex-col items-center justify-center space-y-5">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-violet-100 animate-pulse"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-violet-600 animate-spin"></div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-800 animate-pulse">{aiLoadingMessage}</p>
                    <p className="text-xs text-slate-400 mt-1.5">{t('Quá trình này có thể mất từ 5 đến 15 giây...')}</p>
                  </div>
                </div>
              ) : aiError ? (
                <div className="h-[40vh] flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-lg font-bold mb-4">✕</div>
                  <h4 className="font-bold text-slate-800 text-base">{t('Không thể hoàn thành phân tích AI')}</h4>
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl max-w-md mt-2 mb-4 leading-normal">{aiError}</p>
                  <button
                    type="button"
                    onClick={() => handleAiAnalyze(true)}
                    className="btn-primary text-xs"
                  >
                    {t('Thử lại')}
                  </button>
                </div>
              ) : aiReport ? (
                <div className="space-y-6">
                  {/* Tab Selector */}
                  <div className="flex border-b border-slate-100 pb-px">
                    <button
                      type="button"
                      onClick={() => setAiTab('summary')}
                      className={`pb-3 text-sm font-bold px-4 transition-all border-b-2 cursor-pointer ${
                        aiTab === 'summary'
                          ? 'border-violet-600 text-violet-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {t('Tóm tắt chiến lược')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiTab('markdown')}
                      className={`pb-3 text-sm font-bold px-4 transition-all border-b-2 cursor-pointer ${
                        aiTab === 'markdown'
                          ? 'border-violet-600 text-violet-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {t('Báo cáo đầy đủ (Markdown)')}
                    </button>
                  </div>

                  {/* Tab Contents */}
                  {aiTab === 'summary' ? (
                    <div className="space-y-6 animate-fade-in">
                      {/* Summary Section */}
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                        <h4 className="font-black text-slate-800 text-sm mb-2 uppercase tracking-wider">{t('Tổng quan nhận xét')}</h4>
                        <p className="text-sm text-slate-650 leading-relaxed font-medium">{aiReport.summary}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Highlights card */}
                        <div className="bg-emerald-50/40 border border-emerald-100/60 rounded-2xl p-5">
                          <h4 className="font-extrabold text-emerald-800 text-sm mb-3.5 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">✓</span>
                            {t('Điểm sáng nổi bật')}
                          </h4>
                          <ul className="space-y-2.5">
                            {aiReport.highlights.map((h, i) => (
                              <li key={i} className="text-xs text-slate-650 leading-relaxed flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Issues card */}
                        <div className="bg-amber-50/40 border border-amber-100/60 rounded-2xl p-5">
                          <h4 className="font-extrabold text-amber-800 text-sm mb-3.5 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs">⚠️</span>
                            {t('Cần lưu ý')}
                          </h4>
                          <ul className="space-y-2.5">
                            {aiReport.issues.map((issue, i) => (
                              <li key={i} className="text-xs text-slate-650 leading-relaxed flex items-start gap-1.5">
                                <span className="text-amber-500 font-bold mt-0.5">•</span>
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Recommendations card */}
                        <div className="bg-violet-50/40 border border-violet-100/60 rounded-2xl p-5">
                          <h4 className="font-extrabold text-violet-800 text-sm mb-3.5 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs">💡</span>
                            {t('Khuyến nghị tăng trưởng')}
                          </h4>
                          <ul className="space-y-2.5">
                            {aiReport.recommendations.map((rec, i) => (
                              <li key={i} className="text-xs text-slate-650 leading-relaxed flex items-start gap-1.5">
                                <span className="text-violet-500 font-bold mt-0.5">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/50 max-h-[50vh] overflow-y-auto animate-fade-in">
                      <SimpleMarkdown content={aiReport.markdown} />
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            {!aiLoading && aiReport && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleAiAnalyze(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  🔄 {t('Phân tích lại (Bỏ cache)')}
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      boxShadow: '0 2px 6px rgba(139, 92, 246, 0.2)'
                    }}
                  >
                    {copying ? '✓ ' + t('Đã sao chép') : '📋 ' + t('Sao chép báo cáo')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type AiAnalysisResult = {
  summary: string;
  highlights: string[];
  issues: string[];
  recommendations: string[];
  markdown: string;
};

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.838 3.036a3.75 3.75 0 0 0 2.576 2.576l3.036.838a.75.75 0 0 1 0 1.442l-3.036.838a3.75 3.75 0 0 0-2.576 2.576l-.838 3.036a.75.75 0 0 1-1.442 0l-.838-3.036a3.75 3.75 0 0 0-2.576-2.576l-3.036-.838a.75.75 0 0 1 0-1.442l3.036-.838a3.75 3.75 0 0 0 2.576-2.576l.838-3.036A.75.75 0 0 1 9 4.5ZM18.75 10.5a.75.75 0 0 1 .721.544l.432 1.564a1.875 1.875 0 0 0 1.288 1.288l1.564.432a.75.75 0 0 1 0 1.442l-1.564.432a1.875 1.875 0 0 0-1.288 1.288l-.432 1.564a.75.75 0 0 1-1.442 0l-.432-1.564a1.875 1.875 0 0 0-1.288-1.288l-1.564-.432a.75.75 0 0 1 0-1.442l1.564-.432a1.875 1.875 0 0 0 1.288-1.288l.432-1.564A.75.75 0 0 1 18.75 10.5Z" clipRule="evenodd" />
  </svg>
);

const SimpleMarkdown = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-3 font-sans text-sm text-slate-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} className="font-extrabold text-slate-800 text-sm mt-5 mb-2">{trimmed.replace('### ', '')}</h4>;
        }
        if (trimmed.startsWith('#### ')) {
          return <h5 key={idx} className="font-bold text-slate-800 text-xs mt-4 mb-1 uppercase tracking-wider">{trimmed.replace('#### ', '')}</h5>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={idx} className="font-extrabold text-slate-800 text-base mt-6 mb-3 border-b pb-1">{trimmed.replace('## ', '')}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={idx} className="font-black text-slate-900 text-lg mt-7 mb-4 border-b-2 pb-2">{trimmed.replace('# ', '')}</h2>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const rawText = trimmed.slice(2);
          if (rawText.startsWith('**') && rawText.includes('**:')) {
            const parts = rawText.split('**:');
            const boldPart = parts[0].replace('**', '');
            const normalPart = parts.slice(1).join('**:');
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1">
                <li><strong>{boldPart}</strong>: {normalPart}</li>
              </ul>
            );
          }
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              <li>{rawText}</li>
            </ul>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-2" />;
        }
        return <p key={idx} className="leading-relaxed">{line}</p>;
      })}
    </div>
  );
};
