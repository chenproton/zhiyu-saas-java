'use client'

import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
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

/** 带图标的输入框：图标常驻左侧，输入内容自动缩进，提高字段辨识度与视觉美观 */
export function IconInput({
  icon: Icon,
  ...props
}: { icon: React.ElementType } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input className="pl-9" {...props} />
    </div>
  )
}

/** 只读字段展示行：图标 + 标签 + 值（详情卡片网格用） */
export function FieldValue({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number | undefined | null
}) {
  const v = value == null || value === '' ? '-' : String(value)
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm break-all">{v}</p>
      </div>
    </div>
  )
}
