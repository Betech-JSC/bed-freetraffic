'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type Rule = {
  id: number;
  name: string;
  metric: string;
  threshold: number;
  comparison: string;
  enabled: boolean;
  notifyEmail: string | null;
};

type Log = {
  id: number;
  message: string;
  createdAt: string;
  rule: { name: string };
};

const METRICS = [
  { value: 'sessions', label: 'Sessions (24h)' },
  { value: 'clicks', label: 'Organic clicks (24h)' },
  { value: 'keywords', label: 'Số từ khóa' },
  { value: 'sessions_drop_pct', label: '% giảm sessions (7 ngày vs 7 ngày trước)' },
  { value: 'crawl_errors', label: 'SEO audit lỗi nặng (24h)' },
];

export default function AlertsPage() {
  const { t } = useLocale();
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    metric: 'sessions',
    threshold: '100',
    comparison: 'lt',
    notifyEmail: '',
  });

  const load = async () => {
    setError('');
    try {
      const [r, l] = await Promise.all([apiJson<Rule[]>('/alerts/rules'), apiJson<Log[]>('/alerts/logs')]);
      setRules(r);
      setLogs(l);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được cảnh báo'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiJson('/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ name: '', metric: 'sessions', threshold: '100', comparison: 'lt', notifyEmail: '' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không lưu được rule'));
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      await apiJson(`/alerts/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không cập nhật được'));
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm(t('Xóa rule này?'))) return;
    try {
      await apiJson(`/alerts/rules/${id}`, { method: 'DELETE' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được'));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('Cảnh báo')}
        description={t('Ngưỡng traffic/organic, giảm đột ngột, lỗi SEO audit. Mỗi rule tối đa 1 alert / 24h.')}
      />
      {error && <p className="alert-error text-sm">{error}</p>}
      <form onSubmit={submit} className="card p-6 grid md:grid-cols-3 gap-3">
        <input
          className="input"
          placeholder={t('Tên rule')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select className="input" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
          {METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {t(m.label)}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          step="any"
          placeholder={t('Ngưỡng')}
          value={form.threshold}
          onChange={(e) => setForm({ ...form, threshold: e.target.value })}
        />
        <select className="input" value={form.comparison} onChange={(e) => setForm({ ...form, comparison: e.target.value })}>
          <option value="lt">{t('nhỏ hơn')}</option>
          <option value="gt">{t('lớn hơn')}</option>
          <option value="eq">{t('bằng')}</option>
        </select>
        <input
          className="input md:col-span-2"
          placeholder={t('Email nhận cảnh báo')}
          value={form.notifyEmail}
          onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })}
        />
        <button type="submit" className="btn-primary">
          {t('Thêm rule')}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        {t('Ví dụ giảm traffic: metric')} <code>sessions_drop_pct</code>{t(', so sánh')} <strong>{t('lớn hơn')}</strong>{t(', ngưỡng')}{' '}
        <strong>20</strong> {t('(= giảm hơn 20%).')}
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="font-semibold mb-3">{t('Rules')} ({rules.length})</h3>
          <ul className="text-sm space-y-3">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                <span className={r.enabled ? '' : 'opacity-50 line-through'}>
                  {r.name}: {r.metric} {t(r.comparison === 'lt' ? 'nhỏ hơn' : r.comparison === 'gt' ? 'lớn hơn' : 'bằng')} {r.threshold}
                </span>
                <button type="button" className="text-xs text-brand" onClick={() => toggleRule(r)}>
                  {r.enabled ? t('Tắt') : t('Bật')}
                </button>
                <button type="button" className="text-xs text-red-500" onClick={() => deleteRule(r.id)}>
                  {t('Xóa')}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold mb-3">{t('Nhật ký')}</h3>
          <ul className="text-sm space-y-2 max-h-64 overflow-auto">
            {logs.map((l) => (
              <li key={l.id}>
                {l.message}
                <span className="text-slate-400 block text-xs">{new Date(l.createdAt).toLocaleString('vi-VN')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
