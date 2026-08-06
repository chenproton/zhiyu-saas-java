import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeBrandSync } from '@/components/theme-brand-sync'
import { ChunkErrorHandler } from '@/components/chunk-error-handler'
import { GlobalApiErrorHandler } from '@/components/global-api-error-handler'
import { DataProvider as EvaluationDataProvider } from '@/components/providers/data-provider'
import { I18nProvider } from '@/lib/i18n/locale-provider'
import { Toaster } from '@zhiyu/ui'
import './globals.css'

export const metadata: Metadata = {
  title: '场景化数智教学服务平台',
  description: '面向职业院校的产业岗位、场景实践、数字课程与能力评价管理平台',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=parseInt(localStorage.getItem('zhiyu-font-scale')||'0',10);l=Number.isFinite(l)?Math.min(5,Math.max(0,Math.round(l))):0;if(l>0)document.documentElement.style.fontSize=(16*Math.pow(1.0625,l))+'px'}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem('zhiyu-lang');if(l==='zh'||l==='en')document.documentElement.dataset.locale=l}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=localStorage.getItem('zhiyu-brand-color');if(c&&/^#[0-9a-fA-F]{6}$/.test(c))document.documentElement.style.setProperty('--brand',c)}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <I18nProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
              <EvaluationDataProvider>
                <ThemeBrandSync />
                <ChunkErrorHandler />
                <GlobalApiErrorHandler />
                <Toaster />
                {children}
              </EvaluationDataProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
