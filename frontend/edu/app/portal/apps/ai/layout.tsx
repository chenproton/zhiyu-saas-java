'use client'

// AI 智能服务中心布局：侧边栏（aiNavigationConfig）+ 菜单权限门（与系统设置布局同模式）。
// 权限语义见 lib/menu-permissions.ts：权限树内页面按角色勾选控制，子路径继承最近已授权父菜单。
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, ChevronLeft, Sparkles, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { aiNavigationConfig } from '@/lib/navigation-config'
import { resolvePlatformIcon } from '@/components/platform-shell'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useT } from '@/lib/i18n/locale-provider'

const menuItems = aiNavigationConfig.sideNavItems

// 前台落地页为全宽页面（自带 hero/页脚），不包侧边栏（同 alliance FULL_WIDTH_PAGES 模式）
// 全宽页（前台）：landing 自带 hero；hall/* 大厅属前台浏览页。
// 前台与后台严格区分——这些页面均不包平台侧边栏
const FULL_WIDTH_PAGES = [
  '/portal/apps/ai/landing',
  '/portal/apps/ai/hall',
  '/portal/apps/ai/agents', // 智能体对话详情：广场浏览链路，前台
  '/portal/apps/ai/kb', // 知识库详情：广场浏览链路，前台
  '/portal/apps/ai/studio', // 创作页（知识库/智能体编辑器）：自带顶栏，不包平台侧边栏（v2.6，对齐 zhiyu-ai builder 模式）
]

export default function AICenterLayout({ children }: { children: React.ReactNode }) {
  const t = useT()
  const pathname = usePathname()
  const isFullWidth = FULL_WIDTH_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  const { hasMenuPermission, loading } = usePortalAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    menuItems.filter((item) => item.children).map((item) => item.id),
  )

  // 路由变化时收起移动端抽屉（render 期守卫式状态调整，等价于 effect 监听 pathname）
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setMobileOpen(false)
  }

  const permitted = hasMenuPermission(pathname)

  const visibleMenuItems = useMemo(() => {
    return menuItems
      .map((item) => {
        if (item.href) {
          return hasMenuPermission(item.href) ? item : null
        }
        const visibleChildren = (item.children || []).filter((child: any) =>
          hasMenuPermission(child.href),
        )
        if (visibleChildren.length === 0) return null
        return { ...item, children: visibleChildren }
      })
      .filter(Boolean) as typeof menuItems
  }, [hasMenuPermission])

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const isActive = (href: string) => {
    const item = menuItems.find((i) => i.href === href)
    if (item?.matchers?.some((m) => pathname === m || pathname.startsWith(m + '/'))) return true
    return pathname === href || pathname.startsWith(href + '/')
  }

  const navContent = (
    <>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            href="/portal/apps"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-medium text-foreground">{t('AI 智能服务平台')}</h2>
          </div>
        </div>
      </div>

      <nav className="p-3">
        {visibleMenuItems.map((item: any) => {
          const Icon = resolvePlatformIcon(item.icon)
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = expandedItems.includes(item.id)
          const itemActive = item.href
            ? isActive(item.href)
            : item.children?.some((c: any) => isActive(c.href))

          return (
            <div key={item.id} className="mb-1">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors',
                    itemActive
                      ? 'text-primary font-medium bg-primary/5'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    {t(item.label)}
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
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive(item.href!)
                      ? 'bg-primary text-white font-medium'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.label)}
                </Link>
              )}

              {hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-border pl-3">
                  {(item.children || []).map((child: any) => (
                    <Link
                      key={child.id}
                      href={child.href}
                      className={cn(
                        'block px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive(child.href)
                          ? 'bg-primary text-white font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                    >
                      {t(child.label)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </>
  )

  if (isFullWidth) {
    // 落地页同样受权限门控制（单一开关 /portal/apps/ai 未授权时拦截）
    if (loading) return null
    if (!permitted) {
      return (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t('当前角色暂无权限访问该页面，请联系管理员在角色权限中开通')}
        </div>
      )
    }
    return <>{children}</>
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa]">
      {/* 移动端导航入口按钮 + 抽屉 */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t('打开导航菜单')}
        className="fixed left-3 top-16 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:text-primary md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">{t('导航菜单')}</SheetTitle>
          <div className="flex h-full flex-col overflow-y-auto">{navContent}</div>
        </SheetContent>
      </Sheet>

      {/* Left Sidebar */}
      <aside className="hidden md:flex w-56 bg-background border-r border-border shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto flex-col">
        {navContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden bg-[#f5f7fa] min-h-[calc(100vh-3.5rem)] p-4 sm:p-6">
        {loading ? null : permitted ? (
          children
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t('当前角色暂无权限访问该页面，请联系管理员在角色权限中开通')}
          </div>
        )}
      </main>
    </div>
  )
}
