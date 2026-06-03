'use client';
import React, { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { FacebookConnectCard } from '@/components/settings/FacebookConnectCard';
import { useLocale } from '@/context/LocaleContext';

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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Zalo state
  const [zaloMode, setZaloMode] = useState<'idle' | 'quick' | 'oauth'>('idle');
  const [zaloToken, setZaloToken] = useState('');
  const [zaloAppId, setZaloAppId] = useState('');
  const [zaloAppSecret, setZaloAppSecret] = useState('');
  const [zaloLoading, setZaloLoading] = useState(false);
  const [zaloError, setZaloError] = useState('');
  const [zaloSuccess, setZaloSuccess] = useState('');

  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    lastSyncAt?: string;
    syncStatus?: string;
    oauthAvailable?: boolean;
  } | null>(null);
  const [googleSyncMsg, setGoogleSyncMsg] = useState('');

  const fetchFbBotStatus = async () => {
    try {
      const s = await apiJson<{ botReady: boolean }>('/social/facebook/status');
      setFbBotStatus(s);
    } catch {
      setFbBotStatus(null);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await apiFetch('/social');
      if (res.ok) setConnections(await res.json());
      setLoading(false);
      void fetchFbBotStatus();
    } catch {
      setLoading(false);
    }
  };

  const fetchGoogle = async () => {
    try {
      setGoogleStatus(await apiJson('/google/status'));
    } catch {
      setGoogleStatus(null);
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchGoogle();
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('google') === 'connected') {
      fetchGoogle();
    }
  }, []);

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

  // ===== ZALO =====
  const handleZaloQuickConnect = async () => {
    setZaloLoading(true); setZaloError(''); setZaloSuccess('');
    try {
      const res = await apiFetch('/social/zalo/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: zaloToken })
      });
      const data = await res.json();
      if (data.success) {
        setZaloSuccess(`${t('Đã kết nối:')} ${data.oaName}`);
        setZaloMode('idle');
        fetchConnections();
      } else {
        setZaloError(data.error || t('Không thể kết nối'));
      }
    } catch { setZaloError(t('Lỗi kết nối máy chủ')); }
    setZaloLoading(false);
  };

  const handleZaloOAuth = async () => {
    setZaloLoading(true); setZaloError('');
    const redirectUri = `${window.location.origin}/oauth/zalo-callback`;
    try {
      const res = await apiFetch('/social/zalo/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: zaloAppId, redirectUri })
      });
      const data = await res.json();
      if (data.url) {
        localStorage.setItem('zalo_oauth', JSON.stringify({ appId: zaloAppId, appSecret: zaloAppSecret, redirectUri }));
        const popup = window.open(data.url, 'zalo_oauth', 'width=600,height=700,scrollbars=yes');
        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            setZaloLoading(false);
            fetchConnections();
          }
        }, 1000);
      }
    } catch { setZaloError(t('Lỗi tạo URL đăng nhập')); setZaloLoading(false); }
  };

  // ===== UI =====
  const fbConn = getConn('facebook') as Connection | undefined;
  const emailConn = getConn('email');
  const zaloConn = getConn('zalo');

  const isFbConnected = !!fbConn;
  const isFbReady = isFbConnected && (fbBotStatus ? fbBotStatus.botReady : true);

  return (
    <div className="page-container max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t('Tích hợp & Kết nối')}</h1>
        <p className="text-slate-500 text-sm mt-1.5">{t('Liên kết tài khoản MXH để Bot tự động đăng bài kéo traffic')}</p>
      </div>

      {/* ===== THỐNG KÊ NHANH ===== */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { 
            label: 'Facebook', 
            connected: isFbConnected, 
            statusText: isFbConnected ? (isFbReady ? t('Đã kết nối') : t('Lỗi quyền gửi bài')) : t('Chưa kết nối'),
            statusColor: isFbConnected ? (isFbReady ? 'text-green-600' : 'text-amber-600') : 'text-gray-400',
            dotColor: isFbConnected ? (isFbReady ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse') : 'bg-gray-300',
            borderColor: isFbConnected ? (isFbReady ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white') : 'border-gray-100 bg-white',
            icon: '📘' 
          },
          { 
            label: 'Email', 
            connected: !!emailConn, 
            statusText: emailConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: emailConn ? 'text-green-600' : 'text-gray-400',
            dotColor: emailConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: emailConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white',
            icon: '📧' 
          },
          { 
            label: 'Zalo', 
            connected: !!zaloConn, 
            statusText: zaloConn ? t('Đã kết nối') : t('Chưa kết nối'),
            statusColor: zaloConn ? 'text-green-600' : 'text-gray-400',
            dotColor: zaloConn ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
            borderColor: zaloConn ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white',
            icon: '💬' 
          },
        ].map(item => (
          <div key={item.label} className={`rounded-xl p-4 border-2 transition-all ${item.borderColor}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
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
        <p className="text-sm text-slate-500 mb-4">
          {t('Admin kết nối')} <strong>{t('một lần')}</strong> {t('bằng Gmail có quyền GA4/GSC (OAuth). Không cần thêm service account trong GA4 nếu Google không chấp nhận email')}{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">@iam.gserviceaccount.com</code>.
          {t('File')} <code className="text-xs bg-slate-100 px-1 rounded">google-credentials.json</code> {t('là tùy chọn dự phòng.')}
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              googleStatus?.connected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
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
            <button type="button" className="btn-primary text-sm" onClick={connectGoogle}>
              {t('Kết nối Google OAuth')}
            </button>
          )}
          <button type="button" className="btn-secondary text-sm" onClick={syncGoogle}>
            {t('Đồng bộ ngay')}
          </button>
        </div>
        {googleSyncMsg && <p className="text-sm text-slate-600 mt-3">{googleSyncMsg}</p>}
      </div>

      <FacebookConnectCard connection={fbConn} onConnectionChange={fetchConnections} />

      {/* ===== EMAIL ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #EA4335, #c5221f)' }}>
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Email Marketing</h3>
                {emailConn ? (
                  <p className="text-sm text-green-600 font-medium">✅ {emailConn.pageName}</p>
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
                  {emailTestLoading ? t('⏳ Đang gửi...') : t('✉️ Gửi test')}
                </button>
                <button onClick={() => handleDisconnect('email')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  {t('Ngắt kết nối')}
                </button>
              </div>
            ) : (
              <button onClick={() => { setEmailMode('form'); setEmailError(''); setEmailSuccess(''); }} className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors" style={{ background: '#EA4335' }}>
                {t('⚡ Kết nối Email')}
              </button>
            )}
          </div>

          {emailSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{emailSuccess}</div>}
          {emailTestMsg && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{emailTestMsg}</div>}
          {emailError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {emailError}</div>}

          {emailMode === 'form' && !emailConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-red-50 rounded-lg p-4 text-sm text-red-700">
                <p className="font-bold mb-1">{t('📌 Hướng dẫn cho Gmail:')}</p>
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
                  {emailLoading ? t('⏳ Đang kiểm tra...') : t('🔌 Kết nối ngay')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== ZALO ===== */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #0068FF, #0050CC)' }}>
                <span className="text-white font-black text-xl">Z</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Zalo Official Account</h3>
                {zaloConn ? (
                  <p className="text-sm text-green-600 font-medium">✅ {zaloConn.pageName}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t('Gửi tin nhắn tự động qua Zalo OA')}</p>
                )}
              </div>
            </div>
            {zaloConn ? (
              <button onClick={() => handleDisconnect('zalo')} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                {t('Ngắt kết nối')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setZaloMode('quick'); setZaloError(''); setZaloSuccess(''); }} className="px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors" style={{ background: '#0068FF' }}>
                  {t('⚡ Kết nối nhanh')}
                </button>
                <button onClick={() => { setZaloMode('oauth'); setZaloError(''); setZaloSuccess(''); }} className="px-4 py-2 text-sm font-medium text-[#0068FF] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  {t('🔗 Đăng nhập OAuth')}
                </button>
              </div>
            )}
          </div>

          {zaloSuccess && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{zaloSuccess}</div>}
          {zaloError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {zaloError}</div>}

          {zaloMode === 'quick' && !zaloConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-bold mb-1">{t('📌 Cách lấy Token Zalo OA:')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('Truy cập')} <a href="https://developers.zalo.me/" target="_blank" className="underline font-medium">Zalo Developers</a></li>
                  <li>{t('Vào mục Zalo OA → Lấy Access Token')}</li>
                  <li>{t('Dán token vào ô bên dưới')}</li>
                </ol>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">OA Access Token</label>
                <input type="text" value={zaloToken} onChange={e => setZaloToken(e.target.value)} placeholder={t('Dán Access Token...')} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setZaloMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleZaloQuickConnect} disabled={!zaloToken || zaloLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#0068FF' }}>
                  {zaloLoading ? t('⏳ Đang kết nối...') : t('🔌 Kết nối ngay')}
                </button>
              </div>
            </div>
          )}

          {zaloMode === 'oauth' && !zaloConn && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-bold mb-1">{t('🔐 Đăng nhập OAuth tự động:')}</p>
                <p>{t('Nhập App ID & Secret Key từ')} <a href="https://developers.zalo.me/" target="_blank" className="underline font-medium">Zalo Developers</a></p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">App ID</label>
                  <input type="text" value={zaloAppId} onChange={e => setZaloAppId(e.target.value)} placeholder="App ID..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Secret Key</label>
                  <input type="password" value={zaloAppSecret} onChange={e => setZaloAppSecret(e.target.value)} placeholder="Secret Key..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setZaloMode('idle')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">{t('Hủy')}</button>
                <button onClick={handleZaloOAuth} disabled={!zaloAppId || !zaloAppSecret || zaloLoading} className="px-5 py-2 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50" style={{ background: '#0068FF' }}>
                  {zaloLoading ? t('⏳ Đang mở Zalo...') : t('🚀 Đăng nhập Zalo')}
                </button>
              </div>
            </div>
          )}
        </div>

        <MailchimpStatusSection />

        <div className="card p-6 mt-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">{t('Bảo mật 2FA (TOTP)')}</h2>
          <TwoFactorSection />
        </div>
      </div>
    </div>
  );
}

function MailchimpStatusSection() {
  const { t } = useLocale();
  const [info, setInfo] = useState<{ configured: boolean; message: string } | null>(null);

  useEffect(() => {
    apiJson<{ configured: boolean; message: string }>('/integrations/mailchimp/status')
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  if (!info) return null;

  return (
    <div className="card p-6 mt-6">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Mailchimp (FR-12)</h2>
      <p className={`text-sm ${info.configured ? 'text-green-700' : 'text-slate-600'}`}>
        {info.configured ? t('✅ Đã cấu hình API key') : t('⚠️ Chưa cấu hình')} — {info.message}
      </p>
    </div>
  );
}

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
      <p className="text-slate-600">{t('Trạng thái:')} {enabled ? t('✅ Đang bật') : t('Chưa bật')}</p>
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
