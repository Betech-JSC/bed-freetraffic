'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Locale } from '../lib/i18n';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

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
      setLocaleState(saved);
      const cookieValue = saved === 'en' ? '/vi/en' : '/vi/vi';
      if (!document.cookie.includes(`googtrans=${cookieValue}`)) {
        document.cookie = `googtrans=${cookieValue}; path=/;`;
      }
    }

    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'vi',
          includedLanguages: 'en,vi',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false
        }, 'google_translate_element');
      }
    };

    let translateDiv = document.getElementById('google_translate_element');
    if (!translateDiv) {
      translateDiv = document.createElement('div');
      translateDiv.id = 'google_translate_element';
      translateDiv.style.display = 'none';
      document.body.appendChild(translateDiv);
    }

    const existingScript = document.getElementById('google-translate-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    const cookieValue = newLocale === 'en' ? '/vi/en' : '/vi/vi';
    document.cookie = `googtrans=${cookieValue}; path=/;`;
    window.location.reload();
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
