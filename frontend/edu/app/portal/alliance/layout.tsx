'use client'

import { usePathname } from 'next/navigation'

const FULL_WIDTH_PAGES = [
  '/portal/alliance/landing',
  '/portal/alliance/enterprises',
  '/portal/alliance/projects',
  '/portal/alliance/achievements',
  '/portal/alliance/experts',
  '/portal/alliance/brands',
  '/portal/alliance/employment',
]

export default function AlliancePublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // 列表页与动态详情页均直出：页面自带内容容器与全屏背景，
  // 不再包 container/padding，避免渐变内容区四周露出 body 底色（f6f8fc）空白间隔
  const isFullWidth =
    pathname === '/portal/alliance/landing' ||
    FULL_WIDTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (isFullWidth) {
    return <>{children}</>
  }

  return <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6">{children}</div>
}
