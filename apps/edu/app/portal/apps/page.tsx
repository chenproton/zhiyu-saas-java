"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import {
  Settings,
  Users,
  Briefcase,
  Layers,
  CheckCircle,
  BookOpen,
  Sparkles,
  Share2,
  Calendar,
  BarChart3,
  Rocket,
  GraduationCap,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAppModules } from "@zhiyu/ui"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { getPlatformCardModules } from "@/lib/navigation-config"

const menuItems = [
  { id: "system", label: "系统管理", icon: Settings },
  { id: "career", label: "职业岗位学习平台", icon: Briefcase },
  { id: "scene", label: "实践场景学习平台", icon: Layers },
  { id: "course", label: "数字课程服务平台", icon: BookOpen },
  { id: "ability", label: "能力评价与测评资源管理平台", icon: CheckCircle },
  { id: "resource", label: "教学资源共享服务平台", icon: Share2 },
  { id: "alliance", label: "产教协同与人才品牌运营平台", icon: Users },
  { id: "affairs", label: "教务服务平台", icon: Calendar },
  { id: "ai", label: "AI 智能服务平台", icon: Sparkles },
  { id: "opc", label: "OPC专区", icon: Rocket },
  { id: "decision", label: "敏捷决策中心", icon: BarChart3 },
  { id: "research", label: "教科研服务中心", icon: GraduationCap },
]

const quickAccess = [
  { icon: Settings, label: "组织权限", href: "/portal/apps/system/org-user/roles" },
  { icon: Briefcase, label: "岗位资源管理", href: "/job/positions" },
  { icon: Layers, label: "场景资源管理", href: "/scene" },
  { icon: BarChart3, label: "日志管理", href: "/portal/apps/system/logs/login" },
]

interface PlatformStyle {
  iconColor: string
  iconBg: string
}

