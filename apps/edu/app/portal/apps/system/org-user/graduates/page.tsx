'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { usePortalUsers } from '@/hooks/use-portal-users'
import { useOrgTree, findOrgAncestor } from '@/hooks/use-org-tree'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { portalUserManagementApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { Download, Loader2, Pencil, RotateCcw } from 'lucide-react'
import type { Organization } from '@/lib/types/backend'
import { useT } from '@/lib/i18n/locale-provider'

const DEPT_TYPE = '二级学院'
const CLASS_TYPE = '班级'

interface DisplayGraduate {
  id: string
  name: string
  loginAccount: string
  className: string
  department: string
  orgNodeId?: string
  graduateYear?: number
}

function getOrgTypeName(
  org: Organization | undefined,
  orgTypeMap: Map<string, { name: string }>,
): string | undefined {
  if (!org) return undefined
  return orgTypeMap.get(org.typeId)?.name
}

export default function GraduatesPage() {
  const t = useT()
  const { institution, tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const { users, loading, error, refetch } = usePortalUsers({
    roleCode: 'student',
    status: 'graduated',
    search: searchTerm || undefined,
  })
  const { orgMap, orgTypeMap } = useOrgTree(tenantId)

  const [graduates, setGraduates] = useState<DisplayGraduate[]>([])
  const [yearFilter, setYearFilter] = useState('all')
  const [editingGraduate, setEditingGraduate] = useState<DisplayGraduate | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formClassNodeId, setFormClassNodeId] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      setGraduates(
        users.map((u) => {
          const classNode = u.orgNodeId ? orgMap.get(u.orgNodeId) : undefined
          const className = classNode?.name || '—'

          let departmentName = institution?.name || '—'
          if (classNode) {
            const deptNode = findOrgAncestor(
              orgMap,
              classNode.id,
              (org) => getOrgTypeName(org, orgTypeMap) === DEPT_TYPE,
            )
            departmentName = deptNode?.name || institution?.name || '—'
          }

          return {
            id: u.id,
            name: u.name,
            loginAccount: u.username || u.loginName || '',
            className,
            department: departmentName,
            orgNodeId: u.orgNodeId,
            graduateYear: u.graduateYear,
          }
        }),
      )
    })()
  }, [users, institution, orgMap, orgTypeMap])

  const graduateYears = useMemo(() => {
    return [
      ...new Set(graduates.map((g) => g.graduateYear).filter((y): y is number => y !== undefined)),
    ]
      .sort((a, b) => b - a)
      .map(String)
  }, [graduates])

  const openEditDialog = (graduate: DisplayGraduate) => {
    setEditingGraduate(graduate)
    setFormName(graduate.name)
    setFormUsername(graduate.loginAccount)
    setFormClassNodeId(graduate.orgNodeId || '')
    setIsDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingGraduate || !formName.trim() || !formUsername.trim()) return
    const original = users.find((u) => u.id === editingGraduate.id)
    if (!original) {
      toast({ variant: 'destructive', title: t('保存失败'), description: t('未找到原始用户数据') })
      return
    }
    setSaving(true)
    try {
      await portalUserManagementApi.update(editingGraduate.id, {
        institutionId: original.institutionId,
        orgNodeId: formClassNodeId || undefined,
        majorId: original.majorId,
        role: original.role,
        loginName: formUsername.trim(),
        username: formUsername.trim(),
        name: formName.trim(),
        email: original.email,
        phone: original.phone,
        avatarUrl: original.avatarUrl,
        studentNo: original.studentNo,
        workId: original.workId,
        idCard: original.idCard,
        titleIds: original.titleIds,
      })
      toast({ title: t('保存成功') })
      setIsDialogOpen(false)
      setEditingGraduate(null)
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReEnroll = async (graduate: DisplayGraduate) => {
    try {
      await portalUserManagementApi.updateStatus(graduate.id, 'active')
      toast({ title: t('已恢复入学') })
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('操作失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    }
  }

  return (
    <PortalCrudPage
      title={t('毕业学生管理')}
      description={t('管理已毕业学生的档案信息')}
      entityLabel={t('毕业学生')}
      items={graduates}
      loading={loading}
      error={error ?? null}
      onRetry={refetch}
      colSpan={7}
      searchPlaceholder={t('搜索姓名或学号...')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchRight={
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('毕业年份')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部年份')}</SelectItem>
            {graduateYears.map((year) => (
              <SelectItem key={year} value={year}>
                {t('{year}届', { year })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      filterItems={(items, search) =>
        items.filter((g) => {
          if (yearFilter !== 'all' && String(g.graduateYear) !== yearFilter) return false
          if (!search) return true
          return (
            g.name.includes(search) ||
            g.loginAccount.includes(search) ||
            g.department.includes(search) ||
            g.className.includes(search)
          )
        })
      }
      hideImport
      hideCreate
      emptyContent={searchTerm || yearFilter !== 'all' ? t('未找到匹配的学生') : t('暂无数据')}
      headerActions={
        <Button variant="outline" size="sm" disabled title={t('即将上线')}>
          <Download className="h-4 w-4 mr-1" />
          {t('批量导出')}
        </Button>
      }
      renderTableHeader={() => (
        <>
          <TableHead className="w-32">{t('登录账号（学号）')}</TableHead>
          <TableHead className="w-28">{t('姓名')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('所属院系')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('班级')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('毕业年份')}</TableHead>
          <TableHead className="w-24">{t('状态')}</TableHead>
          <TableHead className="w-24 text-right">{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(graduate) => (
        <>
          <TableCell className="font-mono text-sm">{graduate.loginAccount}</TableCell>
          <TableCell className="font-medium">{graduate.name}</TableCell>
          <TableCell className="hidden md:table-cell">{graduate.department}</TableCell>
          <TableCell className="hidden md:table-cell">{graduate.className}</TableCell>
          <TableCell className="hidden md:table-cell">
            <Badge variant="secondary">
              {graduate.graduateYear !== undefined
                ? t('{year}届', { year: graduate.graduateYear })
                : '—'}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge>{t('毕业')}</Badge>
          </TableCell>
          <TableRowActions>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => openEditDialog(graduate)}
            >
              <Pencil className="mr-1 h-3 w-3" />
              {t('编辑')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
              onClick={() => handleReEnroll(graduate)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t('重新入学')}
            </Button>
          </TableRowActions>
        </>
      )}
    >
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t('编辑学生')}</DialogTitle>
            <DialogDescription>{t('修改学生基本信息与班级归属')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('姓名')} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t('请输入姓名')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('登录账号（学号）')} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t('如：S2024001')}
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('班级')} <span className="text-destructive">*</span>
              </label>
              <OrgNodePicker
                tenantId={tenantId}
                value={formClassNodeId}
                onChange={(value) => {
                  setFormClassNodeId(value || '')
                }}
                selectableTypes={[CLASS_TYPE]}
                placeholder={t('选择班级')}
                title={t('选择班级')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              {t('取消')}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving || !formName.trim() || !formUsername.trim() || !formClassNodeId}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalCrudPage>
  )
}
