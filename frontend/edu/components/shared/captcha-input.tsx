'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { authApi } from '@/lib/api'
import type { CaptchaData } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

interface CaptchaInputProps {
  /** 验证码就绪/用户输入变化回调：captchaId + 当前输入的字符，由登录页暂存随请求提交 */
  onPass: (captchaId: string, code: string) => void
  /** 获取验证码失败（如限流），由登录页展示错误 */
  onError?: (err: Error) => void
  className?: string
}

/**
 * 字符验证码：服务端 base64Captcha 生成（答案仅在服务端），
 * 前端展示图片 + 输入框，输入变化即上报，校验在登录接口内完成。
 */
export default function CaptchaInput({ onPass, onError, className }: CaptchaInputProps) {
  const t = useT()
  const [data, setData] = useState<CaptchaData | null>(null)
  const [loadError, setLoadError] = useState('')
  const idRef = useRef('')
  // onError/t 用 ref 持有最新值：登录页每次 re-render 都会生成新的内联
  // onError 引用，若直接放进 useEffect 依赖，会导致 effect 反复重跑、
  // 验证码被反复重新拉取（提交失败后图片"刷新"的根因）。
  const onErrorRef = useRef(onError)
  const tRef = useRef(t)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  useEffect(() => {
    tRef.current = t
  }, [t])

  const fetchCaptcha = useCallback(() => authApi.captcha(), [])

  const applyCaptcha = useCallback((d: CaptchaData) => {
    idRef.current = d.captchaId
    setData(d)
  }, [])

  // 挂载即拉取验证码（依赖仅稳定引用，父组件 re-render 不会重拉；异步回调中 setState）
  useEffect(() => {
    let cancelled = false
    fetchCaptcha()
      .then((d) => {
        if (!cancelled) applyCaptcha(d)
      })
      .catch((err: any) => {
        if (cancelled) return
        setLoadError(err.message || tRef.current('验证码加载失败'))
        onErrorRef.current?.(err)
      })
    return () => {
      cancelled = true
    }
  }, [fetchCaptcha, applyCaptcha])

  // 刷新按钮/点击图片：事件处理器内 setState 无级联渲染问题
  const load = useCallback(async () => {
    setLoadError('')
    try {
      applyCaptcha(await fetchCaptcha())
    } catch (err: any) {
      setLoadError(err.message || tRef.current('验证码加载失败'))
      onErrorRef.current?.(err)
    }
  }, [fetchCaptcha, applyCaptcha])

  if (loadError) {
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500 ${className || ''}`}
      >
        <span>{loadError}</span>
        <button
          type="button"
          onClick={load}
          className="flex shrink-0 items-center gap-1 text-primary hover:text-primary/80"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('重试')}
        </button>
      </div>
    )
  }

  return (
    <div className={`${className || ''}`}>
      <div className="flex items-stretch gap-2">
        {data ? (
          <button
            type="button"
            onClick={load}
            title={t('点击刷新验证码')}
            className="h-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.image} alt={t('验证码')} className="h-full w-auto" />
          </button>
        ) : (
          <div className="flex h-11 w-[110px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-xs text-slate-400">
            {t('验证码加载中...')}
          </div>
        )}
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={6}
          placeholder={t('请输入验证码')}
          aria-label={t('验证码')}
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-sm tracking-widest transition-all placeholder:tracking-normal placeholder:text-slate-400 focus-visible:border-primary/60 focus-visible:bg-white focus-visible:ring-primary/20"
          onChange={(e) => {
            const v = e.target.value.trim()
            if (data && v) onPass(idRef.current, v)
          }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{t('点击图片可刷新验证码')}</p>
    </div>
  )
}
