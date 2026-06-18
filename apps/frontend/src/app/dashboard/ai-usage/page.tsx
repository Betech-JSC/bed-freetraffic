'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

interface UsageStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCalls: number;
  totalCostUsd: number;
  totalCostVnd: number;
}

interface ModelBreakdownItem {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  costUsd: number;
  costVnd: number;
}

interface FeatureBreakdownItem {
  feature: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  costUsd: number;
  costVnd: number;
}

interface DailyUsageItem {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  costUsd: number;
}

interface AiUsageReport {
  stats: UsageStats;
  modelBreakdown: ModelBreakdownItem[];
  featureBreakdown: FeatureBreakdownItem[];
  dailyUsage: DailyUsageItem[];
}

const FEATURE_LABELS: Record<string, string> = {
  content_generation: 'AI Content Copilot',
  rag_embedding: 'Tri thức RAG (AI)',
  chatbot: 'AI Chatbot CSKH',
  lead_qualifier: 'AI Phân loại Lead',
  onboarding: 'AI Onboarding',
  unknown: 'Khác / API Test',
};

const FEATURE_COLORS: Record<string, string> = {
  content_generation: 'bg-brand',
  rag_embedding: 'bg-blue-500',
  chatbot: 'bg-emerald-500',
  lead_qualifier: 'bg-indigo-500',
  onboarding: 'bg-amber-500',
  unknown: 'bg-slate-400',
};

