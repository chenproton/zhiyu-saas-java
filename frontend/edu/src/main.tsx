import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { I18nProvider } from '@/lib/i18n/locale-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeBrandSync } from '@/components/theme-brand-sync'
import { ChunkErrorHandler } from '@/components/chunk-error-handler'
import { GlobalApiErrorHandler } from '@/components/global-api-error-handler'
import { Toaster } from '@zhiyu/ui'
import { getPathPrefix } from '@/lib/path-prefix'
import { RouteErrorBoundary } from './route-error-boundary'
import { AppRoutes } from './routes'
import '@/app/globals.css'

// 与 Next 版 app/layout.tsx 等价的 Provider 树。
// 差异：AuthProvider 依赖 useLocation（原 usePathname），故必须置于 BrowserRouter 内。
// basename 用运行时 getPathPrefix()：Go 栈 ''，Java 栈 '/java'（对齐原 basePath 行为）。
createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <ThemeProvider defaultTheme="system" enableSystem>
      <BrowserRouter basename={getPathPrefix()}>
        <AuthProvider>
          <ThemeBrandSync />
          <ChunkErrorHandler />
          <GlobalApiErrorHandler />
          <Toaster />
          <RouteErrorBoundary>
            <AppRoutes />
          </RouteErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </I18nProvider>,
)
