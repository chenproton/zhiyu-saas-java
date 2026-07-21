"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Building2 } from "lucide-react"
import type { PlatformNavigationConfig, SideNavItem, TopNavItem, UserMenuItem } from "./config"
import { resolvePlatformIcon } from "./icons"
import { cn, matchesPath } from "./utils"
import { useAuth } from "@/components/auth-provider"

function isTopItemActive(pathname: string, item: TopNavItem) {
  return matchesPath(pathname, item.href, item.matchers)
}

function isSideItemActive(pathname: string, item: SideNavItem) {
  if (item.children?.length) {
    return item.children.some((child) => matchesPath(pathname, child.href, child.matchers))
  }
  return matchesPath(pathname, item.href, item.matchers)
}

const fallbackUserMenuItems: UserMenuItem[] = [
  { id: "profile", label: "个人中心", icon: "user" },
  { id: "account", label: "账号设置", icon: "settings" },
  { id: "logout", label: "退出登录", tone: "danger" },
]

export function PlatformTopNav({ config }: { config: PlatformNavigationConfig }) {
  const pathname = usePathname()
  const [currentTime, setCurrentTime] = useState("")
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const BrandIcon = resolvePlatformIcon(config.brandIcon || "settings")
  const userMenuItems = config.userMenuItems ?? fallbackUserMenuItems

  const [selectedCollege, setSelectedCollege] = useState("all")
  useEffect(() => {
    const readCollege = () => {
      const params = new URLSearchParams(window.location.search)
      setSelectedCollege(params.get("college") || "all")
    }
    readCollege()
    window.addEventListener("popstate", readCollege)
    return () => window.removeEventListener("popstate", readCollege)
  }, [])
  const handleCollegeChange = (value: string) => {
    const params = new URLSearchParams(window.location.search)
    if (value === "all") {
      params.delete("college")
    } else {
      params.set("college", value)
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`
    window.history.pushState(null, "", newUrl)
    window.dispatchEvent(new Event("popstate"))
  }



  useEffect(() => {
    setMounted(true)
    const updateTime = () => {
      const now = new Date()
      const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const day = String(now.getDate()).padStart(2, "0")
      const weekDay = weekDays[now.getDay()]
      const hours = String(now.getHours()).padStart(2, "0")
      const minutes = String(now.getMinutes()).padStart(2, "0")
      setCurrentTime(`${year}年${month}月${day}日 ${weekDay} ${hours}:${minutes}`)
    }

    updateTime()
    const timer = setInterval(updateTime, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-3 md:px-6 shadow-sm">
      <div className="flex items-center gap-4 md:gap-8">
        <Link href={config.brandHref || "/"} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BrandIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline whitespace-nowrap text-base font-semibold text-gray-800">{config.brandTitle}</span>
        </Link>

        <nav className="flex items-center gap-1">
          {config.topNavItems.map((item) => {
            const Icon = resolvePlatformIcon(item.icon)
            const active = isTopItemActive(pathname, item)
            const itemClassName = cn(
              "relative flex items-center gap-1.5 rounded-md px-3 md:px-4 py-2 text-sm transition-colors whitespace-nowrap",
              item.disabled
                ? "cursor-default text-gray-400"
                : active
                  ? "font-medium text-primary"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            )
            return item.disabled ? (
              <span key={item.id} className={itemClassName}>
                <Icon className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </span>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                className={itemClassName}
              >
                <Icon className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden md:inline">{item.label}</span>
                {active ? <span className="absolute bottom-0 left-2 right-2 md:left-4 md:right-4 h-0.5 rounded-full bg-primary" /> : null}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {config.showCollegeFilter && config.collegeOptions && config.collegeOptions.length > 0 && !pathname.startsWith("/landingpage") && (
          <select
            value={selectedCollege}
            onChange={(e) => handleCollegeChange(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 pr-6 text-sm text-gray-600 outline-none hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
          >
            <option value="all">全校</option>
            {config.collegeOptions.map((college) => (
              <option key={college} value={college}>{college}</option>
            ))}
          </select>
        )}

        {config.enterpriseLoginHref && !pathname.startsWith("/landingpage") && (
          <Link
            href={config.enterpriseLoginHref}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300"
          >
            <Building2 className="h-4 w-4" />
            企业登录
          </Link>
        )}

        {config.showCurrentTime !== false && mounted ? <div className="text-sm text-gray-400 hidden md:block whitespace-nowrap">{currentTime}</div> : null}

        {config.showUserMenu !== false ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {(config.currentUserName || "管理员").slice(0, 1)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="whitespace-nowrap text-sm text-gray-700">{config.currentUserName || "管理员"}</div>
                <div className="whitespace-nowrap text-xs text-gray-400">
                  {config.currentUserRoleLabel || config.currentPlatformLabel}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {menuOpen && userMenuItems.length > 0 ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-48 rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
                {userMenuItems.map((item, index) => {
                  const Icon = item.icon ? resolvePlatformIcon(item.icon) : null
                  const itemClassName =
                    item.tone === "danger"
                      ? "flex w-full items-center px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                      : "flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"

                  return (
                    <div key={item.id}>
                      {index > 0 && item.tone === "danger" ? <div className="my-1 h-px bg-gray-100" /> : null}
                      {item.href ? (
                        <Link href={item.href} className={itemClassName}>
                          {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                          {item.label}
                        </Link>
                      ) : (
                        <button type="button" className={itemClassName}>
                          {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                          {item.label}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}

function getVisibleSideNavItems(items: SideNavItem[], hasMenuPerm: (path: string) => boolean): SideNavItem[] {
  return items
    .map((item) => {
      if (item.hidden) return null
      const visibleChildren = item.children?.filter((child) => {
        if (child.hidden) return false
        return hasMenuPerm(child.href)
      })
      if (item.children && item.children.length > 0 && (!visibleChildren || visibleChildren.length === 0)) {
        return null
      }
      return visibleChildren ? { ...item, children: visibleChildren } : item
    })
    .filter(Boolean) as SideNavItem[]
}

export function PlatformSideNav({ config }: { config: PlatformNavigationConfig }) {
  const pathname = usePathname()
  const { hasMenuPermission } = useAuth()
  const visibleSideNavItems = useMemo(
    () => getVisibleSideNavItems(config.sideNavItems, hasMenuPermission),
    [config.sideNavItems, hasMenuPermission]
  )
  const defaultExpanded = useMemo(
    () =>
      config.defaultExpandedSideNavIds?.length
        ? config.defaultExpandedSideNavIds
        : visibleSideNavItems.filter((item) => item.children?.length).map((item) => item.id),
    [config.defaultExpandedSideNavIds, visibleSideNavItems]
  )
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpanded)
  const PlatformIcon = resolvePlatformIcon(config.platformIcon || "settings")

  useEffect(() => {
    const activeParents = visibleSideNavItems
      .filter((item) => item.children?.some((child) => matchesPath(pathname, child.href, child.matchers)))
      .map((item) => item.id)

    setExpandedItems((prev) => Array.from(new Set([...defaultExpanded, ...activeParents, ...prev])))
  }, [visibleSideNavItems, defaultExpanded, pathname])

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId) ? prev.filter((entry) => entry !== itemId) : [...prev, itemId]
    )
  }

  return (
    <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col overflow-hidden overflow-y-auto border-r border-gray-100 bg-white">
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <Link
            href={config.sideBackHref}
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
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-primary/5 font-medium text-primary" : "text-gray-600 hover:bg-gray-50"
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
                  href={item.href || "/"}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-primary text-white font-medium" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )}

              {hasChildren && isExpanded ? (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  {item.children?.map((child) => (
                    <Link
                      key={child.id}
                      href={child.href}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm transition-colors",
                        matchesPath(pathname, child.href, child.matchers)
                          ? "bg-primary text-white font-medium"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
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
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/5 font-medium text-primary"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
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
    </aside>
  )
}

export function PlatformShell({
  config,
  children,
}: {
  config: PlatformNavigationConfig
  children: React.ReactNode
}) {
  return (
    <>
      <PlatformTopNav config={config} />
      <div className={cn("flex min-h-screen bg-[#f5f7fa]", "pt-14", config.shellClassName)}>
        {config.hideSideNav ? null : <PlatformSideNav config={config} />}
        <main className={cn("min-w-0 flex-1", config.mainClassName)}>
          <div className={cn("p-6", config.contentClassName)}>{children}</div>
        </main>
      </div>
    </>
  )
}
