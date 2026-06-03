'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiJson, getAuthToken } from '@/lib/api';
import { buildFacebookOAuthUrl } from '@/lib/facebookOAuth';

const EXPLORER_URL = 'https://developers.facebook.com/tools/explorer/';

export type FacebookBotStatus = {
  connected: boolean;
  botReady: boolean;
  pageId: string | null;
  pageName: string | null;
  fanCount?: number;
  issues: string[];
  lastCheckedAt: string;
};

type Props = {
  connection: { pageName: string | null; pageId: string | null; status: string } | undefined;
  onConnectionChange: () => void;
};

export function FacebookConnectCard({ connection, onConnectionChange }: Props) {
  const connected = connection?.status === 'CONNECTED';
  const [status, setStatus] = useState<FacebookBotStatus | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [pageId, setPageId] = useState('');
  const [pageToken, setPageToken] = useState('');
  const [verifyPreview, setVerifyPreview] = useState<{ pageName: string; fanCount?: number } | null>(null);

  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  const [availablePages, setAvailablePages] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiJson<FacebookBotStatus>('/social/facebook/status');
      setStatus(s);
      if (s.pageId) setPageId(s.pageId);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, connection]);

  useEffect(() => {
    if (connection?.pageId) setPageId(connection.pageId);
  }, [connection?.pageId]);

  const handleListPages = async () => {
    if (!pageToken.trim()) {
      setError('Dán Access Token trước, rồi bấm Lấy danh sách Fanpage.');
      return;
    }
    setLoading(true);
    setError('');
    setAvailablePages([]);
    try {
      const res = await apiFetch('/social/facebook/list-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: pageToken.trim() }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        pages?: { id: string; name: string }[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Không lấy được danh sách Fanpage');
        setLoading(false);
        return;
      }
      setAvailablePages(data.pages || []);
      if (data.pages?.length === 1) {
        setPageId(data.pages[0].id);
        setSuccess(`Đã chọn Fanpage: ${data.pages[0].name} — bấm Kiểm tra token.`);
      } else if (data.pages?.length) {
        setSuccess(`Tìm thấy ${data.pages.length} Fanpage — bấm tên Page bên dưới để chọn đúng ID.`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không lấy được danh sách Fanpage');
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    setVerifyPreview(null);
    setAvailablePages([]);
    try {
      const res = await apiFetch('/social/facebook/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pageId.trim(), accessToken: pageToken.trim() }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        pageName?: string;
        fanCount?: number;
        error?: string;
        availablePages?: { id: string; name: string }[];
      };
      if (!res.ok || !data.success) {
        setError(data.error || 'Không xác minh được');
        if (data.availablePages?.length) setAvailablePages(data.availablePages);
        setLoading(false);
        return;
      }
      if (data.pageName) {
        setVerifyPreview({ pageName: data.pageName, fanCount: data.fanCount });
        setStep(3);
        setSuccess(
          `Xác minh OK: ${data.pageName}${data.fanCount != null ? ` · ${data.fanCount.toLocaleString()} followers` : ''}`
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không xác minh được');
    }
    setLoading(false);
  };

  const pickPage = (p: { id: string; name: string }) => {
    setPageId(p.id);
    setVerifyPreview(null);
    setError('');
    setSuccess(`Đã chọn: ${p.name} (ID ${p.id}). Bấm "Kiểm tra token" lại.`);
    setStep(2);
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiJson<{
        success: boolean;
        pageName?: string;
        fanCount?: number;
        message?: string;
      }>('/social/facebook/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pageId.trim(), accessToken: pageToken.trim() }),
      });
      setSuccess(
        data.message || `Đã kết nối ${data.pageName}${data.fanCount != null ? ` (${data.fanCount.toLocaleString()} followers)` : ''}. Bot sẵn sàng đăng bài.`
      );
      setWizardOpen(false);
      onConnectionChange();
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối');
    }
    setLoading(false);
  };

  const handleTestBot = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiJson<{ success: boolean; message: string }>('/social/facebook/test-bot', {
        method: 'POST',
      });
      setSuccess(data.message || 'Đã gửi bài test lên Fanpage (bài nháp).');
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Test thất bại');
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    await apiFetch('/social/facebook', { method: 'DELETE' });
    setWizardOpen(true);
    setStep(1);
    setVerifyPreview(null);
    onConnectionChange();
    await loadStatus();
  };

  const handleOAuth = async () => {
    if (!appId.trim() || !appSecret.trim()) {
      setError('OAuth cần Meta App ID + App Secret (mục Nâng cao).');
      return;
    }
    setLoading(true);
    setError('');
    const redirectUri = `${window.location.origin}/oauth/fb-callback`;
    let oauthUrl: string;
    try {
      const data = await apiJson<{ url: string }>('/social/facebook/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: appId.trim(), redirectUri }),
      });
      oauthUrl = data.url;
    } catch {
      oauthUrl = buildFacebookOAuthUrl(appId.trim(), redirectUri);
      setSuccess('Backend offline — vẫn mở OAuth; sau đăng nhập cần backend để lưu token.');
    }

    localStorage.setItem(
      'fb_oauth',
      JSON.stringify({
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        redirectUri,
        preferredPageId: pageId.trim() || undefined,
        authToken: getAuthToken() || undefined,
      })
    );

    const popup = window.open(oauthUrl, 'fb_oauth', 'width=600,height=700,scrollbars=yes');
    if (!popup) {
      setError('Cho phép popup cho localhost.');
      setLoading(false);
      return;
    }
    const check = setInterval(() => {
      if (popup.closed) {
        clearInterval(check);
        setLoading(false);
        onConnectionChange();
        loadStatus();
      }
    }, 1000);
  };

  const botReady = status?.botReady ?? false;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* CARD HEADER */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0 text-white"
              style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
            >
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Facebook Fanpage Post Bot</h3>
              <p className="text-sm text-slate-500 mt-1">
                Tự động hóa đăng bài và chia sẻ bài viết lên Fanpage thông qua Graph API
              </p>
            </div>
          </div>
          
          {connected && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="sm:self-center px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
            >
              Ngắt kết nối
            </button>
          )}
        </div>

        {/* TRẠNG THÁI BOT */}
        <div
          className={`mt-6 rounded-2xl border p-5 transition-all duration-300 ${
            botReady 
              ? 'border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white' 
              : 'border-amber-100 bg-gradient-to-r from-amber-50/80 to-white'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${botReady ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${botReady ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                
                <span className={`text-sm font-bold tracking-wide uppercase ${botReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {botReady
                    ? 'Bot đã sẵn sàng hoạt động'
                    : connected
                      ? 'Lỗi cấp quyền gửi bài'
                      : 'Chưa kết nối'}
                </span>
              </div>
              
              {status?.pageName && (
                <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <span>Trang liên kết:</span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">
                    {status.pageName}
                  </span>
                  {status.pageId && (
                    <span className="text-slate-400 text-xs font-normal">
                      (ID: {status.pageId})
                    </span>
                  )}
                </div>
              )}
            </div>

            {botReady && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={handleTestBot}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold text-blue-600 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  {loading ? 'Đang gửi...' : 'Gửi bài test nháp'}
                </button>
                <a 
                  href="/dashboard/automation" 
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
                >
                  Cấu hình Bot Automation →
                </a>
              </div>
            )}
          </div>

          {/* HIỂN THỊ CÁC LỖI/CẢNH BÁO */}
          {status?.issues?.length ? (
            <div className="mt-4 border-t border-dashed border-amber-200/60 pt-4">
              <div className="flex items-start gap-2.5 text-amber-800">
                <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider">Chi tiết vấn đề kết nối:</p>
                  <ul className="text-xs list-disc list-inside space-y-1 font-medium leading-relaxed">
                    {status.issues.map((issue, idx) => (
                      <li key={idx} className="marker:text-amber-500">{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {success && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{success}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-800 flex items-start gap-2">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium whitespace-pre-line">{error}</span>
          </div>
        )}

        {/* Cửa ngõ kết nối gọn gàng khi chưa liên kết */}
        {!connected && !wizardOpen && !advancedOpen && (
          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">Liên kết Fanpage Facebook của bạn</h4>
              <p className="text-xs text-slate-500">Chọn phương thức nhập Token thủ công hoặc qua đăng nhập ứng dụng OAuth</p>
            </div>
            <div className="flex flex-wrap gap-2.5 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
              >
                🔌 Kết nối bằng Token
              </button>
              <button
                type="button"
                onClick={() => setAdvancedOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              >
                ⚙️ Cấu hình OAuth App
              </button>
            </div>
          </div>
        )}
      </div>

      {/* WIZARD HƯỚNG DẪN KẾT NỐI */}
      {wizardOpen && (
        <div className="p-6 sm:p-8 space-y-6">
          {!connected && (
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Cấu hình kết nối Facebook (Khuyên dùng)</h4>
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full font-medium">3 Bước Nhanh</span>
            </div>
          )}

          <div className="relative pl-8 border-l-2 border-blue-100 ml-4 space-y-8">
            {/* BƯỚC 1 */}
            <div className="relative">
              <span className="absolute -left-12 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white text-xs font-bold ring-4 ring-white shadow-md shadow-blue-500/10">
                1
              </span>
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 text-sm">Mở Graph API Explorer</h5>
                <p className="text-slate-500 text-xs leading-relaxed max-w-2xl">
                  Chọn ứng dụng Facebook của bạn (BeTraffic), bấm nút <strong className="text-slate-700">Generate Token</strong> và tích chọn hai quyền bắt buộc là <strong className="text-blue-600">pages_manage_posts</strong> và <strong className="text-blue-600">pages_read_engagement</strong>.
                </p>
                <a
                  href={EXPLORER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-1 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
                >
                  <span>Mở Graph API Explorer</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
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
                <h5 className="font-bold text-slate-800 text-sm">Điền thông tin &amp; Kiểm tra Token</h5>
                <p className="text-slate-500 text-xs leading-relaxed max-w-2xl">
                  Nhập mã Page ID và Page Access Token Fanpage của bạn. Mẹo: bạn có thể nhập Access Token và bấm <strong className="text-slate-700">Lấy danh sách Fanpage</strong> để hệ thống tự động bóc tách Page ID.
                </p>
                
                <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mt-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500">Page ID Fanpage</label>
                    <input
                      type="text"
                      value={pageId}
                      onChange={(e) => {
                        setPageId(e.target.value);
                        setVerifyPreview(null);
                        setStep(2);
                      }}
                      placeholder="Nhập ID trang (Ví dụ: 10238517...)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500">Page Access Token</label>
                    <input
                      type="password"
                      value={pageToken}
                      onChange={(e) => {
                        setPageToken(e.target.value);
                        setVerifyPreview(null);
                        setStep(2);
                      }}
                      placeholder="Dán token dài EAAx..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleListPages}
                    disabled={!pageToken.trim() || loading}
                    className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? 'Đang tải...' : '🔍 Lấy danh sách Fanpage'}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={!pageId.trim() || !pageToken.trim() || loading}
                    className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? 'Đang xác minh...' : '🛡️ Kiểm tra token'}
                  </button>
                </div>

                {availablePages.length > 0 && (
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl max-w-xl space-y-2">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Danh sách Fanpage bạn quản lý:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                      {availablePages.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickPage(p)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white hover:border-blue-500 hover:bg-blue-50/40 text-xs font-medium text-slate-700 flex items-center justify-between transition-all"
                        >
                          <span className="font-bold text-slate-800">{p.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">ID: {p.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BƯỚC 3 */}
            <div className="relative">
              <span className={`absolute -left-12 top-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white transition-all duration-300 ${
                step >= 3 ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/10' : 'bg-slate-100 text-slate-400'
              }`}>
                3
              </span>
              <div className="space-y-3">
                <h5 className="font-bold text-slate-800 text-sm">Lưu kết nối hệ thống</h5>
                <p className="text-slate-500 text-xs leading-relaxed max-w-xl">
                  Lưu thông tin kết nối an toàn vào cơ sở dữ liệu. Bot sẽ ngay lập tức được kích hoạt để quản lý và lập lịch đăng bài lên trang này.
                </p>
                {verifyPreview && (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-blue-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span>Xác nhận liên kết: <strong>{verifyPreview.pageName}</strong></span>
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!verifyPreview || loading}
                    className="px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md shadow-blue-500/10 transition-all hover:shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                    style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
                  >
                    {loading ? 'Đang kết nối...' : 'Hoàn tất kết nối'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="button" 
              onClick={() => setWizardOpen(false)} 
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <span>↑ Thu gọn hướng dẫn thiết lập</span>
            </button>
          </div>
        </div>
      )}

      {connected && !wizardOpen && (
        <div className="px-6 sm:p-8 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <span className="text-xs text-slate-500">Cấu hình kết nối hiện tại đã được lưu an toàn.</span>
          <button 
            type="button" 
            onClick={() => setWizardOpen(true)} 
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            <span>Đổi cấu hình kết nối Fanpage →</span>
          </button>
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
            <span>{advancedOpen ? '▼' : '▶'} Tùy chọn nâng cao — Đăng nhập OAuth ứng dụng (Nhận Token Vô Hạn)</span>
          </button>
          
          {advancedOpen && (
            <div className="mt-4 space-y-4 p-5 rounded-2xl bg-white border border-slate-200/60 shadow-inner max-w-3xl">
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-800">
                <svg className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-1">
                  <p className="font-bold">Luồng OAuth nâng cao:</p>
                  <p className="leading-relaxed">
                    Dành cho các tài khoản tự tạo Meta App riêng. Cung cấp App ID và App Secret để hệ thống thực hiện đăng nhập và tự động gia hạn token vĩnh viễn (không bao giờ bị hết hạn sau 2 giờ).
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">Facebook App ID</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Nhập ID ứng dụng Meta"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">Facebook App Secret</label>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="Nhập mã bảo mật ứng dụng"
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
                🔗 Bắt đầu đăng nhập OAuth
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

