'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import GoCaptcha from 'go-captcha-react'
import 'go-captcha-react/dist/go-captcha-react.cjs.development.css'
import { authApi } from '@/lib/api'
import type { CaptchaData } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

interface SliderCaptchaProps {
  /** 拖动完成回调：captchaId + 拼图块最终位置（原图像素坐标），由登录页暂存随请求提交 */
  onPass: (captchaId: string, x: number, y: number) => void
  /** 获取验证码失败（如限流），由登录页展示错误 */
  onError?: (err: Error) => void
  className?: string
}

/**
 * 滑块拼图验证码：服务端 go-captcha 生成（答案仅在服务端），
 * 前端使用官方 go-captcha-react 的 Slide 组件渲染与交互。
 * 图片以 300x220 原尺寸显示，confirm 回调返回的坐标即图片像素值，
 * 与后端缺口坐标直接比对，无需任何换算。
 */
export default function SliderCaptcha({ onPass, onError, className }: SliderCaptchaProps) {
  const t = useT()
  const [data, setData] = useState<CaptchaData | null>(null)
  const [loadError, setLoadError] = useState('')
  const idRef = useRef('')

  const fetchCaptcha = useCallback(() => authApi.captcha(), [])

  const applyCaptcha = useCallback((d: CaptchaData) => {
    idRef.current = d.captchaId
    setData(d)
  }, [])

  // 挂载即拉取验证码（异步回调中 setState，避免同步 setState 触发级联渲染）
  useEffect(() => {
    let cancelled = false
    fetchCaptcha()
      .then((d) => {
        if (!cancelled) applyCaptcha(d)
      })
      .catch((err: any) => {
        if (cancelled) return
        setLoadError(err.message || t('验证码加载失败'))
        onError?.(err)
      })
    return () => {
      cancelled = true
    }
  }, [fetchCaptcha, applyCaptcha, onError, t])

  // 刷新按钮：事件处理器内 setState 无级联渲染问题
  const load = useCallback(async () => {
    setLoadError('')
    try {
      applyCaptcha(await fetchCaptcha())
    } catch (err: any) {
      setLoadError(err.message || t('验证码加载失败'))
      onError?.(err)
    }
  }, [fetchCaptcha, applyCaptcha, onError, t])

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

  if (!data) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 py-5 text-xs text-slate-400 ${className || ''}`}
      >
        {t('验证码加载中...')}
      </div>
    )
  }

  return (
    <div className={className}>
      <GoCaptcha.Slide
        data={{
          image: data.image,
          thumb: data.thumb,
          thumbX: data.thumbX,
          thumbY: data.thumbY,
          thumbWidth: data.thumbWidth,
          thumbHeight: data.thumbHeight,
        }}
        config={{
          width: data.imageWidth,
          height: data.imageHeight,
          showTheme: false,
          title: t('向右拖动滑块完成拼图'),
        }}
        events={{
          confirm: (point) => onPass(idRef.current, point.x, point.y),
          refresh: load,
        }}
      />
    </div>
  )
}
