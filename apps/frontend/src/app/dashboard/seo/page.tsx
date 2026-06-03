'use client';

import { useEffect, useState } from 'react';
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
  const [audits, setAudits] = useState<Audit[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const runAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const target = url.trim();
      await apiJson('/seo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      setUrl('');
      load();
      loadHistory(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Lỗi audit'));
    } finally {
      setLoading(false);
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
  const chartData = history.slice().reverse().map(h => ({
    date: new Date(h.auditedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: '2-digit', day: '2-digit' }),
    score: h.score
  }));

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title={t('SEO Audit (On-Page)')}
        description={t('FR-03 — Quét tối ưu cấu trúc HTML, heading, meta description, alt hình ảnh và trải nghiệm di động của trang đích.')}
      />

      {/* Quick Help Onboarding Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <span className="text-xl mt-0.5">💡</span>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{t('Cách thức SEO Audit hoạt động')}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {t('Nhập đường dẫn URL đích của bạn vào khung bên dưới để hệ thống thực hiện quét thời gian thực.')}{' '}
            {t('Bot sẽ phân tích các thẻ')} <strong>Title, Meta Description, Heading (H1-H2), {t('tốc độ phản hồi và')} Mobile Viewport</strong>.{' '}
            {t('Sau khi có điểm, bạn hãy kéo xuống danh sách lỗi để xem chi tiết cách khắc phục từng mục giúp website thân thiện hơn với Google!')}
          </p>
        </div>
      </div>

      <form onSubmit={runAudit} className="card p-6 flex gap-3 flex-wrap shadow-sm">
        <input
          className="input flex-1 min-w-[240px]"
          type="url"
          placeholder={t('Ví dụ: https://website-cua-ban.com/landing-page')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary px-6" disabled={loading}>
          {loading ? t('Đang phân tích...') : t('Chạy SEO Audit')}
        </button>
      </form>
      
      {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">{error}</div>}

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
        <h3 className="text-lg font-bold text-slate-800">{t('Lịch sử Audit gần đây')}</h3>
        {audits.length === 0 && (
          <div className="card p-8 text-center text-slate-400 text-sm">
            {t('Chưa có trang nào được audit. Hãy chạy quét bằng khung phía trên.')}
          </div>
        )}
        {audits.map((a) => {
          const criticalCount = a.issues.filter(i => i.severity === 'CRITICAL').length;
          const warningCount = a.issues.filter(i => i.severity === 'WARNING').length;

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
                  <button type="button" className="text-xs font-bold text-brand hover:underline" onClick={() => loadHistory(a.url)}>
                    📊 {t('Xem lịch sử URL')}
                  </button>
                  <div className={`text-2xl font-black px-3 py-1 border rounded-lg shadow-sm ${getScoreColor(a.score)}`}>
                    {a.score} <span className="text-xs font-semibold text-slate-500">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Sub-scores grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 border rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t('Điểm Kỹ Thuật')}</div>
                  <div className="text-lg font-black text-slate-700 mt-1">{a.technicalScore}</div>
                </div>
                <div className="bg-slate-50 border rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t('Tối ưu Nội dung')}</div>
                  <div className="text-lg font-black text-slate-700 mt-1">{a.contentScore}</div>
                </div>
                <div className="bg-slate-50 border rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t('Trải nghiệm UX')}</div>
                  <div className="text-lg font-black text-slate-700 mt-1">{a.uxScore}</div>
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
                    {t('🎉 Tuyệt vời! Không phát hiện lỗi On-page nào trên trang web này.')}
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
                              <span className="text-[10px] font-bold text-emerald-600">👉 {t('Gợi ý khắc phục:')}</span> {issue.suggestion}
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
    </div>
  );
}
