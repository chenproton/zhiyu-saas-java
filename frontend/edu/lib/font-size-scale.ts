export const FONT_SCALE_STORAGE_KEY = 'zhiyu-font-scale'

export const MAX_FONT_SCALE_LEVEL = 5

export const FONT_SCALE_STEP = 0.0625

export const BASE_FONT_SIZE_PX = 16

export function clampFontScaleLevel(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(MAX_FONT_SCALE_LEVEL, Math.max(0, Math.round(level)))
}

export function fontScaleForLevel(level: number): number {
  return Math.pow(1 + FONT_SCALE_STEP, clampFontScaleLevel(level))
}
