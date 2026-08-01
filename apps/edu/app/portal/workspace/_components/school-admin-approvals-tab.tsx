'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, ChevronRight, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionCard } from './section-card'
import { portalApi } from '@/lib/api'
import type { WorkspaceDashboard, WorkspaceTodo } from '@/lib/types'

const approvalHrefMap: Record<string, string> = {
  'pending-course': '/lesson/admin/approvals',
  'pending-scenario': '/scene/approvals',
  'pending-career_position': '/job/approvals',
  'pending-question_bank': '/evaluation/approvals',
  'pending-exam': '/evaluation/approvals',
  'pending-training_program': '/affairs/approvals',
}

const typeHrefMap: Record<string, string> = {
  course: '/lesson/admin/approvals',
  scenario: '/scene/approvals',
  career_position: '/job/approvals',
  question_bank: '/evaluation/approvals',
  exam: '/evaluation/approvals',
  training_program: '/affairs/approvals',
}

export function SchoolAdminApprovalsTab() {
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)

  useEffect(() => {
    portalApi
      .workspaceDashboard({ role: 'school_admin' })
      .then(setDashboard)
      .catch(() => setDashboard(null))
  }, [])

  const todos = dashboard?.todos || []
  const total = todos.reduce((acc, item) => acc + item.count, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">待审批总数</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        {todos.slice(0, 3).map((item) => (
          <Card
            key={item.id}
            className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50"
          >
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{item.title.replace('待审批', '')}</p>
              <p className="text-xl font-bold text-gray-900">{item.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard title="待审批事项清单" icon={CheckSquare} iconColor="rose">
        <div className="space-y-2">
          {todos.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">暂无待审批事项</div>
          )}
          {todos.map((item) => (
            <a
              key={item.id}
              href={approvalHrefMap[item.id] || typeHrefMap[item.id.replace('pending-', '')] || '#'}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">点击前往对应审批中心处理</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="destructive" className="text-xs">
                  {item.count}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 group-hover:text-blue-600 group-hover:bg-blue-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
