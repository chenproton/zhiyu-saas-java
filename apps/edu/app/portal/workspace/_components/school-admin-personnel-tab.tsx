'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  ChevronRight,
  GraduationCap,
  KeyRound,
  Users,
  UserCog,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionCard } from './section-card'
import { portalApi } from '@/lib/api'
import type { WorkspaceDashboard } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

const iconMap: Record<string, LucideIcon> = {
  学生: GraduationCap,
  教职工: Users,
  企业导师: UsersRound,
  学校管理员: UserCog,
}

export function SchoolAdminPersonnelTab() {
  const t = useT()

  const quickLinks = [
    {
      label: t('学生管理'),
      desc: t('查看、编辑、批量导入学生'),
      href: '/portal/apps/system/org-user/students',
      icon: GraduationCap,
    },
    {
      label: t('教职工管理'),
      desc: t('管理教师账号与角色'),
      href: '/portal/apps/system/org-user/teachers',
      icon: Users,
    },
    {
      label: t('账户列表'),
      desc: t('全部账户启停与密码重置'),
      href: '/portal/apps/system/org-user/accounts',
      icon: UserPlus,
    },
    {
      label: t('角色权限'),
      desc: t('自定义角色与菜单授权'),
      href: '/portal/apps/system/org-user/roles',
      icon: KeyRound,
    },
    {
      label: t('组织架构'),
      desc: t('学院、专业、班级维护'),
      href: '/portal/apps/system/org-user/org-structure',
      icon: Building2,
    },
  ]

  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi
      .workspaceDashboard({ role: 'school_admin' })
      .then(setDashboard)
      .catch(() => setDashboard(null))
  }, [])

  const personnelStats = dashboard?.personnelStats || []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {personnelStats.map((item) => {
          const Icon = iconMap[item.label] || Users
          return (
            <Card
              key={item.label}
              className="bg-gradient-to-r from-primary to-primary/70 text-white border-0"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-primary-foreground/80 text-sm">{item.label}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <SectionCard title={t('人员管理入口')} icon={Users} iconColor="green">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {quickLinks.map((entry) => (
            <a
              key={entry.label}
              href={entry.href}
              className="group flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-primary/25 hover:shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-primary group-hover:bg-primary/5 group-hover:border-primary/25 transition-colors">
                <entry.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{entry.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{entry.desc}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-300 group-hover:text-primary group-hover:bg-primary/5"
                aria-label={t('查看详情')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
