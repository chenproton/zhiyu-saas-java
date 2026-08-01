'use client'

import { TopNav } from '@/components/portal/top-nav'

export default function LibraryLandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="pt-14 min-h-screen">
      <TopNav />
      {children}
    </div>
  )
}
