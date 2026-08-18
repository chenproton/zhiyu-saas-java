'use client'

import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/error-handling'
import { I18nContext, translate, type Locale } from '@/lib/i18n/locale-provider'

// 根级路由错误边界：合并原 Next 的 app/error.tsx + app/global-error.tsx。
// 渲染期/异步 chunk 加载错误都会被此处捕获（Suspense + lazy 抛出的错误冒泡到这里）。
interface State {
  error: Error | null
}

export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  static contextType = I18nContext
  declare context: { locale: Locale }

  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    reportError(error, 'route-error')
  }

  render() {
    if (this.state.error) {
      const t = (key: string) => translate(key, this.context.locale)
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-5xl">{t('页面出错了')}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {t('页面渲染过程中发生异常，已记录错误信息，请重试')}
          </p>
          <Button onClick={() => this.setState({ error: null })}>
            <RefreshCw className="mr-1 size-3.5" />
            {t('重试')}
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
