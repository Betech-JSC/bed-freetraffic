'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

type Props = {
  onConnectionChange: () => void;
};

function bufferToBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return bufferToBase64Url(array.buffer).substring(0, 43);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToBase64Url(digest);
}

export function ZaloConnectCard({ onConnectionChange }: Props) {
  const { t } = useLocale();
  const [zaloConnections, setZaloConnections] = useState<any[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [zaloToken, setZaloToken] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  const [loading, setLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchZaloConnections = useCallback(async () => {
    try {
      const list = await apiJson<any[]>('/social');
      setZaloConnections(list.filter((c: any) => c.platform === 'zalo' && c.status === 'CONNECTED'));
    } catch {
      setZaloConnections([]);
    }
  }, []);

  useEffect(() => {
    fetchZaloConnections();
  }, [fetchZaloConnections]);

  const handleQuickConnect = async () => {
    if (!zaloToken.trim()) {
      setError(t('Vui lòng nhập OA Access Token.'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiFetch('/social/zalo/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: zaloToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('Không thể kết nối Zalo OA.'));
        setLoading(false);
        return;
      }
      setSuccess(`${t('Đã kết nối thành công Zalo OA:')} ${data.oaName}`);
      setZaloToken('');
      setWizardOpen(false);
      onConnectionChange();
      await fetchZaloConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Lỗi kết nối máy chủ.'));
    }
    setLoading(false);
  };

  const handleDisconnectSpecific = async (connId: number, oaName: string) => {
    if (!confirm(t('Bạn có chắc chắn muốn ngắt kết nối Zalo OA "{oaName}"?').replace('{oaName}', oaName))) return;
    setDisconnectingId(connId);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/social/connections/${connId}`, { method: 'DELETE' });
      setSuccess(t('Đã ngắt kết nối Zalo OA thành công.'));
      onConnectionChange();
      await fetchZaloConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Lỗi ngắt kết nối'));
    }
    setDisconnectingId(null);
  };

  const handleOAuth = async () => {
    if (!appId.trim() || !appSecret.trim()) {
      setError(t('OAuth cần Zalo App ID + Secret Key (mục Nâng cao).'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const redirectUri = `${window.location.origin}/oauth/zalo-callback`;
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      const res = await apiFetch('/social/zalo/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: appId.trim(), redirectUri, codeChallenge: challenge }),
      });
      const data = await res.json();
      if (data.url) {
        localStorage.setItem(
          'zalo_oauth',
          JSON.stringify({
            appId: appId.trim(),
            appSecret: appSecret.trim(),
            redirectUri,
            codeVerifier: verifier,
          })
        );
        const popup = window.open(data.url, 'zalo_oauth', 'width=600,height=700,scrollbars=yes');
        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            setLoading(false);
            onConnectionChange();
            void fetchZaloConnections();
          }
        }, 1000);
      } else {
        setError(t('Không tạo được đường dẫn đăng nhập.'));
        setLoading(false);
      }
    } catch {
      setError(t('Lỗi kết nối máy chủ khi tạo URL đăng nhập.'));
      setLoading(false);
    }
  };

  const handleUnifiedConnect = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const workspaceId = localStorage.getItem('workspaceId') || '0';
      const data = await apiJson<{ url: string }>(`/auth/social/zalo/url?action=connect&workspaceId=${workspaceId}`);
      if (data.url) {
        const popup = window.open(data.url, 'zalo_oauth', 'width=600,height=700,scrollbars=yes');
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'social_connected' && event.data?.platform === 'zalo') {
            onConnectionChange();
            void fetchZaloConnections();
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);

        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            setLoading(false);
            onConnectionChange();
            void fetchZaloConnections();
          }
        }, 1000);
      } else {
        setError(t('Không tạo được đường dẫn kết nối Zalo.'));
        setLoading(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Lỗi kết nối máy chủ.'));
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* CARD HEADER */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Zalo Official Account Bot</h3>
            <p className="text-sm text-slate-500 mt-1">
              {t('Kết nối Zalo OA để gửi tin nhắn chăm sóc khách hàng tự động và ZNS bám đuổi CRM')}
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleUnifiedConnect}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0068FF 0%, #0053cc 100%)' }}
            >
              {loading ? t('Đang kết nối...') : t('Kết nối nhanh (OAuth)')}
            </button>
            <button
              type="button"
              onClick={() => {
                setWizardOpen(!wizardOpen);
                setStep(1);
                setError('');
                setSuccess('');
              }}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              {wizardOpen ? t('Đóng cấu hình') : t('Thêm OA bằng Token')}
            </button>
          </div>
        </div>

        {/* DANH SÁCH CÁC ZALO OA ĐAV KẾT NỐI */}
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            {t('Các Zalo OA đã liên kết')} ({zaloConnections.length})
          </h4>
          {zaloConnections.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
              <span className="text-slate-400 text-sm block mb-1">{t('Chưa có Zalo OA nào được liên kết')}</span>
              <span className="text-slate-400 text-xs">{t('Hãy sử dụng nút "Kết nối nhanh" hoặc "Thêm OA bằng Token" để bắt đầu.')}</span>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500">
                    <th className="px-5 py-3.5">{t('Tên OA')}</th>
                    <th className="px-5 py-3.5 hidden md:table-cell">{t('OA ID')}</th>
                    <th className="px-5 py-3.5">{t('Trạng thái')}</th>
                    <th className="px-5 py-3.5 text-right">{t('Hành động')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {zaloConnections.map((conn) => (
                    <tr key={conn.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0068FF] flex items-center justify-center font-bold text-sm">
                            Z
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">{conn.pageName || 'Zalo OA'}</span>
                            <span className="text-[10px] text-slate-400 font-mono md:hidden">ID: {conn.pageId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell font-mono text-xs text-slate-400">
                        {conn.pageId}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {t('Đang kết nối')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDisconnectSpecific(conn.id, conn.pageName || 'Zalo OA')}
                            disabled={disconnectingId === conn.id}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all disabled:opacity-50"
                          >
                            {disconnectingId === conn.id ? t('Đang ngắt...') : t('Gỡ bỏ')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {success && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800">
            <span className="font-medium">{success}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-800">
            <span className="font-medium whitespace-pre-line">{error}</span>
          </div>
        )}
      </div>

      {/* WIZARD THỦ CÔNG QUA TOKEN */}
      {wizardOpen && (
        <div className="p-6 sm:p-8 space-y-6 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('Thêm OA bằng Token thủ công')}</h4>
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full font-medium">{t('Lớp cấu hình thủ công')}</span>
          </div>

          <div className="relative pl-8 border-l-2 border-blue-100 ml-4 space-y-8">
            {/* BƯỚC 1 */}
            <div className="relative">
              <span className="absolute -left-12 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white text-xs font-bold ring-4 ring-white shadow-md shadow-blue-500/10">
                1
              </span>
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 text-sm">{t('Truy cập Zalo Developers')}</h5>
                <p className="text-slate-500 text-xs leading-relaxed max-w-2xl">
                  {t('Đăng nhập vào bảng điều khiển nhà phát triển Zalo, truy cập Zalo OA của bạn và tạo Access Token với các quyền quản trị tin nhắn.')}
                </p>
                <a
                  href="https://developers.zalo.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-1 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: 'linear-gradient(135deg, #0068FF 0%, #0053cc 100%)' }}
                >
                  <span>{t('Mở Zalo Developers')}</span>
                </a>
              </div>
            </div>

            {/* BƯỚC 2 */}
            <div className="relative">
              <span className={`absolute -left-12 top-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white transition-all duration-300 ${
                step >= 2 ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/10' : 'bg-slate-100 text-slate-400'
              }`}>
                2
              </span>
              <div className="space-y-3 w-full">
                <h5 className="font-bold text-slate-800 text-sm">{t('Điền Token Zalo OA')}</h5>
                <p className="text-slate-500 text-xs leading-relaxed max-w-2xl">
                  {t('Dán Access Token dài của Zalo OA vào đây và bấm "Kết nối ngay" để hệ thống tự động kiểm tra và cấu hình.')}
                </p>

                <div className="max-w-xl mt-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500">{t('Zalo OA Access Token')}</label>
                    <input
                      type="password"
                      value={zaloToken}
                      onChange={(e) => {
                        setZaloToken(e.target.value);
                        setStep(2);
                      }}
                      placeholder={t('Dán Access Token...')}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleQuickConnect}
                    disabled={!zaloToken.trim() || loading}
                    className="px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md shadow-blue-500/10 transition-all hover:shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #0068FF 0%, #0053cc 100%)' }}
                  >
                    {loading ? t('Đang kết nối...') : t('Kết nối ngay')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OAUTH NÂNG CAO */}
      <div className="border-t border-slate-100 bg-slate-50/50">
        <div className="px-6 sm:px-8 py-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
          >
            <span>{advancedOpen ? '[Ẩn]' : '[Hiện]'} {t('Tùy chọn nâng cao — Đăng nhập OAuth ứng dụng (Tự động gia hạn)')}</span>
          </button>

          {advancedOpen && (
            <div className="mt-4 space-y-4 p-5 rounded-2xl bg-white border border-slate-200/60 shadow-inner max-w-3xl">
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800">
                <div className="space-y-1">
                  <p className="font-bold">{t('Luồng OAuth Zalo App:')}</p>
                  <p className="leading-relaxed">
                    {t('Sử dụng Zalo App riêng của bạn. Cung cấp App ID và Secret Key từ Zalo Developers để hệ thống tự động đăng nhập và gia hạn Access Token qua mã refresh token.')}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">Zalo App ID</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. 4551190512668674845"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">Zalo Secret Key</label>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="Secret key..."
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleOAuth}
                disabled={loading || !appId.trim() || !appSecret.trim()}
                className="px-5 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
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
