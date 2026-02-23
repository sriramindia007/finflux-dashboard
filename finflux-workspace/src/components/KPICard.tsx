import { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface KPICardProps {
    title: string;
    value: string | number;
    subValue?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    icon?: LucideIcon;
    className?: string;
}

const KPICard = memo(({ title, value, subValue, trend, trendValue, icon: Icon, className }: KPICardProps) => {
    return (
        <div className={cn("bg-white p-4 rounded-lg border border-secondary-200 shadow-sm hover:shadow-md transition-shadow", className)}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-secondary-500 text-xs font-semibold uppercase tracking-wider">{title}</h3>
                {Icon && (
                    <div className="p-1.5 bg-primary-50 text-primary-600 rounded-md">
                        <Icon size={16} />
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xl font-bold text-secondary-900">{value}</span>
                {subValue && <span className="text-xs text-secondary-400 font-medium truncate max-w-[120px]">{subValue}</span>}
            </div>
            {trendValue && (
                <div className={cn("flex items-center gap-1 text-[10px] font-medium",
                    trend === 'up' ? "text-emerald-600" : trend === 'down' ? "text-rose-600" : "text-secondary-500"
                )}>
                    <span>{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '•'}</span>
                    <span>{trendValue}</span>
                    <span className="text-secondary-400 font-normal ml-0.5">vs last month</span>
                </div>
            )}
        </div>
    );
});

KPICard.displayName = 'KPICard';

export default KPICard;

