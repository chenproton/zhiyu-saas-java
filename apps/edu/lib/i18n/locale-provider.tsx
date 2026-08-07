'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import en from '@/messages/en.json'

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'zhiyu-lang'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
})

/** 读取 html 上的 data-locale（由 layout 内联脚本预置，与 font-scale 同模式），避免切换后刷新闪变。 */
function readInitialLocale(): Locale {
  if (typeof document !== 'undefined') {
    const v = document.documentElement.dataset.locale
    if (v === 'en' || v === 'zh') return v
  }
  return 'zh'
}

export { I18nContext }

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale)

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage 不可用时忽略，仅影响持久化
    }
  }, [])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

/** 纯翻译函数：中文即 key，英文查字典，未命中回退中文原文；支持 {name} 插值。 */
export function translate(
  key: string,
  locale: Locale,
  vars?: Record<string, string | number>,
): string {
  const text = locale === 'zh' ? key : ((en as Record<string, string>)[key] ?? key)
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  )
}

/** 轻量翻译 hook：返回绑定当前 locale 的 t 函数。 */
export function useT() {
  const { locale } = useContext(I18nContext)
  return useCallback((key: string, vars?: Record<string, string | number>) => {
    return translate(key, locale, vars)
  }, [locale])
}
