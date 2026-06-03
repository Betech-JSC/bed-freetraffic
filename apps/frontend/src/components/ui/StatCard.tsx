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
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
};

const glow: Record<string, string> = {
  brand: 'bg-brand/20',
  blue: 'bg-blue-400/20',
  emerald: 'bg-emerald-400/20',
  violet: 'bg-violet-400/20',
  slate: 'bg-slate-400/15',
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
