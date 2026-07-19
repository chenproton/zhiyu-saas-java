"use client"

import { TopNav } from "@/components/portal/top-nav"

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen pt-14 bg-[#f5f7fa]">
      <TopNav />
      {children}
    </div>
  )
}
