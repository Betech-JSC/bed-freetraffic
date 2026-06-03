'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type Recommendation = {
  id: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionPath?: string;
};

const priorityStyle: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function InsightsPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (ai = false) => {
    setError('');
    if (ai) setAiLoading(true);
    else setLoading(true);
    try {
      const q = ai ? '?ai=1' : '';
      const data = await apiJson<{ items: Recommendation[]; summary: string | null }>(`/insights${q}`);
      setItems(data.items);
      setSummary(data.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được gợi ý'));
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('Gợi ý tối ưu (AI)')}
        description={t('Phase 3 — Phân tích dữ liệu hệ thống và đề xuất hành động (rule-based + OpenAI tùy chọn).')}
        actions={
          <button type="button" className="btn-primary" disabled={aiLoading} onClick={() => load(true)}>
            {aiLoading ? t('Đang tóm tắt AI...') : t('Tóm tắt bằng AI')}
          </button>
        }
      />
      {error && <p className="alert-error text-sm">{error}</p>}
      {summary && (
        <div className="card p-6 border-l-4 border-brand">
          <h3 className="font-semibold text-slate-900 mb-2">{t('Tóm tắt AI')}</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{summary}</p>
        </div>
      )}
      {loading ? (
        <p className="text-slate-500">{t('Đang phân tích...')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className={`card p-5 border ${priorityStyle[r.priority] || ''}`}>
              <div className="flex flex-wrap justify-between gap-2 mb-1">
                <span className="text-xs font-bold uppercase">{t(r.priority)}</span>
                <span className="text-xs text-slate-500">{t(r.category)}</span>
              </div>
              <h3 className="font-semibold text-slate-900">{t(r.title)}</h3>
              <p className="text-sm text-slate-600 mt-1">{t(r.description)}</p>
              {r.actionPath && (
                <Link href={r.actionPath} className="text-sm text-brand font-semibold mt-2 inline-block">
                  {t('Xem')} →
                </Link>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-slate-500">{t('Chưa có gợi ý — hệ thống đang ổn hoặc thiếu dữ liệu.')}</p>
          )}
        </ul>
      )}
    </div>
  );
}
