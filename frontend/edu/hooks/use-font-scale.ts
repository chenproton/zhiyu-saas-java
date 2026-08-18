'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BASE_FONT_SIZE_PX,
  clampFontScaleLevel,
  FONT_SCALE_STORAGE_KEY,
  fontScaleForLevel,
  MAX_FONT_SCALE_LEVEL,
} from '@/lib/font-size-scale'

function readStoredLevel(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY)
    if (raw === null) return 0
    return clampFontScaleLevel(Number(raw))
  } catch {
    return 0
  }
}

export interface UseFontScaleResult {
  level: number
  maxLevel: number
  increase: () => void
  decrease: () => void
  reset: () => void
}

export function useFontScale(): UseFontScaleResult {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后读取本地存储，避免 SSR/hydration 不一致
    setLevel(readStoredLevel())
  }, [])

  useEffect(() => {
    const scale = fontScaleForLevel(level)
    if (level === 0) {
      document.documentElement.style.removeProperty('font-size')
    } else {
      document.documentElement.style.fontSize = `${BASE_FONT_SIZE_PX * scale}px`
    }
  }, [level])

  // 仅在用户操作时持久化档位，避免挂载时用初始值 0 覆盖已存储的档位
  const persist = (next: number) => {
    try {
      window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next))
    } catch {
      // localStorage 不可用时忽略，仅本次生效
    }
  }

  const increase = useCallback(
    () =>
      setLevel((l) => {
        const next = Math.min(MAX_FONT_SCALE_LEVEL, l + 1)
        persist(next)
        return next
      }),
    [],
  )
  const decrease = useCallback(
    () =>
      setLevel((l) => {
        const next = Math.max(0, l - 1)
        persist(next)
        return next
      }),
    [],
  )
  const reset = useCallback(() => {
    setLevel(0)
    persist(0)
  }, [])

  return { level, maxLevel: MAX_FONT_SCALE_LEVEL, increase, decrease, reset }
}
