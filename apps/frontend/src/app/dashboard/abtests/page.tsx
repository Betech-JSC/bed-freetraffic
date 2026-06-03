'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type Template = { id: number; title: string };

type AbTest = {
  id: number;
  name: string;
  status: string;
  impressionsA: number;
  impressionsB: number;
  clicksA: number;
  clicksB: number;
  winner: string | null;
  templateA?: Template | null;
  templateB?: Template | null;
};

export default function AbTestsPage() {
  const { t } = useLocale();
  const [tests, setTests] = useState<AbTest[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState('');
  const [templateAId, setTemplateAId] = useState('');
  const [templateBId, setTemplateBId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [testList, tplList] = await Promise.all([
        apiJson<AbTest[]>('/abtests'),
        apiJson<Template[]>('/templates'),
      ]);
      setTests(testList);
      setTemplates(tplList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được A/B tests'));
      setTests([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiJson('/abtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          templateAId: templateAId || undefined,
          templateBId: templateBId || undefined,
        }),
      });
      setName('');
      setTemplateAId('');
      setTemplateBId('');
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tạo được test'));
    }
  };

  const track = async (id: number, type: 'impression' | 'click', variant: 'A' | 'B') => {
    setError('');
    try {
      await apiJson(`/abtests/${id}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không ghi nhận được'));
    }
  };

  const complete = async (id: number) => {
    setError('');
    try {
      await apiJson(`/abtests/${id}/complete`, { method: 'POST' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không kết thúc được test'));
    }
  };

  const ctr = (imp: number, clk: number) => (imp > 0 ? `${((clk / imp) * 100).toFixed(1)}%` : '—');

  return (
    <div className="space-y-8">
      <PageHeader
        title="A/B Testing"
        description={t('FR-08 — So sánh 2 mẫu từ Content Editor; winner theo CTR (click/impression).')}
      />
      {error && <p className="alert-error text-sm">{error}</p>}
      <form onSubmit={create} className="card p-6 space-y-3">
        <input className="input" placeholder={t('Tên test')} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid md:grid-cols-2 gap-3">
          <select className="input" value={templateAId} onChange={(e) => setTemplateAId(e.target.value)}>
            <option value="">{t('Biến thể A (mẫu)')}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.title}
              </option>
            ))}
          </select>
          <select className="input" value={templateBId} onChange={(e) => setTemplateBId(e.target.value)}>
            <option value="">{t('Biến thể B (mẫu)')}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          {t('Tạo test')}
        </button>
      </form>
      <div className="table-wrap">
        <table className="table-modern">
          <thead>
            <tr>
              <th>{t('Tên')}</th>
              <th>{t('Mẫu A / B')}</th>
              <th>Impression</th>
              <th>CTR</th>
              <th>Winner</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id}>
                <td>{test.name}</td>
                <td className="text-xs">
                  A: {test.templateA?.title ?? '—'}
                  <br />
                  B: {test.templateB?.title ?? '—'}
                </td>
                <td>
                  {test.impressionsA} / {test.impressionsB}
                  <br />
                  <span className="text-slate-500 text-xs">
                    clicks {test.clicksA}/{test.clicksB}
                  </span>
                </td>
                <td>
                  {ctr(test.impressionsA, test.clicksA)} / {ctr(test.impressionsB, test.clicksB)}
                </td>
                <td>{test.winner ?? '—'}</td>
                <td className="space-y-1 whitespace-nowrap">
                  {test.status === 'RUNNING' && (
                    <>
                      <div className="flex gap-1 flex-wrap">
                        <button type="button" className="btn-secondary text-xs" onClick={() => track(test.id, 'impression', 'A')}>
                          +imp A
                        </button>
                        <button type="button" className="btn-secondary text-xs" onClick={() => track(test.id, 'impression', 'B')}>
                          +imp B
                        </button>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <button type="button" className="text-xs text-brand" onClick={() => track(test.id, 'click', 'A')}>
                          +click A
                        </button>
                        <button type="button" className="text-xs text-brand" onClick={() => track(test.id, 'click', 'B')}>
                          +click B
                        </button>
                      </div>
                      <button type="button" className="btn-primary text-xs mt-1" onClick={() => complete(test.id)}>
                        {t('Kết thúc')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
