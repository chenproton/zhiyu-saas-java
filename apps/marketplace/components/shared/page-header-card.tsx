"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatItem {
  label: string
  value: number
  icon: React.ReactNode
  iconClassName?: string
}

interface PageHeaderCardProps {
  title: string
  description?: string
  actions?: React.ReactNode
  stats?: StatItem[]
  className?: string
}

export function PageHeaderCard({
  title,
  description,
  actions,
  stats,
  className,
}: PageHeaderCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div
            className={cn(
              "grid gap-3 mt-3",
              stats.length <= 4 ? `grid-cols-${stats.length}` : "grid-cols-5",
              stats.length === 2 && "grid-cols-2",
              stats.length === 3 && "grid-cols-3",
              stats.length === 4 && "grid-cols-4"
            )}
          >
            {stats.map((stat, idx) => (
              <Card key={idx} className="border-slate-200 shadow-sm w-full">
                <CardContent className="px-3 py-[6px] flex items-center justify-between">
                  <div className="leading-none">
                    <p className="text-xs text-slate-500 leading-none">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-900 leading-none mt-[3px]">{stat.value}</p>
                  </div>
                  <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", stat.iconClassName || "bg-blue-50")}>
                    {stat.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
