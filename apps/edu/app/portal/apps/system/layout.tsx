"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, ChevronLeft, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { systemNavigationConfig } from "@/lib/navigation-config"
import { resolvePlatformIcon } from "@/components/platform-shell"

const menuItems = systemNavigationConfig.sideNavItems

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { hasMenuPermission, loading } = usePortalAuth()
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    menuItems.filter((item) => item.children).map((item) => item.id)
  )

  const permitted = hasMenuPermission(pathname)

  const visibleMenuItems = useMemo(() => {
    return menuItems
      .map((item) => {
        if (item.href) {
          return hasMenuPermission(item.href) ? item : null
        }
        const visibleChildren = (item.children || []).filter((child: any) => hasMenuPermission(child.href))
        if (visibleChildren.length === 0) return null
        return { ...item, children: visibleChildren }
      })
      .filter(Boolean) as typeof menuItems
  }, [hasMenuPermission])

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa]">
      {/* Left Sidebar */}
      <aside className="w-56 bg-background border-r border-border shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
        {/* Header with back button */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/apps"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">系统设置</h2>
            </div>
          </div>
        </div>

        <nav className="p-3">
          {visibleMenuItems.map((item: any) => {
            const Icon = resolvePlatformIcon(item.icon)
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.includes(item.id)
            const itemActive = item.href ? isActive(item.href) : item.children?.some((c: any) => isActive(c.href))

            return (
              <div key={item.id} className="mb-1">
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                      itemActive
                        ? "text-primary font-medium bg-primary/5"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive(item.href!)
                        ? "bg-primary text-white font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )}

                {/* Children */}
                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-border pl-3">
                    {(item.children || []).map((child: any) => (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={cn(
                          "block px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive(child.href)
                            ? "bg-primary text-white font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden bg-[#f5f7fa] min-h-[calc(100vh-3.5rem)]">
        {loading ? null : permitted ? (
          children
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            当前角色暂无权限访问该页面，请联系管理员在角色权限中开通
          </div>
        )}
      </main>
    </div>
  )
}
