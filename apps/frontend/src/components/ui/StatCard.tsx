import React from 'react';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: string;
  accent?: 'brand' | 'blue' | 'emerald' | 'violet' | 'slate';
};

const iconBg: Record<string, string> = {
  brand: 'bg-brand/10 text-brand',
  blue: 'bg-brand-light text-brand',
  emerald: 'bg-orange-100/45 text-orange-600',
  violet: 'bg-brand/5 text-orange-500',
  slate: 'bg-slate-100 text-slate-500',
};

const glow: Record<string, string> = {
  brand: 'bg-brand/20',
  blue: 'bg-brand/15',
  emerald: 'bg-orange-500/10',
  violet: 'bg-brand/10',
  slate: 'bg-slate-400/10',
};

export function StatCard({ label, value, icon, trend, accent = 'brand' }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl ${glow[accent]}`} />
      <div className="relative flex justify-between items-start mb-5">
        {icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg[accent]}`}>
            {icon}
          </div>
        )}
        {trend && <span className="badge-brand">{trend}</span>}
      </div>
      <p className="relative text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="relative text-3xl font-extrabold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
