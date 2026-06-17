'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { FacebookConnectCard } from '@/components/settings/FacebookConnectCard';
import { ZaloConnectCard } from '@/components/settings/ZaloConnectCard';
import { TikTokConnectCard } from '@/components/settings/TikTokConnectCard';
import { useLocale } from '@/context/LocaleContext';
import { AuditLogsTab } from '@/components/settings/AuditLogsTab';

// ===== TYPES =====
interface Connection {
  id: number;
  platform: string;
  pageName: string | null;
  pageId: string | null;
  status: string;
  accessToken: string;
}

export default function SettingsPage() {
  const { t, locale } = useLocale();
  const [activeTab, setActiveTab] = useState<'integrations' | 'security' | 'audit'>('integrations');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [fbBotStatus, setFbBotStatus] = useState<{ botReady: boolean } | null>(null);

  // Email state
  const [emailMode, setEmailMode] = useState<'idle' | 'form'>('idle');
  const [emailAddr, setEmailAddr] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailTestMsg, setEmailTestMsg] = useState('');



  // Mailchimp state
  const [mailchimpMode, setMailchimpMode] = useState<'idle' | 'form'>('idle');
  const [mcApiKey, setMcApiKey] = useState('');
  const [mcServer, setMcServer] = useState('');
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState('');
  const [mcSuccess, setMcSuccess] = useState('');

  // Telegram state
  const [telegramMode, setTelegramMode] = useState<'idle' | 'form'>('idle');
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgSuccess, setTgSuccess] = useState('');

  // Reddit state
  const [redditMode, setRedditMode] = useState<'idle' | 'form'>('idle');
  const [rdClientId, setRdClientId] = useState('');
  const [rdClientSecret, setRdClientSecret] = useState('');
  const [rdUsername, setRdUsername] = useState('');
  const [rdPassword, setRdPassword] = useState('');
  const [rdSubreddit, setRdSubreddit] = useState('');
  const [rdLoading, setRdLoading] = useState(false);
  const [rdError, setRdError] = useState('');
  const [rdSuccess, setRdSuccess] = useState('');

  // Moz state
  const [mozMode, setMozMode] = useState<'idle' | 'form'>('idle');
  const [mozAccessId, setMozAccessId] = useState('');
  const [mozSecretKey, setMozSecretKey] = useState('');
  const [mozLoading, setMozLoading] = useState(false);
  const [mozError, setMozError] = useState('');
  const [mozSuccess, setMozSuccess] = useState('');

  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    lastSyncAt?: string;
    syncStatus?: string;
    oauthAvailable?: boolean;
    syncError?: string;
    ga4PropertyId?: string;
    gscSiteUrl?: string;
  } | null>(null);
  const [googleSyncMsg, setGoogleSyncMsg] = useState('');
  const [ga4PropId, setGa4PropId] = useState('');
  const [gscUrl, setGscUrl] = useState('');

  const fetchFbBotStatus = useCallback(async () => {
    try {
      const s = await apiJson<{ botReady: boolean }>('/social/facebook/status');
      setFbBotStatus(s);
    } catch {
      setFbBotStatus(null);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await apiFetch('/social');
      if (res.ok) setConnections(await res.json());
      void fetchFbBotStatus();
    } catch {
      // Ignore
    }
  }, [fetchFbBotStatus]);

  const fetchGoogle = useCallback(async () => {
    try {
      const data = await apiJson<{
        connected: boolean;
        ga4PropertyId?: string;
        gscSiteUrl?: string;
        lastSyncAt?: string;
        syncStatus?: string;
        oauthAvailable?: boolean;
        syncError?: string;
      }>('/google/status');
      setGoogleStatus(data);
      if (data) {
        setGa4PropId(data.ga4PropertyId || '');
        setGscUrl(data.gscSiteUrl || '');
        if (data.syncError) {
          setGoogleSyncMsg(`${t('Lỗi')}: ${data.syncError}`);
        } else {
          setGoogleSyncMsg('');
        }
      }
    } catch {
      setGoogleStatus(null);
    }
  }, [t]);

  useEffect(() => {
    setTimeout(() => {
      fetchConnections();
      fetchGoogle();
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('google') === 'connected') {
        fetchGoogle();
      }
    }, 0);
  }, [fetchConnections, fetchGoogle]);

  const connectGoogle = async () => {
    const { url } = await apiJson<{ url: string }>('/google/auth-url');
    window.location.href = url;
  };

  const syncGoogle = async () => {
    setGoogleSyncMsg(t('Đang đồng bộ...'));
    const r = await apiJson<{ success: boolean; message: string }>('/google/sync', { method: 'POST' });
    setGoogleSyncMsg(r.message);
    fetchGoogle();
  };

  const saveGoogleConfig = async () => {
    setGoogleSyncMsg(t('Đang lưu cấu hình...'));
    try {
      await apiJson('/google/config', {
        method: 'PATCH',
        body: JSON.stringify({ ga4PropertyId: ga4PropId, gscSiteUrl: gscUrl })
      });
      setGoogleSyncMsg(t('Đã lưu cấu hình! Đang đồng bộ dữ liệu...'));
      const r = await apiJson<{ success: boolean; message: string }>('/google/sync', { method: 'POST' });
      setGoogleSyncMsg(r.message);
      fetchGoogle();
    } catch (err: any) {
      setGoogleSyncMsg(err.message || t('Lỗi cấu hình'));
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm(t('Bạn có chắc chắn muốn ngắt kết nối tài khoản Google không?'))) return;
    try {
      await apiFetch('/google', { method: 'DELETE' });
      setGoogleSyncMsg('');
      fetchGoogle();
    } catch (err) {
      console.error(err);
    }
  };

  const getConn = (platform: string) => connections.find(c => c.platform === platform && c.status === 'CONNECTED');

  const handleDisconnect = async (platform: string) => {
    await apiFetch(`/social/${platform}`, { method: 'DELETE' });
    fetchConnections();
  };

  const handleEmailTest = async () => {
    setEmailTestLoading(true);
    setEmailTestMsg('');
    setEmailError('');
    try {
      const res = await apiFetch('/social/email/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setEmailTestMsg(data.message || t('Đã gửi email test thành công!'));
      } else {
        setEmailError(data.error || t('Gửi email test thất bại'));
      }
    } catch {
      setEmailError(t('Lỗi kết nối máy chủ'));
    }
    setEmailTestLoading(false);
  };

  // ===== EMAIL =====
  const handleEmailConnect = async () => {
    setEmailLoading(true); setEmailError(''); setEmailSuccess('');
    try {
      const res = await apiFetch('/social/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr, password: emailPass })
      });
      const data = await res.json();
      if (data.success) {
        setEmailSuccess(`${t('Đã kết nối:')} ${data.email} (${data.smtpHost})`);
        setEmailMode('idle');
        fetchConnections();
      } else {
        setEmailError(data.error || t('Không thể kết nối'));
      }
    } catch { setEmailError(t('Lỗi kết nối máy chủ')); }
    setEmailLoading(false);
  };



  const handleGoogleUnifiedConnect = async () => {
    setEmailLoading(true); setEmailError(''); setEmailSuccess('');
    try {
      const workspaceId = localStorage.getItem('workspaceId') || '0';
      const data = await apiJson<{ url: string }>(`/auth/social/google/url?action=connect&workspaceId=${workspaceId}`);
      if (data.url) {
        const popup = window.open(data.url, 'google_oauth', 'width=600,height=700,scrollbars=yes');
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'social_connected' && event.data?.platform === 'google') {
            fetchConnections();
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);

        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            setEmailLoading(false);
            fetchConnections();
          }
        }, 1000);
      } else {
        setEmailError(t('Không tạo được đường dẫn kết nối Google.'));
        setEmailLoading(false);
      }
    } catch (e: unknown) {
      setEmailError(e instanceof Error ? e.message : t('Lỗi kết nối máy chủ.'));
      setEmailLoading(false);
    }
  };

  // ===== MAILCHIMP =====
  const handleMailchimpConnect = async () => {
    setMcLoading(true); setMcError(''); setMcSuccess('');
    try {
      const res = await apiFetch('/social/mailchimp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: mcApiKey, serverPrefix: mcServer })
      });
      const data = await res.json();
      if (data.success) {
        setMcSuccess(t('Đã kết nối Mailchimp thành công!'));
        setMailchimpMode('idle');
        fetchConnections();
      } else {
        setMcError(data.error || t('Không thể kết nối'));
      }
    } catch { setMcError(t('Lỗi kết nối máy chủ')); }
    setMcLoading(false);
  };

  // ===== TELEGRAM =====
  const handleTelegramConnect = async () => {
    setTgLoading(true); setTgError(''); setTgSuccess('');
    try {
      const res = await apiFetch('/social/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: tgBotToken, chatId: tgChatId })
      });
      const data = await res.json();
      if (data.success) {
        setTgSuccess(t('Đã kết nối Telegram Bot thành công!'));
        setTelegramMode('idle');
        fetchConnections();
      } else {
        setTgError(data.error || t('Không thể kết nối'));
      }
    } catch { setTgError(t('Lỗi kết nối máy chủ')); }
    setTgLoading(false);
  };

  // ===== REDDIT =====
  const handleRedditConnect = async () => {
    setRdLoading(true); setRdError(''); setRdSuccess('');
    try {
      const res = await apiFetch('/social/reddit/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: rdClientId,
          clientSecret: rdClientSecret,
          username: rdUsername,
          password: rdPassword,
          subreddit: rdSubreddit
        })
      });
      const data = await res.json();
      if (data.success) {
        setRdSuccess(t('Đã kết nối Reddit thành công!'));
        setRedditMode('idle');
        fetchConnections();
      } else {
        setRdError(data.error || t('Không thể kết nối'));
      }
    } catch { setRdError(t('Lỗi kết nối máy chủ')); }
    setRdLoading(false);
  };

  // ===== MOZ =====
  const handleMozConnect = async () => {
    setMozLoading(true); setMozError(''); setMozSuccess('');
    try {
      const res = await apiFetch('/social/moz/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessId: mozAccessId, secretKey: mozSecretKey })
      });
      const data = await res.json();
      if (data.success) {
        setMozSuccess(t('Đã kết nối Moz API thành công!'));
        setMozMode('idle');
        fetchConnections();
      } else {
        setMozError(data.error || t('Không thể kết nối'));
      }
    } catch { setMozError(t('Lỗi kết nối máy chủ')); }
    setMozLoading(false);
  };

  // ===== UI =====
  const fbConn = getConn('facebook') as Connection | undefined;
  const emailConn = getConn('email');
  const zaloConn = getConn('zalo');
  const mailchimpConn = getConn('mailchimp');
  const telegramConn = getConn('telegram');
  const redditConn = getConn('reddit');
  const mozConn = getConn('moz');
  const tiktokConn = getConn('tiktok');
  const tiktokshopConn = getConn('tiktokshop');

  const isFbConnected = !!fbConn;
  const isFbReady = isFbConnected && (fbBotStatus ? fbBotStatus.botReady : true);

  return (
    <div className="page-container max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t('Cài đặt hệ thống')}</h1>
        <p className="text-slate-500 text-sm mt-1.5">{t('Quản lý tích hợp, bảo mật tài khoản và giám sát hoạt động')}</p>
      </div>

      {/* ===== TAB SELECTOR ===== */}
      <div className="flex border-b border-slate-200 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none ${
            activeTab === 'integrations'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('Tích hợp & Kết nối')}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none ${
            activeTab === 'security'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('Bảo mật & 2FA')}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none ${
            activeTab === 'audit'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('Nhật ký hoạt động')}
        </button>
      </div>

      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* ===== THỐNG KÊ NHANH ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { 
            label: 'Facebook', 
            connected: isFbConnected, 
            statusText: isFbConnected ? (isFbReady ? t('Đã kết nối') : t('Lỗi quyền gửi bài')) : t('Chưa kết nối'),
            statusColor: isFbConnected ? (isFbReady ? 'text-green-600' : 'text-amber-600') : 'text-gray-400',
            dotColor: isFbConnected ? (isFbReady ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse') : 'bg-gray-300',
            borderColor: isFbConnected ? (isFbReady ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white') : 'border-gray-100 bg-white'
          },
          { 
            label: 'Email', 
            connected: !!emailConn, 
            statusText: emailConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: emailConn ? 'text-green-600' : 'text-gray-400',
            dotColor: emailConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: emailConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: 'Zalo', 
            connected: !!zaloConn, 
            statusText: zaloConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: zaloConn ? 'text-green-600' : 'text-gray-400',
            dotColor: zaloConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: zaloConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: 'TikTok Shop', 
            connected: !!tiktokshopConn, 
            statusText: tiktokshopConn ? t('Đang đồng bộ') : t('Chưa kết nối'),
            statusColor: tiktokshopConn ? 'text-green-600' : 'text-gray-400',
            dotColor: tiktokshopConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: tiktokshopConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: t('Kênh TikTok'), 
            connected: !!tiktokConn, 
            statusText: tiktokConn ? t('Sẵn sàng') : t('Chưa kết nối'),
            statusColor: tiktokConn ? 'text-green-600' : 'text-gray-400',
            dotColor: tiktokConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: tiktokConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: 'Mailchimp', 
            connected: !!mailchimpConn, 
            statusText: mailchimpConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: mailchimpConn ? 'text-green-600' : 'text-gray-400',
            dotColor: mailchimpConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: mailchimpConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: 'Telegram', 
            connected: !!telegramConn, 
            statusText: telegramConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: telegramConn ? 'text-green-600' : 'text-gray-400',
            dotColor: telegramConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: telegramConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: 'Reddit', 
            connected: !!redditConn, 
            statusText: redditConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: redditConn ? 'text-green-600' : 'text-gray-400',
            dotColor: redditConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: redditConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
          { 
            label: 'Moz API', 
            connected: !!mozConn, 
            statusText: mozConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: mozConn ? 'text-green-600' : 'text-gray-400',
            dotColor: mozConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: mozConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          },
        ].map(item => (
          <div key={item.label} className={`rounded-xl p-4 border-2 transition-all ${item.borderColor}`}>
            <div className="flex items-center gap-3">
              <div>
                <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                <p className={`text-xs font-medium flex items-center gap-1 ${item.statusColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor}`}></span>
                  {item.statusText}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 border-2 border-violet-100">
        <h2 className="font-bold text-slate-900 mb-2">Google Analytics &amp; Search Console</h2>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              googleStatus?.connected 
                ? (googleStatus?.syncStatus === 'CONNECTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') 
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {googleStatus?.syncStatus || 'DISCONNECTED'}
          </span>
          {googleStatus?.lastSyncAt && (
            <span className="text-xs text-slate-500">
              Sync: {new Date(googleStatus.lastSyncAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
          )}
          {googleStatus?.oauthAvailable && (
            <button 
              type="button" 
              className={googleStatus?.connected ? "btn-secondary text-xs px-3 py-1.5" : "btn-primary text-sm"} 
              onClick={connectGoogle}
            >
              {googleStatus?.connected ? t('Kết nối lại (Đổi tài khoản)') : t('Kết nối Google OAuth')}
            </button>
          )}
          {googleStatus?.connected && (
            <button 
              type="button" 
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer" 
              onClick={disconnectGoogle}
            >
              {t('Ngắt kết nối')}
            </button>
          )}
        </div>

        {googleStatus?.connected && (
          <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  GA4 Property ID
                </label>
                <input
                  type="text"
                  value={ga4PropId}
                  onChange={(e) => setGa4PropId(e.target.value)}
                  placeholder="e.g. 539718603"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-brand/40"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {t('ID tài sản Google Analytics 4 (chuỗi số từ trang quản trị GA4)')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Search Console Site URL
                </label>
                <input
                  type="text"
                  value={gscUrl}
                  onChange={(e) => setGscUrl(e.target.value)}
                  placeholder="e.g. https://yourwebsite.com/ or sc-domain:yourwebsite.com"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-brand/40"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {t('Đường dẫn website đã xác thực trong Google Search Console')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2.5">
              <button 
                type="button" 
                className="btn-primary text-xs px-3.5 py-2 cursor-pointer" 
                onClick={saveGoogleConfig}
              >
                {t('Lưu & Đồng bộ dữ liệu')}
              </button>
              <button 
                type="button" 
                className="btn-secondary text-xs px-3.5 py-2 cursor-pointer" 
                onClick={syncGoogle}
              >
                {t('Chỉ đồng bộ ngay')}
              </button>
            </div>
          </div>
        )}

        {googleSyncMsg && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
            {googleSyncMsg}
          </div>
        )}
      </div>

      <FacebookConnectCard connection={fbConn} onConnectionChange={fetchConnections} />

      {/* ===== EMAIL ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Email Marketing</h3>
                {emailConn ? (
                  <p className="text-sm text-green-600 font-medium">{emailConn.pageName}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t('Gửi email quảng cáo tự động (Gmail, Outlook, Yahoo...)')}</p>
                )}
              </div>
            </div>
            {emailConn ? (
              <div className="flex gap-2">
                <button
                  onClick={handleEmailTest}
                  disabled={emailTestLoading}
                  className="px-4 py-2 text-sm font-medium text-[#EA4335] bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {emailTestLoading ? t('Đang gửi...') : t('Gửi test')}
                </button>
                <button onClick={() => handleDisconnect('email')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  {t('Ngắt kết nối')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleGoogleUnifiedConnect}
                  disabled={emailLoading}
                  className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  style={{ background: '#EA4335' }}
                >
                  {emailLoading ? t('Đang kết nối...') : t('Google OAuth (Một chạm)')}
                </button>
                <button 
                  onClick={() => { setEmailMode('form'); setEmailError(''); setEmailSuccess(''); }} 
                  className="px-4 py-2 text-sm font-medium text-[#EA4335] bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  {t('SMTP Thủ công')}
                </button>
              </div>
            )}
          </div>

          {emailSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{emailSuccess}</div>}
          {emailTestMsg && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{emailTestMsg}</div>}
          {emailError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{emailError}</div>}

          {emailMode === 'form' && !emailConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-red-50 rounded-lg p-4 text-sm text-red-700">
                <p className="font-bold mb-1">{t('Hướng dẫn cho Gmail:')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('Vào')} <a href="https://myaccount.google.com/apppasswords" target="_blank" className="underline font-medium">Google App Passwords</a></li>
                  <li>{t('Tạo "Mật khẩu ứng dụng" mới (chọn loại: Mail)')}</li>
                  <li>{t('Copy mật khẩu 16 ký tự và dán vào ô bên dưới')}</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Địa chỉ Email')}</label>
                  <input type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} placeholder="yourname@gmail.com" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-red-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Mật khẩu ứng dụng')}</label>
                  <input type="password" value={emailPass} onChange={e => setEmailPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-red-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEmailMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleEmailConnect} disabled={!emailAddr || !emailPass || emailLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#EA4335' }}>
                  {emailLoading ? t('Đang kiểm tra...') : t('Kết nối ngay')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ZaloConnectCard onConnectionChange={fetchConnections} />

      <TikTokConnectCard onConnectionChange={fetchConnections} />

      {/* ===== MAILCHIMP ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Mailchimp</h3>
                {mailchimpConn ? (
                  <p className="text-sm text-green-600 font-medium">{t('Đã cấu hình API key')}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t('Gửi chiến dịch Email & đồng bộ danh sách với Mailchimp')}</p>
                )}
              </div>
            </div>
            {mailchimpConn ? (
              <button onClick={() => handleDisconnect('mailchimp')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                {t('Ngắt kết nối')}
              </button>
            ) : (
              <button onClick={() => { setMailchimpMode('form'); setMcError(''); setMcSuccess(''); }} className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors" style={{ background: '#007C89' }}>
                {t('Kết nối Mailchimp')}
              </button>
            )}
          </div>

          {mcSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{mcSuccess}</div>}
          {mcError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{mcError}</div>}

          {mailchimpMode === 'form' && !mailchimpConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-teal-50 rounded-lg p-4 text-sm text-teal-900">
                <p className="font-bold mb-1">{t('Cách lấy API Key & Server Prefix:')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('Truy cập Mailchimp → Account → Marketing API keys để tạo key')}</li>
                  <li>{t('Server Prefix là phần đuôi của API key (vd: us19) hoặc URL admin của bạn')}</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mailchimp API Key</label>
                  <input type="password" value={mcApiKey} onChange={e => setMcApiKey(e.target.value)} placeholder="e.g. xxxxxxxx-us19" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Server Prefix (Ví dụ: us19)')}</label>
                  <input type="text" value={mcServer} onChange={e => setMcServer(e.target.value)} placeholder="e.g. us19" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMailchimpMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleMailchimpConnect} disabled={!mcApiKey || !mcServer || mcLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#007C89' }}>
                  {mcLoading ? t('Đang kết nối...') : t('Kết nối ngay')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== TELEGRAM BOT ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Telegram Bot</h3>
                {telegramConn ? (
                  <p className="text-sm text-green-600 font-medium">{telegramConn.pageName}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t('Tự động đăng thông báo & bài viết lên Telegram Chat/Channel')}</p>
                )}
              </div>
            </div>
            {telegramConn ? (
              <button onClick={() => handleDisconnect('telegram')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                {t('Ngắt kết nối')}
              </button>
            ) : (
              <button onClick={() => { setTelegramMode('form'); setTgError(''); setTgSuccess(''); }} className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors" style={{ background: '#26A5E4' }}>
                {t('Kết nối Telegram Bot')}
              </button>
            )}
          </div>

          {tgSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{tgSuccess}</div>}
          {tgError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{tgError}</div>}

          {telegramMode === 'form' && !telegramConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
                <p className="font-bold mb-1">{t('Cách kết nối Telegram Bot:')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('Chat với @BotFather trên Telegram để tạo Bot mới và lấy Token')}</li>
                  <li>{t('Thêm Bot vào Chat/Group/Channel của bạn với quyền Administrator')}</li>
                  <li>{t('Nhập Bot Token và Chat/Channel ID (Ví dụ: -100123456789) vào bên dưới')}</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Telegram Bot Token (Từ @BotFather)')}</label>
                  <input type="password" value={tgBotToken} onChange={e => setTgBotToken(e.target.value)} placeholder="e.g. 123456789:ABCdef..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Telegram Chat hoặc Channel ID (Ví dụ: -100xxx hoặc @tenchannel)')}</label>
                  <input type="text" value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="e.g. -100123456789" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTelegramMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleTelegramConnect} disabled={!tgBotToken || !tgChatId || tgLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#26A5E4' }}>
                  {tgLoading ? t('Đang kết nối...') : t('Kết nối ngay')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== REDDIT AUTOMATION ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reddit Automation</h3>
                {redditConn ? (
                  <p className="text-sm text-green-600 font-medium">{redditConn.pageName}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t('Tự động chia sẻ bài viết lên các Subreddit Reddit')}</p>
                )}
              </div>
            </div>
            {redditConn ? (
              <button onClick={() => handleDisconnect('reddit')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                {t('Ngắt kết nối')}
              </button>
            ) : (
              <button onClick={() => { setRedditMode('form'); setRdError(''); setRdSuccess(''); }} className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors" style={{ background: '#FF4500' }}>
                {t('Kết nối Reddit')}
              </button>
            )}
          </div>

          {rdSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{rdSuccess}</div>}
          {rdError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{rdError}</div>}

          {redditMode === 'form' && !redditConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-orange-50 rounded-lg p-4 text-sm text-orange-900">
                <p className="font-bold mb-1">{t('Cách tạo Reddit App:')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('Truy cập Reddit App Preferences')}</li>
                  <li>{t('Tạo ứng dụng dạng "script" để lấy Client ID và Secret')}</li>
                  <li>{t('Điền chính xác tài khoản Reddit của bạn để làm người đăng bài')}</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Reddit Client ID (Từ reddit app)')}</label>
                  <input type="text" value={rdClientId} onChange={e => setRdClientId(e.target.value)} placeholder="Client ID..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Reddit Client Secret')}</label>
                  <input type="password" value={rdClientSecret} onChange={e => setRdClientSecret(e.target.value)} placeholder="Client Secret..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Tên tài khoản Reddit')}</label>
                  <input type="text" value={rdUsername} onChange={e => setRdUsername(e.target.value)} placeholder="Username..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Mật khẩu Reddit')}</label>
                  <input type="password" value={rdPassword} onChange={e => setRdPassword(e.target.value)} placeholder="Password..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-200 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Subreddit mục tiêu (Ví dụ: test)')}</label>
                  <input type="text" value={rdSubreddit} onChange={e => setRdSubreddit(e.target.value)} placeholder="e.g. test" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRedditMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleRedditConnect} disabled={!rdClientId || !rdClientSecret || !rdUsername || !rdPassword || !rdSubreddit || rdLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#FF4500' }}>
                  {rdLoading ? t('Đang kết nối...') : t('Kết nối ngay')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== MOZ API ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Moz Link Explorer</h3>
                {mozConn ? (
                  <p className="text-sm text-green-600 font-medium">{mozConn.pageName}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t('Đo lường độ uy tín DA/PA của backlinks')}</p>
                )}
              </div>
            </div>
            {mozConn ? (
              <button onClick={() => handleDisconnect('moz')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                {t('Ngắt kết nối')}
              </button>
            ) : (
              <button onClick={() => { setMozMode('form'); setMozError(''); setMozSuccess(''); }} className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors" style={{ background: '#00A3E0' }}>
                {t('Kết nối Moz API')}
              </button>
            )}
          </div>

          {mozSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{mozSuccess}</div>}
          {mozError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{mozError}</div>}

          {mozMode === 'form' && !mozConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-sky-50 rounded-lg p-4 text-sm text-sky-950">
                <p className="font-bold mb-1">{t('Cách lấy Moz API Key:')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('Đăng ký tài khoản Moz Community miễn phí hoặc trả phí')}</li>
                  <li>{t('Vào mục API Dashboard để tạo Access ID và Secret Key')}</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Moz Access ID')}</label>
                  <input type="text" value={mozAccessId} onChange={e => setMozAccessId(e.target.value)} placeholder="Access ID..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-sky-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('Moz Secret Key')}</label>
                  <input type="password" value={mozSecretKey} onChange={e => setMozSecretKey(e.target.value)} placeholder="Secret Key..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-sky-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMozMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleMozConnect} disabled={!mozAccessId || !mozSecretKey || mozLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#00A3E0' }}>
                  {mozLoading ? t('Đang kết nối...') : t('Kết nối ngay')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

        </div>
      )}

      {activeTab === 'security' && (
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">{t('Bảo mật 2FA (TOTP)')}</h2>
          <TwoFactorSection />
        </div>
      )}

      {activeTab === 'audit' && (
        <AuditLogsTab />
      )}
    </div>
  );
}

// Stub function to satisfy target matching

function TwoFactorSection() {
  const { t } = useLocale();
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    apiJson<{ enabled: boolean }>('/auth/2fa/status')
      .then((s) => setEnabled(s.enabled))
      .catch(() => {});
  }, []);

  const doSetup = async () => {
    setErr('');
    try {
      const r = await apiJson<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {
        method: 'POST',
      });
      setSetup(r);
      setMsg(t('Quét otpauth URL trong Google Authenticator (hoặc nhập secret thủ công).'));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('Lỗi setup'));
    }
  };

  const enable = async () => {
    setErr('');
    try {
      await apiJson('/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setEnabled(true);
      setSetup(null);
      setMsg(t('Đã bật 2FA — lần đăng nhập sau cần mã 6 số.'));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('Lỗi'));
    }
  };

  const disable = async () => {
    setErr('');
    try {
      await apiJson('/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setEnabled(false);
      setMsg(t('Đã tắt 2FA'));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t('Lỗi'));
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">{t('Trạng thái:')} {enabled ? t('Đang bật') : t('Chưa bật')}</p>
      {msg && <p className="text-emerald-700">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
      {setup && (
        <div className="bg-slate-50 p-3 rounded-lg text-xs break-all space-y-2">
          <p>
            <strong>Secret:</strong> {setup.secret}
          </p>
          <p>
            <strong>URI:</strong> {setup.otpauthUrl}
          </p>
        </div>
      )}
      <input
        className="input max-w-xs"
        placeholder={t('Mã 6 số')}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      <div className="flex flex-wrap gap-2">
        {!enabled && (
          <>
            <button type="button" className="btn-secondary" onClick={doSetup}>
              {t('Tạo mã QR')}
            </button>
            <button type="button" className="btn-primary" onClick={enable}>
              {t('Bật 2FA')}
            </button>
          </>
        )}
        {enabled && (
          <button type="button" className="btn-secondary" onClick={disable}>
            {t('Tắt 2FA')}
          </button>
        )}
      </div>
    </div>
  );
}
