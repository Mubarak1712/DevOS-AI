import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-[#9B6DFF] text-white shadow-[0_24px_60px_rgba(155,109,255,0.24)] hover:bg-[#8656FF] active:bg-[#6f41e6]',
      secondary: 'bg-[#E8E1FF] text-[#2F1F65] shadow-sm hover:bg-[#D9C1FF]',
      ghost: 'text-[#2F1F65] hover:bg-[#F4EBFF]',
      danger: 'bg-[#FFE4A3] text-[#5D3A00] shadow-sm hover:bg-[#F5D17A]',
      success: 'bg-[#E8FFF3] text-[#065F46] shadow-sm hover:bg-[#C7F6E4]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
