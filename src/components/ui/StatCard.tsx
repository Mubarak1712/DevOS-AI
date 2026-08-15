import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'primary' | 'cyan' | 'emerald' | 'secondary' | 'warning' | 'error' | 'coral';
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, color = 'primary', subtitle, className }: StatCardProps) {
  const colors = {
    primary: 'bg-slate-100 text-slate-900 shadow-slate-200',
    cyan: 'bg-cyan-50 text-cyan-700 shadow-cyan-200',
    emerald: 'bg-emerald-50 text-emerald-700 shadow-emerald-200',
    secondary: 'bg-violet-50 text-violet-700 shadow-violet-200',
    warning: 'bg-amber-50 text-amber-700 shadow-amber-200',
    error: 'bg-rose-50 text-rose-700 shadow-rose-200',
    coral: 'bg-orange-50 text-orange-700 shadow-orange-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('dev-os-metric group', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{title}</p>
          <p className="font-display text-3xl font-bold text-neutral-900 mt-1 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-surface-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105',
            colors[color]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
