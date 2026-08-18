'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface PasswordInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'className'> {
  /** 传入的 className 作用于内部 input（与 Input 组件语义一致） */
  className?: string
  /** 初始是否明文展示（默认 false：掩码） */
  defaultVisible?: boolean
}

/**
 * 密码输入框：默认掩码显示，右侧小眼睛按钮点击在明文/掩码（••••••）间切换。
 * 全局密码输入统一使用本组件（登录/注册/重置密码/AI Key 等），
 * 见 docs/components.md「表单控件」。
 */
export function PasswordInput({
  className,
  defaultVisible = false,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(defaultVisible)
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? '隐藏密码' : '显示密码'}
        title={visible ? '隐藏密码' : '显示密码'}
        // 防止点击眼睛时输入框失焦（密码可见性切换不中断输入）
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
