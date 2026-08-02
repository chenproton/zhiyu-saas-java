'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { usePortalUsers } from '@/hooks/use-portal-users'
import { useOrgTree } from '@/hooks/use-org-tree'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  portalUserManagementApi,
  portalStaffTitleApi,
  importExportApi,
  downloadBlob,
} from '@/lib/api'
import type { StaffTitle } from '@/lib/types/backend'
import { MultiSelectSearch } from '@/components/ui/multi-select-search'
import { useToast } from '@zhiyu/ui'
import { PortalSidebarCrudPage } from '@/components/shared/portal-sidebar-crud-page'
import { Pencil, Trash2, Key, UserCheck, Ban, Users, Loader2 } from 'lucide-react'

interface Teacher {
  id: string
  name: string
  loginAccount: string
  department: string
  orgNodeId?: string
  roles: string[]
  positions: string[]
  status: '正常' | '禁用'
}

function mapTeacherStatus(status: string): Teacher['status'] {
  if (status === 'active') return '正常'
  if (status === 'disabled') return '禁用'
  return '正常'
}

function toBackendStatus(status: Teacher['status']): string {
  if (status === '正常') return 'active'
  if (status === '禁用') return 'disabled'
  return 'active'
}

export default function TeachersPage() {
  const { institution, institutionId, tenantId } = usePortalAuth()
  const { toast } = useToast()
  const {
    users,
    roles: tenantRoles,
    total,
    page,
    pageSize,
    setPage,
    loading,
    error,
    refetch,
  } = usePortalUsers({
    roleCode: 'teacher',
  })
  const { orgs, orgMap, orgTypeMap, loading: orgLoading } = useOrgTree(tenantId)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [staffTitles, setStaffTitles] = useState<StaffTitle[]>([])
  const [statusFilter, setStatusFilter] = useState('all')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [saving, setSaving] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)

  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formOrgNodeId, setFormOrgNodeId] = useState('')
  const [formTitleIds, setFormTitleIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setTeachers(
        users.map((u) => {
          const orgNode = u.orgNodeId ? orgMap.get(u.orgNodeId) : undefined
          return {
            id: u.id,
            name: u.name,
            loginAccount: u.username || u.loginName || '',
            department: orgNode?.name || institution?.name || '—',
            orgNodeId: u.orgNodeId,
            roles: u.roleNames ?? [],
            positions: u.titleIds ?? [],
            status: mapTeacherStatus(u.status),
          }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [users, institution, orgMap])

  useEffect(() => {
    if (!tenantId) return
    portalStaffTitleApi
      .list({ tenantId, limit: 1000 })
      .then((res) => {
        setStaffTitles(res.items)
      })
      .catch(() => {})
  }, [tenantId])

  const titleNameMap = useMemo(() => {
    const map = new Map<string, string>()
    staffTitles.forEach((t) => map.set(t.id, t.name))
    return map
  }, [staffTitles])

  const resetForm = () => {
    setFormName('')
    setFormUsername('')
    setFormPassword('')
    setFormOrgNodeId('')
    setFormTitleIds([])
  }

  const changeStatus = async (teacher: Teacher, targetStatus: Teacher['status']) => {
    try {
      await portalUserManagementApi.updateStatus(teacher.id, toBackendStatus(targetStatus))
      toast({ title: '状态已更新' })
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '操作失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget || batchDeleteTarget.length === 0) return
    setBatchDeleting(true)
    try {
      await portalUserManagementApi.batchDelete(batchDeleteTarget)
      toast({ title: `成功删除 ${batchDeleteTarget.length} 名教师` })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '批量删除失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setBatchDeleting(false)
      setBatchDeleteTarget(null)
    }
    await refetch()
  }

  const formValid =
    formName.trim() && formUsername.trim() && (!!selectedTeacher || formPassword.trim())

  return (
    <>
      <PortalSidebarCrudPage
        title="教职工管理"
        description="维护教师档案信息"
        entityLabel="教师"
        searchPlaceholder="搜索姓名或登录账号..."
        createButtonLabel="新建教师"
        items={teachers}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        refetch={refetch}
        orgs={orgs}
        orgMap={orgMap}
        orgTypeMap={orgTypeMap}
        orgLoading={orgLoading}
        sidebarAllLabel="全部教职工"
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={[
          { value: 'all', label: '全部状态' },
          { value: '正常', label: '正常' },
          { value: '禁用', label: '禁用' },
        ]}
        filterItems={(items, search, status) =>
          items.filter((t) => {
            if (status !== 'all' && t.status !== status) return false
            if (!search) return true
            return t.name.includes(search) || t.loginAccount.includes(search)
          })
        }
        getItemOrgNodeId={(item) => item.orgNodeId}
        importConfig={{
          importType: 'teachers',
          entityLabel: '教师',
          templateFileName: '教师批量导入模板.xlsx',
        }}
        colSpan={7}
        renderTableHeader={() => (
          <>
            <TableHead>登录账号（工号）</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>所属组织节点</TableHead>
            <TableHead>关联角色</TableHead>
            <TableHead>职位</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </>
        )}
        renderTableRow={(teacher, actions) => (
          <>
            <TableCell className="font-mono text-sm">{teacher.loginAccount}</TableCell>
            <TableCell className="font-medium">{teacher.name}</TableCell>
            <TableCell>{teacher.department}</TableCell>
            <TableCell>
              {teacher.roles.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {teacher.roles.map((role, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {teacher.positions.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {teacher.positions.map((pos, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {titleNameMap.get(pos) || pos}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={teacher.status} />
            </TableCell>
            <TableRowActions>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
                <Pencil className="mr-1 h-3 w-3" />
                编辑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => changeStatus(teacher, '正常')}
              >
                <UserCheck className="mr-1 h-3 w-3" />
                {teacher.status !== '正常' ? '设为正常' : '正常'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => changeStatus(teacher, '禁用')}
              >
                <Ban className="mr-1 h-3 w-3" />
                {teacher.status !== '禁用' ? '设为禁用' : '禁用'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={actions.onResetPwd}
              >
                <Key className="mr-1 h-3 w-3" />
                重置密码
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={actions.onDelete}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            </TableRowActions>
          </>
        )}
        headerActions={(selectedIds, openJoinDialog) => (
          <>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedIds.length === 0 || batchDeleting}
              onClick={() => {
                if (selectedIds.length === 0) return
                setBatchDeleteTarget([...selectedIds])
              }}
            >
              {batchDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              {selectedIds.length > 0 ? `批量删除(${selectedIds.length})` : '批量删除'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0 || batchDeleting}
              onClick={openJoinDialog}
            >
              <Users className="h-4 w-4 mr-1" />
              {selectedIds.length > 0 ? `批量加入部门(${selectedIds.length})` : '批量加入部门'}
            </Button>
          </>
        )}
        onOpenCreate={() => {
          setSelectedTeacher(null)
          resetForm()
          setIsDialogOpen(true)
        }}
        onOpenEdit={(teacher) => {
          setSelectedTeacher(teacher)
          setFormName(teacher.name)
          setFormUsername(teacher.loginAccount)
          setFormPassword('')
          setFormOrgNodeId(teacher.orgNodeId || '')
          setFormTitleIds(teacher.positions)
          setIsDialogOpen(true)
        }}
        isEditDialogOpen={isDialogOpen}
        setIsEditDialogOpen={setIsDialogOpen}
        editDialogTitle={selectedTeacher ? '编辑教师' : '新建教师'}
        editDialogDescription={selectedTeacher ? '修改教职工基本信息' : '填写教职工基本信息'}
        renderForm={() => (
          <>
            <FormFieldRow label="姓名" required>
              <Input
                placeholder="请输入姓名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </FormFieldRow>
            <FormFieldRow label="登录账号（工号）" required>
              <Input
                placeholder="如：T001"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </FormFieldRow>
            {!selectedTeacher && (
              <FormFieldRow label="密码" required>
                <Input
                  type="text"
                  placeholder="请输入密码"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </FormFieldRow>
            )}
            <FormFieldRow label="所属组织节点">
              <OrgNodePicker
                tenantId={tenantId}
                value={formOrgNodeId}
                onChange={(value) => setFormOrgNodeId(value || '')}
                placeholder="选择所属组织节点"
                title="选择所属组织节点"
              />
            </FormFieldRow>
            <FormFieldRow label="职位">
              <MultiSelectSearch
                options={staffTitles.map((t) => ({ label: t.name, value: t.id }))}
                selected={formTitleIds}
                onChange={setFormTitleIds}
                placeholder="选择职位"
                searchPlaceholder="搜索职位..."
                emptyText="未找到匹配的职位"
              />
            </FormFieldRow>
          </>
        )}
        formValid={!!formValid}
        saving={saving}
        onFormSave={async () => {
          setSaving(true)
          try {
            if (selectedTeacher) {
              const original = users.find((u) => u.id === selectedTeacher.id)
              if (!original) {
                toast({
                  variant: 'destructive',
                  title: '保存失败',
                  description: '未找到原始用户数据',
                })
                return
              }
              await portalUserManagementApi.update(selectedTeacher.id, {
                institutionId: original.institutionId,
                orgNodeId: formOrgNodeId || undefined,
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
                titleIds: formTitleIds,
              })
              toast({ title: '保存成功' })
            } else {
              if (!tenantId) {
                toast({
                  variant: 'destructive',
                  title: '创建失败',
                  description: '未获取到租户信息',
                })
                return
              }
              const teacherRole = tenantRoles.find((r) => r.code === 'teacher')
              if (!teacherRole) {
                toast({ variant: 'destructive', title: '创建失败', description: '未找到教师角色' })
                return
              }
              await portalUserManagementApi.create({
                tenantId,
                institutionId,
                roleId: teacherRole.id,
                role: 'school',
                platform: 'portal',
                loginName: formUsername.trim(),
                username: formUsername.trim(),
                password: formPassword.trim(),
                name: formName.trim(),
                orgNodeId: formOrgNodeId || undefined,
                titleIds: formTitleIds.length > 0 ? formTitleIds : undefined,
              })
              toast({ title: '创建成功' })
            }
            setIsDialogOpen(false)
            resetForm()
            setSelectedTeacher(null)
            await refetch()
          } catch (err) {
            toast({
              variant: 'destructive',
              title: '保存失败',
              description: err instanceof Error ? err.message : '未知错误',
            })
          } finally {
            setSaving(false)
          }
        }}
        onDelete={async (id) => {
          await portalUserManagementApi.delete(id)
        }}
        onExport={async (selectedIds) => {
          const res = await importExportApi.exportTeachersExcel(selectedIds)
          downloadBlob(await res.blob(), '教师导出.xlsx')
          toast({
            title: selectedIds.length > 0 ? `已导出 ${selectedIds.length} 名教职工` : '导出完成',
          })
        }}
        joinEntityLabel="部门"
        onBatchJoin={async (orgNodeId, userIds) => {
          await portalUserManagementApi.batchUpdateOrgNode({ userIds, orgNodeId })
        }}
      />
      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteTarget(null)
        }}
        title="确认批量删除"
        description={`确定要删除选中的 ${batchDeleteTarget?.length || 0} 名教师吗？此操作不可撤销。`}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
