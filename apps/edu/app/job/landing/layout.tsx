"use client"

import { TopNav } from "@/components/portal/top-nav"

export default function JobLandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="pt-14 min-h-screen bg-[#F1FAFF] text-[#1f2937]" style={{ fontFamily: '"Microsoft YaHei", Arial, sans-serif' }}>
      <TopNav />
      {children}
    </div>
  )
}
