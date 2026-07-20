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
  Star,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppModules } from "@/hooks/use-platform-links"
import { usePortalAuth } from "@/contexts/portal-auth-context"

const menuItems = [
  { id: "system", label: "系统管理", icon: Settings },
  { id: "alliance", label: "产教协同与人才品牌运营平台", icon: Users },
  { id: "career", label: "职业岗位学习平台", icon: Briefcase },
  { id: "course", label: "数字课程服务平台", icon: BookOpen },
  { id: "scene", label: "实践场景学习平台", icon: Layers },
  { id: "ability", label: "能力评价与测评资源管理平台", icon: CheckCircle },
  { id: "affairs", label: "教务服务平台", icon: Calendar },
  { id: "ai", label: "AI 智能服务平台", icon: Sparkles },
  { id: "resource", label: "教学资源共享服务平台", icon: Share2 },
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

const systemModules = [
  { id: "tenant", title: "租户信息管理", desc: "管理租户基本信息与配置", note: "查看和编辑当前租户的基础信息", href: "/portal/apps/system/tenant" },
  { id: "resource-mgmt", title: "系统资源管理", desc: "套餐、编码、行业、专业", note: "管理系统套餐与资源编码配置", href: "/portal/apps/system/resource/package" },
  { id: "log", title: "日志管理", desc: "登录日志、操作日志查看", note: "追溯用户操作记录和登录历史", href: "/portal/apps/system/logs/login" },
  { id: "org-user", title: "组织用户管理", desc: "组织架构、用户账户管理", note: "管理组织关系、角色权限和用户账号", href: "/portal/apps/system/org-user/org-structure" },
]

const fallbackModules: Record<string, ModuleItem[]> = {
  alliance: [
    { id: "alliance-entry", title: "产教协同平台", desc: "暂未开放", note: "校企合作与人才供需对接", href: "#" },
  ],
  career: [
    { id: "career-position-center", title: "岗位中心", desc: "产业岗位标准管理", note: "建设和发布产业岗位标准", href: "/job/positions" },
    { id: "career-archive", title: "岗位归档", desc: "历史岗位归档查看", note: "查看已归档的历史岗位数据", href: "/job/archive" },
    { id: "career-approval", title: "审批中心", desc: "岗位审批流程", note: "处理岗位相关的审批申请", href: "/job/approvals" },
  ],
  course: [
    { id: "course-online-resources", title: "在线课资源库", desc: "体系课管理", note: "管理在线课程体系课资源", href: "/lesson/admin/system" },
    { id: "course-granular", title: "颗粒课管理", desc: "颗粒课资源管理", note: "创建和管理颗粒课资源", href: "/lesson/admin/granular" },
    { id: "course-hybrid-resources", title: "混合课模板", desc: "混合课模板管理", note: "管理混合课模板资源", href: "/lesson/admin/hybrid" },
    { id: "course-archive", title: "混合课历史", desc: "历史档案库", note: "查看混合课历史档案", href: "/lesson/admin/archive" },
    { id: "course-teaching-space", title: "教学空间", desc: "开课计划与教学跟踪", note: "管理开课计划和跟踪学生学习", href: "/lesson/teacher/claim" },
    { id: "course-approval", title: "审批中心", desc: "课程审批流程", note: "处理课程相关的审批申请", href: "/lesson/admin/approvals" },
  ],
  scene: [
    { id: "scene-center", title: "场景中心", desc: "实践场景与任务设计", note: "创建和管理产业实践场景", href: "/scene/" },
    { id: "scene-archive", title: "场景归档", desc: "历史场景查看", note: "查看已归档的历史场景数据", href: "/scene/archive" },
    { id: "scene-approval", title: "审批中心", desc: "场景审批流程", note: "处理场景相关的审批申请", href: "/scene/approvals" },
  ],
  ability: [
    { id: "ability-exam-resources", title: "题库管理", desc: "题库与试卷管理", note: "建设题库和组织试卷", href: "/evaluation/question-banks" },
    { id: "ability-exams", title: "试卷管理", desc: "试卷创建与管理", note: "创建和管理考试试卷", href: "/evaluation/exams" },
    { id: "ability-exam-usage", title: "考试管理", desc: "考试安排与管理", note: "安排和管理考试流程", href: "/evaluation/exam-usage" },
    { id: "ability-approval", title: "审批中心", desc: "测评审批流程", note: "处理测评相关的审批申请", href: "/evaluation/approvals" },
  ],
  affairs: [
    { id: "affairs-entry", title: "教务服务", desc: "暂未开放", note: "教务管理功能即将上线", href: "#" },
  ],
  ai: [
    { id: "ai-entry", title: "AI 服务", desc: "暂未开放", note: "AI 辅助教学功能即将上线", href: "#" },
  ],
  resource: [
    { id: "resource-mall", title: "资源商城", desc: "教学资源交易", note: "浏览和采购优质教学资源", href: "http://111.170.170.202:3010/login" },
  ],
  opc: [
    { id: "opc-entry", title: "OPC 专区", desc: "暂未开放", note: "校企合作课程专区即将上线", href: "#" },
  ],
  decision: [
    { id: "decision-entry", title: "决策中心", desc: "暂未开放", note: "数据分析和决策支持即将上线", href: "#" },
  ],
  research: [
    { id: "research-entry", title: "教科研服务", desc: "暂未开放", note: "教科研管理功能即将上线", href: "#" },
  ],
}

interface ModuleItem {
  id: string
  title: string
  desc: string
  href: string
  note?: string
}

interface ModuleSection {
  id: string
  label: string
  icon: typeof Settings
  iconColor: string
  iconBg: string
  modules: ModuleItem[]
}

function ModuleCard({
  module,
}: {
  module: ModuleItem
}) {
  const isExternal = module.href.startsWith("http")
  const href = isExternal ? module.href : module.href

  const cardContent = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-50 transition-colors opacity-0 group-hover:opacity-100 z-10"
            onClick={(e) => {
              e.preventDefault()
            }}
          >
            <Star className="w-3.5 h-3.5 text-muted-foreground hover:text-amber-400 transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>设为常用</p>
        </TooltipContent>
      </Tooltip>

      <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-2 pr-6 leading-tight flex items-center gap-1">
        {module.title}
        {isExternal && <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary/70" />}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{module.note || module.desc}</p>

      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-primary" />
      </div>
    </>
  )

  const className =
    "bg-card rounded-xl p-5 hover:shadow-lg hover:shadow-border/50 transition-all group relative border border-border hover:border-primary/20 block"

  if (isExternal) {
    return (
      <a
        key={module.id}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
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
  const { hasMenuPermission } = usePortalAuth()
  const [activeMenu, setActiveMenu] = useState(menuItems[0].id)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const contentRef = useRef<HTMLDivElement>(null)
  const { data: modulesData, loading: modulesLoading } = useAppModules()

  const visibleQuickAccess = quickAccess.filter((item) => hasMenuPermission(item.href))

  const fallbackNotes = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const modules of Object.values(fallbackModules)) {
      for (const m of modules) {
        if (m.note && m.href) map[m.href] = m.note
      }
    }
    return map
  }, [])

  const allModules: ModuleSection[] = [
    {
      id: "system",
      label: "系统管理",
      icon: Settings,
      ...platformStyles.system,
      modules: systemModules.filter((m) => hasMenuPermission(m.href)),
    },
    ...menuItems
      .filter((item) => item.id !== "system")
      .map((item) => {
        const configured = modulesData.platforms.find((p) => p.id === item.id)
        const rawModules = configured?.modules.length
          ? configured.modules
          : fallbackModules[item.id] || []
        return {
          id: item.id,
          label: item.label,
          icon: item.icon,
          ...platformStyles[item.id],
          modules: rawModules
            .filter((m) => m.href && m.href !== "#" && hasMenuPermission(m.href))
            .map((m) => ({
              id: m.id,
              title: m.title,
              desc: (m as any).description || m.desc,
              note: (m as any).note || fallbackNotes[m.href],
              href: m.href || "#",
            })),
        }
      }),
  ].filter((section) => section.modules.length > 0)

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
        <div className="bg-background border-b border-border px-6 py-3 sticky top-14 z-10 shadow-sm">
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
        </div>

        <div className="flex">
          {/* Left Sidebar */}
          <aside className="w-56 bg-background shrink-0 min-h-[calc(100vh-3.5rem-40px)] sticky top-[96px] self-start border-r border-border shadow-sm">
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
            {modulesLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-muted-foreground">加载中...</div>
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
                    <div className="grid grid-cols-5 gap-4">
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