const platformStyles: Record<string, PlatformStyle> = {
  system: { iconColor: "text-blue-600", iconBg: "bg-blue-50" },
  alliance: { iconColor: "text-rose-600", iconBg: "bg-rose-50" },
  career: { iconColor: "text-purple-600", iconBg: "bg-purple-50" },
  course: { iconColor: "text-amber-600", iconBg: "bg-amber-50" },
  scene: { iconColor: "text-cyan-600", iconBg: "bg-cyan-50" },
  ability: { iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
  affairs: { iconColor: "text-teal-600", iconBg: "bg-teal-50" },
  ai: { iconColor: "text-indigo-600", iconBg: "bg-indigo-50" },
  resource: { iconColor: "text-blue-600", iconBg: "bg-blue-50" },
  opc: { iconColor: "text-orange-600", iconBg: "bg-orange-50" },
  decision: { iconColor: "text-sky-600", iconBg: "bg-sky-50" },
  research: { iconColor: "text-violet-600", iconBg: "bg-violet-50" },
}

interface ModuleItem {
  id: string
  title: string
  desc?: string
  href: string
}

interface ModuleSection {
  id: string
  label: string
  icon: typeof Settings
  iconColor: string
  iconBg: string
  modules: ModuleItem[]
}

function ModuleCard({ module }: { module: ModuleItem }) {
  const isExternal = module.href.startsWith("http")
  const href = module.href

  const cardContent = (
    <>
      <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-2 pr-2 leading-tight flex items-center gap-1">
        {module.title}
        {isExternal && <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary/70" />}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{module.desc}</p>
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-primary" />
      </div>
    </>
  )

  const className =
    "bg-card rounded-xl p-5 hover:shadow-lg hover:shadow-border/50 transition-all group relative border border-border hover:border-primary/20 block"

  if (isExternal) {
    return (
      <a key={module.id} href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {cardContent}
      </a>
    )
  }

  if (href === "#") {
    return (
      <div key={module.id} className={`${className} cursor-default opacity-60`}>
        {cardContent}
      </div>
    )
  }

  return (
    <Link key={module.id} href={href} className={className}>
      {cardContent}
    </Link>
  )
}

export default function AppsPage() {
  const { hasMenuPermission, subscriptionModules } = usePortalAuth()
  const [activeMenu, setActiveMenu] = useState(menuItems[0].id)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const contentRef = useRef<HTMLDivElement>(null)
  const { data: modulesData, loading: modulesLoading } = useAppModules()
  const subscriptionLoading = subscriptionModules === null

  const visibleQuickAccess = quickAccess.filter((item) => hasMenuPermission(item.href))

  const allModules: ModuleSection[] = useMemo(() => {
    return menuItems
      .filter((item) => subscriptionModules?.[item.id] === true)
      .map((item) => {
        const configured = modulesData.platforms.find((p) => p.id === item.id)
        let modules: ModuleItem[]

        if (getPlatformCardModules(item.id).length > 0) {
          // 已在统一平台模块定义中，按一级菜单聚合展示
          modules = getPlatformCardModules(item.id).filter((m) => hasMenuPermission(m.href))
        } else if (configured?.modules.length) {
          // 未在定义中的平台，使用后台配置的模块数据
          modules = configured.modules
            .filter((m) => m.href && m.href !== "#" && hasMenuPermission(m.href))
            .map((m) => ({
              id: m.id,
              title: m.title,
              desc: (m as any).description || m.desc,
              href: m.href || "#",
            }))
        } else {
          modules = []
        }

        return {
          id: item.id,
          label: item.label,
          icon: item.icon,
          ...platformStyles[item.id],
          modules,
        }
      })
      .filter((section) => section.modules.length > 0)
  }, [modulesData.platforms, hasMenuPermission, subscriptionModules])

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return

      const scrollTop = contentRef.current.scrollTop
      let currentSection = menuItems[0].id

      for (const section of allModules) {
        const el = sectionRefs.current[section.id]
        if (el) {
          const offsetTop = el.offsetTop - 100
          if (scrollTop >= offsetTop) {
            currentSection = section.id
          }
        }
      }

      setActiveMenu(currentSection)
    }

    const contentEl = contentRef.current
    if (contentEl) {
      contentEl.addEventListener("scroll", handleScroll)
      return () => contentEl.removeEventListener("scroll", handleScroll)
    }
  }, [allModules])

  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId]
    if (el && contentRef.current) {
      const offsetTop = el.offsetTop - 20
      contentRef.current.scrollTo({ top: offsetTop, behavior: "smooth" })
    }
    setActiveMenu(sectionId)
  }

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa] pt-0">
        {/* Quick Access Bar */}
        <div className="bg-background border-b border-border px-4 md:px-6 py-3 sticky top-14 z-10 shadow-sm space-y-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="font-medium">常用服务</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {visibleQuickAccess.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg hover:bg-primary/5 hover:text-primary transition-all shrink-0 group border border-border"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* 移动端分类芯片导航 */}
          <div className="md:hidden flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {allModules.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors border",
                  activeMenu === section.id
                    ? "bg-primary text-white border-primary"
                    : "bg-muted text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex">
          {/* Left Sidebar */}
          <aside className="hidden md:block w-56 bg-background shrink-0 min-h-[calc(100vh-3.5rem-40px)] sticky top-[96px] self-start border-r border-border shadow-sm">
            <nav className="p-2 space-y-2">
              {menuItems.filter((m) => allModules.some((s) => s.id === m.id)).map((item) => {
                const Icon = item.icon
                const isActive = activeMenu === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all text-left group",
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-white" : "text-muted-foreground group-hover:text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto text-white/70" />}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main ref={contentRef} className="flex-1 px-4 pb-4 pt-4 overflow-y-auto max-h-[calc(100vh-3.5rem-40px)] relative">
            {modulesLoading || subscriptionLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-muted-foreground">加载中...</div>
              </div>
            ) : allModules.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-muted-foreground">暂无可用应用，请联系管理员开通套餐</div>
              </div>
            ) : (
              allModules.map((section) => {
                const SectionIcon = section.icon
                return (
                  <div
                    key={section.id}
                    ref={(el) => {
                      sectionRefs.current[section.id] = el
                    }}
                    className="mb-5"
                  >
                    {/* Section Title */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", section.iconBg)}>
                        <SectionIcon className={cn("w-5 h-5", section.iconColor)} />
                      </div>
                      <h2 className="text-base font-semibold text-foreground">{section.label}</h2>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {section.modules.length} 个模块
                      </span>
                    </div>

                    {/* Module Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                      {section.modules.map((module) => (
                        <ModuleCard key={module.id} module={module} />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
