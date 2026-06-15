'use client';

import React, { useState, useEffect } from 'react';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type TopReferrer = {
  id: number;
  name: string;
  email: string;
  pointsBalance: number;
  referralCode: string;
  createdAt: string;
  _count: {
    referrals: number;
  };
};

type RecentRedemption = {
  id: number;
  customerId: number;
  customer: {
    name: string;
    email: string;
  };
  product: {
    name: string;
    price: number;
  };
  pointsSpent: number;
  downloadToken: string;
  createdAt: string;
};

type ReferralStats = {
  topReferrers: TopReferrer[];
  recentRedemptions: RecentRedemption[];
  config: {
    pointsPerSignup: number;
    pointsPerRedemption: number;
  };
};

export default function ReferralsDashboardPage() {
  const { t } = useLocale();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [workspaceId, setWorkspaceId] = useState('1');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedId = localStorage.getItem('workspaceId');
    if (savedId) {
      setWorkspaceId(savedId);
    }
  }, []);

  // Build the public portal link
  const portalUrl = isMounted
    ? `${window.location.protocol}//${window.location.host}/public/portal?workspaceId=${workspaceId}`
    : `/public/portal?workspaceId=${workspaceId}`;

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<ReferralStats>('/referrals/stats');
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu tiếp thị lan truyền');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Metrics calculators
  const totalReferrals = stats?.topReferrers.reduce((acc, curr) => acc + curr._count.referrals, 0) || 0;
  const activeReferrersCount = stats?.topReferrers.length || 0;
  const totalRedemptionsCount = stats?.recentRedemptions.length || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Viral Referral Loops</h1>
        <p className="text-gray-500 mt-1">
          Thiết lập chiến dịch tiếp thị lan truyền bằng cách tặng điểm cho khách hàng giới thiệu bạn bè đăng ký Lead Magnet.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng số lượt giới thiệu</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-gray-950">{totalReferrals}</span>
            <span className="text-xs text-green-600 font-medium">Bạn bè đăng ký</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Khách hàng lan truyền tích cực</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-gray-950">{activeReferrersCount}</span>
            <span className="text-xs text-amber-600 font-medium">Đã tích lũy điểm</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Giao dịch quy đổi quà tặng</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-gray-950">{totalRedemptionsCount}</span>
            <span className="text-xs text-blue-600 font-medium">Tải xuống thành công</span>
          </div>
        </div>
      </div>

      {/* Main layout: stats lists + setting card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column - Referrers & Redemptions */}
        <div className="lg:col-span-8 space-y-8">
          {/* Top Referrers list */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-150 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Bảng xếp hạng khách hàng lan truyền</h2>
              <button 
                onClick={loadStats}
                className="p-1 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5M4 4a9 9 0 0115.356-2" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400 animate-pulse">Đang tải bảng xếp hạng...</div>
            ) : !stats || stats.topReferrers.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Chưa có khách hàng tham gia chiến dịch giới thiệu.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-3">Khách hàng</th>
                      <th className="px-6 py-3">Mã giới thiệu</th>
                      <th className="px-6 py-3">Lượt đăng ký mới</th>
                      <th className="px-6 py-3 text-right">Điểm tích lũy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {stats.topReferrers.map((referrer) => (
                      <tr key={referrer.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{referrer.name}</div>
                          <div className="text-xs text-gray-400">{referrer.email}</div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-xs text-amber-600">{referrer.referralCode}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{referrer._count.referrals} bạn bè</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-950">{referrer.pointsBalance} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Redemptions list */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-150">
              <h2 className="text-base font-bold text-gray-900">Lịch sử quy đổi phần thưởng gần đây</h2>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400 animate-pulse">Đang tải lịch sử...</div>
            ) : !stats || stats.recentRedemptions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Chưa có giao dịch đổi thưởng nào được thực hiện.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-3">Người đổi</th>
                      <th className="px-6 py-3">Sản phẩm kỹ thuật số</th>
                      <th className="px-6 py-3">Mã tải xuống</th>
                      <th className="px-6 py-3 text-right">Điểm tiêu tốn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {stats.recentRedemptions.map((redemption) => (
                      <tr key={redemption.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{redemption.customer.name}</div>
                          <div className="text-xs text-gray-400">{redemption.customer.email}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{redemption.product.name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{redemption.downloadToken.slice(0, 8)}...</td>
                        <td className="px-6 py-4 text-right font-semibold text-rose-600">-{redemption.pointsSpent} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Configurations & Portal link */}
        <div className="lg:col-span-4 space-y-6">
          {/* Config card */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
            <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">Cấu hình điểm số</h3>

            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500">Giới thiệu 1 bạn bè mới</span>
                <span className="font-semibold text-green-600">+100 điểm</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-500">Chi phí quy đổi quà tặng</span>
                <span className="font-semibold text-rose-600">-500 điểm / sản phẩm</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Yêu cầu đăng nhập OTP</span>
                <span className="font-semibold text-gray-900">Email OTP</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 leading-relaxed">
              <strong>Mẹo vận hành:</strong> Hãy tặng các sản phẩm Lead Magnet độc quyền như Ebook, Tài liệu hướng dẫn, hoặc Khóa học online để tạo động lực lan truyền lớn nhất.
            </div>
          </div>

          {/* Public link share card */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Cổng phần thưởng của khách hàng</h3>
              <p className="text-xs text-gray-400 mt-1">Cung cấp đường dẫn này cho khách hàng để họ tự kiểm tra điểm và đổi quà tặng.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-gray-500 truncate max-w-[180px]">{portalUrl}</span>
              <button
                onClick={copyPortalLink}
                className="shrink-0 p-1.5 bg-white border border-gray-200 hover:border-gray-300 hover:text-gray-900 rounded-lg text-xs font-medium text-gray-600 transition-all shadow-sm"
              >
                {copiedLink ? 'Đã sao chép!' : 'Sao chép'}
              </button>
            </div>

            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold text-center transition-all shadow-sm"
            >
              Xem Cổng phần thưởng công khai
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
