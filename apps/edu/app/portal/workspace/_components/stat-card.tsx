'use client'

import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'cyan' | 'indigo'
  onClick?: () => void
  className?: string
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  indigo: 'bg-indigo-50 text-indigo-600',
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  color = 'blue',
  onClick,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow rounded-xl',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
              colorMap[color],
            )}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs mt-1 font-medium',
                  trendUp ? 'text-emerald-600' : 'text-gray-400',
                )}
              >
                {trend}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
