'use client'

import { TopNav } from '@/components/portal/top-nav'

export default function SceneLandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div
      className="pt-14"
      style={{
        background: '#f5f7fa',
        color: '#333',
        fontFamily: '"Microsoft YaHei", Arial, sans-serif',
        minHeight: '100vh',
      }}
    >
      <TopNav />
      {children}
    </div>
  )
}
