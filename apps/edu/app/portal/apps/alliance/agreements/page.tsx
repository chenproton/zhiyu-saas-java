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
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAgreementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import type { AllianceAgreement, AllianceEnterprise, AllianceProject } from '@/lib/types'

export default function AllianceAgreementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceAgreement[]>([])
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [data, ents, projs] = await Promise.all([
        allianceAgreementApi.list(),
        allianceEnterpriseApi.list({ limit: 200 }),
        allianceProjectApi.list({ limit: 200 }),
      ])
      setItems(data.items || [])
      setEnterprises(ents.items || [])
      setProjects(projs.items || [])
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
      await fetchItems()
    })()
  }, [tenantId, authLoading, fetchItems])

  return (
    <PortalCrudPage
      title="合作协议管理"
      description="管理校企合作协议的独立记录"
      entityLabel="合作协议"
      searchPlaceholder="搜索协议名称..."
      createButtonLabel="新增协议"
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchItems}
      filterItems={(filtered, search) =>
        filtered.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
      }
      importConfig={{
        importType: 'alliance-agreements',
        entityLabel: '合作协议',
        templateFileName: '合作协议批量导入模板.xlsx',
      }}
      createHref="/portal/apps/alliance/agreements/new"
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>协议名称</TableHead>
          <TableHead>合作企业</TableHead>
          <TableHead>关联项目</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>生效日期</TableHead>
          <TableHead>到期日期</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => {
        const entIds: string[] = (item.enterpriseIds || []).map(String)
        const expiring =
          item.endDate &&
          (() => {
            const days = (new Date(item.endDate).getTime() - Date.now()) / 86400000
            return days >= 0 && days <= 90
          })()
        return (
          <>
            <TableCell className="font-medium">
              <Link
                href={`/portal/apps/alliance/agreements/${item.id}`}
                className="hover:underline"
              >
                {item.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[160px]">
              {entIds.length > 0
                ? entIds.map((eid) => enterprises.find((e) => e.id === eid)?.name || eid).join('、')
                : '-'}
            </TableCell>
            <TableCell>
              {(item.projectIds || []).length > 0
                ? projects.find((p) => p.id === (item.projectIds || [])[0])?.name || '-'
                : '-'}
            </TableCell>
            <TableCell>{item.type || '-'}</TableCell>
            <TableCell>
              {item.startDate ? new Date(item.startDate).toLocaleDateString('zh-CN') : '-'}
            </TableCell>
            <TableCell className={expiring ? 'text-amber-600 font-medium' : ''}>
              {item.endDate ? new Date(item.endDate).toLocaleDateString('zh-CN') : '-'}
              {expiring && <span className="ml-1 text-xs">（即将到期）</span>}
            </TableCell>
            <TableCell>{allianceLabel('agreementStatus', item.status)}</TableCell>
            <TableRowActions>
              <Link href={`/portal/apps/alliance/agreements/${item.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  查看
                </Button>
              </Link>
              <Link href={`/portal/apps/alliance/agreements/${item.id}/edit`}>
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
          type: '',
          status: 'draft',
          startDate: '',
          endDate: '',
          content: '',
          enabled: true as any,
          createdAt: '',
          updatedAt: '',
        }) as AllianceAgreement & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <FormFieldRow label="协议名称" required>
            <Input
              value={item.name || ''}
              onChange={(e: any) => setItem({ ...item, name: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label="协议类型">
            <Input
              value={item.type || ''}
              onChange={(e: any) => setItem({ ...item, type: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label="状态">
            <Select
              value={item.status || 'draft'}
              onValueChange={(v: any) => setItem({ ...item, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="active">生效中</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
                <SelectItem value="renewed">已续签</SelectItem>
                <SelectItem value="terminated">已终止</SelectItem>
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
          <FormFieldRow label="协议内容">
            <Textarea
              value={item.content || ''}
              onChange={(e: any) => setItem({ ...item, content: e.target.value })}
              rows={4}
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item: any) => <>确定要删除协议「{item.name}」吗？</>}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await allianceAgreementApi.update(item.id, item)
        } else {
          await allianceAgreementApi.create(item)
        }
        toast({ title: `协议已${isEdit ? '更新' : '创建'}` })
        await fetchItems()
      }}
      onDelete={async (item: any) => {
        await allianceAgreementApi.delete(item.id)
        toast({ title: '协议已删除' })
        await fetchItems()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
