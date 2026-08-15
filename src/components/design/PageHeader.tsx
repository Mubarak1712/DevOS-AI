import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  variant?: 'default' | 'hero' | 'compact';
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  variant = 'default',
  className,
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative',
        variant === 'hero' && 'mb-10',
        variant === 'default' && 'mb-8',
        variant === 'compact' && 'mb-6',
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="dev-os-eyebrow mb-2 text-slate-500 uppercase tracking-[0.24em] text-[11px] font-semibold">{eyebrow}</p>
          )}
          <h1
            className={cn(
              'font-display font-bold tracking-tight',
              variant === 'hero' && 'text-3xl sm:text-4xl',
              variant === 'default' && 'text-2xl sm:text-3xl',
              variant === 'compact' && 'text-xl sm:text-2xl',
              'text-slate-900'
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </motion.header>
  );
}
