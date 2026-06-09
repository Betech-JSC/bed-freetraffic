'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Locale } from '../lib/i18n';

type LocaleContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (text: string) => string;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi');

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved === 'vi' || saved === 'en') {
      setTimeout(() => {
        setLocaleState(saved);
      }, 0);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (text: string): string => {
    const dict = (translations[locale] as unknown as Record<string, string>) || {};
    return dict[text] || (translations['vi'] as unknown as Record<string, string>)[text] || text;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
