"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Building2 } from "lucide-react"
import type { PlatformNavigationConfig, TopNavItem, UserMenuItem } from "@zhiyu/ui/components/platform-shell"
import { PlatformSideNav } from "@zhiyu/ui/components/platform-shell"
import { resolvePlatformIcon } from "@zhiyu/ui/components/platform-shell"
import { cn, matchesPath } from "@zhiyu/ui/components/platform-shell/utils"
import { useAuth } from "@/components/auth-provider"

function isTopItemActive(pathname: string, item: TopNavItem) {
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
          {config.topNavItems?.map((item) => {
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
              <Link key={item.id} href={item.href} title={item.label} className={itemClassName}>
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
          <Link href={config.enterpriseLoginHref}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300"
          >
            <Building2 className="h-4 w-4" />企业登录
          </Link>
        )}

        {config.showCurrentTime !== false && mounted ? <div className="text-sm text-gray-400 hidden md:block whitespace-nowrap">{currentTime}</div> : null}

        {config.showUserMenu !== false ? (
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen((value) => !value)}
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
                        <Link href={item.href} className={itemClassName}>{Icon ? <Icon className="mr-2 h-4 w-4" /> : null}{item.label}</Link>
                      ) : (
                        <button type="button" className={itemClassName}>{Icon ? <Icon className="mr-2 h-4 w-4" /> : null}{item.label}</button>
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

export function PlatformShell({
  config,
  children,
}: {
  config: PlatformNavigationConfig
  children: React.ReactNode
}) {
  const { hasMenuPermission } = useAuth()

  return (
    <>
      <PlatformTopNav config={config} />
      <div className={cn("flex min-h-screen bg-[#f5f7fa]", "pt-14", config.shellClassName)}>
        {config.hideSideNav ? null : (
          <PlatformSideNav config={config} hasMenuPermission={hasMenuPermission} />
        )}
        <main className={cn("min-w-0 flex-1", config.mainClassName)}>
          <div className={cn("p-6", config.contentClassName)}>{children}</div>
        </main>
      </div>
    </>
  )
}
