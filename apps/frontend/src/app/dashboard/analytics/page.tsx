'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type AnalyticsData = {
  summary: {
    successRate: number;
    runningBots: number;
    totalBots: number;
    connectedPlatforms: number;
  };
  connections: { platform: string; pageName: string | null; status: string }[];
  tasks: { id: number; name: string; status: string }[];
  recentLogs: { id: number; message: string; status: string; createdAt: string; task?: { name: string } }[];
  chartData: { name: string; success: number; error: number }[];
};

const emptyAnalytics: AnalyticsData = {
  summary: { successRate: 0, runningBots: 0, totalBots: 0, connectedPlatforms: 0 },
  connections: [],
  tasks: [],
  recentLogs: [],
  chartData: [
    { name: 'Facebook', success: 0, error: 0 },
    { name: 'Email', success: 0, error: 0 },
    { name: 'Zalo', success: 0, error: 0 },
  ],
};

export default function AnalyticsPage() {
  const { t } = useLocale();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<AnalyticsData>('/analytics')
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : t('Không tải được dữ liệu phân tích'));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm font-semibold">
        Đang tải phân tích...
      </div>
    );
  }

  if (error && !data) {
    return <p className="text-gray-500">{error}</p>;
  }

  const { summary, connections, tasks, recentLogs, chartData } = data ?? emptyAnalytics;

  return (
    <div className="page-container">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1.5">{t('Thống kê hiệu suất Bot và trạng thái tích hợp')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: t('Tỷ lệ thành công Bot'), value: `${summary.successRate}%`, icon: 'OK' },
          { label: t('Bot đang chạy'), value: summary.runningBots, icon: 'BOT' },
          { label: t('Tổng chiến dịch'), value: summary.totalBots, icon: 'CAM' },
          { label: t('Kênh đã kết nối'), value: summary.connectedPlatforms, icon: 'CON' },
        ].map(card => (
          <div key={card.label} className="stat-card">
            <div className="text-xs font-black text-brand bg-brand/10 w-fit px-2 py-0.5 rounded mb-3">{card.icon}</div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-bold text-brand mb-6">{t('Kết quả theo nền tảng')}</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" name={t('Thành công')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="error" name={t('Lỗi')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-bold text-brand mb-4">{t('Trạng thái tích hợp')}</h3>
          <div className="space-y-3">
            {connections.length === 0 && (
              <p className="text-sm text-gray-400">{t('Chưa có kết nối nào. Vào Settings để liên kết.')}</p>
            )}
            {connections.map((c: any, idx: number) => (
              <div key={`${c.platform}-${idx}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-800 capitalize">{c.platform}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  c.status === 'CONNECTED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {c.status === 'CONNECTED' ? (c.pageName || 'Connected') : t('Chưa kết nối')}
                </span>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-bold text-brand mt-8 mb-4">{t('Chiến dịch Bot')}</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tasks.map((task: any) => (
              <div key={task.id} className="flex justify-between text-sm py-1.5">
                <span className="font-medium text-gray-700 truncate pr-2">{task.name}</span>
                <span className={`shrink-0 text-xs font-bold ${task.status === 'RUNNING' ? 'text-green-600' : 'text-gray-400'}`}>
                  {task.status === 'RUNNING' ? t('Đang chạy') : t('Đã dừng')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-brand">{t('Nhật ký Bot gần đây')}</h3>
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {recentLogs.length === 0 && (
            <p className="p-8 text-center text-gray-400 text-sm">{t('Chưa có log nào. Bật một Bot để bắt đầu.')}</p>
          )}
          {recentLogs.map((log: any) => (
            <div key={log.id} className="px-6 py-3 flex gap-4 items-start text-sm">
              <span className="text-gray-400 shrink-0 font-mono text-xs">
                {new Date(log.createdAt).toLocaleString('vi-VN')}
              </span>
              <span className="font-medium text-purple-600 shrink-0">[{log.task?.name}]</span>
              <span className={log.status === 'SUCCESS' ? 'text-green-600' : 'text-red-500'}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
