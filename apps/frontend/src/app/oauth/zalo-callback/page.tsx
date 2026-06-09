'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

export default function ZaloCallbackPage() {
  const { t } = useLocale();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setMessage(t('Đang xác thực với Zalo...'));
      const run = async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code') || params.get('oa_id');
        const error = params.get('error_description') || params.get('error');

        if (error) {
          setStatus('error');
          setMessage(decodeURIComponent(error));
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage(t('Không nhận được mã xác thực từ Zalo.'));
          return;
        }

        const raw = localStorage.getItem('zalo_oauth');
        if (!raw) {
          setStatus('error');
          setMessage(t('Thiếu cấu hình OAuth. Hãy thử đăng nhập lại từ trang Settings.'));
          return;
        }

        const { appId, appSecret, redirectUri } = JSON.parse(raw);

        try {
          const res = await apiFetch('/social/zalo/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, appId, appSecret, redirectUri }),
          });
          const data = await res.json();

          if (!res.ok || !data.success) {
            setStatus('error');
            setMessage(data.error || t('Không thể kết nối Zalo.'));
            return;
          }

          localStorage.removeItem('zalo_oauth');
          setStatus('success');
          setMessage(`${t('Đã kết nối:')} ${data.oaName || 'Zalo OA'}`);
          setTimeout(() => window.close(), 1500);
        } catch {
          setStatus('error');
          setMessage(t('Lỗi kết nối máy chủ.'));
        }
      };

      run();
    }, 0);
  }, [t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
        {status === 'loading' && <div className="text-sm font-bold text-slate-500 mb-4 animate-pulse">ĐANG TẢI...</div>}
        {status === 'success' && <div className="text-sm font-bold text-green-600 mb-4">THÀNH CÔNG</div>}
        {status === 'error' && <div className="text-sm font-bold text-red-600 mb-4">LỖI</div>}

        <h1 className="text-lg font-bold text-gray-900 mb-2">Zalo OAuth</h1>
        <p className="text-sm text-gray-600">{message}</p>

        {status === 'error' && (
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-6 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            {t('Đóng cửa sổ')}
          </button>
        )}
      </div>
    </div>
  );
}
