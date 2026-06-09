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
  const [selectedTestStats, setSelectedTestStats] = useState<any>(null);

  const fetchStats = async (id: number) => {
    try {
      const data = await apiJson<any>(`/abtests/${id}/stats`);
      setSelectedTestStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được thống kê chi tiết'));
    }
  };

  const forceSelectWinner = async (id: number, winner: 'A' | 'B') => {
    setError('');
    try {
      await apiJson(`/abtests/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner }),
      });
      setSelectedTestStats(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không chốt được Winner'));
    }
  };

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
                  <td className="font-semibold text-white">
                    <button
                      onClick={() => fetchStats(test.id)}
                      className="hover:underline text-left text-[#f25c22] font-extrabold hover:text-[#d94d1a]"
                    >
                      {test.name}
                    </button>
                  </td>
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs px-2.5 py-1"
                        onClick={() => fetchStats(test.id)}
                      >
                        {t('Chi tiết')}
                      </button>
                      {test.status === 'RUNNING' && (
                        <button
                          type="button"
                          className="btn-primary text-xs px-2.5 py-1"
                          onClick={() => complete(test.id)}
                        >
                          {t('Kết thúc')}
                        </button>
                      )}
                    </div>
                    {test.status === 'RUNNING' && !isLp && (
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        <button type="button" className="btn-secondary text-[9px] px-1 py-0.5" onClick={() => track(test.id, 'impression', 'A')}>
                          +imp A
                        </button>
                        <button type="button" className="btn-secondary text-[9px] px-1 py-0.5" onClick={() => track(test.id, 'impression', 'B')}>
                          +imp B
                        </button>
                        <button type="button" className="text-[9px] text-[#f25c22] border border-orange-200 hover:bg-orange-50 rounded px-1.5 py-0.5 font-bold transition-all" onClick={() => track(test.id, 'click', 'A')}>
                          +click A
                        </button>
                        <button type="button" className="text-[9px] text-[#f25c22] border border-orange-200 hover:bg-orange-50 rounded px-1.5 py-0.5 font-bold transition-all" onClick={() => track(test.id, 'click', 'B')}>
                          +click B
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

      {/* Modal báo cáo A/B Test chi tiết */}
      {selectedTestStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-slate-700 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-orange-500"></div>
            <button
              onClick={() => setSelectedTestStats(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg font-bold"
            >
              ✕
            </button>
            
            <h3 className="text-lg font-black text-slate-800 mb-1">{selectedTestStats.test.name}</h3>
            <p className="text-slate-500 text-xs mb-6">Thống kê chi tiết & Phân tích độ tin cậy từ hệ thống</p>
            
            {/* Cards so sánh */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Variant A Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 relative overflow-hidden">
                <span className="absolute top-0 right-0 bg-slate-200 text-slate-600 px-2.5 py-0.5 text-[9px] font-bold rounded-bl-lg">BIẾN THỂ A</span>
                <h4 className="font-extrabold text-slate-700 text-sm mb-3 truncate">
                  {selectedTestStats.test.landingPageA?.title || selectedTestStats.test.templateA?.title || 'Variant A'}
                </h4>
                <div className="grid grid-cols-3 gap-1.5 text-center mt-2">
                  <div>
                    <div className="text-slate-500 text-[9px] font-bold uppercase">Lượt xem</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{selectedTestStats.test.impressionsA}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] font-bold uppercase">Click</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{selectedTestStats.test.clicksA}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] font-bold uppercase">Tỉ lệ CR</div>
                    <div className="text-sm font-black text-[#f25c22] font-mono mt-0.5">{(selectedTestStats.stats.crA * 100).toFixed(2)}%</div>
                  </div>
                </div>
              </div>

              {/* Variant B Card */}
              <div className="bg-brand-light/30 border border-orange-100/80 rounded-xl p-5 relative overflow-hidden">
                <span className="absolute top-0 right-0 bg-[#f25c22]/10 text-[#f25c22] px-2.5 py-0.5 text-[9px] font-bold rounded-bl-lg">BIẾN THỂ B</span>
                <h4 className="font-extrabold text-slate-700 text-sm mb-3 truncate">
                  {selectedTestStats.test.landingPageB?.title || selectedTestStats.test.templateB?.title || 'Variant B'}
                </h4>
                <div className="grid grid-cols-3 gap-1.5 text-center mt-2">
                  <div>
                    <div className="text-slate-500 text-[9px] font-bold uppercase">Lượt xem</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{selectedTestStats.test.impressionsB}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] font-bold uppercase">Click</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{selectedTestStats.test.clicksB}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] font-bold uppercase">Tỉ lệ CR</div>
                    <div className="text-sm font-black text-[#f25c22] font-mono mt-0.5">{(selectedTestStats.stats.crB * 100).toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phân tích khoa học */}
            <div className="mt-4 bg-orange-50/20 border border-orange-100/50 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Báo cáo kiểm thử thống kê Chi-Square (χ²)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-1 text-center md:text-left">
                <div>
                  <div className="text-slate-500 text-[10px]">Tỷ lệ cải thiện</div>
                  <div className={`text-base font-black font-mono mt-0.5 ${selectedTestStats.stats.improvement >= 0 ? 'text-[#f25c22]' : 'text-rose-500'}`}>
                    {selectedTestStats.stats.improvement >= 0 ? '+' : ''}{selectedTestStats.stats.improvement.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Độ tin cậy</div>
                  <div className="text-base font-black text-brand mt-0.5">{selectedTestStats.stats.confidenceLevel}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Trị số Chi-Square</div>
                  <div className="text-base font-black font-mono text-slate-700 mt-0.5">{selectedTestStats.stats.chiSquare.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Ý nghĩa thống kê</div>
                  <div className={`text-xs font-bold mt-1 ${selectedTestStats.stats.isSignificant ? 'text-brand' : 'text-slate-500'}`}>
                    {selectedTestStats.stats.isSignificant ? 'Có ý nghĩa (p < 0.05)' : 'Không đáng kể'}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                  Trạng thái hiện tại: {selectedTestStats.test.winner ? (
                    <span className="text-brand font-bold uppercase">Đã chốt (Winner: {selectedTestStats.test.winner === 'tie' ? 'Hòa' : `Mẫu ${selectedTestStats.test.winner}`})</span>
                  ) : (
                    <span>Đang chạy {selectedTestStats.stats.isSignificant ? `— AI khuyên dùng Biến thể ${selectedTestStats.stats.currentLeader}` : ''}</span>
                  )}
                </div>
                
                {selectedTestStats.test.status === 'RUNNING' && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => forceSelectWinner(selectedTestStats.test.id, 'A')}
                      className="btn-secondary text-[10px] py-1 px-2.5 font-bold"
                    >
                      Chốt Winner A
                    </button>
                    <button
                      onClick={() => forceSelectWinner(selectedTestStats.test.id, 'B')}
                      className="btn-primary text-[10px] py-1 px-2.5 font-bold"
                    >
                      Chốt Winner B
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
