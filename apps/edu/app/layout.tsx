import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ChunkErrorHandler } from '@/components/chunk-error-handler'
import { GlobalApiErrorHandler } from '@/components/global-api-error-handler'
import { DataProvider as EvaluationDataProvider } from '@/components/providers/data-provider'
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
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <EvaluationDataProvider>
              <ChunkErrorHandler />
              <GlobalApiErrorHandler />
              <Toaster />
              {children}
            </EvaluationDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
