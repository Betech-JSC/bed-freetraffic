'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type CmoTask = {
  task: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  actionPath: string;
  actionLabel: string;
};

type CmoReport = {
  performanceReview: string;
  growthOpportunities: string;
  recommendedTasks: CmoTask[];
  stats: {
    totalTraffic: number;
    avgBounceRate: number;
    totalLeads: number;
    newLeads7Days: number;
    leadMagnetLeads: number;
    listeningLogsScanned: number;
    listeningLogsHot: number;
    emailsSent: number;
    emailsOpened: number;
    seoKeywordsCount: number;
    totalOrders: number;
    totalRevenue: number;
  };
};

const priorityStyles = {
  high: 'bg-rose-50 text-rose-700 border-rose-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low: 'bg-slate-50 text-slate-600 border-slate-100',
};

export default function InsightsPage() {
  const { t } = useLocale();
  const [report, setReport] = useState<CmoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<CmoReport>('/insights/cmo');
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải báo cáo AI CMO');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex justify-between items-center border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>AI CMO Strategic Dashboard</span>
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                Live Analysis
              </span>
            </h1>
            <p className="text-gray-500 text-sm">Đang thu thập dữ liệu & phân tích các chỉ số từ hệ thống...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-gray-100 p-5 rounded-2xl animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 animate-pulse h-48"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12 text-center py-12">
        <div className="inline-flex p-4 bg-rose-50 rounded-full text-rose-500 mb-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-950">Không thể tải báo cáo AI CMO</h2>
        <p className="text-gray-500 max-w-md mx-auto text-sm">{error || 'Đã có lỗi xảy ra'}</p>
        <button
          onClick={loadReport}
          className="mt-4 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  const s = report.stats;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>AI CMO Strategic Dashboard</span>
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
              Live Analysis
            </span>
          </h1>
          <p className="text-gray-500 mt-1">
            Bảng điều hành phân tích chiến lược của Giám đốc Marketing AI dựa trên các chỉ số thực tế trong tuần qua.
          </p>
        </div>
        <button
          onClick={loadReport}
          className="py-2.5 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
          </svg>
          <span>Làm mới phân tích</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1: Traffic & SEO */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lưu lượng & SEO</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-gray-950">{s.totalTraffic.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">Sessions trong 7 ngày qua</div>
          </div>
          <div className="pt-2 border-t border-gray-50 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
            <div>
              <span className="font-semibold text-gray-700">Tỷ lệ thoát:</span> {s.avgBounceRate.toFixed(1)}%
            </div>
            <div>
              <span className="font-semibold text-gray-700">SEO Keywords:</span> {s.seoKeywordsCount}
            </div>
          </div>
        </div>

        {/* Card 2: CRM & Leads */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">CRM & Leads</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-gray-950">{s.totalLeads.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">Tổng khách hàng hệ thống</div>
          </div>
          <div className="pt-2 border-t border-gray-50 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
            <div>
              <span className="font-semibold text-emerald-600">Mới (7d):</span> +{s.newLeads7Days}
            </div>
            <div>
              <span className="font-semibold text-gray-700">Lead Magnet:</span> {s.leadMagnetLeads}
            </div>
          </div>
        </div>

        {/* Card 3: Social Listening */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Social Listening</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-gray-950">{s.listeningLogsScanned.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">Tin đăng quét được (7d)</div>
          </div>
          <div className="pt-2 border-t border-gray-50 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
            <div>
              <span className="font-semibold text-rose-600">HOT Leads:</span> {s.listeningLogsHot}
            </div>
            <div>
              <span className="font-semibold text-gray-700">Tỉ lệ HOT:</span> {s.listeningLogsScanned > 0 ? ((s.listeningLogsHot / s.listeningLogsScanned) * 100).toFixed(0) : 0}%
            </div>
          </div>
        </div>

        {/* Card 4: Sales & Revenue */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doanh thu & Bán hàng</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-955">{s.totalRevenue.toLocaleString('vi-VN')} VNĐ</div>
            <div className="text-xs text-gray-500 font-medium mt-1">Doanh số phễu AI tự động</div>
          </div>
          <div className="pt-2 border-t border-gray-50 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
            <div>
              <span className="font-semibold text-gray-700">Đơn hàng:</span> {s.totalOrders}
            </div>
            <div>
              <span className="font-semibold text-gray-700">AOV:</span> {s.totalOrders > 0 ? (s.totalRevenue / s.totalOrders).toLocaleString('vi-VN') : 0} đ
            </div>
          </div>
        </div>
      </div>

      {/* AI CMO Report Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-gray-955 text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-6 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            🪄
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Nhận định từ Giám đốc Marketing AI</h2>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">CMO Strategic Review</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
          {/* Section 1: Performance Review */}
          <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
              <span>Đánh giá sức khỏe chiến dịch</span>
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-light whitespace-pre-wrap">
              {report.performanceReview || 'Hệ thống đang thu thập dữ liệu tổng quan...'}
            </p>
          </div>

          {/* Section 2: Growth Opportunities */}
          <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              <span>Định hướng tăng trưởng nhanh</span>
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-light whitespace-pre-wrap">
              {report.growthOpportunities || 'Cơ hội tăng trưởng đang được tính toán từ các điểm nghẽn.'}
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Tasks Section */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-gray-900 uppercase tracking-wider">📋 Đề xuất nhiệm vụ từ AI CMO</h3>
        <p className="text-gray-500 text-xs mt-0.5">
          Các công việc có mức độ ưu tiên cao nhất được AI sắp xếp để cải thiện hiệu suất phễu chuyển đổi và tối ưu hóa traffic.
        </p>

        <div className="space-y-4">
          {report.recommendedTasks.map((t, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-gray-200 transition-colors">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${priorityStyles[t.priority] || ''}`}>
                    {t.priority === 'high' ? 'Khẩn cấp' : t.priority === 'medium' ? 'Trung bình' : 'Khuyến nghị'}
                  </span>
                  <span className="text-xs font-bold text-gray-400 font-mono">TASK #{idx + 1}</span>
                </div>
                <h4 className="text-sm font-bold text-gray-950">{t.task}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{t.reason}</p>
              </div>

              {t.actionPath && (
                <Link
                  href={t.actionPath}
                  className="py-2 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer text-center w-full md:w-auto"
                >
                  {t.actionLabel || 'Thao tác ngay'}
                </Link>
              )}
            </div>
          ))}

          {report.recommendedTasks.length === 0 && (
            <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl text-gray-400 text-xs">
              Mọi hoạt động của hệ thống đang hoạt động tối ưu. AI chưa phát hiện thêm đề xuất mới nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
