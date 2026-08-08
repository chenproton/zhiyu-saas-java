'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import type { PlatformNavigationConfig, SideNavChild, SideNavItem } from './config'
import { resolvePlatformIcon } from './icons'
import { cn } from '@/lib/utils'
import { matchesPath } from './utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

function getMatchedTarget(pathname: string, href?: string, matchers?: string[]) {
  const targets = matchers && matchers.length > 0 ? matchers : href ? [href] : []
  return targets.find((target) => {
    if (target === '/') {
      return pathname === '/'
    }
    if (target.endsWith('$')) {
      return pathname === target.slice(0, -1)
    }
    return pathname === target || pathname.startsWith(`${target}/`)
  })
}

function getActiveChild(pathname: string, children?: SideNavChild[]): SideNavChild | undefined {
  if (!children?.length) return undefined
  const matched = children
    .map((child) => ({ child, target: getMatchedTarget(pathname, child.href, child.matchers) }))
    .filter((m): m is { child: SideNavChild; target: string } => m.target !== undefined)
  if (matched.length === 0) return undefined
  return matched.sort((a, b) => b.target.length - a.target.length)[0].child
}

function isSideItemActive(pathname: string, item: SideNavItem) {
  if (item.children?.length) {
    return getActiveChild(pathname, item.children) !== undefined
  }
  return getMatchedTarget(pathname, item.href, item.matchers) !== undefined
}

function getVisibleSideNavItems(
  items: SideNavItem[],
  hasMenuPerm: (path: string) => boolean,
): SideNavItem[] {
  return items
    .map((item) => {
      if (item.hidden) return null
      const visibleChildren = item.children?.filter((child) => {
        if (child.hidden) return false
        return hasMenuPerm(child.href)
      })
      if (
        item.children &&
        item.children.length > 0 &&
        (!visibleChildren || visibleChildren.length === 0)
      ) {
        return null
      }
      return visibleChildren ? { ...item, children: visibleChildren } : item
    })
    .filter(Boolean) as SideNavItem[]
}

export function PlatformSideNav({
  config,
  hasMenuPermission,
}: {
  config: PlatformNavigationConfig
  hasMenuPermission: (path: string) => boolean
}) {
  const pathname = usePathname()
  const visibleSideNavItems = useMemo(
    () => getVisibleSideNavItems(config.sideNavItems, hasMenuPermission),
    [config.sideNavItems, hasMenuPermission],
  )
  const defaultExpanded = useMemo(
    () =>
      config.defaultExpandedSideNavIds?.length
        ? config.defaultExpandedSideNavIds
        : visibleSideNavItems.filter((item) => item.children?.length).map((item) => item.id),
    [config.defaultExpandedSideNavIds, visibleSideNavItems],
  )
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpanded)
  const [mobileOpen, setMobileOpen] = useState(false)
  const PlatformIcon = resolvePlatformIcon(config.platformIcon || 'settings')

  // 路由变化时收起移动端抽屉（render 期守卫式状态调整，等价于 effect 监听 pathname）
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setMobileOpen(false)
  }

  useEffect(() => {
    const activeParents = visibleSideNavItems
      .filter((item) =>
        item.children?.some((child) => matchesPath(pathname, child.href, child.matchers)),
      )
      .map((item) => item.id)

    setExpandedItems((prev) => Array.from(new Set([...defaultExpanded, ...activeParents, ...prev])))
  }, [visibleSideNavItems, defaultExpanded, pathname])

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId) ? prev.filter((entry) => entry !== itemId) : [...prev, itemId],
    )
  }

  const navBody = (
    <>
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <Link
            href={config.sideBackHref}
            aria-label={config.currentPlatformLabel ? `返回${config.currentPlatformLabel}` : '返回'}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <PlatformIcon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium text-gray-800">{config.currentPlatformLabel}</h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {visibleSideNavItems.map((item) => {
          const Icon = resolvePlatformIcon(item.icon)
          const hasChildren = Boolean(item.children?.length)
          const active = isSideItemActive(pathname, item)
          const isExpanded = expandedItems.includes(item.id)

          return (
            <div key={item.id} className="mb-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-primary/5 font-medium text-primary'
                      : 'text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href || '/'}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    active ? 'bg-primary text-white font-medium' : 'text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )}

              {hasChildren && isExpanded ? (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  {(() => {
                    const activeChildId = getActiveChild(pathname, item.children)?.id
                    return item.children?.map((child) => (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={cn(
                          'block rounded-lg px-3 py-2 text-sm transition-colors',
                          activeChildId === child.id
                            ? 'bg-primary text-white font-medium'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                        )}
                      >
                        {child.label}
                      </Link>
                    ))
                  })()}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      {config.platformSwitchItems && config.platformSwitchItems.length > 0 && (
        <div className="border-t border-gray-100 p-3">
          <p className="mb-2 px-3 text-xs font-medium text-gray-400">平台切换</p>
          <div className="space-y-1">
            {config.platformSwitchItems.map((item) => {
              const Icon = resolvePlatformIcon(item.icon)
              const active = matchesPath(pathname, item.href, item.matchers)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/5 font-medium text-primary'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* 移动端导航入口按钮 + 抽屉 */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="打开导航菜单"
        className="fixed left-3 top-16 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:text-primary md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <div className="flex h-full flex-col">{navBody}</div>
        </SheetContent>
      </Sheet>

      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col border-r border-gray-100 bg-white md:flex md:overflow-y-auto">
        {navBody}
      </aside>
    </>
  )
}
