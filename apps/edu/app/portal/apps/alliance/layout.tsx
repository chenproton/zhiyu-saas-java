"use client"

import { AllianceSideNav } from "./_components/alliance-side-nav"

export default function AllianceAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <AllianceSideNav />
      <main className="flex-1 p-6 min-w-0">
        {children}
      </main>
    </div>
  )
}
