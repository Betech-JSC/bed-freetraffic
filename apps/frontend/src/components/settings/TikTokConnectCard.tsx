'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';
import { Toast } from '@/components/ui/Toast';

type Props = {
  onConnectionChange: () => void;
};

export function TikTokConnectCard({ onConnectionChange }: Props) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'shop' | 'creator'>('shop');
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Manual configuration for advanced users
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [manualShopId, setManualShopId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const list = await apiJson<any[]>('/social');
      setConnections(list.filter((c: any) => (c.platform === 'tiktok' || c.platform === 'tiktokshop') && c.status === 'CONNECTED'));
    } catch {
      setConnections([]);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleOAuthConnect = async (platform: 'tiktok' | 'tiktokshop') => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const workspaceId = localStorage.getItem('workspaceId') || '0';
      const data = await apiJson<{ url: string }>(`/auth/social/${platform}/url?action=connect&workspaceId=${workspaceId}`);
      if (data.url) {
        const popup = window.open(data.url, `${platform}_oauth`, 'width=600,height=700,scrollbars=yes');
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'social_connected' && event.data?.platform === platform) {
            onConnectionChange();
            void fetchConnections();
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);

        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            setLoading(false);
            onConnectionChange();
            void fetchConnections();
          }
        }, 1000);
      } else {
        setError(t('Không tạo được đường dẫn kết nối.'));
        setLoading(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Lỗi kết nối máy chủ.'));
      setLoading(false);
    }
  };

  const handleDisconnect = async (connId: number, name: string) => {
    if (!confirm(t('Bạn có chắc chắn muốn ngắt kết nối "{name}"?').replace('{name}', name))) return;
    setDisconnectingId(connId);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/social/connections/${connId}`, { method: 'DELETE' });
      setSuccess(t('Đã ngắt kết nối thành công.'));
      onConnectionChange();
      await fetchConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Lỗi ngắt kết nối'));
    }
    setDisconnectingId(null);
  };

  const handleManualConnect = async () => {
    if (!manualToken.trim() || !manualShopId.trim()) {
      setError(t('Vui lòng điền đầy đủ Access Token và Shop ID/Channel ID.'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const platform = activeTab === 'shop' ? 'tiktokshop' : 'tiktok';
    try {
      // Save direct mock/custom token connection to backend
      const res = await apiFetch(`/social/${platform}/bind-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: manualShopId.trim(),
          pageAccessToken: manualToken.trim(),
          pageName: activeTab === 'shop' ? 'TikTok Shop Store' : 'TikTok Channel'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('Không kết nối được bằng token thủ công.'));
        setLoading(false);
        return;
      }
      setSuccess(t('Kết nối thành công!'));
      setManualToken('');
      setManualShopId('');
      setManualOpen(false);
      onConnectionChange();
      await fetchConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Lỗi kết nối máy chủ.'));
    }
    setLoading(false);
  };

  const handleCustomOAuth = async () => {
    if (!appId.trim() || !appSecret.trim()) {
      setError(t('Vui lòng cung cấp cả Client ID và Secret Key.'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const platform = activeTab === 'shop' ? 'tiktokshop' : 'tiktok';
    const redirectUri = `${window.location.origin}/oauth/callback`;
    
    // Save oauth parameters in localstorage and trigger auth
    localStorage.setItem(`${platform}_oauth_config`, JSON.stringify({ appId, appSecret, redirectUri }));
    
    let url = '';
    if (platform === 'tiktokshop') {
      url = `https://services.tiktokshop.com/open/authorize?app_key=${appId.trim()}&state=connect`;
    } else {
      const scopes = 'user.info.profile,video.upload';
      url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${appId.trim()}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=connect`;
    }

    const popup = window.open(url, `${platform}_oauth`, 'width=600,height=700,scrollbars=yes');
    const check = setInterval(() => {
      if (popup?.closed) {
        clearInterval(check);
        setLoading(false);
        onConnectionChange();
        void fetchConnections();
      }
    }, 1000);
  };

  const shopConns = connections.filter(c => c.platform === 'tiktokshop');
  const creatorConns = connections.filter(c => c.platform === 'tiktok');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* HEADER WITH TABS */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">TikTok Integration Engine</h3>
            <p className="text-sm text-slate-500 mt-1">
              {t('Liên kết TikTok Shop để đồng bộ CRM và tích hợp Kênh để lên lịch đăng video tự động')}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOAuthConnect(activeTab === 'shop' ? 'tiktokshop' : 'tiktok')}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #010101 0%, #111111 100%)' }}
            >
              {loading ? t('Đang kết nối...') : t('Kết nối nhanh (OAuth)')}
            </button>
            <button
              type="button"
              onClick={() => {
                setManualOpen(!manualOpen);
                setError('');
                setSuccess('');
              }}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              {manualOpen ? t('Đóng cấu hình') : t('Thêm bằng Token')}
            </button>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex gap-2 mt-6 border-b border-slate-100 pb-px">
          <button
            onClick={() => setActiveTab('shop')}
            className={`pb-3 text-xs font-extrabold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === 'shop' ? 'border-black text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            TikTok Shop ({shopConns.length})
          </button>
          <button
            onClick={() => setActiveTab('creator')}
            className={`pb-3 text-xs font-extrabold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === 'creator' ? 'border-black text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            {t('Kênh Creator')} ({creatorConns.length})
          </button>
        </div>

        {/* CONNECTION LISTING */}
        <div className="mt-6">
          {activeTab === 'shop' ? (
            <div>
              {shopConns.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
                  <span className="text-slate-400 text-sm block mb-1">{t('Chưa có TikTok Shop nào được kết nối')}</span>
                  <span className="text-slate-400 text-xs">{t('Nhấp "Kết nối nhanh" để đồng bộ đơn hàng về CRM.')}</span>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500">
                        <th className="px-5 py-3">{t('Tên Shop')}</th>
                        <th className="px-5 py-3">{t('Shop ID')}</th>
                        <th className="px-5 py-3">{t('Trạng thái')}</th>
                        <th className="px-5 py-3 text-right">{t('Hành động')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {shopConns.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-800">{c.pageName || 'TikTok Shop'}</td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-400">{c.pageId}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              {t('Đang đồng bộ')}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDisconnect(c.id, c.pageName || 'TikTok Shop')}
                              disabled={disconnectingId === c.id}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all"
                            >
                              {disconnectingId === c.id ? t('Đang ngắt...') : t('Gỡ bỏ')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              {creatorConns.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
                  <span className="text-slate-400 text-sm block mb-1">{t('Chưa có Kênh TikTok nào được kết nối')}</span>
                  <span className="text-slate-400 text-xs">{t('Kết nối kênh để lên lịch đẩy video tự động qua AI.')}</span>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500">
                        <th className="px-5 py-3">{t('Tên Kênh')}</th>
                        <th className="px-5 py-3">{t('Open ID')}</th>
                        <th className="px-5 py-3">{t('Trạng thái')}</th>
                        <th className="px-5 py-3 text-right">{t('Hành động')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {creatorConns.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-800">{c.pageName || 'TikTok Creator'}</td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-400">{c.pageId}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              {t('Sẵn sàng')}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDisconnect(c.id, c.pageName || 'TikTok Creator')}
                              disabled={disconnectingId === c.id}
                              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all"
                            >
                              {disconnectingId === c.id ? t('Đang ngắt...') : t('Gỡ bỏ')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {success && (
          <Toast
            message={success}
            type="success"
            onClose={() => setSuccess('')}
            duration={4000}
          />
        )}
        {error && (
          <Toast
            message={error}
            type="error"
            onClose={() => setError('')}
            duration={5000}
          />
        )}
      </div>

      {/* MANUAL SETUP OVERLAY/FORM */}
      {manualOpen && (
        <div className="p-6 sm:p-8 space-y-6 border-b border-slate-100 bg-slate-50/30">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('Kết nối bằng Token thủ công')}</h4>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">{activeTab === 'shop' ? t('Shop ID') : t('Channel Open ID')}</label>
              <input
                type="text"
                value={manualShopId}
                onChange={e => setManualShopId(e.target.value)}
                placeholder="ID..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Access Token</label>
              <input
                type="password"
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="Access token..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualConnect}
            disabled={loading}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
          >
            {loading ? t('Đang kết nối...') : t('Xác nhận kết nối')}
          </button>
        </div>
      )}

      {/* ADVANCED CUSTOM CLIENT OAuth */}
      <div className="border-t border-slate-100 bg-slate-50/50">
        <div className="px-6 sm:px-8 py-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
          >
            <span>{advancedOpen ? '[Ẩn]' : '[Hiện]'} {t('Tùy chọn cấu hình nâng cao (Ứng dụng tự phát triển)')}</span>
          </button>

          {advancedOpen && (
            <div className="mt-4 space-y-4 p-5 rounded-2xl bg-white border border-slate-200/60 shadow-inner max-w-3xl">
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800">
                <p>{t('Điền thông tin Client Key/App Key của bạn từ trang nhà phát triển TikTok để chạy OAuth tùy chỉnh.')}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">{activeTab === 'shop' ? 'TikTok App Key' : 'TikTok Client Key'}</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Key..."
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">{activeTab === 'shop' ? 'TikTok App Secret' : 'TikTok Client Secret'}</label>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="Secret..."
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCustomOAuth}
                disabled={loading || !appId.trim() || !appSecret.trim()}
                className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-40 active:scale-95"
              >
                {t('Bắt đầu đăng nhập OAuth')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
