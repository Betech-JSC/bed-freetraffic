'use client';

import { useEffect } from 'react';
import { useLocale } from '@/context/LocaleContext';

/** Chuyển hướng URL OAuth cũ sang route popup gọn */
export default function LegacyFbCallbackRedirect() {
  const { t } = useLocale();

  useEffect(() => {
    const q = window.location.search;
    window.location.replace(`/oauth/fb-callback${q}`);
  }, []);

  return (
    <p className="p-8 text-center text-sm text-gray-500">{t('Đang chuyển hướng OAuth...')}</p>
  );
}

