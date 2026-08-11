'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsRight, RefreshCw } from 'lucide-react'
import { authApi } from '@/lib/api'
import type { CaptchaData } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

interface SliderCaptchaProps {
  /** 拼图块位置变化（原图像素坐标），拖动过程中持续回调，登录页暂存最新值随请求提交 */
  onPass: (captchaId: string, x: number, y: number) => void
  /** 获取验证码失败（如限流），由登录页展示错误 */
  onError?: (err: Error) => void
  className?: string
}

/**
 * 滑块拼图验证码：服务端 go-captcha 生成（答案仅在服务端），
 * 前端只负责拖动拼图块并上报最终坐标，校验在登录接口内完成。
 */
export default function SliderCaptcha({ onPass, onError, className }: SliderCaptchaProps) {
  const t = useT()
  const [data, setData] = useState<CaptchaData | null>(null)
  const [curX, setCurX] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const dragState = useRef<{
    startClientX: number
    startX: number
    displayWidth: number
  } | null>(null)
  const curXRef = useRef(0)

  const fetchCaptcha = useCallback(() => authApi.captcha(), [])

  const applyCaptcha = useCallback((d: CaptchaData) => {
    setData(d)
    setCurX(d.thumbX)
    curXRef.current = d.thumbX
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
    setLoading(true)
    setLoadError('')
    try {
      applyCaptcha(await fetchCaptcha())
    } catch (err: any) {
      setLoadError(err.message || t('验证码加载失败'))
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }, [fetchCaptcha, applyCaptcha, onError, t])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!data) return
    const track = e.currentTarget.parentElement
    if (!track) return
    dragState.current = {
      startClientX: e.clientX,
      startX: curX,
      displayWidth: track.getBoundingClientRect().width,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragState.current
    if (!ds || !data) return
    const scale = data.imageWidth / ds.displayWidth
    const maxX = data.imageWidth - data.thumbWidth
    const x = Math.min(maxX, Math.max(0, ds.startX + (e.clientX - ds.startClientX) * scale))
    setCurX(x)
    curXRef.current = x
  }

  // 拖动结束才上报最终坐标（防止未拖动直接提交初始位置导致验证失败）
  const handlePointerUp = () => {
    if (dragState.current && data) {
      onPass(data.captchaId, Math.round(curXRef.current), data.thumbY)
    }
    dragState.current = null
  }

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

  const thumbPercent = Math.max(0, Math.min(100, (curX / data.imageWidth) * 100))

  return (
    <div className={className}>
      <div
        className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        style={{ aspectRatio: `${data.imageWidth} / ${data.imageHeight}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.image}
          alt={t('滑块验证码')}
          className="h-full w-full select-none object-cover"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.thumb}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          style={{
            left: `${thumbPercent}%`,
            top: `${(data.thumbY / data.imageHeight) * 100}%`,
            width: `${(data.thumbWidth / data.imageWidth) * 100}%`,
            height: 'auto',
          }}
        />
      </div>

      <div className="relative mt-2 h-10 rounded-lg border border-slate-200 bg-slate-50/80">
        <div className="pointer-events-none flex h-full items-center justify-center text-xs text-slate-400 select-none">
          {t('向右拖动滑块完成拼图')}
        </div>
        <div
          role="slider"
          aria-label={t('拖动滑块')}
          aria-valuenow={Math.round(thumbPercent)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute top-0 flex h-full w-10 cursor-grab touch-none items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 active:cursor-grabbing"
          style={{ left: `calc(${thumbPercent}% - 1.25rem)` }}
        >
          <ChevronsRight className="h-4 w-4" />
        </div>
        <button
          type="button"
          onClick={load}
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary"
          title={t('刷新验证码')}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  )
}
