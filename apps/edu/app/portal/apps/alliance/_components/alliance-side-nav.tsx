"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Building, Briefcase, Award, Users, FileText, Shield, BookOpen, Share2, Sparkles, GraduationCap, Palette } from "lucide-react"

const navGroups = [
  {
    id: "cooperation",
    label: "产教融合管理",
    items: [
      { id: "school", label: "学校信息", href: "/portal/apps/alliance/school", icon: Building },
      { id: "enterprises", label: "合作企业", href: "/portal/apps/alliance/enterprises", icon: Building },
      { id: "projects", label: "合作项目", href: "/portal/apps/alliance/projects", icon: Briefcase },
      { id: "achievements", label: "合作成果", href: "/portal/apps/alliance/achievements", icon: Award },
      { id: "experts", label: "专家资源库", href: "/portal/apps/alliance/experts", icon: Users },
      { id: "agreements", label: "合作协议", href: "/portal/apps/alliance/agreements", icon: FileText },
      { id: "permissions", label: "合作权限", href: "/portal/apps/alliance/permissions", icon: Shield },
      { id: "dictionaries", label: "字典管理", href: "/portal/apps/alliance/dictionaries", icon: BookOpen },
    ],
  },
  {
    id: "brand",
    label: "品牌运营管理",
    items: [
      { id: "brand-talent", label: "人才品牌管理", href: "/portal/apps/alliance/brands/talent", icon: GraduationCap },
      { id: "brand-employer", label: "雇主品牌管理", href: "/portal/apps/alliance/brands/employer", icon: Building },
      { id: "brand-job", label: "岗位品牌管理", href: "/portal/apps/alliance/brands/job", icon: Briefcase },
      { id: "brand-major", label: "专业品牌管理", href: "/portal/apps/alliance/brands/major", icon: BookOpen },
      { id: "brand-teacher", label: "师资品牌管理", href: "/portal/apps/alliance/brands/teacher", icon: Users },
      { id: "brand-culture", label: "文化思政品牌管理", href: "/portal/apps/alliance/brands/culture", icon: Palette },
      { id: "brand-topics", label: "品牌专题页", href: "/portal/apps/alliance/brands/topics", icon: Sparkles },
    ],
  },
]

export function AllianceSideNav() {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r bg-sidebar min-h-[calc(100vh-56px)] shrink-0">
      <div className="p-4">
        <Link href="/portal/apps/alliance/brands" className="block mb-6">
          <h2 className="text-lg font-bold text-foreground">产教融合管理平台</h2>
        </Link>
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.id}>
              <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
