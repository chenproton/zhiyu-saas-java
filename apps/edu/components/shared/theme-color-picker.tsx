'use client'

import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw } from 'lucide-react'
import { isHexColor } from '@/lib/theme-brand'

export const THEME_PRESETS = [
  '#4862e4',
  '#1677ff',
  '#0b5bd0',
  '#0ea5e9',
  '#7c3aed',
  '#059669',
  '#ea580c',
]

interface ThemeColorPickerProps {
  color: string
  onChange: (color: string) => void
  onSubmit: (color: string) => void | Promise<void>
  submitting?: boolean
  submitLabel?: string
  secondary?: { label: string; onClick: () => void; disabled?: boolean }[]
}

/** 主题色选择器：预设色板 + 取色器 + 手动输入 + 实时预览 + 保存动作（平台级/租户级通用）。 */
export function ThemeColorPicker({
  color,
  onChange,
  onSubmit,
  submitting = false,
  submitLabel = '保存并应用',
  secondary = [],
}: ThemeColorPickerProps) {
  const valid = isHexColor(color)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            title={preset}
            aria-label={`主题色 ${preset}`}
            onClick={() => onChange(preset)}
            className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
              color.toLowerCase() === preset.toLowerCase()
                ? 'ring-2 ring-offset-2 ring-foreground/30'
                : ''
            }`}
            style={{ backgroundColor: preset }}
          />
        ))}
        <label
          className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-gray-300 text-xs text-muted-foreground cursor-pointer hover:border-primary hover:text-primary"
          title="自定义颜色"
        >
          <input
            type="color"
            value={valid ? color : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          +
        </label>
        <input
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-28 rounded-md border border-gray-200 px-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="#RRGGBB"
        />
        <span className="text-xs text-muted-foreground">自定义色值</span>
      </div>

      {/* 实时预览 */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
        <span className="text-xs text-muted-foreground">预览：</span>
        <Button size="sm" style={{ backgroundColor: color }} disabled={!valid}>
          主要按钮
        </Button>
        <Button size="sm" variant="outline" style={{ color }} disabled={!valid}>
          次要按钮
        </Button>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          标签
        </span>
        <span className="text-xs text-muted-foreground">
          当前色值：<span className="font-mono">{color}</span>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={() => onSubmit(color)} disabled={submitting || !valid}>
          {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          {submitLabel}
        </Button>
        {secondary.map((item) => (
          <Button
            key={item.label}
            size="sm"
            variant="outline"
            disabled={item.disabled || submitting}
            onClick={item.onClick}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
