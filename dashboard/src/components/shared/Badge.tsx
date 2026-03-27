import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        variant === 'default' && 'bg-[#22252F] text-[#9CA3AF]',
        variant === 'success' && 'bg-emerald-500/20 text-emerald-400',
        variant === 'warning' && 'bg-amber-500/20 text-amber-400',
        variant === 'error' && 'bg-red-500/20 text-red-400',
        variant === 'info' && 'bg-blue-500/20 text-blue-400',
        variant === 'outline' && 'border border-[#2A2D37] bg-transparent text-[#9CA3AF]',
        className
      )}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  cited: boolean;
  consistency?: number;
}

export function StatusBadge({ cited, consistency = 0 }: StatusBadgeProps) {
  if (!cited) {
    return <Badge variant="error">Not Cited</Badge>;
  }
  if (consistency >= 0.67) {
    return <Badge variant="success">Cited</Badge>;
  }
  return <Badge variant="warning">Intermittent</Badge>;
}
