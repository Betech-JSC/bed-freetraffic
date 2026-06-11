'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type Template = { id: number; title: string; content: string };
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

type AbTestStatsResponse = {
  test: AbTest;
  stats: {
    crA: number;
    crB: number;
    improvement: number;
    chiSquare: number;
    isSignificant: boolean;
    confidenceLevel: string;
    currentLeader: string;
    totalImpressions: number;
    totalConversions: number;
  };
};

export default function AbTestAnalyticsPage() {
  const { t } = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? String(params.id) : '';

  const [data, setData] = useState<AbTestStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadStats = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiJson<AbTestStatsResponse>(`/abtests/${id}/stats`);
      setData(res);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không tải được thống kê chi tiết'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [id]);

  const handleSelectWinner = async (winner: 'A' | 'B' | 'tie') => {
    if (!id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await apiJson(`/abtests/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner }),
      });
      setSuccess(
        winner === 'tie'
          ? t('Đã chốt kết quả Hòa cho chiến dịch.')
          : `${t('Đã chốt phiên bản chiến thắng:')} Biến thể ${winner}`
      );
      await loadStats();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không chốt được Winner'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoComplete = async () => {
    if (!id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiJson<any>(`/abtests/${id}/complete`, {
        method: 'POST',
      });
      setSuccess(
        res.winner === 'tie'
          ? t('Kết quả kiểm định Chi-Square cho thấy hai biến thể hòa nhau.')
          : `${t('Hệ thống tự động chốt Winner dựa trên ý nghĩa thống kê:')} Biến thể ${res.winner}`
      );
      await loadStats();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không hoàn tất tự động được'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateAction = async (type: 'impression' | 'click', variant: 'A' | 'B') => {
    if (!id) return;
    setError('');
    setSuccess('');
    try {
      await apiJson(`/abtests/${id}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      });
      await loadStats();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không ghi nhận được'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <span className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">{t('Đang phân tích dữ liệu chiến dịch...')}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-container space-y-4">
        <div className="alert-error p-4">{error}</div>
        <Link href="/dashboard/abtests" className="btn-secondary inline-block">
          &larr; {t('Quay lại danh sách A/B Testing')}
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { test, stats } = data;
  const isLp = !!(test.landingPageAId || test.landingPageBId);

  // Prepare chart data
  const chartData = [
    {
      name: t('Biến thể A'),
      'Impressions': test.impressionsA,
      'Clicks': test.clicksA,
      'CTR': parseFloat((stats.crA * 100).toFixed(2)),
      color: '#3b82f6', // blue
    },
    {
      name: t('Biến thể B'),
      'Impressions': test.impressionsB,
      'Clicks': test.clicksB,
      'CTR': parseFloat((stats.crB * 100).toFixed(2)),
      color: '#f25c22', // brand orange
    },
  ];

  return (
    <div className="page-container space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/abtests"
              className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
            >
              &larr; {t('A/B Testing')}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isLp ? 'Landing Page Test' : 'Social Post Test'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            {t('Phân tích Chiến dịch:')} {test.name}
          </h1>
          <p className="text-slate-500 text-sm">
            {t('Theo dõi lượt xem, nhấp chuột, tỉ lệ CTR và kết quả kiểm định Chi-Square.')}
          </p>
        </div>

        <div className="flex gap-2">
          {test.status === 'RUNNING' && (
            <button
              onClick={handleAutoComplete}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              📊 {t('Tự động chốt Winner')}
            </button>
          )}
          <Link href="/dashboard/abtests" className="btn-secondary text-sm">
            {t('Danh sách chiến dịch')}
          </Link>
        </div>
      </div>

      {error && <p className="alert-error text-sm">{error}</p>}
      {success && <p className="alert-info text-sm">{success}</p>}

      {/* Campaign Status Alert */}
      {test.status === 'COMPLETED' ? (
        <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest">
                {t('CHIẾN DỊCH ĐÃ HOÀN THÀNH')}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {test.winner === 'tie'
                ? t('Chiến dịch kết thúc với kết quả Hòa (không có sự khác biệt rõ rệt).')
                : `${t('Chiến dịch đã chọn được biến thể chiến thắng tối ưu:')} `}
              {test.winner !== 'tie' && (
                <strong className="text-emerald-700 text-base">
                  {t('Biến thể')} {test.winner}
                </strong>
              )}
            </p>
          </div>
          {test.winner !== 'tie' && (
            <div className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-sm shadow">
              🏆 {t('Winner:')} {t('Biến thể')} {test.winner}
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse inline-block" />
              <span className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">
                {t('ĐANG CHẠY & THU THẬP DỮ LIỆU')}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {t('Lưu lượng truy cập đang được phân phối ngẫu nhiên 50/50 cho hai biến thể A và B.')}
            </p>
          </div>
          {stats.isSignificant && (
            <div className="px-4 py-2 bg-[#f25c22]/10 text-brand border border-orange-200 rounded-xl font-bold text-xs">
              💡 {t('AI gợi ý:')} {t('Mẫu')} {stats.currentLeader} {t('đang dẫn đầu với độ tin cậy')} {stats.confidenceLevel}
            </div>
          )}
        </div>
      )}

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('Tổng lượt hiển thị')}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-slate-800 font-mono">{stats.totalImpressions}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            A: {test.impressionsA} | B: {test.impressionsB}
          </p>
        </div>

        <div className="stat-card p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('Tổng lượt chuyển đổi')}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-slate-800 font-mono">{stats.totalConversions}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            A: {test.clicksA} | B: {test.clicksB}
          </p>
        </div>

        <div className="stat-card p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('Mức cải thiện CTR')}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p
              className={`text-2xl font-black font-mono ${
                stats.improvement >= 0 ? 'text-[#f25c22]' : 'text-rose-600'
              }`}
            >
              {stats.improvement >= 0 ? '+' : ''}
              {stats.improvement.toFixed(1)}%
            </p>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {t('Hiệu số CTR từ A sang B')}
          </p>
        </div>

        <div className="stat-card p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('Ý nghĩa thống kê')}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p
              className={`text-lg font-black truncate ${
                stats.isSignificant ? 'text-emerald-600' : 'text-slate-600'
              }`}
            >
              {stats.isSignificant ? t('Đáng tin cậy') : t('Chưa đáng kể')}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {t('Độ tin cậy:')} {stats.confidenceLevel}
          </p>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Impressions vs Clicks Chart */}
          <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              📊 {t('Lượt xem & Lượt nhấp chuột')}
            </h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Impressions" name={t('Lượt xem (Impression)')} fill="#64748b" radius={[4, 4, 0, 0]}>
                    <Cell fill="#94a3b8" />
                    <Cell fill="#cbd5e1" />
                  </Bar>
                  <Bar dataKey="Clicks" name={t('Lượt nhấp (Click)')} fill="#f25c22" radius={[4, 4, 0, 0]}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f25c22" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CTR Chart */}
          <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              🎯 {t('Tỉ lệ click chuột (CTR %)')}
            </h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Bar dataKey="CTR" name="Click-Through Rate (CTR %)" radius={[6, 6, 0, 0]} barSize={50}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f25c22" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Actions for Test Drive (Optional, only visible when RUNNING) */}
      {test.status === 'RUNNING' && (
        <div className="card p-5 bg-orange-500/5 border border-orange-100 rounded-2xl space-y-3">
          <h4 className="text-xs font-extrabold text-brand uppercase tracking-wider">
            🛠️ {t('Bảng Giả lập Dữ liệu (Dành cho Kiểm thử)')}
          </h4>
          <p className="text-xs text-slate-500">
            {t('Nhấp vào các nút dưới đây để tăng lượt hiển thị và nhấp chuột giả lập cho chiến dịch này:')}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleSimulateAction('impression', 'A')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
            >
              +1 Imp A
            </button>
            <button
              onClick={() => handleSimulateAction('impression', 'B')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
            >
              +1 Imp B
            </button>
            <button
              onClick={() => handleSimulateAction('click', 'A')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg transition-all"
            >
              +1 Click A
            </button>
            <button
              onClick={() => handleSimulateAction('click', 'B')}
              className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-brand text-xs font-bold rounded-lg transition-all"
            >
              +1 Click B
            </button>
          </div>
        </div>
      )}

      {/* Comparison Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Variant A Detail */}
        <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-extrabold text-[10px] rounded-lg">
              {t('BIẾN THỂ A')}
            </span>
            <span className="text-xs font-mono text-slate-400">
              CTR: {(stats.crA * 100).toFixed(2)}%
            </span>
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              {isLp ? test.landingPageA?.title : test.templateA?.title || t('Không rõ')}
            </h4>
            {isLp && test.landingPageA && (
              <span className="text-xs text-slate-400 font-mono block mt-1">
                Slug: {test.landingPageA.slug}
              </span>
            )}
          </div>
          {!isLp && test.templateA?.content && (
            <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
              {test.templateA.content}
            </div>
          )}
          {test.status === 'RUNNING' && (
            <button
              disabled={submitting}
              onClick={() => handleSelectWinner('A')}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
            >
              🏆 {t('Chọn làm Biến thể Chiến thắng')} (A)
            </button>
          )}
        </div>

        {/* Variant B Detail */}
        <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="px-2.5 py-0.5 bg-orange-50 text-brand font-extrabold text-[10px] rounded-lg">
              {t('BIẾN THỂ B')}
            </span>
            <span className="text-xs font-mono text-slate-400">
              CTR: {(stats.crB * 100).toFixed(2)}%
            </span>
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">
              {isLp ? test.landingPageB?.title : test.templateB?.title || t('Không rõ')}
            </h4>
            {isLp && test.landingPageB && (
              <span className="text-xs text-slate-400 font-mono block mt-1">
                Slug: {test.landingPageB.slug}
              </span>
            )}
          </div>
          {!isLp && test.templateB?.content && (
            <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
              {test.templateB.content}
            </div>
          )}
          {test.status === 'RUNNING' && (
            <button
              disabled={submitting}
              onClick={() => handleSelectWinner('B')}
              className="w-full py-2 bg-brand hover:bg-[#e04f1a] text-white font-bold text-xs rounded-xl transition-all shadow-sm"
            >
              🏆 {t('Chọn làm Biến thể Chiến thắng')} (B)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
