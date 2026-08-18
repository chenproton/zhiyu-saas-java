'use client'

import { useEffect, Component, type ComponentType } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { I18nContext, translate, type Locale } from '@/lib/i18n/locale-provider'

export function ChunkErrorHandler() {
  useEffect(() => {
    let reloading = false

    const handler = (event: PromiseRejectionEvent) => {
      if (reloading) return
      if (
        event?.reason?.name === 'ChunkLoadError' ||
        event?.reason?.message?.includes('Loading chunk')
      ) {
        reloading = true
        window.location.reload()
      }
    }

    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return null
}

interface WithChunkErrorProps {
  Component: ComponentType<any>
  componentProps?: Record<string, unknown>
}

interface ChunkErrorBoundaryState {
  error: Error | null
}

export class ChunkErrorBoundary extends Component<WithChunkErrorProps, ChunkErrorBoundaryState> {
  static contextType = I18nContext
  declare context: { locale: Locale }
  state: ChunkErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error) {
    if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
      return { error }
    }
    return null
  }

  render() {
    if (this.state.error) {
      const t = (key: string) => translate(key, this.context.locale)
      return (
        <div className="flex h-96 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>{t('图谱组件加载失败，请检查网络连接后重试')}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1 size-3.5" />
            {t('刷新页面')}
          </Button>
        </div>
      )
    }

    const { Component, componentProps = {} } = this.props
    return <Component {...componentProps} />
  }
}
