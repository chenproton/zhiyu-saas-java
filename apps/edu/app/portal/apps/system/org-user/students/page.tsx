'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'

import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { usePortalUsers } from '@/hooks/use-portal-users'
import { useOrgTree, findOrgAncestor } from '@/hooks/use-org-tree'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { portalUserManagementApi, importExportApi, downloadBlob } from '@/lib/api'
import type { Organization } from '@/lib/types/backend'
import { useToast, StatusBadge } from '@zhiyu/ui'
import { PortalSidebarCrudPage } from '@/components/shared/portal-sidebar-crud-page'
import { Pencil, Power, Trash2, Key, Award, Users, Loader2 } from 'lucide-react'

const DEPT_TYPE = '二级学院'
const CLASS_TYPE = '班级'

interface Student {
  id: string
  name: string
  loginAccount: string
  className: string
  department: string
  orgNodeId?: string
  status: '正常' | '禁用' | '毕业'
}

function mapStudentStatus(status: string): Student['status'] {
  if (status === 'active') return '正常'
  if (status === 'disabled') return '禁用'
  if (status === 'graduated') return '毕业'
  return '正常'
}

function toBackendStatus(status: Student['status']): string {
  if (status === '正常') return 'active'
  if (status === '禁用') return 'disabled'
  if (status === '毕业') return 'graduated'
  return 'active'
}

function toStatusBadgeKey(status: Student['status']): string {
  if (status === '正常') return 'active'
  if (status === '禁用') return 'disabled'
  if (status === '毕业') return 'graduated'
  return status
}

function getOrgTypeName(
  org: Organization | undefined,
  orgTypeMap: Map<string, { name: string }>,
): string | undefined {
  if (!org) return undefined
  return orgTypeMap.get(org.typeId)?.name
}

