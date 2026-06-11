'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiUrl } from '@/lib/api';

interface MockAccount {
  id: string;
  name: string;
  email: string;
  avatarLetter: string;
}

interface MockPage {
  id: string;
  name: string;
  category: string;
}

function MockOAuthSandboxInner() {
  const searchParams = useSearchParams();
  const platform = (searchParams.get('platform') || 'google').toLowerCase();
  const action = searchParams.get('action') || 'login';
  const state = searchParams.get('state') || 'login_0';
  
  const [selectedAccount, setSelectedAccount] = useState<string>('1');
  const [selectedPage, setSelectedPage] = useState<string>('1');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const mockAccounts: Record<string, MockAccount[]> = {
    google: [
      { id: '1', name: 'Nguyễn Văn A (Google)', email: 'nguyenvana.google@gmail.com', avatarLetter: 'G1' },
      { id: '2', name: 'Trần Thị B (Google)', email: 'tranthib.google@gmail.com', avatarLetter: 'G2' }
    ],
    facebook: [
      { id: '1', name: 'Lê Văn C (Facebook)', email: 'levanc.facebook@gmail.com', avatarLetter: 'F1' },
      { id: '2', name: 'Phạm Thị D (Facebook)', email: 'phamthid.facebook@gmail.com', avatarLetter: 'F2' }
    ],
    zalo: [
      { id: '1', name: 'Zalo User Việt Nam', email: 'zalo.vietnam@zalo.betraffic.com', avatarLetter: 'Z1' },
      { id: '2', name: 'Khách hàng Zalo Demo', email: 'zalo.demo@zalo.betraffic.com', avatarLetter: 'Z2' }
    ],
    tiktokshop: [
      { id: '1', name: 'TikTok Shop Store A', email: 'storeA.tiktokshop@gmail.com', avatarLetter: 'TS1' },
      { id: '2', name: 'TikTok Shop Store B', email: 'storeB.tiktokshop@gmail.com', avatarLetter: 'TS2' }
    ],
    tiktok: [
      { id: '1', name: 'TikTok Creator Channel A', email: 'creatorA.tiktok@gmail.com', avatarLetter: 'TC1' },
      { id: '2', name: 'TikTok Creator Channel B', email: 'creatorB.tiktok@gmail.com', avatarLetter: 'TC2' }
    ]
  };

  const mockPages: Record<string, MockPage[]> = {
    facebook: [
      { id: 'fb_page_1', name: 'Page Đồ ăn vặt Hà Nội (Mock Fanpage)', category: 'Ẩm thực & Nhà hàng' },
      { id: 'fb_page_2', name: 'Page Nông sản sạch miền Tây (Mock Fanpage)', category: 'Mua sắm & Bán lẻ' }
    ],
    zalo: [
      { id: 'zalo_oa_1', name: 'Zalo OA Cửa hàng Mật Ong Rừng (Mock OA)', category: 'Sức khỏe & Sắc đẹp' },
      { id: 'zalo_oa_2', name: 'Zalo OA Thời trang công sở (Mock OA)', category: 'Cửa hàng quần áo' }
    ],
    tiktokshop: [
      { id: 'tiktok_shop_1', name: 'Cửa hàng Mỹ phẩm TikTok Shop A (Mock Shop)', category: 'Thời trang & Mỹ phẩm' },
      { id: 'tiktok_shop_2', name: 'Cửa hàng Đồ gia dụng TikTok Shop B (Mock Shop)', category: 'Gia dụng & Tiện ích' }
    ],
    tiktok: [
      { id: 'tiktok_creator_1', name: 'Kênh TikTok Review Công nghệ A (Mock Channel)', category: 'Media & Review' },
      { id: 'tiktok_creator_2', name: 'Kênh TikTok Vlogs Ẩm thực B (Mock Channel)', category: 'Giải trí & Vlogs' }
    ]
  };

  const currentAccounts = mockAccounts[platform] || mockAccounts.google;
  const currentPages = mockPages[platform] || [];

  const getBrandDetails = () => {
    switch (platform) {
      case 'facebook':
        return {
          name: 'Facebook',
          color: '#1877F2',
          bgColor: 'bg-[#1877F2]',
          logo: '📘',
          scopes: ['public_profile', 'email', 'pages_manage_posts']
        };
      case 'zalo':
        return {
          name: 'Zalo',
          color: '#0068FF',
          bgColor: 'bg-[#0068FF]',
          logo: '💬',
          scopes: ['oa_profile', 'send_message', 'manage_content']
        };
      case 'tiktokshop':
        return {
          name: 'TikTok Shop',
          color: '#010101',
          bgColor: 'bg-[#010101]',
          logo: '🛍️',
          scopes: ['orders.read', 'products.read', 'shop.info.read']
        };
      case 'tiktok':
        return {
          name: 'TikTok Creator',
          color: '#010101',
          bgColor: 'bg-[#010101]',
          logo: '🎵',
          scopes: ['user.info.profile', 'video.upload']
        };
      default:
        return {
          name: 'Google',
          color: '#EA4335',
          bgColor: 'bg-[#EA4335]',
          logo: '🔴',
          scopes: ['openid', 'email', 'profile']
        };
    }
  };

  const brand = getBrandDetails();

  const handleAuthorize = () => {
    setIsRedirecting(true);
    const codeId = action === 'connect' && currentPages.length > 0
      ? `${selectedAccount}_page_${selectedPage}`
      : selectedAccount;
    
    // Redirect về callback của backend
    const callbackCode = `mock_code_${codeId}`;
    const targetUrl = apiUrl(`/api/auth/social/${platform}/callback?code=${callbackCode}&state=${state}`);
    window.location.href = targetUrl;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 max-w-md w-full relative overflow-hidden">
        {/* Top brand header bar */}
        <div className={`h-1.5 absolute top-0 left-0 right-0 ${brand.bgColor}`} />

        {/* Branding */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{brand.logo}</span>
            <span className="font-extrabold text-slate-800 text-lg">{brand.name} Developer Sandbox</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
            Giả Lập / Mock Mode
          </span>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Yêu cầu cấp quyền truy cập
          </h1>
          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            Ứng dụng <strong className="text-slate-850">Be Traffic (Free Traffic OS)</strong> đang yêu cầu liên kết với tài khoản {brand.name} của bạn.
          </p>
        </div>

        {/* Scopes Requested */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
          <h3 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Quyền yêu cầu cấp:</h3>
          <ul className="space-y-1.5">
            {brand.scopes.map((scope, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="text-green-500 font-bold">✓</span>
                <code className="bg-white px-1.5 py-0.5 border border-slate-200 rounded text-[10px] font-mono text-slate-700">
                  {scope}
                </code>
              </li>
            ))}
          </ul>
        </div>

        {/* Account Selection */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              1. Chọn tài khoản {brand.name} giả lập:
            </label>
            <div className="space-y-2">
              {currentAccounts.map((acc) => (
                <label 
                  key={acc.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedAccount === acc.id 
                      ? 'border-brand bg-brand-light/20' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="mock_account"
                    value={acc.id}
                    checked={selectedAccount === acc.id}
                    onChange={() => setSelectedAccount(acc.id)}
                    className="w-4 h-4 text-brand focus:ring-brand border-slate-300"
                  />
                  <div className="w-8 h-8 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0">
                    {acc.avatarLetter}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">{acc.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{acc.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Page/OA Selection (for Connect Action only) */}
          {action === 'connect' && currentPages.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                2. Chọn {platform === 'zalo' ? 'Zalo OA' : 'Fanpage'} kết nối:
              </label>
              <div className="space-y-2">
                {currentPages.map((page, index) => {
                  const val = String(index + 1);
                  return (
                    <label 
                      key={page.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedPage === val 
                          ? 'border-brand bg-brand-light/20' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mock_page"
                        value={val}
                        checked={selectedPage === val}
                        onChange={() => setSelectedPage(val)}
                        className="w-4 h-4 text-brand focus:ring-brand border-slate-300"
                      />
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-lg font-bold shrink-0">
                        {platform === 'zalo' ? '💬' : '📘'}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900">{page.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{page.category}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button 
            type="button" 
            onClick={() => window.close()}
            className="flex-1 py-3 bg-slate-100 text-slate-650 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
          >
            Từ chối
          </button>
          <button 
            type="button" 
            disabled={isRedirecting}
            onClick={handleAuthorize}
            className={`flex-1 py-3 text-white font-bold text-xs rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${brand.bgColor} hover:opacity-90 disabled:opacity-55`}
          >
            {isRedirecting ? (
              <span>Đang kết nối...</span>
            ) : (
              <>
                <span>Cho phép</span>
                <span className="text-xs font-normal">→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MockOAuthSandbox() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 max-w-md w-full relative overflow-hidden text-center animate-pulse">
          <p className="text-sm font-extrabold text-slate-500 uppercase tracking-widest">Đang tải sandbox...</p>
        </div>
      </div>
    }>
      <MockOAuthSandboxInner />
    </Suspense>
  );
}
