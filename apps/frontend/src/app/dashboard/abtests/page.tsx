'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';
import Link from 'next/link';

type Template = { id: number; title: string };
type LandingPage = { id: number; title: string; slug: string };

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
  landingPageAId?: number | null;
  landingPageBId?: number | null;
  landingPageA?: LandingPage | null;
  landingPageB?: LandingPage | null;
};

export default function AbTestsPage() {
  const { t } = useLocale();
  const [tests, setTests] = useState<AbTest[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  
  const [testType, setTestType] = useState<'post' | 'landing'>('post');
  const [name, setName] = useState('');
  const [templateAId, setTemplateAId] = useState('');
  const [templateBId, setTemplateBId] = useState('');
  const [landingPageAId, setLandingPageAId] = useState('');
  const [landingPageBId, setLandingPageBId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [testList, tplList, lpList] = await Promise.all([
        apiJson<AbTest[]>('/abtests'),
        apiJson<Template[]>('/templates'),
        apiJson<LandingPage[]>('/landing-pages').catch(() => []),
      ]);
      setTests(testList);
      setTemplates(tplList);
      setLandingPages(lpList);
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
      const payload: any = { name };
      if (testType === 'post') {
        payload.templateAId = templateAId || undefined;
        payload.templateBId = templateBId || undefined;
      } else {
        payload.landingPageAId = landingPageAId || undefined;
        payload.landingPageBId = landingPageBId || undefined;
      }

      await apiJson('/abtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setName('');
      setTemplateAId('');
      setTemplateBId('');
      setLandingPageAId('');
      setLandingPageBId('');
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

  const ctr = (imp: number, clk: number) => (imp > 0 ? `${((clk / imp) * 100).toFixed(1)}%` : '0.0%');

  const calculateChiSquare = (impA: number, clkA: number, impB: number, clkB: number) => {
    const totalConversions = clkA + clkB;
    const totalImpressions = impA + impB;
    const totalNonConversions = totalImpressions - totalConversions;

    if (impA <= 0 || impB <= 0 || totalConversions <= 0 || totalNonConversions <= 0) {
      return { chiSquare: 0, isSignificant: false, description: 'Chưa đủ dữ liệu (Cần impressions & conversions > 0)' };
    }

    const o11 = clkA;
    const o12 = impA - clkA;
    const o21 = clkB;
    const o22 = impB - clkB;

    const numerator = totalImpressions * Math.pow(o11 * o22 - o12 * o21, 2);
    const denominator = impA * impB * totalConversions * totalNonConversions;

    if (denominator <= 0) {
      return { chiSquare: 0, isSignificant: false, description: 'Chưa đủ dữ liệu' };
    }

    const chiSquare = numerator / denominator;
    const isSignificant = chiSquare > 3.841; // Chi2 critical value at alpha=0.05, df=1
    const description = isSignificant 
      ? `Có ý nghĩa thống kê (chi² = ${chiSquare.toFixed(2)}, p < 0.05)`
      : `Chưa có ý nghĩa thống kê (chi² = ${chiSquare.toFixed(2)}, p >= 0.05)`;
    return { chiSquare, isSignificant, description };
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="A/B Testing"
        description={t('So sánh 2 mẫu nội dung hoặc 2 Trang đích để tìm ra phương án tối ưu dựa trên tỷ lệ chuyển đổi (CTR).')}
      />
      {error && <p className="alert-error text-sm">{error}</p>}
      
      <form onSubmit={create} className="card p-6 space-y-4">
        <h3 className="font-bold text-white text-sm">Tạo chiến dịch thử nghiệm mới</h3>
        
        {/* Test Type Select */}
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="testType"
              value="post"
              checked={testType === 'post'}
              onChange={() => setTestType('post')}
              className="accent-[#f25c22]"
            />
            Mẫu mạng xã hội (Social Post)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="radio"
              name="testType"
              value="landing"
              checked={testType === 'landing'}
              onChange={() => setTestType('landing')}
              className="accent-[#f25c22]"
            />
            Trang đích (Split URL Landing Page)
          </label>
        </div>

        <input className="input" placeholder={t('Tên chiến dịch test')} value={name} onChange={(e) => setName(e.target.value)} required />
        
        {testType === 'post' ? (
          <div className="grid md:grid-cols-2 gap-3">
            <select className="input" value={templateAId} onChange={(e) => setTemplateAId(e.target.value)} required={testType === 'post'}>
              <option value="">{t('Biến thể A (mẫu MXH)')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </option>
              ))}
            </select>
            <select className="input" value={templateBId} onChange={(e) => setTemplateBId(e.target.value)} required={testType === 'post'}>
              <option value="">{t('Biến thể B (mẫu MXH)')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            <select className="input" value={landingPageAId} onChange={(e) => setLandingPageAId(e.target.value)} required={testType === 'landing'}>
              <option value="">{t('Biến thể A (Trang đích gốc)')}</option>
              {landingPages.map((lp) => (
                <option key={lp.id} value={lp.id}>
                  {lp.title} ({lp.slug})
                </option>
              ))}
            </select>
            <select className="input" value={landingPageBId} onChange={(e) => setLandingPageBId(e.target.value)} required={testType === 'landing'}>
              <option value="">{t('Biến thể B (Trang đích thử nghiệm)')}</option>
              {landingPages.map((lp) => (
                <option key={lp.id} value={lp.id}>
                  {lp.title} ({lp.slug})
                </option>
              ))}
            </select>
          </div>
        )}
        
        <button type="submit" className="btn-primary">
          {t('Tạo test')}
        </button>
      </form>

      <div className="table-wrap">
        <table className="table-modern">
          <thead>
            <tr>
              <th>{t('Tên chiến dịch')}</th>
              <th>{t('Loại')}</th>
              <th>{t('Biến thể A / B')}</th>
              <th>Impressions</th>
              <th>Conversions / CTR</th>
              <th>Ý nghĩa thống kê (Chi-Square)</th>
              <th>Winner</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => {
              const isLp = !!(test.landingPageAId || test.landingPageBId);
              const stats = calculateChiSquare(test.impressionsA, test.clicksA, test.impressionsB, test.clicksB);
              
              return (
                <tr key={test.id}>
                  <td className="font-semibold text-white">{test.name}</td>
                  <td>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${isLp ? 'bg-sky-900/30 text-sky-400 border border-sky-800/40' : 'bg-purple-900/30 text-purple-400 border border-purple-800/40'}`}>
                      {isLp ? 'Landing Page' : 'Social Post'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-300">
                    {isLp ? (
                      <>
                        <span className="font-medium text-slate-400">A:</span> {test.landingPageA?.title ?? '—'}
                        <br />
                        <span className="font-medium text-slate-400">B:</span> {test.landingPageB?.title ?? '—'}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-slate-400">A:</span> {test.templateA?.title ?? '—'}
                        <br />
                        <span className="font-medium text-slate-400">B:</span> {test.templateB?.title ?? '—'}
                      </>
                    )}
                  </td>
                  <td className="text-xs font-mono text-slate-200">
                    A: {test.impressionsA}
                    <br />
                    B: {test.impressionsB}
                  </td>
                  <td className="text-xs">
                    <span className="font-mono text-slate-400">{test.clicksA}</span> ({ctr(test.impressionsA, test.clicksA)})
                    <br />
                    <span className="font-mono text-slate-400">{test.clicksB}</span> ({ctr(test.impressionsB, test.clicksB)})
                  </td>
                  <td className={`text-xs ${stats.isSignificant ? 'text-green-400 font-medium' : 'text-slate-400'}`}>
                    {stats.description}
                  </td>
                  <td className="font-bold">
                    {test.winner ? (
                      <span className={`px-2 py-0.5 text-xs rounded ${test.winner === 'tie' ? 'bg-slate-800 text-slate-400' : 'bg-green-950 text-green-400'}`}>
                        {test.winner === 'tie' ? 'Hòa (Tie)' : `Biến thể ${test.winner}`}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs italic">Đang chạy</span>
                    )}
                  </td>
                  <td className="space-y-1 whitespace-nowrap">
                    {test.status === 'RUNNING' && (
                      <div className="flex flex-col gap-1.5">
                        {/* Simulation triggers for debugging/manual testing */}
                        {!isLp && (
                          <div className="flex gap-1 flex-wrap">
                            <button type="button" className="btn-secondary text-[10px] px-2 py-0.5" onClick={() => track(test.id, 'impression', 'A')}>
                              +imp A
                            </button>
                            <button type="button" className="btn-secondary text-[10px] px-2 py-0.5" onClick={() => track(test.id, 'impression', 'B')}>
                              +imp B
                            </button>
                            <button type="button" className="text-[10px] text-brand border border-slate-800 hover:bg-slate-900 rounded px-1.5 py-0.5" onClick={() => track(test.id, 'click', 'A')}>
                              +click A
                            </button>
                            <button type="button" className="text-[10px] text-brand border border-slate-800 hover:bg-slate-900 rounded px-1.5 py-0.5" onClick={() => track(test.id, 'click', 'B')}>
                              +click B
                            </button>
                          </div>
                        )}
                        <button type="button" className="btn-primary text-xs w-full py-1 text-center" onClick={() => complete(test.id)}>
                          {t('Kết thúc')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
