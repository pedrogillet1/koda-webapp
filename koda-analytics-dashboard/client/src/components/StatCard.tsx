import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Size variants for the StatCard component */
type StatCardSize = 'sm' | 'md' | 'lg';

/** Size configuration for different card sizes */
const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    value: 'text-xl',
    trendIcon: 'h-2.5 w-2.5',
    skeleton: { value: 'h-6', subtitle: 'h-2.5', trend: 'h-2.5' }
  },
  md: {
    icon: 'h-4 w-4',
    value: 'text-2xl',
    trendIcon: 'h-3 w-3',
    skeleton: { value: 'h-8', subtitle: 'h-3', trend: 'h-3' }
  },
  lg: {
    icon: 'h-5 w-5',
    value: 'text-3xl',
    trendIcon: 'h-4 w-4',
    skeleton: { value: 'h-10', subtitle: 'h-4', trend: 'h-4' }
  }
} as const;

/**
 * Props for the StatCard component
 */
interface StatCardProps {
  /** The title displayed at the top of the card */
  title: string;
  /** The main value to display (can be string or number) */
  value: string | number;
  /** Optional subtitle text below the value */
  subtitle?: string;
  /** Optional Lucide icon component to display */
  icon?: LucideIcon;
  /** Optional trend indicator with value and label */
  trend?: {
    /** Numeric trend value (positive = up, negative = down) */
    value: number;
    /** Label to display after the trend value */
    label: string;
  };
  /** Optional color class for the icon (defaults to 'text-primary') */
  color?: string;
  /** Optional additional className for the card */
  className?: string;
  /** Optional loading state */
  loading?: boolean;
  /** Size variant: 'sm', 'md' (default), or 'lg' */
  size?: StatCardSize;
}

/**
 * StatCard - A reusable statistics display card component
 *
 * Displays a metric with title, value, optional subtitle, icon, and trend indicator.
 * Supports loading states, size variants, and customizable styling.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <StatCard
 *   title="Total Users"
 *   value={1234}
 *   subtitle="Active this month"
 *   icon={Users}
 *   color="text-blue-500"
 * />
 *
 * // With trend indicator
 * <StatCard
 *   title="Revenue"
 *   value="$12,345"
 *   trend={{ value: 12.5, label: "vs last month" }}
 *   icon={DollarSign}
 *   color="text-green-500"
 * />
 *
 * // Large size variant
 * <StatCard
 *   title="Active Sessions"
 *   value={256}
 *   size="lg"
 *   icon={Activity}
 * />
 * ```
 */
export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'text-primary',
  className,
  loading = false,
  size = 'md'
}: StatCardProps) {
  const config = sizeConfig[size];

  // Loading skeleton state
  if (loading) {
    return (
      <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="h-4 bg-muted rounded w-24 animate-pulse" />
          <div className={cn('bg-muted rounded animate-pulse', config.icon)} />
        </CardHeader>
        <CardContent>
          <div className={cn('bg-muted rounded w-20 animate-pulse', config.skeleton.value)} />
          <div className={cn('bg-muted rounded w-32 mt-2 animate-pulse', config.skeleton.subtitle)} />
          <div className={cn('bg-muted rounded w-24 mt-2 animate-pulse', config.skeleton.trend)} />
        </CardContent>
      </Card>
    );
  }

  // Determine trend direction and styling
  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-green-600 dark:text-green-500';
    if (trend.value < 0) return 'text-red-600 dark:text-red-500';
    return 'text-muted-foreground';
  };

  const TrendIcon = trend ? (trend.value >= 0 ? ArrowUp : ArrowDown) : null;

  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <Icon
            className={cn('transition-colors', config.icon, color)}
            aria-hidden="true"
          />
        )}
      </CardHeader>
      <CardContent>
        <div className={cn('font-bold', config.value)} aria-label={`${title}: ${value}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
        {trend && (
          <div className={cn(
            'mt-2 flex items-center text-xs transition-colors duration-300',
            getTrendColor()
          )}>
            {TrendIcon && (
              <TrendIcon
                className={cn('mr-1 transition-transform duration-300', config.trendIcon)}
                aria-hidden="true"
              />
            )}
            <span className="font-medium tabular-nums transition-all duration-300">
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-muted-foreground ml-1">
              {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
