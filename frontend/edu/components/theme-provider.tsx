'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// 自研主题 Provider（等价原 next-themes 的 attribute="class" 行为，去掉 Next 耦合）。
// 仅管理 <html> 上的 light/dark class（Tailwind dark: 变体据此生效），无 SSR，纯客户端。
export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyClass(theme: Theme) {
  const root = document.documentElement
  const resolved = resolveTheme(theme)
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableSystem = false,
}: {
  children: ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : defaultTheme
  })

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 忽略隐私模式等场景下的存储失败
    }
  }

  useEffect(() => {
    applyClass(theme)
  }, [theme])

  useEffect(() => {
    if (!enableSystem) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') applyClass('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, enableSystem])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
