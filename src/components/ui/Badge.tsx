import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-neutral-100 text-neutral-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    info: 'bg-primary-100 text-primary-700',
    outline: 'bg-transparent border border-neutral-200 text-neutral-600',
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: 'live' | 'offline' | 'error' | 'sleeping' | 'building' }) {
  const statusConfig = {
    live: { variant: 'success' as const, dot: 'bg-success-500', label: 'Live' },
    offline: { variant: 'default' as const, dot: 'bg-neutral-400', label: 'Offline' },
    error: { variant: 'error' as const, dot: 'bg-error-500', label: 'Error' },
    sleeping: { variant: 'warning' as const, dot: 'bg-warning-400', label: 'Sleeping' },
    building: { variant: 'info' as const, dot: 'bg-primary-500', label: 'Building' },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: 'planning' | 'development' | 'testing' | 'deployed' | 'archived' }) {
  const statusConfig = {
    planning: { variant: 'default' as const, label: 'Planning' },
    development: { variant: 'info' as const, label: 'Development' },
    testing: { variant: 'warning' as const, label: 'Testing' },
    deployed: { variant: 'success' as const, label: 'Deployed' },
    archived: { variant: 'outline' as const, label: 'Archived' },
  };

  const config = statusConfig[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
