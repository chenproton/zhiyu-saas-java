'use client'

import { usePathname } from 'next/navigation'

export default function AlliancePublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/portal/alliance/landing') {
    return <>{children}</>
  }

  return <div className="container mx-auto py-8">{children}</div>
}
