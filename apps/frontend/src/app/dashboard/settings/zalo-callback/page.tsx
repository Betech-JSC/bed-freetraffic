'use client';

import { useEffect } from 'react';
import { useLocale } from '@/context/LocaleContext';

export default function LegacyZaloCallbackRedirect() {
  const { t } = useLocale();

  useEffect(() => {
    const q = window.location.search;
    window.location.replace(`/oauth/zalo-callback${q}`);
  }, []);

  return (
    <p className="p-8 text-center text-sm text-gray-500">{t('Đang chuyển hướng OAuth...')}</p>
  );
}

