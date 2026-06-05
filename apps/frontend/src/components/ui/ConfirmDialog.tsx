'use client';

import { useEffect, useId, useRef } from 'react';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'neutral';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  /** Tên đối tượng (chiến dịch, bản ghi…) hiển thị nổi bật */
  highlight?: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

const variantStyles: Record<
  ConfirmDialogVariant,
  { iconBg: string; iconRing: string; button: string; accent: string }
> = {
  danger: {
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
    iconRing: 'ring-red-500/20',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/40 shadow-red-600/25',
    accent: 'border-red-100 bg-red-50/80 text-red-950',
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconRing: 'ring-amber-500/20',
    button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/40 shadow-amber-600/25',
    accent: 'border-amber-100 bg-amber-50/80 text-amber-950',
  },
  neutral: {
    iconBg: 'bg-gradient-to-br from-slate-600 to-slate-800',
    iconRing: 'ring-slate-500/20',
    button: 'bg-brand hover:opacity-95 focus-visible:ring-brand/40 shadow-brand/20',
    accent: 'border-slate-200 bg-slate-50 text-slate-900',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  highlight,
  details,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onClick={() => !loading && onCancel()}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]" />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative w-full max-w-md rounded-2xl border border-white/20 bg-white shadow-2xl shadow-slate-900/20 animate-[modalIn_0.22s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent opacity-80" />

        <div className="p-6 sm:p-7">
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {highlight && (
            <div className={`mt-5 rounded-xl border px-4 py-3 ${styles.accent}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">Đối tượng</p>
              <p className="text-sm font-semibold truncate" title={highlight}>
                {highlight}
              </p>
            </div>
          )}

          {details && details.length > 0 && (
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              {details.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-slate-400 shrink-0">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="h-11 px-5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void onConfirm()}
              className={`h-11 px-5 rounded-xl text-sm font-semibold text-white shadow-lg disabled:opacity-60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${styles.button}`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
