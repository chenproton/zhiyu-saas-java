'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest, buildQuery } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import type {
  AllianceProject,
  AllianceEnterprise,
  AllianceProjectMilestone,
  AllianceListResponse,
} from '@/lib/types'

export default function AllianceProjectsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [milestones, setMilestones] = useState<Record<string, AllianceProjectMilestone[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [data, ents] = await Promise.all([
        portalRequest<AllianceListResponse<AllianceProject>>('/alliance/projects'),
        portalRequest<AllianceListResponse<AllianceEnterprise>>('/alliance/enterprises?limit=1000'),
      ])
      setProjects(data.items || [])
      setEnterprises(ents.items || [])
      const ms: Record<string, AllianceProjectMilestone[]> = {}
      for (const p of data.items || []) {
        try {
          const m = await portalRequest<AllianceListResponse<AllianceProjectMilestone>>(
            `/alliance/projects/${p.id}/milestones`,
          )
          ms[p.id] = m.items || []
        } catch {
          ms[p.id] = []
        }
      }
      setMilestones(ms)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading || !tenantId) return
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await fetchProjects()
    })()
  }, [tenantId, authLoading, fetchProjects])

  const entName = (id: string) => enterprises.find((e) => e.id === id)?.name || id
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('zh-CN') : '-')

  return (
    <PortalCrudPage
      title="合作项目管理"
      description="管理校企合作项目，追踪项目阶段与里程碑。"
      entityLabel="合作项目"
      searchPlaceholder="搜索项目名称..."
      createButtonLabel="新增项目"
      items={projects}
      loading={loading}
      error={error}
      onRetry={fetchProjects}
      filterItems={(items, search) =>
        items.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      }
      importConfig={{
        importType: 'alliance-projects',
        entityLabel: '合作项目',
        templateFileName: '合作项目批量导入模板.xlsx',
      }}
      createHref="/portal/apps/alliance/projects/new"
      colSpan={9}
      renderTableHeader={() => (
        <>
          <TableHead>项目名称</TableHead>
          <TableHead>前台展示</TableHead>
          <TableHead>合作企业</TableHead>
          <TableHead>合作类型</TableHead>
          <TableHead>起止时间</TableHead>
          <TableHead>里程碑进度</TableHead>
          <TableHead>阶段</TableHead>
          <TableHead>更新时间</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(p: any, actions: any) => {
        const ms = milestones[p.id] || []
        const done = ms.filter((m) => m.isCompleted).length
        const progress = ms.length > 0 ? Math.round((done / ms.length) * 100) : 0
        const entIds: string[] = (p.enterpriseIds || []).map(String)
        return (
          <>
            <TableCell className="font-medium">
              <Link href={`/portal/apps/alliance/projects/${p.id}`} className="hover:underline">
                {p.name}
              </Link>
            </TableCell>
            <TableCell>
              <Switch checked={p.isPublic || false} onCheckedChange={actions.toggle} />
            </TableCell>
            <TableCell className="max-w-[180px]">
              {entIds.length > 0 ? entIds.map(entName).join('、') : '-'}
            </TableCell>
            <TableCell>{p.type || '-'}</TableCell>
            <TableCell className="whitespace-nowrap">
              {fmtDate(p.startDate)} ~ {fmtDate(p.endDate)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="w-20 h-2" />
                <span className="text-xs text-muted-foreground">{progress}%</span>
              </div>
            </TableCell>
            <TableCell>{allianceLabel('projectPhase', p.phase)}</TableCell>
            <TableCell>{fmtDate(p.updatedAt)}</TableCell>
            <TableRowActions>
              <Link href={`/portal/apps/alliance/projects/${p.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  查看
                </Button>
              </Link>
              <Link href={`/portal/apps/alliance/projects/${p.id}/edit`}>
                <Button variant="ghost" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  编辑
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                删除
              </Button>
            </TableRowActions>
          </>
        )
      }}
      createDefault={() =>
        ({
          id: '',
          name: '',
          phase: 'initiation',
          publishStatus: 'draft',
          isPublic: false as any,
          createdAt: '',
          updatedAt: '',
        }) as any
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <FormFieldRow label="项目名称" required>
            <Input
              value={item.name || ''}
              onChange={(e: any) => setItem({ ...item, name: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label="阶段">
            <Select
              value={item.phase || ''}
              onValueChange={(v: any) => setItem({ ...item, phase: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['initiation', 'execution', 'acceptance', 'closure', 'archived', 'terminated'].map(
                  (v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FormFieldRow>
          <FormFieldGrid>
            <FormFieldRow label="开始日期">
              <Input
                type="date"
                value={item.startDate || ''}
                onChange={(e: any) => setItem({ ...item, startDate: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="结束日期">
              <Input
                type="date"
                value={item.endDate || ''}
                onChange={(e: any) => setItem({ ...item, endDate: e.target.value })}
              />
            </FormFieldRow>
          </FormFieldGrid>
          <FormFieldRow label="描述">
            <Textarea
              value={item.description || ''}
              onChange={(e: any) => setItem({ ...item, description: e.target.value })}
              rows={3}
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item: any) => (
        <>
          确定要删除项目 <b>{item.name}</b> 吗？
        </>
      )}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit)
          await portalRequest(`/alliance/projects/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify(item),
          })
        else
          await portalRequest('/alliance/projects', { method: 'POST', body: JSON.stringify(item) })
        toast({ title: `项目已${isEdit ? '更新' : '创建'}` })
        await fetchProjects()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/projects/${item.id}`, { method: 'DELETE' })
        toast({ title: '已删除' })
        await fetchProjects()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
