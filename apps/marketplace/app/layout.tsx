import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { DataProvider as EvaluationDataProvider } from '@/components/providers/data-provider'
import { AnnotationEditProvider } from '@/lib/annotation-edit-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '教学资源共享商城',
  description: '面向职业院校的教学资源共享交易平台',
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
                  {children}
                </AnnotationEditProvider>
              </EvaluationDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
