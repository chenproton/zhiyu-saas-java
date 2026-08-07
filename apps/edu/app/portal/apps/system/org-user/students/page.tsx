'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
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
import { useT } from '@/lib/i18n/locale-provider'

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
  const t = useT()
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
      toast({ title: t('状态已更新') })
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('操作失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    }
  }

  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget || batchDeleteTarget.length === 0) return
    setBatchDeleting(true)
    try {
      await portalUserManagementApi.batchDelete(batchDeleteTarget)
      toast({ title: t('成功删除 {n} 名学生', { n: batchDeleteTarget.length }) })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('批量删除失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
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
        title={t('学生管理')}
        description={t('管理学生基础信息与学籍数据')}
        entityLabel={t('学生')}
        searchPlaceholder={t('搜索姓名、登录账号...')}
        createButtonLabel={t('新建学生')}
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
        sidebarAllLabel={t('全部学生')}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={[
          { value: 'all', label: t('全部状态') },
          { value: '正常', label: t('正常') },
          { value: '禁用', label: t('禁用') },
          { value: '毕业', label: t('毕业') },
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
          entityLabel: t('学生'),
          templateFileName: t('学生批量导入模板.xlsx'),
        }}
        colSpan={6}
        renderTableHeader={() => (
          <>
            <TableHead className="w-32">{t('登录账号（学号）')}</TableHead>
            <TableHead className="w-28">{t('姓名')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('所属院系')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('班级')}</TableHead>
            <TableHead className="w-24">{t('状态')}</TableHead>
            <TableHead className="w-24 text-right">{t('操作')}</TableHead>
          </>
        )}
        renderTableRow={(student, actions) => (
          <>
            <TableCell className="font-mono text-sm">{student.loginAccount}</TableCell>
            <TableCell className="font-medium">{student.name}</TableCell>
            <TableCell className="hidden md:table-cell">{student.department}</TableCell>
            <TableCell className="hidden md:table-cell">{student.className}</TableCell>
            <TableCell>
              <StatusBadge status={toStatusBadgeKey(student.status)} />
            </TableCell>
            <TableRowActions>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
                <Pencil className="mr-1 h-3 w-3" />
                {t('编辑')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={actions.onResetPwd}
              >
                <Key className="mr-1 h-3 w-3" />
                {t('重置密码')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => changeStatus(student, '正常')}
              >
                <Power className="mr-1 h-3 w-3" />
                {student.status !== '正常' ? t('设为正常') : t('正常')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => changeStatus(student, '禁用')}
              >
                <Power className="mr-1 h-3 w-3" />
                {student.status !== '禁用' ? t('设为禁用') : t('禁用')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => changeStatus(student, '毕业')}
              >
                <Award className="mr-1 h-3 w-3" />
                {student.status !== '毕业' ? t('设为毕业') : t('毕业')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={actions.onDelete}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {t('删除')}
              </Button>
            </TableRowActions>
          </>
        )}
        headerActions={(selectedIds) => (
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
              {t('批量删除({n})', { n: selectedIds.length })}
            </Button>
          </>
        )}
        afterImportActions={(selectedIds, openJoinDialog) => (
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
                    title: t('批量毕业成功'),
                    description: t('已将 {n} 名学生状态改为毕业', { n: selectedIds.length }),
                  })
                  await refetch()
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: t('批量毕业失败'),
                    description: err instanceof Error ? err.message : t('未知错误'),
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
              {selectedIds.length > 0
                ? t('批量毕业({n})', { n: selectedIds.length })
                : t('批量毕业')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0 || graduateLoading || batchDeleting}
              onClick={openJoinDialog}
            >
              <Users className="h-4 w-4 mr-1" />
              {selectedIds.length > 0
                ? t('批量加入班级({n})', { n: selectedIds.length })
                : t('批量加入班级')}
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
        editDialogTitle={selectedStudent ? t('编辑学生') : t('新建学生')}
        editDialogDescription={
          selectedStudent ? t('修改学生基本信息与班级归属') : t('填写学生基本信息，并关联到真实班级')
        }
        renderForm={() => (
          <>
            <FormFieldRow label={t('姓名')} required>
              <Input
                placeholder={t('请输入姓名')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </FormFieldRow>
            <FormFieldRow label={t('登录账号（学号）')} required>
              <Input
                placeholder={t('如：S2024001')}
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </FormFieldRow>
            {!selectedStudent && (
              <FormFieldRow label={t('密码')} required>
                <Input
                  type="text"
                  placeholder={t('请输入密码')}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </FormFieldRow>
            )}
            <FormFieldRow label={t('班级')} required>
              <OrgNodePicker
                tenantId={tenantId}
                value={formClassNodeId}
                onChange={(value) => setFormClassNodeId(value || '')}
                selectableTypes={[CLASS_TYPE]}
                placeholder={t('选择班级')}
                title={t('选择班级')}
              />
            </FormFieldRow>
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
                  title: t('保存失败'),
                  description: t('未找到原始用户数据'),
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
              toast({ title: t('保存成功') })
            } else {
              if (!tenantId) {
                toast({
                  variant: 'destructive',
                  title: t('创建失败'),
                  description: t('未获取到租户信息'),
                })
                return
              }
              if (!formClassNodeId) {
                toast({ variant: 'destructive', title: t('创建失败'), description: t('请选择班级') })
                return
              }
              const studentRole = tenantRoles.find((r) => r.code === 'student')
              if (!studentRole) {
                toast({ variant: 'destructive', title: t('创建失败'), description: t('未找到学生角色') })
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
              toast({ title: t('创建成功') })
            }
            setIsDialogOpen(false)
            resetForm()
            setSelectedStudent(null)
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
        }}
        onDelete={async (id) => {
          await portalUserManagementApi.delete(id)
        }}
        onExport={async (selectedIds) => {
          const res = await importExportApi.exportStudentsExcel(selectedIds)
          downloadBlob(await res.blob(), t('学生导出.xlsx'))
          toast({
            title:
              selectedIds.length > 0
                ? t('已导出 {n} 名学生', { n: selectedIds.length })
                : t('导出完成'),
          })
        }}
        joinEntityLabel={t('班级')}
        onBatchJoin={async (orgNodeId, userIds) => {
          await portalUserManagementApi.batchUpdateOrgNode({ userIds, orgNodeId })
        }}
        orgNodePickerProps={{
          selectableTypes: [CLASS_TYPE],
          placeholder: t('选择班级'),
          title: t('选择班级'),
        }}
      />
      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteTarget(null)
        }}
        title={t('确认批量删除')}
        description={t('确定要删除选中的 {n} 名学生吗？此操作不可撤销。', {
          n: batchDeleteTarget?.length || 0,
        })}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
