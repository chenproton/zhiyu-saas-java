import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ChunkErrorHandler } from '@/components/chunk-error-handler'
import { DataProvider as EvaluationDataProvider } from '@/components/providers/data-provider'
import { AnnotationEditProvider } from '@/lib/annotation-edit-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '场景化数智教学服务平台',
  description: '面向职业院校的产业岗位、场景实践、数字课程与能力评价管理平台',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
              <EvaluationDataProvider>
                <AnnotationEditProvider>
                  <ChunkErrorHandler />
                  {children}
                </AnnotationEditProvider>
              </EvaluationDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
