'use client'

import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldRowProps {
  label: ReactNode
  required?: boolean
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  className?: string
  labelClassName?: string
  children: ReactNode
}

/**
 * 通用表单字段行：统一 label + 控件 + 可选提示/错误的结构。
 * 渲染结构为 <div class="grid gap-2"><Label/><children/><hint/><error/></div>，
 * 与历史手写 <div class="grid gap-2"><Label>…</Label><Input …/></div> 保持一致，
 * 替换不会改变 PC 端外观。
 */
export function FormFieldRow({
  label,
  required,
  htmlFor,
  hint,
  error,
  className,
  labelClassName,
  children,
}: FormFieldRowProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={htmlFor} className={cn('block', labelClassName)}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface FormFieldGridProps {
  cols?: 2 | 3
  className?: string
  children: ReactNode
}

/**
 * 通用多列表单容器：移动端收敛为一列，md 及以上按 cols 排布。
 * 替换手写 <div class="grid grid-cols-2 gap-4"> 或 <div class="grid grid-cols-1 md:grid-cols-2 gap-4">。
 */
export function FormFieldGrid({ cols = 2, className, children }: FormFieldGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
