'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  icon?: LucideIcon
  iconColor?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'cyan' | 'indigo' | 'gray'
  children: ReactNode
  action?: {
    label: string
    onClick?: () => void
  }
  className?: string
  headerClassName?: string
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  gray: 'bg-gray-100 text-gray-600',
}

export function SectionCard({
  title,
  icon: Icon,
  iconColor = 'blue',
  children,
  action,
  className,
  headerClassName,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        'bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden',
        className,
      )}
    >
      {title && (
        <CardHeader className={cn('pb-2 pt-3 px-4', headerClassName)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2.5">
              {Icon && (
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    colorMap[iconColor],
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
              )}
              {title}
            </CardTitle>
            {action && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-auto py-1.5 px-2"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('px-4 pb-4', title ? 'pt-0' : 'pt-3')}>{children}</CardContent>
    </Card>
  )
}
