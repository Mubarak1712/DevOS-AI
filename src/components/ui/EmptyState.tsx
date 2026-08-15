import { motion } from 'framer-motion';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'premium';
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'premium',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-14 px-6 text-center"
    >
      <div
        className={
          variant === 'premium'
            ? 'relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 via-purple-50 to-cyan-50 flex items-center justify-center text-violet-500 mb-5 dev-os-glow-ring'
            : 'w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center text-surface-400 mb-4'
        }
      >
        {variant === 'premium' && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-cyan-500/5" />
        )}
        <div className="relative">{icon}</div>
      </div>
      <h3 className="font-display text-lg font-bold text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-surface-600 max-w-md leading-relaxed mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </motion.div>
  );
}
