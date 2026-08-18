'use client'

import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

// 原生日期/时间选框：点击输入框任意位置即弹出选择器。
// Chrome/Edge/Firefox/Safari 默认仅右侧图标区域可点，showPicker() 让整框可点；
// 重复点击/环境不支持时静默忽略。
export function DateInput(props: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      type={props.type ?? 'date'}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker()
        } catch {
          /* 已打开或环境不支持时忽略 */
        }
        props.onClick?.(e)
      }}
    />
  )
}
