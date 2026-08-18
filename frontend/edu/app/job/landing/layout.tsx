'use client'

import { TopNav } from '@/components/portal/top-nav'

export default function JobStudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div
      className="pt-14 min-h-screen"
      style={{
        background: '#f5f7fa',
        color: '#333',
        fontFamily: '"Microsoft YaHei", Arial, sans-serif',
      }}
    >
      <TopNav />
      {children}
    </div>
  )
}
