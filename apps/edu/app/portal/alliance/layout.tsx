'use client'

import { usePathname } from 'next/navigation'

const FULL_WIDTH_PAGES = [
  '/portal/alliance/landing',
  '/portal/alliance/enterprises',
  '/portal/alliance/projects',
  '/portal/alliance/achievements',
  '/portal/alliance/experts',
  '/portal/alliance/brands',
]

export default function AlliancePublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (FULL_WIDTH_PAGES.includes(pathname)) {
    return <>{children}</>
  }

  return <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6">{children}</div>
}
