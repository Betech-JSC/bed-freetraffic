'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('fb_oauth');
    if (raw) {
      const { authToken } = JSON.parse(raw) as { authToken?: string };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
    }
  } catch {
    /* ignore */
  }
  return headers;
}

interface FbPage {
  id: string;
  name: string;
  access_token?: string;
}

export default function FacebookCallbackPage() {
  const { t } = useLocale();
  const [status, setStatus] = useState<'loading' | 'select' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [pages, setPages] = useState<FbPage[]>([]);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    setMessage(t('Đang xác thực với Facebook...'));
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error_description') || params.get('error');

      if (error) {
        setStatus('error');
        setMessage(decodeURIComponent(error));
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage(t('Không nhận được mã xác thực từ Facebook.'));
        return;
      }

      const raw = localStorage.getItem('fb_oauth');
      if (!raw) {
        setStatus('error');
        setMessage(t('Thiếu cấu hình OAuth. Hãy thử đăng nhập lại từ trang Settings.'));
        return;
      }

      const { appId, appSecret, redirectUri, preferredPageId } = JSON.parse(raw) as {
        appId: string;
        appSecret: string;
        redirectUri: string;
        preferredPageId?: string;
      };

      try {
        const res = await apiFetch('/social/facebook/callback', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            code,
            appId,
            appSecret,
            redirectUri,
            preferredPageId: preferredPageId?.trim() || undefined,
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          if (Array.isArray(data.pages) && data.pages.length > 0) {
            setPages(data.pages);
            setStatus('select');
            setMessage(data.error || t('Chọn Fanpage bạn muốn kết nối:'));
            return;
          }
          setStatus('error');
          setMessage(data.error || t('Không thể kết nối Facebook.'));
          return;
        }

        localStorage.removeItem('fb_oauth');

        if (data.needsPageSelection && data.pages?.length > 1) {
          setPages(data.pages);
          setStatus('select');
          setMessage(t('Chọn Fanpage bạn muốn kết nối:'));
          return;
        }

        setStatus('success');
        setMessage(`${t('Đã kết nối:')} ${data.connectedPage?.name || 'Facebook Page'}`);
        setTimeout(() => window.close(), 1500);
      } catch {
        setStatus('error');
        setMessage(t('Lỗi kết nối máy chủ.'));
      }
    };

    run();
  }, [t]);

  const handleSelectPage = async (page: FbPage) => {
    if (!page.access_token) {
      setStatus('error');
      setMessage(t('Thiếu Page Access Token. Vui lòng đăng nhập OAuth lại.'));
      return;
    }

    setSelecting(true);
    try {
      const data = await apiJson<{ success: boolean; error?: string }>('/social/facebook/select-page', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pageAccessToken: page.access_token,
          pageId: page.id,
          pageName: page.name,
        }),
      });
      if (data.success) {
        setStatus('success');
        setMessage(`${t('Đã kết nối:')} ${page.name}`);
        setTimeout(() => window.close(), 1500);
      } else {
        setStatus('error');
        setMessage(data.error || t('Không thể chọn Page.'));
      }
    } catch {
      setStatus('error');
      setMessage(t('Lỗi kết nối máy chủ.'));
    }
    setSelecting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
        {status === 'loading' && <div className="text-4xl mb-4 animate-pulse">📘</div>}
        {status === 'success' && <div className="text-4xl mb-4">✅</div>}
        {status === 'error' && <div className="text-4xl mb-4">❌</div>}
        {status === 'select' && <div className="text-4xl mb-4">📘</div>}

        <h1 className="text-lg font-bold text-gray-900 mb-2">Facebook OAuth</h1>
        <p className="text-sm text-gray-600 mb-4">{message}</p>

        {status === 'select' && (
          <div className="space-y-2 text-left">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                disabled={selecting}
                onClick={() => handleSelectPage(page)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 hover:border-[#1877F2] hover:bg-blue-50 text-sm font-medium text-gray-800 transition-colors disabled:opacity-50"
              >
                {page.name}
              </button>
            ))}
          </div>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            {t('Đóng cửa sổ')}
          </button>
        )}
      </div>
    </div>
  );
}