export default function AiUsagePage() {
  const { t } = useLocale();
  const [report, setReport] = useState<AiUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<AiUsageReport>('/dashboard/ai-usage')
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || 'Không thể tải báo cáo sử dụng Model AI.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm font-semibold">
        <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin mr-2" />
        Đang tải báo cáo sử dụng Model AI...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="page-container text-center py-12">
        <p className="text-red-500 font-semibold">{error || 'Đã có lỗi xảy ra.'}</p>
      </div>
    );
  }

  const { stats, modelBreakdown, featureBreakdown, dailyUsage } = report;

  // Format numbers to local string
  const fmt = (num: number) => num.toLocaleString('vi-VN');

  // Format currency
  const formatUsd = (usd: number) => {
    if (usd === 0) return '$0.00';
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
  };

  const formatVnd = (vnd: number) => {
    if (vnd === 0) return '0đ';
    return `${vnd.toLocaleString('vi-VN')}đ`;
  };

  // Find most active model
  const activeModel = modelBreakdown.length > 0 
    ? [...modelBreakdown].sort((a, b) => b.totalTokens - a.totalTokens)[0].model 
    : 'Chưa có';

  // Format short date for chart (e.g. 2026-06-17 -> 17/06)
  const chartData = dailyUsage.map(d => {
    const parts = d.date.split('-');
    return {
      ...d,
      name: parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date,
    };
  });

  return (
    <div className="space-y-8 page-container text-slate-800 max-w-7xl mx-auto">
      {/* Upper Title Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50/70 via-white to-orange-50/30 border border-slate-200/80 p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-brand/5 rounded-full blur-3xl" />
        <div className="relative z-10 text-slate-800">
          <PageHeader
            title="Thống kê Sử dụng Model AI"
            description="Báo cáo chi tiết lượng token tiêu thụ, số lượt gọi API và chi phí ước tính của các mô hình AI tích hợp."
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Tổng số Token', value: fmt(stats.totalTokens), desc: `Input: ${fmt(stats.totalPromptTokens)} | Output: ${fmt(stats.totalCompletionTokens)}`, color: 'text-brand' },
          { label: 'Chi phí ước tính', value: formatUsd(stats.totalCostUsd), desc: `~ ${formatVnd(stats.totalCostVnd)}`, color: 'text-emerald-600' },
          { label: 'Tổng lượt gọi API', value: fmt(stats.totalCalls), desc: 'Độ trễ trung bình ~1.8s', color: 'text-indigo-600' },
          { label: 'Model dùng nhiều nhất', value: activeModel, desc: 'Dựa trên tổng token tiêu thụ', color: 'text-slate-800' }
        ].map((card, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
              <p className={`text-2xl font-extrabold mt-2 ${card.color} truncate`}>{card.value}</p>
            </div>
            <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 font-medium leading-relaxed">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Main Graph Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-6">Xu hướng tiêu thụ Token (30 ngày qua)</h3>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrompt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="promptTokens" name="Input Tokens" stroke="#f97316" fillOpacity={1} fill="url(#colorPrompt)" strokeWidth={2} />
              <Area type="monotone" dataKey="completionTokens" name="Output Tokens" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCompletion)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdowns section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Model Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Thống kê theo dòng Model</h3>
            <p className="text-xs text-slate-500 mt-1">Đo lường phân bổ token và chi phí giữa các dòng Model AI</p>
          </div>

          <div className="space-y-4">
            {modelBreakdown.map((item, idx) => {
              const percent = stats.totalTokens > 0 ? (item.totalTokens / stats.totalTokens) * 100 : 0;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-800">{item.model}</span>
                    <span>{percent.toFixed(1)}% ({fmt(item.totalTokens)} tkn)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                    <span>Số cuộc gọi: {fmt(item.calls)}</span>
                    <span className="font-semibold text-emerald-600">Ước tính: {formatUsd(item.costUsd)} (~{formatVnd(item.costVnd)})</span>
                  </div>
                </div>
              );
            })}
            {modelBreakdown.length === 0 && (
              <p className="text-sm text-slate-400 italic">Chưa có dữ liệu cuộc gọi AI.</p>
            )}
          </div>
        </div>

        {/* Feature Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Thống kê theo tính năng hệ thống</h3>
            <p className="text-xs text-slate-500 mt-1">Theo dõi lượng token tiêu thụ theo từng nghiệp vụ kinh doanh</p>
          </div>

          <div className="space-y-4">
            {featureBreakdown.map((item, idx) => {
              const percent = stats.totalTokens > 0 ? (item.totalTokens / stats.totalTokens) * 100 : 0;
              const label = FEATURE_LABELS[item.feature] || item.feature;
              const colorClass = FEATURE_COLORS[item.feature] || 'bg-brand';
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                      {label}
                    </span>
                    <span>{percent.toFixed(1)}% ({fmt(item.totalTokens)} tkn)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`${colorClass} h-full rounded-full transition-all duration-500`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                    <span>Số cuộc gọi: {fmt(item.calls)}</span>
                    <span className="font-semibold text-emerald-600">Ước tính: {formatUsd(item.costUsd)}</span>
                  </div>
                </div>
              );
            })}
            {featureBreakdown.length === 0 && (
              <p className="text-sm text-slate-400 italic">Chưa có dữ liệu cuộc gọi AI.</p>
            )}
          </div>
        </div>

      </div>

      {/* Model price guides table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">Bảng giá tham chiếu hệ thống</h3>
          <p className="text-xs text-slate-505 mt-0.5">Biểu giá ước tính trên 1.000.000 tokens của các dòng Model AI thông dụng</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                <th className="py-2.5 px-4 font-bold">Mô hình AI (Model)</th>
                <th className="py-2.5 px-4 font-bold">Giá Prompt (Đầu vào) / 1M tkn</th>
                <th className="py-2.5 px-4 font-bold">Giá Completion (Đầu ra) / 1M tkn</th>
                <th className="py-2.5 px-4 font-bold">Nhà cung cấp / Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[
                { name: 'gpt-4o-mini', input: '$0.150', output: '$0.600', provider: 'OpenAI / Trợ lý nhanh' },
                { name: 'gpt-4o', input: '$2.500', output: '$10.000', provider: 'OpenAI / Trí tuệ cao' },
                { name: 'gemini-2.5-flash', input: '$0.075', output: '$0.300', provider: 'Google Gemini / Trợ lý nhanh' },
                { name: 'deepseek-v4-flash', input: '$0.140', output: '$0.280', provider: 'DeepSeek / Tối ưu chi phí (Flash)' },
                { name: 'deepseek-chat', input: '$0.140', output: '$0.280', provider: 'DeepSeek / Legacy alias' },
                { name: 'text-embedding-3-small', input: '$0.020', output: '—', provider: 'OpenAI / Vector Embeddings' },
                { name: 'gemini-embedding-001', input: '$0.020', output: '—', provider: 'Google Gemini / Vector Embeddings' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 font-medium">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.name}</td>
                  <td className="py-3 px-4 text-slate-600">{row.input}</td>
                  <td className="py-3 px-4 text-slate-600">{row.output}</td>
                  <td className="py-3 px-4 text-slate-400 font-semibold">{row.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
