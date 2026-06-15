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
  Tooltip as ChartTooltip
} from 'recharts';

type Audit = {
  id: number;
  url: string;
  score: number;
  technicalScore: number;
  contentScore: number;
  uxScore: number;
  auditedAt: string;
  issues: { severity: string; message: string; suggestion?: string }[];
};

export default function SeoPage() {
  const { t, locale } = useLocale();
  const [activeTab, setActiveTab] = useState<'onpage' | 'keyword-planner'>('onpage');
  const [audits, setAudits] = useState<Audit[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [url, setUrl] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [usePageSpeed, setUsePageSpeed] = useState(false);
  const [error, setError] = useState('');

  // AI Keyword planner states
  const [seedKeyword, setSeedKeyword] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResults, setResearchResults] = useState<{
    keyword: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    volume: number;
    intent: 'Informational' | 'Transactional' | 'Navigational';
    suggestedTitle: string;
    brief: string[];
  }[]>([]);
  const [trackedKeywords, setTrackedKeywords] = useState<Record<string, boolean>>({});
  const [expandedBriefIdx, setExpandedBriefIdx] = useState<number | null>(null);

  const load = () => apiJson<Audit[]>('/seo/audits').then(setAudits).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const loadHistory = async (auditUrl: string) => {
    try {
      const rows = await apiJson<Audit[]>(`/seo/history?url=${encodeURIComponent(auditUrl)}`);
      setHistory(rows);
    } catch {
      setHistory([]);
    }
  };

  const handleKeywordResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedKeyword.trim()) return;
    setResearchLoading(true);
    setError('');
    try {
      const data = await apiJson<any>('/seo/keyword-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedKeyword: seedKeyword.trim() }),
      });
      setResearchResults(data);
      setExpandedBriefIdx(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi nghiên cứu từ khóa');
    } finally {
      setResearchLoading(false);
    }
  };

  const handleTrackKeyword = async (keywordName: string, volume: number) => {
    try {
      await apiJson('/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keywordName,
          searchVolume: volume,
        }),
      });
      setTrackedKeywords(prev => ({ ...prev, [keywordName]: true }));
    } catch (err: any) {
      alert(err.message || 'Lỗi theo dõi từ khóa');
    }
  };

  const runAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const target = url.trim();
      const endpoint = usePageSpeed ? '/seo/pagespeed' : '/seo/audit';
      await apiJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, targetKeyword: targetKeyword.trim() || undefined }),
      });
      setUrl('');
      setTargetKeyword('');
      load();
      loadHistory(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi audit'));
    } finally {
      setLoading(false);
    }
  };

  const deleteAudit = async (id: number) => {
    if (!confirm(t('Bạn có chắc chắn muốn xóa kết quả audit này không?'))) return;
    try {
      await apiJson(`/seo/audits/${id}`, { method: 'DELETE' });
      load();
      setHistory([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi khi xóa kết quả audit'));
    }
  };

  const deleteAllAudits = async () => {
    if (!confirm(t('Bạn có chắc chắn muốn xóa TẤT CẢ kết quả audit không? Hành động này không thể hoàn tác.'))) return;
    try {
      await apiJson('/seo/audits', { method: 'DELETE' });
      load();
      setHistory([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi khi xóa tất cả kết quả audit'));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 border-emerald-200 bg-emerald-50';
    if (score >= 50) return 'text-amber-600 border-amber-200 bg-amber-50';
    return 'text-red-600 border-red-200 bg-red-50';
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  // Process history data for chart
  const chartData = React.useMemo(() => {
    return history.slice().reverse().map(h => ({
      date: new Date(h.auditedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: '2-digit', day: '2-digit' }),
      score: h.score
    }));
  }, [history, locale]);

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={activeTab === 'onpage' ? t('SEO Audit (On-Page)') : t('AI SEO Keyword Research & Content Planner')}
        description={
          activeTab === 'onpage'
            ? t('Quét tối ưu cấu trúc HTML, heading, meta description, alt hình ảnh và trải nghiệm di động của trang đích.')
            : t('Nhập từ khóa chính để AI đề xuất các từ khóa ngách, lượng tìm kiếm mô phỏng, độ khó, ý định tìm kiếm, tiêu đề bài viết gợi ý và dàn ý chi tiết.')
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('onpage')}
          className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 cursor-pointer ${
            activeTab === 'onpage'
              ? 'border-brand text-brand font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {t('On-page SEO Audit')}
        </button>
        <button
          onClick={() => setActiveTab('keyword-planner')}
          className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 cursor-pointer ${
            activeTab === 'keyword-planner'
              ? 'border-brand text-brand font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 113.536 0V21h-2v-3.3a5 5 0 01-1.536-1.7z" />
          </svg>
          {t('Nghiên cứu từ khóa AI')}
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">{error}</div>}

      {activeTab === 'onpage' ? (
        <>
          {/* Quick Help Onboarding Banner */}
          <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">{t('Cách thức SEO Audit hoạt động')}</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('Nhập đường dẫn URL đích của bạn vào khung bên dưới để hệ thống thực hiện quét thời gian thực.')}{' '}
                {t('Bot sẽ phân tích các thẻ')} <strong>Title, Meta Description, Heading (H1-H2), {t('tốc độ phản hồi và')} Mobile Viewport</strong>.{' '}
                {t('Sau khi có điểm, bạn hãy kéo xuống danh sách lỗi để xem chi tiết cách khắc phục từng mục giúp website thân thiện hơn với Google!')}
              </p>
            </div>
          </div>

          <form onSubmit={runAudit} className="card p-6 flex flex-col gap-4 shadow-sm">
            <div className="flex gap-3 flex-wrap w-full">
              <input
                className="input flex-[2] min-w-[240px]"
                type="url"
                placeholder={t('Ví dụ: https://website-cua-ban.com/landing-page')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <input
                className="input flex-1 min-w-[180px]"
                type="text"
                placeholder={t('Từ khóa mục tiêu (tùy chọn)')}
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
              />
              <button type="submit" className="btn-primary px-6 cursor-pointer" disabled={loading}>
                {loading ? t('Đang phân tích...') : t('Chạy SEO Audit')}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium select-none">
              <input 
                type="checkbox" 
                id="usePageSpeed" 
                checked={usePageSpeed} 
                onChange={(e) => setUsePageSpeed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30 cursor-pointer"
              />
              <label htmlFor="usePageSpeed" className="cursor-pointer flex items-center gap-1">
                {t('Phân tích tốc độ load & trải nghiệm di động (Google PageSpeed Insights)')}
              </label>
            </div>
          </form>

          {/* History Score Line Chart */}
          {history.length > 1 && (
            <div className="card p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{t('Biểu đồ tiến độ chất lượng SEO')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">URL: <span className="font-semibold text-slate-700">{history[0]?.url}</span></p>
              </div>
              <div className="h-[180px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tickLine={false} style={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis domain={[0, 100]} tickLine={false} style={{ fontSize: 10, fill: '#94A3B8' }} />
                    <ChartTooltip />
                    <Line type="monotone" dataKey="score" name={t('Điểm số')} stroke="#FB6F1D" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Audits List */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{t('Lịch sử Audit gần đây')}</h3>
              {audits.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100/70 border border-red-200/50 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                  onClick={deleteAllAudits}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('Xóa tất cả')}
                </button>
              )}
            </div>
            {audits.length === 0 && (
              <div className="card p-8 text-center text-slate-400 text-sm">
                {t('Chưa có trang nào được audit. Hãy chạy quét bằng khung phía trên.')}
              </div>
            )}
            {audits.map((a) => {
              const criticalCount = a.issues.filter(i => i.severity === 'CRITICAL').length;
              const warningCount = a.issues.filter(i => i.severity === 'WARNING').length;
              const isPageSpeedFallback = a.issues.some(i => i.message.includes('Google PageSpeed Insights: Không thể kết nối'));

              return (
                <div key={a.id} className="card p-6 shadow-sm border border-slate-100 hover:border-slate-200 transition-all space-y-6">
                  {/* Card Header */}
                  <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-50">
                    <div>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-800 hover:text-brand hover:underline break-all text-sm block">
                        {a.url}
                      </a>
                      <p className="text-[11px] text-slate-400 mt-1">{t('Đã quét vào:')} {new Date(a.auditedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button type="button" className="text-xs font-bold text-brand hover:underline cursor-pointer" onClick={() => loadHistory(a.url)}>
                        {t('Xem lịch sử URL')}
                      </button>
                      <button 
                        type="button" 
                        className="text-xs font-bold text-red-500 hover:text-red-750 flex items-center gap-1 transition-colors cursor-pointer" 
                        onClick={() => deleteAudit(a.id)}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t('Xóa')}
                      </button>
                      <div className={`text-2xl font-black px-3 py-1 border rounded-lg shadow-sm ${getScoreColor(a.score)}`}>
                        {a.score} <span className="text-xs font-semibold text-slate-500">/ 100</span>
                      </div>
                    </div>
                  </div>

                  {/* Amber Fallback Banner if PageSpeed failed */}
                  {isPageSpeedFallback && (
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-xs animate-[fadeIn_0.2s_ease-out]">
                      <span className="text-lg shrink-0 mt-0.5">⚠️</span>
                      <div className="text-xs text-amber-850 leading-relaxed font-medium">
                        <p className="font-extrabold text-amber-900">{t('Google PageSpeed Insights tạm thời quá tải hoặc lỗi kết nối (Lỗi 429).')}</p>
                        <p className="mt-1 text-amber-800/90">{t('Hệ thống đã tự động kích hoạt chế độ dự phòng: Phân tích cấu trúc HTML On-Page tại chỗ để đưa ra điểm số thực tiễn nhất cho website của bạn.')}</p>
                      </div>
                    </div>
                  )}

                  {/* Sub-scores grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-sky-50/20 border border-sky-100/60 rounded-2xl p-4 flex flex-col justify-between hover:bg-sky-50/40 transition-colors shadow-xs">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider">{t('Điểm Kỹ Thuật')}</span>
                        <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 mt-1" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-black text-slate-800">{a.technicalScore}</span>
                        <span className="text-[10px] font-bold text-slate-400">/100</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                        <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: `${a.technicalScore}%` }} />
                      </div>
                    </div>

                    <div className="bg-orange-50/20 border border-orange-100/60 rounded-2xl p-4 flex flex-col justify-between hover:bg-orange-50/40 transition-colors shadow-xs">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wider">{t('Tối ưu Nội dung')}</span>
                        <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-1" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-black text-slate-800">{a.contentScore}</span>
                        <span className="text-[10px] font-bold text-slate-400">/100</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                        <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${a.contentScore}%` }} />
                      </div>
                    </div>

                    <div className="bg-emerald-50/20 border border-emerald-100/60 rounded-2xl p-4 flex flex-col justify-between hover:bg-emerald-50/40 transition-colors shadow-xs">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">{t('Trải nghiệm UX')}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
                      </div>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-black text-slate-850">{a.uxScore}</span>
                        <span className="text-[10px] font-bold text-slate-400">/100</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${a.uxScore}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Issues Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('Danh sách khuyến nghị')} ({a.issues.length})</h4>
                      <div className="flex gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-50 text-red-700 border border-red-100">{criticalCount} {t('nguy cấp')}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-100">{warningCount} {t('cảnh báo')}</span>
                      </div>
                    </div>
                    
                    {a.issues.length === 0 ? (
                      <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-xs font-semibold">
                        {t('Tuyệt vời! Không phát hiện lỗi On-page nào trên trang web này.')}
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {a.issues.map((issue, idx) => (
                          <li key={idx} className="flex gap-3 items-start p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border transition-colors">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-md shrink-0 mt-0.5 ${getSeverityBadge(issue.severity)}`}>
                              {issue.severity}
                            </span>
                            <div className="flex-1 text-xs">
                              <p className="font-semibold text-slate-800">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-slate-500 mt-1 flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-emerald-600">{t('Gợi ý khắc phục:')}</span> {issue.suggestion}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleKeywordResearch} className="card p-6 flex gap-3 shadow-sm items-center">
            <div className="relative flex-1">
              <input
                className="input pl-10 w-full"
                style={{ paddingLeft: '2.5rem' }}
                type="text"
                placeholder={t('Nhập từ khóa hạt giống (ví dụ: phần mềm crm, du lịch sapa, bán hàng online)...')}
                value={seedKeyword}
                onChange={(e) => setSeedKeyword(e.target.value)}
                required
                disabled={researchLoading}
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 113.536 0V21h-2v-3.3a5 5 0 01-1.536-1.7z" />
                </svg>
              </span>
            </div>
            <button type="submit" className="btn-primary px-6 flex items-center gap-2 cursor-pointer" disabled={researchLoading}>
              {researchLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('Đang phân tích...')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
                  </svg>
                  {t('Nghiên cứu từ khóa AI')}
                </>
              )}
            </button>
          </form>

          {researchLoading && (
            <div className="card p-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
              <div>{t('AI đang tiến hành phân tích và lập kế hoạch từ khóa...')}</div>
            </div>
          )}

          {!researchLoading && researchResults.length > 0 && (
            <div className="card overflow-hidden shadow-sm border border-slate-100">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{t('Kết quả nghiên cứu cho từ khóa:')} <span className="text-brand font-black">"{seedKeyword}"</span></h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t('AI đề xuất các từ khóa ngách tối ưu kèm độ khó, volume và dàn ý gợi ý.')}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4">{t('Từ khóa ngách')}</th>
                      <th className="p-4">{t('Lượng tìm kiếm')}</th>
                      <th className="p-4">{t('Độ khó')}</th>
                      <th className="p-4">{t('Ý định tìm kiếm')}</th>
                      <th className="p-4">{t('Tiêu đề blog gợi ý')}</th>
                      <th className="p-4 text-right">{t('Thao tác')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {researchResults.map((item, idx) => {
                      const isExpanded = expandedBriefIdx === idx;
                      const isTracked = trackedKeywords[item.keyword];

                      // Difficulty mapping
                      let diffColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      let diffLabel = t('Dễ');
                      if (item.difficulty === 'Medium') {
                        diffColor = 'bg-amber-50 text-amber-700 border-amber-100';
                        diffLabel = t('Trung bình');
                      } else if (item.difficulty === 'Hard') {
                        diffColor = 'bg-rose-50 text-rose-700 border-rose-100';
                        diffLabel = t('Khó');
                      }

                      // Intent mapping
                      let intentColor = 'bg-blue-50 text-blue-700 border-blue-100';
                      let intentLabel = t('Thông tin');
                      if (item.intent === 'Transactional') {
                        intentColor = 'bg-purple-50 text-purple-700 border-purple-100';
                        intentLabel = t('Giao dịch');
                      } else if (item.intent === 'Navigational') {
                        intentColor = 'bg-teal-50 text-teal-700 border-teal-100';
                        intentLabel = t('Điều hướng');
                      }

                      return (
                        <React.Fragment key={idx}>
                          <tr className="hover:bg-slate-50/45 transition-colors">
                            <td className="p-4 font-bold text-slate-800 text-sm">
                              {item.keyword}
                            </td>
                            <td className="p-4 font-extrabold text-slate-700">
                              {item.volume.toLocaleString()}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 border rounded-md font-bold text-[10px] ${diffColor}`}>
                                {diffLabel}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 border rounded-md font-bold text-[10px] ${intentColor}`}>
                                {intentLabel}
                              </span>
                            </td>
                            <td className="p-4 max-w-[280px] truncate text-slate-650" title={item.suggestedTitle}>
                              {item.suggestedTitle}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex gap-2 justify-end items-center">
                                <button
                                  type="button"
                                  onClick={() => setExpandedBriefIdx(isExpanded ? null : idx)}
                                  className="text-[11px] font-bold text-slate-500 hover:text-slate-850 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                      </svg>
                                      {t('Thu nhỏ')}
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                      {t('Dàn ý')}
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={isTracked}
                                  onClick={() => handleTrackKeyword(item.keyword, item.volume)}
                                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                    isTracked
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-250 opacity-80 cursor-default'
                                      : 'bg-white text-brand border-brand/20 hover:bg-brand/5'
                                  }`}
                                >
                                  {isTracked ? (
                                    <>
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                      {t('Đang theo dõi')}
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                      </svg>
                                      {t('Theo dõi')}
                                    </>
                                  )}
                                </button>
                                <a
                                  href={`/dashboard/blog?keyword=${encodeURIComponent(item.keyword)}&title=${encodeURIComponent(item.suggestedTitle)}`}
                                  className="text-[11px] font-bold text-white bg-brand hover:bg-brand/90 px-2.5 py-1 rounded-lg shadow-xs hover:shadow-sm transition-all whitespace-nowrap flex items-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  {t('Viết Blog')}
                                </a>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Brief Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="p-4 border-t border-slate-100">
                                <div className="space-y-2.5 max-w-3xl">
                                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {t('Dàn ý bài viết chuẩn SEO đề xuất')}
                                  </h4>
                                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                                    <p className="text-slate-700 font-extrabold mb-2 text-xs">
                                      {t('Tiêu đề bài viết:')} <span className="text-slate-800 underline font-black">"{item.suggestedTitle}"</span>
                                    </p>
                                    <ul className="space-y-1.5 pl-5 list-decimal text-slate-600 text-xs leading-relaxed">
                                      {item.brief.map((bullet, bulletIdx) => (
                                        <li key={bulletIdx}>
                                          {bullet}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
