'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import {
  allianceEnterpriseApi,
  allianceProjectApi,
  allianceAchievementApi,
  allianceAgreementApi,
} from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import type {
  AllianceEnterprise,
  AllianceProject,
  AllianceAchievement,
  AllianceAgreement,
} from '@/lib/types'

export default function AllianceEnterprisesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [agreements, setAgreements] = useState<AllianceAgreement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEnterprises = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [ent, proj, ach, agr] = await Promise.all([
        allianceEnterpriseApi.list(),
        allianceProjectApi.list({ limit: 200 }),
        allianceAchievementApi.list({ limit: 200 }),
        allianceAgreementApi.list({ limit: 200 }),
      ])
      setEnterprises(ent.items || [])
      setProjects(proj.items || [])
      setAchievements(ach.items || [])
      setAgreements(agr.items || [])
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
      await fetchEnterprises()
    })()
  }, [tenantId, authLoading, fetchEnterprises])

  const countBy = (arr: any[], field: string, id: string) =>
    arr.filter((x) => (x[field] || []).includes?.(id)).length

  return (
    <PortalCrudPage
      title="合作企业管理"
      description="管理全部合作企业档案，包含基本信息、合作协议、合作评级等。"
      entityLabel="合作企业"
      searchPlaceholder="搜索企业名称或行业..."
      createButtonLabel="新增企业"
      items={enterprises}
      loading={loading}
      error={error}
      onRetry={fetchEnterprises}
      filterItems={(items, search) =>
        items.filter(
          (e) =>
            !search ||
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            (e.industry || '').toLowerCase().includes(search.toLowerCase()),
        )
      }
      importConfig={{
        importType: 'alliance-enterprises',
        entityLabel: '合作企业',
        templateFileName: '合作企业批量导入模板.xlsx',
      }}
      createHref="/portal/apps/alliance/enterprises/new"
      colSpan={14}
      renderTableHeader={() => (
        <>
          <TableHead>企业名称</TableHead>
          <TableHead>前台展示</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>行业</TableHead>
          <TableHead>地址</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>评级</TableHead>
          <TableHead>合作协议</TableHead>
          <TableHead>合作项目</TableHead>
          <TableHead>合作成果</TableHead>
          <TableHead>创建人</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead>更新时间</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(enterprise: any, actions: any) => (
        <>
          <TableCell className="font-medium">
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}`}
              className="hover:underline"
            >
              {enterprise.name}
            </Link>
          </TableCell>
          <TableCell>
            <Switch checked={enterprise.isPublic || false} onCheckedChange={actions.toggle} />
          </TableCell>
          <TableCell>{allianceLabel('enterpriseType', enterprise.enterpriseType)}</TableCell>
          <TableCell>{enterprise.industry || '-'}</TableCell>
          <TableCell className="max-w-[160px] truncate">{enterprise.address || '-'}</TableCell>
          <TableCell>{allianceLabel('enterpriseStatus', enterprise.status)}</TableCell>
          <TableCell>{allianceLabel('enterpriseRating', enterprise.rating)}</TableCell>
          <TableCell>
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=agreements`}
              className="text-primary hover:underline"
            >
              {agreements.filter((a) => (a.enterpriseIds || []).includes?.(enterprise.id)).length}
            </Link>
          </TableCell>
          <TableCell>
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=projects`}
              className="text-primary hover:underline"
            >
              {countBy(projects, 'enterpriseIds', enterprise.id)}
            </Link>
          </TableCell>
          <TableCell>
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=achievements`}
              className="text-primary hover:underline"
            >
              {countBy(achievements, 'enterpriseIds', enterprise.id)}
            </Link>
          </TableCell>
          <TableCell>{enterprise.createdBy || '-'}</TableCell>
          <TableCell>{formatDate(enterprise.createdAt)}</TableCell>
          <TableCell>{formatDate(enterprise.updatedAt)}</TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                查看
              </Button>
            </Link>
            <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}/edit`}>
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
      )}
      createDefault={() =>
        ({
          id: '',
          name: '',
          enterpriseType: 'cooperation',
          status: 'negotiating',
          rating: 'general',
          isPublic: false as any,
          industry: '',
          region: '',
          description: '',
          contactPerson: '',
          contactPhone: '',
          contactEmail: '',
          cooperationTypes: [] as any,
          businessLicensePhotos: [] as any,
          qualificationPhotos: [] as any,
          intellectualPropertyPhotos: [] as any,
          coverPhotos: [] as any,
          secondaryColleges: [] as any,
          createdAt: '',
          updatedAt: '',
        }) as AllianceEnterprise & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormFieldRow label="企业名称" required>
              <Input
                value={item.name || ''}
                onChange={(e: any) => setItem({ ...item, name: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="企业类型">
              <Select
                value={item.enterpriseType || 'cooperation'}
                onValueChange={(v: any) => setItem({ ...item, enterpriseType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cooperation">合作企业</SelectItem>
                  <SelectItem value="third-party">第三方雇主企业</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label="所属行业">
              <Input
                value={item.industry || ''}
                onChange={(e: any) => setItem({ ...item, industry: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="所在地区">
              <Input
                value={item.region || ''}
                onChange={(e: any) => setItem({ ...item, region: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="合作状态">
              <Select
                value={item.status || 'negotiating'}
                onValueChange={(v: any) => setItem({ ...item, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="negotiating">洽谈中</SelectItem>
                  <SelectItem value="active">合作中</SelectItem>
                  <SelectItem value="paused">已暂停</SelectItem>
                  <SelectItem value="terminated">已终止</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label="合作评级">
              <Select
                value={item.rating || 'general'}
                onValueChange={(v: any) => setItem({ ...item, rating: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategic">战略合作</SelectItem>
                  <SelectItem value="deep">深度合作</SelectItem>
                  <SelectItem value="general">一般合作</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label="联系人">
              <Input
                value={item.contactPerson || ''}
                onChange={(e: any) => setItem({ ...item, contactPerson: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="联系电话">
              <Input
                value={item.contactPhone || ''}
                onChange={(e: any) => setItem({ ...item, contactPhone: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="联系邮箱">
              <Input
                value={item.contactEmail || ''}
                onChange={(e: any) => setItem({ ...item, contactEmail: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="Logo URL">
              <Input
                value={item.logoUrl || ''}
                onChange={(e: any) => setItem({ ...item, logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormFieldRow>
            <FormFieldRow label="企业地址">
              <Input
                value={item.address || ''}
                onChange={(e: any) => setItem({ ...item, address: e.target.value })}
              />
            </FormFieldRow>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={item.isPublic || false}
                onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })}
              />
              <Label>公开显示</Label>
            </div>
          </div>
          <FormFieldRow label="企业描述">
            <Textarea
              value={item.description || ''}
              onChange={(e: any) => setItem({ ...item, description: e.target.value })}
              rows={4}
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item: any) => (
        <>
          确定要删除合作企业 <b>{item.name}</b> 吗？此操作不可撤销。
        </>
      )}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await allianceEnterpriseApi.update(item.id, item)
        } else {
          await allianceEnterpriseApi.create(item)
        }
        toast({ title: `企业已${isEdit ? '更新' : '创建'}` })
        await fetchEnterprises()
      }}
      onDelete={async (item: any) => {
        await allianceEnterpriseApi.delete(item.id)
        toast({ title: '企业已删除' })
        await fetchEnterprises()
      }}
      onToggleEnabled={async (item: any) => {
        await allianceEnterpriseApi.togglePublic(item.id, !item.isPublic)
        await fetchEnterprises()
      }}
    />
  )
}
