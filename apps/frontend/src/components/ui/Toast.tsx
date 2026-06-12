'use client';

import React, { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start exit animation slightly before the duration ends
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    // Call onClose when duration is fully complete
    const closeTimer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  };

  // Color mapping based on theme
  const config = {
    success: {
      gradient: 'from-emerald-400 to-teal-500',
      border: 'border-emerald-100/80',
      bgLight: 'bg-emerald-50/50',
      text: 'text-emerald-800',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      progressBg: 'bg-emerald-500',
      title: 'Thành công',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      gradient: 'from-rose-400 to-red-500',
      border: 'border-rose-100/80',
      bgLight: 'bg-rose-50/50',
      text: 'text-rose-800',
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      progressBg: 'bg-rose-500',
      title: 'Gặp lỗi',
      icon: (
        <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    warning: {
      gradient: 'from-amber-400 to-orange-500',
      border: 'border-amber-100/80',
      bgLight: 'bg-amber-50/50',
      text: 'text-amber-800',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      progressBg: 'bg-amber-500',
      title: 'Cảnh báo',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      gradient: 'from-blue-400 to-indigo-500',
      border: 'border-blue-100/80',
      bgLight: 'bg-blue-50/50',
      text: 'text-blue-800',
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      progressBg: 'bg-blue-500',
      title: 'Thông báo',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }[type];

  return (
    <div 
      className={`fixed top-6 right-6 z-[9999] max-w-sm w-[90vw] pointer-events-auto transition-all duration-300 transform ${
        isExiting 
          ? 'opacity-0 translate-y-[-20px] scale-95' 
          : 'opacity-100 translate-y-0 scale-100 animate-[toastIn_0.3s_ease-out]'
      }`}
    >
      <div className={`bg-white/95 backdrop-blur-md border ${config.border} shadow-2xl rounded-2xl p-4 flex items-start gap-3.5 relative overflow-hidden`}>
        {/* Top colored line indicator */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient}`} />
        
        {/* Style tag for progress shrink animation */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shrinkProgress {
            from { width: 100%; }
            to { width: 0%; }
          }
          @keyframes toastIn {
            from {
              opacity: 0;
              transform: translateX(40px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }
        `}} />

        {/* Icon container */}
        <div className={`w-9 h-9 rounded-full ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0 shadow-sm mt-0.5`}>
          {config.icon}
        </div>

        {/* Message body */}
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="font-bold text-slate-800 text-sm tracking-tight">{config.title}</h4>
          <p className="text-slate-600 text-xs mt-1 leading-relaxed whitespace-pre-line break-words">
            {message}
          </p>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress Bar timer */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/70">
          <div
            className={`h-full ${config.progressBg} rounded-r`}
            style={{
              width: '100%',
              animation: `shrinkProgress ${duration}ms linear forwards`
            }}
          />
        </div>
      </div>
    </div>
  );
}
