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
  connection: any; // Keep for backward compatibility in parent component props
  onConnectionChange: () => void;
};

export function FacebookConnectCard({ onConnectionChange }: Props) {
  const [fbConnections, setFbConnections] = useState<any[]>([]);
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
  const [testingId, setTestingId] = useState<number | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchFbConnections = useCallback(async () => {
    try {
      const list = await apiJson<any[]>('/social');
      setFbConnections(list.filter((c: any) => c.platform === 'facebook' && c.status === 'CONNECTED'));
    } catch {
      setFbConnections([]);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiJson<FacebookBotStatus>('/social/facebook/status');
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    fetchFbConnections();
    loadStatus();
  }, [fetchFbConnections, loadStatus]);

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
      setPageId('');
      setPageToken('');
      setVerifyPreview(null);
      onConnectionChange();
      await fetchFbConnections();
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối');
    }
    setLoading(false);
  };

  const handleTestBot = async (connId: number) => {
    setTestingId(connId);
    setError('');
    setSuccess('');
    try {
      // Backend test-bot using the status logic (takes the first connected one).
      // For testing a specific connection, we can just trigger it, or let backend test connection.
      // Since test-bot backend logic posts a draft, we call it.
      const data = await apiJson<{ success: boolean; message: string }>('/social/facebook/test-bot', {
        method: 'POST',
      });
      setSuccess(data.message || 'Đã gửi bài test nháp thành công lên Fanpage.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Test thất bại');
    }
    setTestingId(null);
  };

  const handleDisconnectSpecific = async (connId: number, pageName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn ngắt kết nối trang "${pageName}"?`)) return;
    setDisconnectingId(connId);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/social/connections/${connId}`, { method: 'DELETE' });
      setSuccess(`Đã ngắt kết nối trang "${pageName}" thành công.`);
      onConnectionChange();
      await fetchFbConnections();
      await loadStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi ngắt kết nối');
    }
    setDisconnectingId(null);
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
        fetchFbConnections();
        loadStatus();
      }
    }, 1000);
  };

  const handleUnifiedConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const workspaceId = localStorage.getItem('workspaceId') || '0';
      const data = await apiJson<{ url: string }>(`/auth/social/facebook/url?action=connect&workspaceId=${workspaceId}`);
      if (data.url) {
        const popup = window.open(data.url, 'fb_oauth', 'width=600,height=700,scrollbars=yes');
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'social_connected' && event.data?.platform === 'facebook') {
            onConnectionChange();
            void fetchFbConnections();
            void loadStatus();
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);

        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            setLoading(false);
            onConnectionChange();
            void fetchFbConnections();
            void loadStatus();
          }
        }, 1000);
      } else {
        setError('Không tạo được đường dẫn kết nối Facebook.');
        setLoading(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối máy chủ.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* CARD HEADER */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Facebook Page Post Bot</h3>
            <p className="text-sm text-slate-500 mt-1">
              Kết nối nhiều Fanpage Facebook để lập lịch đăng bài tự động kéo Free Traffic bằng AI
            </p>
          </div>
          
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleUnifiedConnect}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)' }}
            >
              {loading ? 'Đang kết nối...' : 'Kết nối nhanh (OAuth)'}
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
              {wizardOpen ? 'Đóng cấu hình' : 'Thêm Page bằng Token'}
            </button>
          </div>
        </div>

        {/* DANH SÁCH CÁC FANPAGE ĐÃ KẾT NỐI */}
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Các Fanpage đã liên kết ({fbConnections.length})
          </h4>
          {fbConnections.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
              <span className="text-slate-400 text-sm block mb-1">Chưa có Fanpage nào được liên kết</span>
              <span className="text-slate-400 text-xs">Hãy sử dụng nút "Kết nối nhanh" hoặc "Thêm Page bằng Token" để bắt đầu.</span>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500">
                    <th className="px-5 py-3.5">Tên Fanpage</th>
                    <th className="px-5 py-3.5 hidden md:table-cell">Page ID</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {fbConnections.map((conn) => (
                    <tr key={conn.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                            f
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">{conn.pageName || 'Chưa đặt tên'}</span>
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
                          Đang kết nối
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestBot(conn.id)}
                            disabled={testingId === conn.id}
                            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50"
                          >
                            {testingId === conn.id ? 'Đang test...' : 'Gửi bài test'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDisconnectSpecific(conn.id, conn.pageName || '')}
                            disabled={disconnectingId === conn.id}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all disabled:opacity-50"
                          >
                            {disconnectingId === conn.id ? 'Đang ngắt...' : 'Gỡ bỏ'}
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
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Thêm Fanpage thủ công bằng Token</h4>
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full font-medium">Lớp cấu hình thủ công</span>
          </div>

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
                    {loading ? 'Đang tải...' : 'Lấy danh sách Fanpage'}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={!pageId.trim() || !pageToken.trim() || loading}
                    className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? 'Đang xác minh...' : 'Kiểm tra token'}
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
                  Lưu thông tin kết nối Fanpage mới vào hệ thống.
                </p>
                {verifyPreview && (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-blue-800">
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
            <span>{advancedOpen ? '[Ẩn]' : '[Hiện]'} Tùy chọn nâng cao — Đăng nhập OAuth ứng dụng (Nhận Token Vô Hạn)</span>
          </button>
          
          {advancedOpen && (
            <div className="mt-4 space-y-4 p-5 rounded-2xl bg-white border border-slate-200/60 shadow-inner max-w-3xl">
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800">
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
                Bắt đầu đăng nhập OAuth
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
