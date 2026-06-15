'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { apiJson, apiUrl } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

type Customer = {
  id: number;
  name: string;
  email: string;
  pointsBalance: number;
  referralCode: string;
};

type ReferredFriend = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

type RedeemableProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  pointsRequired: number;
};

type Redemption = {
  id: number;
  productId: number;
  productName: string;
  pointsSpent: number;
  downloadToken: string;
  createdAt: string;
};

type PortalDataResponse = {
  customer: Customer;
  referrals: ReferredFriend[];
  products: RedeemableProduct[];
  redemptions: Redemption[];
};

function PortalContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') || '1';

  // Session state
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [referrals, setReferrals] = useState<ReferredFriend[]>([]);
  const [products, setProducts] = useState<RedeemableProduct[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  
  // Login states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  
  // UX states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('customer_portal_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Fetch portal data when token is available
  const fetchPortalData = async (activeToken: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<PortalDataResponse>('/referrals/public/portal-data', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      setCustomer(data.customer);
      setReferrals(data.referrals);
      setProducts(data.products);
      setRedemptions(data.redemptions);
    } catch (err: any) {
      setError(err.message || 'Phiên làm việc hết hạn hoặc không tìm thấy dữ liệu.');
      // clear invalid token
      localStorage.removeItem('customer_portal_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortalData(token);
    }
  }, [token]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setDebugOtp(null);

    try {
      const res = await apiJson<{ message: string; otp?: string }>('/referrals/public/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), workspaceId }),
      });
      setOtpSent(true);
      setSuccess(res.message);
      if (res.otp) {
        setDebugOtp(res.otp); // Show in UI for development testing convenience
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi gửi mã xác thực OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await apiJson<{ token: string; customer: Customer }>('/referrals/public/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), workspaceId }),
      });
      
      localStorage.setItem('customer_portal_token', res.token);
      setToken(res.token);
      setSuccess('Đăng nhập thành công!');
    } catch (err: any) {
      setError(err.message || 'Mã OTP không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (productId: number) => {
    if (!token) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiJson<{ message: string; newPointsBalance: number; redemption: Redemption }>('/referrals/public/redeem', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId }),
      });

      setSuccess(res.message);
      // Reload stats
      fetchPortalData(token);
    } catch (err: any) {
      setError(err.message || 'Lỗi quy đổi phần quà.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_portal_token');
    setToken(null);
    setCustomer(null);
    setReferrals([]);
    setProducts([]);
    setRedemptions([]);
    setOtpSent(false);
    setEmail('');
    setOtp('');
    setSuccess('');
    setError('');
  };

  const getReferralLink = (code: string) => {
    // Generates public tracking redirection URL
    return apiUrl(`/referrals/public/ref/${code}`);
  };

  const copyReferralLink = () => {
    if (!customer) return;
    navigator.clipboard.writeText(getReferralLink(customer.referralCode));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Auth screen
  if (!token || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-150 w-full max-w-md p-8 rounded-2xl shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Cổng Thông Tin Đổi Thưởng</h1>
            <p className="text-sm text-gray-500">Nhập email của bạn để tra cứu điểm giới thiệu và nhận quà tặng số.</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs">
              {success}
            </div>
          )}

          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Hòm thư Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>Gửi mã OTP qua email</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Mã OTP (6 chữ số)</label>
                <input
                  type="text"
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-center font-mono letter-spacing-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>

              {debugOtp && (
                <div className="p-3 bg-amber-50 border border-amber-250 text-amber-800 rounded-xl text-xs font-mono text-center">
                  [DEV MODE] OTP: {debugOtp}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>Xác minh OTP & Đăng nhập</span>
              </button>

              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-900 transition-colors py-1"
              >
                Quay lại nhập email
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Dashboard screen (logged in)
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-150 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">G</div>
          <span className="font-bold text-gray-950 text-base">Growth OS Portal</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-500 hidden sm:inline">{customer.email}</span>
          <button
            onClick={handleLogout}
            className="py-1.5 px-3 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-900 transition-all bg-white"
          >
            Đăng xuất
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 md:px-8 mt-10 space-y-8">
        {/* Welcome block */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold">Xin chào, {customer.name}!</h2>
            <p className="text-gray-400 text-xs md:text-sm">Chia sẻ liên kết giới thiệu để mời bạn bè nhận tài liệu và tích lũy điểm thưởng đổi quà.</p>
          </div>
          <div className="bg-white/10 px-6 py-4 rounded-2xl backdrop-blur-md text-center shrink-0 border border-white/5 min-w-[150px]">
            <span className="text-xs uppercase font-semibold text-gray-300 tracking-wider">Số điểm của bạn</span>
            <div className="text-3xl font-extrabold text-amber-400 mt-1">{customer.pointsBalance} pts</div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs">
            {success}
          </div>
        )}

        {/* Share Section */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Liên kết giới thiệu độc quyền của bạn</h3>
            <p className="text-xs text-gray-400 mt-0.5">Với mỗi người bạn đăng ký qua liên kết này, bạn nhận ngay <strong className="text-green-600">+100 điểm</strong>.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              readOnly
              value={getReferralLink(customer.referralCode)}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-600 focus:outline-none"
            />
            <button
              onClick={copyReferralLink}
              className="py-3 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0"
            >
              {copiedLink ? 'Đã sao chép!' : 'Sao chép liên kết'}
            </button>
          </div>
        </div>

        {/* Two column layout: redeemable gifts + referrals logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Redeem gifts */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Danh sách quà tặng số của bạn</h3>
              <span className="text-xs text-gray-400">Chi phí: 500 điểm / quà tặng</span>
            </div>

            {products.length === 0 ? (
              <div className="p-8 text-center text-gray-400 bg-white border border-gray-150 rounded-2xl text-sm">
                Chưa có phần thưởng nào được thiết lập trong hệ thống.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((product) => {
                  const pointsRequired = product.pointsRequired || 500;
                  const canRedeem = customer.pointsBalance >= pointsRequired;
                  const alreadyRedeemed = redemptions.find(r => r.productId === product.id);

                  return (
                    <div key={product.id} className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {pointsRequired} pts
                        </span>
                        <h4 className="font-bold text-gray-950 text-sm mt-2">{product.name}</h4>
                        <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{product.description || 'Không có mô tả chi tiết.'}</p>
                      </div>

                      {alreadyRedeemed ? (
                        <a
                          href={apiUrl(`/referrals/public/download/${alreadyRedeemed.downloadToken}`)}
                          download
                          className="w-full py-2 px-3 bg-green-550 hover:bg-green-600 bg-green-600 text-white rounded-xl text-xs font-semibold text-center transition-all shadow-sm"
                        >
                          Tải xuống tài liệu
                        </a>
                      ) : (
                        <button
                          onClick={() => handleRedeem(product.id)}
                          disabled={!canRedeem || actionLoading}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                            canRedeem
                              ? 'bg-gray-950 hover:bg-gray-800 text-white cursor-pointer'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Đổi quà tặng
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Friends referred list */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Bạn bè đã giới thiệu</h3>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {referrals.length} bạn bè
              </span>
            </div>

            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm">
              {referrals.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  Bạn chưa giới thiệu người bạn nào đăng ký. Hãy chia sẻ đường dẫn bên trên nhé!
                </div>
              ) : (
                <div className="divide-y divide-gray-100 text-xs text-gray-700 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {referrals.map((friend) => (
                    <div key={friend.id} className="p-4 flex justify-between items-center hover:bg-gray-50/50">
                      <div>
                        <div className="font-semibold text-gray-900">{friend.name}</div>
                        <div className="text-[10px] text-gray-400">{friend.email}</div>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(friend.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Redemptions list */}
            {redemptions.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-base font-bold text-gray-900">Quà tặng đã đổi</h3>
                </div>
                <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100 text-xs text-gray-700">
                  {redemptions.map((red) => (
                    <div key={red.id} className="p-4 flex justify-between items-center hover:bg-gray-50/50">
                      <div>
                        <div className="font-semibold text-gray-900">{red.productName}</div>
                        <div className="text-[10px] text-gray-400">Đã tiêu tốn {red.pointsSpent} pts</div>
                      </div>
                      <a
                        href={apiUrl(`/referrals/public/download/${red.downloadToken}`)}
                        download
                        className="p-1 px-2.5 border border-green-250 bg-green-50 text-green-700 rounded-lg font-medium text-[10px] transition-all hover:bg-green-100"
                      >
                        Tải lại
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Đang tải trang...</div>}>
      <PortalContent />
    </Suspense>
  );
}