export default function StudentsPage() {
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
    roleCode: 'student',
  })
  const { orgs, orgMap, orgTypeMap, loading: orgLoading } = useOrgTree(tenantId)

  const [students, setStudents] = useState<Student[]>([])
  const [statusFilter, setStatusFilter] = useState('正常')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)
  const [graduateLoading, setGraduateLoading] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)

  const [formName, setFormName] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formClassNodeId, setFormClassNodeId] = useState('')

  useEffect(() => {
    ;(async () => {
      setStudents(
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
            status: mapStudentStatus(u.status),
          }
        }),
      )
    })()
  }, [users, institution, orgMap, orgTypeMap])

  const resetForm = () => {
    setFormName('')
    setFormUsername('')
    setFormPassword('')
    setFormClassNodeId('')
  }

  const changeStatus = async (student: Student, targetStatus: Student['status']) => {
    try {
      await portalUserManagementApi.updateStatus(student.id, toBackendStatus(targetStatus))
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
      toast({ title: `成功删除 ${batchDeleteTarget.length} 名学生` })
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
    formName.trim() &&
    formUsername.trim() &&
    !!formClassNodeId &&
    (!!selectedStudent || formPassword.trim())

  return (
    <>
      <PortalSidebarCrudPage
        title="学生管理"
        description="管理学生基础信息与学籍数据"
        entityLabel="学生"
        searchPlaceholder="搜索姓名、登录账号..."
        createButtonLabel="新生录入"
        items={students}
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
        sidebarAllLabel="全部学生"
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={[
          { value: 'all', label: '全部状态' },
          { value: '正常', label: '正常' },
          { value: '禁用', label: '禁用' },
          { value: '毕业', label: '毕业' },
        ]}
        filterItems={(items, search, status) =>
          items.filter((s) => {
            if (status !== 'all' && s.status !== status) return false
            if (!search) return true
            return s.name.includes(search) || s.loginAccount.includes(search)
          })
        }
        getItemOrgNodeId={(item) => item.orgNodeId}
        importConfig={{
          importType: 'students',
          entityLabel: '学生',
          templateFileName: '学生批量导入模板.xlsx',
        }}
        colSpan={6}
        renderTableHeader={() => (
          <>
            <TableHead>登录账号（学号）</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>所属院系</TableHead>
            <TableHead>班级</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </>
        )}
        renderTableRow={(student, actions) => (
          <>
            <TableCell className="font-mono text-sm">{student.loginAccount}</TableCell>
            <TableCell className="font-medium">{student.name}</TableCell>
            <TableCell>{student.department}</TableCell>
            <TableCell>{student.className}</TableCell>
            <TableCell>
              <StatusBadge status={toStatusBadgeKey(student.status)} />
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
                onClick={actions.onResetPwd}
              >
                <Key className="mr-1 h-3 w-3" />
                重置密码
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => changeStatus(student, '正常')}
              >
                <Power className="mr-1 h-3 w-3" />
                {student.status !== '正常' ? '设为正常' : '正常'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => changeStatus(student, '禁用')}
              >
                <Power className="mr-1 h-3 w-3" />
                {student.status !== '禁用' ? '设为禁用' : '禁用'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => changeStatus(student, '毕业')}
              >
                <Award className="mr-1 h-3 w-3" />
                {student.status !== '毕业' ? '设为毕业' : '毕业'}
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
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0 || graduateLoading || batchDeleting}
              onClick={async () => {
                if (!tenantId) return
                setGraduateLoading(true)
                try {
                  await portalUserManagementApi.batchGraduate({ userIds: selectedIds })
                  toast({
                    title: '批量毕业成功',
                    description: `已将 ${selectedIds.length} 名学生状态改为毕业`,
                  })
                  await refetch()
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: '批量毕业失败',
                    description: err instanceof Error ? err.message : '未知错误',
                  })
                } finally {
                  setGraduateLoading(false)
                }
              }}
            >
              {graduateLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Award className="h-4 w-4 mr-1" />
              )}
              {selectedIds.length > 0 ? `批量毕业(${selectedIds.length})` : '批量毕业'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0 || graduateLoading || batchDeleting}
              onClick={openJoinDialog}
            >
              <Users className="h-4 w-4 mr-1" />
              {selectedIds.length > 0 ? `批量加入班级(${selectedIds.length})` : '批量加入班级'}
            </Button>
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
              批量删除({selectedIds.length})
            </Button>
          </>
        )}
        onOpenCreate={() => {
          setSelectedStudent(null)
          resetForm()
          setIsDialogOpen(true)
        }}
        onOpenEdit={(student) => {
          setSelectedStudent(student)
          setFormName(student.name)
          setFormUsername(student.loginAccount)
          setFormPassword('')
          setFormClassNodeId(student.orgNodeId || '')
          setIsDialogOpen(true)
        }}
        isEditDialogOpen={isDialogOpen}
        setIsEditDialogOpen={setIsDialogOpen}
        editDialogTitle={selectedStudent ? '编辑学生' : '新生录入'}
        editDialogDescription={
          selectedStudent ? '修改学生基本信息与班级归属' : '填写学生基本信息，并关联到真实班级'
        }
        renderForm={() => (
          <>
            <div className="grid gap-2">
              <Label>
                姓名 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="请输入姓名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>
                登录账号（学号） <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="如：S2024001"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            {!selectedStudent && (
              <div className="grid gap-2">
                <Label>
                  密码 <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="请输入密码"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>
                班级 <span className="text-destructive">*</span>
              </Label>
              <OrgNodePicker
                tenantId={tenantId}
                value={formClassNodeId}
                onChange={(value) => setFormClassNodeId(value || '')}
                selectableTypes={[CLASS_TYPE]}
                placeholder="选择班级"
                title="选择班级"
              />
            </div>
          </>
        )}
        formValid={!!formValid}
        saving={saving}
        onFormSave={async () => {
          setSaving(true)
          try {
            if (selectedStudent) {
              const original = users.find((u) => u.id === selectedStudent.id)
              if (!original) {
                toast({
                  variant: 'destructive',
                  title: '保存失败',
                  description: '未找到原始用户数据',
                })
                return
              }
              await portalUserManagementApi.update(selectedStudent.id, {
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
              if (!formClassNodeId) {
                toast({ variant: 'destructive', title: '创建失败', description: '请选择班级' })
                return
              }
              const studentRole = tenantRoles.find((r) => r.code === 'student')
              if (!studentRole) {
                toast({ variant: 'destructive', title: '创建失败', description: '未找到学生角色' })
                return
              }
              await portalUserManagementApi.create({
                tenantId,
                institutionId,
                roleId: studentRole.id,
                role: 'school',
                platform: 'portal',
                loginName: formUsername.trim(),
                username: formUsername.trim(),
                password: formPassword.trim(),
                name: formName.trim(),
                orgNodeId: formClassNodeId,
              })
              toast({ title: '创建成功' })
            }
            setIsDialogOpen(false)
            resetForm()
            setSelectedStudent(null)
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
          const res = await importExportApi.exportStudentsExcel(selectedIds)
          downloadBlob(await res.blob(), '学生导出.xlsx')
          toast({
            title: selectedIds.length > 0 ? `已导出 ${selectedIds.length} 名学生` : '导出完成',
          })
        }}
        joinEntityLabel="班级"
        onBatchJoin={async (orgNodeId, userIds) => {
          await portalUserManagementApi.batchUpdateOrgNode({ userIds, orgNodeId })
        }}
        orgNodePickerProps={{
          selectableTypes: [CLASS_TYPE],
          placeholder: '选择班级',
          title: '选择班级',
        }}
      />
      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteTarget(null)
        }}
        title="确认批量删除"
        description={`确定要删除选中的 ${batchDeleteTarget?.length || 0} 名学生吗？此操作不可撤销。`}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
