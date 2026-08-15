import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradient' | 'outline' | 'os';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  className,
  variant = 'default',
  hover = false,
  padding = 'lg',
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-[#EEE6FF] border border-[#D9C5FF] shadow-[0_24px_60px_rgba(114,60,193,0.12)]',
    glass: 'bg-white/90 backdrop-blur-xl border border-[#DDD6FE] shadow-sm',
    gradient: 'bg-gradient-to-br from-[#F6F1FF] via-[#FCEEF8] to-[#EEE6FF] border border-[#D9C5FF] shadow-sm',
    outline: 'bg-[#FCEEF8] border border-[#F4D3E9] shadow-sm',
    os: 'bg-[#F0E9FF] border border-[#D9C5FF] shadow-sm',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'rounded-3xl shadow-sm transition-shadow',
        variants[variant],
        paddings[padding],
        hover && 'hover:shadow-md hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-lg font-semibold text-slate-800', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-slate-600 mt-1 leading-relaxed', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 pt-4 border-t border-surface-100', className)} {...props} />;
}
