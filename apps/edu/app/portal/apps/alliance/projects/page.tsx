'use client'

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
import { allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import type { AllianceProjectMilestone } from '@/lib/types'

export default function AllianceProjectsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return { projects: [], enterprises: [], milestones: {} }
      const [data, ents] = await Promise.all([
        allianceProjectApi.list(),
        allianceEnterpriseApi.list({ limit: 200 }),
      ])
      const ms: Record<string, AllianceProjectMilestone[]> = {}
      for (const p of data.items || []) {
        try {
          const m = await allianceProjectApi.listMilestones(p.id)
          ms[p.id] = m.items || []
        } catch {
          ms[p.id] = []
        }
      }
      return { projects: data.items || [], enterprises: ents.items || [], milestones: ms }
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const { projects, enterprises, milestones } = data ?? {}

  const entName = (id: string) => (enterprises ?? []).find((e) => e.id === id)?.name || id

  return (
    <PortalCrudPage
      title="合作项目管理"
      description="管理校企合作项目，追踪项目阶段与里程碑。"
      entityLabel="合作项目"
      searchPlaceholder="搜索项目名称..."
      createButtonLabel="新增项目"
      items={projects ?? []}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
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
        const ms = (milestones ?? {})[p.id] || []
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
              {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="w-20 h-2" />
                <span className="text-xs text-muted-foreground">{progress}%</span>
              </div>
            </TableCell>
            <TableCell>{allianceLabel('projectPhase', p.phase)}</TableCell>
            <TableCell>{formatDate(p.updatedAt)}</TableCell>
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
        if (isEdit) await allianceProjectApi.update(item.id, item)
        else await allianceProjectApi.create(item)
        toast({ title: `项目已${isEdit ? '更新' : '创建'}` })
        await refresh()
      }}
      onDelete={async (item: any) => {
        await allianceProjectApi.delete(item.id)
        toast({ title: '已删除' })
        await refresh()
      }}
      onToggleEnabled={async (item: any) => {
        await allianceProjectApi.update(item.id, { isPublic: !item.isPublic })
        toast({ title: `已${item.isPublic ? '取消' : '设为'}前台展示` })
        await refresh()
      }}
    />
  )
}
