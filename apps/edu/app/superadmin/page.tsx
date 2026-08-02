'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@zhiyu/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Pencil,
  Power,
  Trash2,
  Search,
  Loader2,
  Users,
  Eye,
  Package,
  LogIn,
  LogOut,
  Shield,
} from 'lucide-react'
import { platformModuleDefs } from '@/lib/navigation-config'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { getToken, setToken, removeToken, saasRequest, type ListResponse } from '@zhiyu/api-client'

const TENANTS_API = '/admin/tenants'
const LOGIN_URL = '/api/v1/auth/saas/login'

interface AdminTenant {
  id: string
  name: string
  code: string
  logoUrl?: string
  domain?: string
  enterpriseCode?: string
  contact?: string
  phone?: string
  address?: string
  description?: string
  adminIds: string[]
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

interface TenantAdmin {
  id: string
  tenantId: string
  username: string
  loginName: string
  name: string
  status: string
  newPassword?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

// 复用 api-client 的 saasRequest（显式走 SaaS token），仅补上租户管理 API 前缀
function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return saasRequest<T>(`${TENANTS_API}${path}`, options)
}

export default function SuperAdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [authUser, setAuthUser] = useState<string>('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contact: '',
    phone: '',
    domain: '',
    enterpriseCode: '',
    address: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  })

  const [toggleTarget, setToggleTarget] = useState<AdminTenant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null)

  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [adminModalTenant, setAdminModalTenant] = useState<AdminTenant | null>(null)
  const [admins, setAdmins] = useState<TenantAdmin[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminDeleteTarget, setAdminDeleteTarget] = useState<TenantAdmin | null>(null)
  const [adminInline, setAdminInline] = useState<{
    id?: string
    username: string
    name: string
  } | null>(null)
  const [adminInlineSubmitting, setAdminInlineSubmitting] = useState(false)
  const [viewPassword, setViewPassword] = useState<{ admin: TenantAdmin; password: string } | null>(
    null,
  )

  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)
  const [subscriptionTenant, setSubscriptionTenant] = useState<AdminTenant | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<{
    id: string
    name: string
    validUntil: string
    status: 'active' | 'inactive'
    modules: Record<string, boolean>
  }>({ id: '', name: '', validUntil: '', status: 'active', modules: {} })
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    ;(async () => {
      const token = getToken('saas')
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          if (payload.roleCodes?.includes('platform_admin')) {
            setAuthenticated(true)
            setAuthUser(payload.username || '管理员')
          } else {
            setAuthenticated(false)
            setLoginError('当前账号不是平台管理员')
            removeToken('saas')
          }
        } catch {
          setAuthenticated(false)
          removeToken('saas')
        }
      } else {
        setAuthenticated(false)
      }
    })()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      })
      const data = await res.json().catch(() => ({ error: '请求失败' }))
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      if (data.token && data.user) {
        const payload = JSON.parse(atob(data.token.split('.')[1]))
        if (!payload.roleCodes?.includes('platform_admin')) {
          throw new Error('当前账号不是平台管理员，无权限访问')
        }
        setToken(data.token, 'saas')
        setAuthenticated(true)
        setAuthUser(data.user.username || data.user.name || '管理员')
      } else {
        throw new Error('登录响应缺少 token')
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    removeToken('saas')
    setAuthenticated(false)
    setLoginUsername('')
    setLoginPassword('')
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      contact: '',
      phone: '',
      domain: '',
      enterpriseCode: '',
      address: '',
      description: '',
      status: 'active',
    })
  }

  const loadForm = (t: AdminTenant) => {
    setFormData({
      name: t.name,
      code: t.code,
      contact: t.contact || '',
      phone: t.phone || '',
      domain: t.domain || '',
      enterpriseCode: t.enterpriseCode || '',
      address: t.address || '',
      description: t.description || '',
      status: t.status,
    })
  }

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''
      const res = await adminFetch<ListResponse<AdminTenant>>(params)
      setTenants(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载租户列表失败')
    } finally {
      setLoading(false)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!authenticated) return
    const timer = setTimeout(() => fetchTenants(), 300)
    return () => clearTimeout(timer)
  }, [searchTerm, authenticated, fetchTenants])

  const openAdminModal = (t: AdminTenant) => {
    setAdminModalTenant(t)
    setAdminModalOpen(true)
    setAdminInline(null)
    setAdminError(null)
    fetchAdmins(t.id)
  }

  const fetchAdmins = async (tenantId: string) => {
    setAdminLoading(true)
    setAdminError(null)
    try {
      const res = await adminFetch<ListResponse<TenantAdmin>>(`/${tenantId}/admins`)
      setAdmins(res.items)
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : '加载管理员列表失败')
    } finally {
      setAdminLoading(false)
    }
  }

  const startAddAdmin = () => {
    setAdminInline({ username: '', name: '' })
    setAdminError(null)
  }

  const startEditAdmin = (a: TenantAdmin) => {
    setAdminInline({ id: a.id, username: a.username, name: a.name })
    setAdminError(null)
  }

  const cancelInlineAdmin = () => {
    setAdminInline(null)
    setAdminError(null)
  }

  const submitInlineAdmin = async () => {
    if (!adminInline || !adminModalTenant) return
    if (!adminInline.username || !adminInline.name) {
      setAdminError('账号和姓名不能为空')
      return
    }

    setAdminInlineSubmitting(true)
    setAdminError(null)
    try {
      if (adminInline.id) {
        await adminFetch(`/${adminModalTenant.id}/admins/${adminInline.id}`, {
          method: 'PUT',
          body: JSON.stringify({ username: adminInline.username, name: adminInline.name }),
        })
        toast({ title: '保存成功' })
      } else {
        const created = await adminFetch<TenantAdmin>(`/${adminModalTenant.id}/admins`, {
          method: 'POST',
          body: JSON.stringify({ username: adminInline.username, name: adminInline.name }),
        })
        toast({
          title: '创建成功',
          description: created.newPassword ? `初始密码：${created.newPassword}` : '创建成功',
        })
      }
      setAdminInline(null)
      await fetchAdmins(adminModalTenant.id)
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : adminInline.id ? '保存失败' : '创建失败')
    } finally {
      setAdminInlineSubmitting(false)
    }
  }

  const handleAdminDelete = async () => {
    if (!adminModalTenant || !adminDeleteTarget) return
    try {
      await adminFetch(`/${adminModalTenant.id}/admins/${adminDeleteTarget.id}`, {
        method: 'DELETE',
      })
      toast({ title: '删除成功' })
      await fetchAdmins(adminModalTenant.id)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setAdminDeleteTarget(null)
    }
  }

  const handleResetPassword = async (a: TenantAdmin) => {
    if (!adminModalTenant) return
    try {
      const res = await adminFetch<{ id: string; newPassword: string }>(
        `/${adminModalTenant.id}/admins/${a.id}/reset-password`,
        {
          method: 'POST',
        },
      )
      setViewPassword({ admin: a, password: res.newPassword })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '获取密码失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  const openSubscriptionModal = (t: AdminTenant) => {
    setSubscriptionTenant(t)
    setSubscriptionDialogOpen(true)
    setSubscriptionLoading(true)
    adminFetch<{
      id: string
      name: string
      validUntil?: string
      status: string
      modules: Record<string, boolean>
    }>(`/${t.id}/subscription`)
      .then((res) => {
        const defaultModules: Record<string, boolean> = {}
        Object.keys(platformModuleDefs).forEach((key) => {
          defaultModules[key] = res.modules?.[key] ?? false
        })
        setSubscriptionData({
          id: res.id || '',
          name: res.name || '默认套餐',
          validUntil: res.validUntil || '',
          status: (res.status as 'active' | 'inactive') || 'active',
          modules: defaultModules,
        })
      })
      .catch((err) => {
        toast({
          variant: 'destructive',
          title: '加载套餐失败',
          description: err instanceof Error ? err.message : '未知错误',
        })
      })
      .finally(() => setSubscriptionLoading(false))
  }

  const handleSubscriptionSubmit = async () => {
    if (!subscriptionTenant) return
    if (!subscriptionData.name) {
      toast({ variant: 'destructive', title: '套餐名称不能为空' })
      return
    }
    setSubscriptionSubmitting(true)
    try {
      await adminFetch(`/${subscriptionTenant.id}/subscription`, {
        method: 'PUT',
        body: JSON.stringify({
          name: subscriptionData.name,
          validUntil: subscriptionData.validUntil || null,
          status: subscriptionData.status,
          modules: subscriptionData.modules,
        }),
      })
      toast({ title: '保存成功' })
      setSubscriptionDialogOpen(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setSubscriptionSubmitting(false)
    }
  }

  const toggleModule = (key: string) => {
    setSubscriptionData((prev) => ({
      ...prev,
      modules: { ...prev.modules, [key]: !prev.modules[key] },
    }))
  }

  const openCreate = () => {
    setEditingTenant(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (t: AdminTenant) => {
    setEditingTenant(t)
    loadForm(t)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      setError('企业名称不能为空')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (editingTenant) {
        await adminFetch(`/${editingTenant.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name,
            contact: formData.contact || null,
            phone: formData.phone || null,
            domain: formData.domain || null,
            enterpriseCode: formData.enterpriseCode || null,
            address: formData.address || null,
            description: formData.description || null,
          }),
        })
        toast({ title: '更新成功' })
      } else {
        const code = formData.code || 't' + Math.random().toString(36).substring(2, 9)
        await adminFetch('', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            code,
            contact: formData.contact || null,
            phone: formData.phone || null,
            domain: formData.domain || null,
            enterpriseCode: formData.enterpriseCode || null,
            address: formData.address || null,
            description: formData.description || null,
          }),
        })
        toast({ title: '创建成功' })
      }
      setDialogOpen(false)
      await fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : editingTenant ? '更新失败' : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleClick = (t: AdminTenant) => {
    setToggleTarget(t)
  }

  const confirmToggleStatus = async () => {
    if (!toggleTarget) return
    const newStatus = toggleTarget.status === 'active' ? 'inactive' : 'active'
    const label = newStatus === 'active' ? '启用' : '停用'
    try {
      await adminFetch(`/${toggleTarget.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      })
      toast({ title: `${label}成功` })
      await fetchTenants()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: `${label}失败`,
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setToggleTarget(null)
    }
  }

  const handleDeleteClick = (t: AdminTenant) => {
    setDeleteTarget(t)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminFetch(`/${deleteTarget.id}`, { method: 'DELETE' })
      toast({ title: '删除成功' })
      await fetchTenants()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">超级管理员控制台</h1>
              <p className="mt-2 text-sm text-muted-foreground">请使用平台管理员账号登录</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">账号</Label>
                <Input
                  id="username"
                  placeholder="请输入平台管理员账号"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                  disabled={loginLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loginLoading}
                />
              </div>

              {loginError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {loginError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loginLoading || !loginUsername || !loginPassword}
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    登录
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">超级管理员 - 租户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理所有平台租户，支持增删改查</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{authUser}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            退出
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            新增租户
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索企业名称或标识..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground w-24">租户标识</TableHead>
                  <TableHead className="text-muted-foreground">企业名称</TableHead>
                  <TableHead className="text-muted-foreground">联系人</TableHead>
                  <TableHead className="text-muted-foreground">联系电话</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">创建时间</TableHead>
                  <TableHead className="text-muted-foreground text-right w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id} className="border-border group">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {t.code}
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.contact || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{t.phone || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableRowActions>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openAdminModal(t)}
                      >
                        <Users className="mr-1 h-3 w-3" />
                        学校管理员配置
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openSubscriptionModal(t)}
                      >
                        <Package className="mr-1 h-3 w-3" />
                        套餐配置
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleToggleClick(t)}
                      >
                        <Power className="mr-1 h-3 w-3" />
                        {t.status === 'active' ? '停用' : '启用'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteClick(t)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    </TableRowActions>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      暂无租户
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录</span>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTenant ? '编辑租户' : '新增租户'}</DialogTitle>
            <DialogDescription>
              {editingTenant ? '修改租户信息，租户标识创建后不可修改' : '创建新的平台租户'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>
                  租户标识 <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="唯一标识，创建后不可修改"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                  disabled={!!editingTenant}
                  className={editingTenant ? 'bg-muted font-mono' : 'font-mono'}
                />
              </div>
              <div className="grid gap-2">
                <Label>状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, status: v as 'active' | 'inactive' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>
                企业名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="如：清华大学"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>联系人</Label>
                <Input
                  placeholder="企业联系人姓名"
                  value={formData.contact}
                  onChange={(e) => setFormData((p) => ({ ...p, contact: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>联系电话</Label>
                <Input
                  placeholder="联系电话"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>绑定域名</Label>
                <Input
                  placeholder="如：xxx.edu.cn"
                  value={formData.domain}
                  onChange={(e) => setFormData((p) => ({ ...p, domain: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>企业代码</Label>
                <Input
                  placeholder="统一社会信用代码"
                  value={formData.enterpriseCode}
                  onChange={(e) => setFormData((p) => ({ ...p, enterpriseCode: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>企业地址</Label>
              <Input
                placeholder="企业详细地址"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>企业简介</Label>
              <Textarea
                placeholder="企业简介描述"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingTenant ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>套餐配置</DialogTitle>
            <DialogDescription>
              {subscriptionTenant ? `配置租户「${subscriptionTenant.name}」的订阅套餐` : ''}
            </DialogDescription>
          </DialogHeader>

          {subscriptionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>
                    套餐名称 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="如：默认全功能套餐"
                    value={subscriptionData.name}
                    onChange={(e) => setSubscriptionData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>有效期至</Label>
                  <Input
                    type="date"
                    value={subscriptionData.validUntil}
                    onChange={(e) =>
                      setSubscriptionData((p) => ({ ...p, validUntil: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>状态</Label>
                <Select
                  value={subscriptionData.status}
                  onValueChange={(v) =>
                    setSubscriptionData((p) => ({ ...p, status: v as 'active' | 'inactive' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>平台模块</Label>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                  {Object.entries(platformModuleDefs).map(([key, def]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded-md"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        checked={!!subscriptionData.modules[key]}
                        onChange={() => toggleModule(key)}
                      />
                      <span>{def.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubscriptionDialogOpen(false)}
              disabled={subscriptionSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={handleSubscriptionSubmit}
              disabled={subscriptionLoading || subscriptionSubmitting}
            >
              {subscriptionSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setToggleTarget(null)
        }}
        title={toggleTarget ? `${toggleTarget.status === 'active' ? '停用' : '启用'}租户` : ''}
        description={
          toggleTarget
            ? `确定${toggleTarget.status === 'active' ? '停用' : '启用'}租户「${toggleTarget.name}」吗？`
            : ''
        }
        confirmText={toggleTarget ? (toggleTarget.status === 'active' ? '停用' : '启用') : ''}
        onConfirm={confirmToggleStatus}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="确认删除"
        description={deleteTarget ? `确定删除租户「${deleteTarget.name}」吗？此操作不可撤销。` : ''}
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex-row items-center justify-between">
            <div>
              <DialogTitle>学校管理员配置</DialogTitle>
              <DialogDescription>
                {adminModalTenant ? `管理租户「${adminModalTenant.name}」的学校管理员账号` : ''}
              </DialogDescription>
            </div>
            <Button size="sm" onClick={startAddAdmin} disabled={adminInline !== null}>
              <Plus className="h-4 w-4 mr-1" />
              新增
            </Button>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {adminError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {adminError}
              </div>
            )}

            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">账号</TableHead>
                    <TableHead className="text-muted-foreground">姓名</TableHead>
                    <TableHead className="text-muted-foreground">状态</TableHead>
                    <TableHead className="text-muted-foreground text-right w-32">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminInline && !adminInline.id && (
                    <TableRow className="border-border bg-slate-50/50">
                      <TableCell>
                        <Input
                          placeholder="登录账号"
                          value={adminInline.username}
                          onChange={(e) =>
                            setAdminInline((p) => (p ? { ...p, username: e.target.value } : p))
                          }
                          disabled={adminInlineSubmitting}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="姓名"
                          value={adminInline.name}
                          onChange={(e) =>
                            setAdminInline((p) => (p ? { ...p, name: e.target.value } : p))
                          }
                          disabled={adminInlineSubmitting}
                        />
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={submitInlineAdmin}
                            disabled={adminInlineSubmitting}
                          >
                            {adminInlineSubmitting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              '保存'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={cancelInlineAdmin}
                            disabled={adminInlineSubmitting}
                          >
                            取消
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {adminLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {admins.map((a) => (
                        <TableRow key={a.id} className="border-border">
                          {adminInline && adminInline.id === a.id ? (
                            <>
                              <TableCell>
                                <Input
                                  value={adminInline.username}
                                  onChange={(e) =>
                                    setAdminInline((p) =>
                                      p ? { ...p, username: e.target.value } : p,
                                    )
                                  }
                                  disabled={adminInlineSubmitting}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={adminInline.name}
                                  onChange={(e) =>
                                    setAdminInline((p) => (p ? { ...p, name: e.target.value } : p))
                                  }
                                  disabled={adminInlineSubmitting}
                                />
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={a.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={submitInlineAdmin}
                                    disabled={adminInlineSubmitting}
                                  >
                                    {adminInlineSubmitting ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      '保存'
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={cancelInlineAdmin}
                                    disabled={adminInlineSubmitting}
                                  >
                                    取消
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-mono text-sm">{a.username}</TableCell>
                              <TableCell>{a.name}</TableCell>
                              <TableCell>
                                <StatusBadge status={a.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleResetPassword(a)}
                                  >
                                    <Eye className="mr-1 h-3 w-3" />
                                    重置密码
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => startEditAdmin(a)}
                                  >
                                    <Pencil className="mr-1 h-3 w-3" />
                                    编辑
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                                    onClick={() => setAdminDeleteTarget(a)}
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    删除
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                      {admins.length === 0 && !adminLoading && !adminInline && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-sm text-muted-foreground py-8"
                          >
                            暂无学校管理员
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewPassword !== null}
        onOpenChange={(open) => {
          if (!open) setViewPassword(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              {viewPassword
                ? `${viewPassword.admin.name}（${viewPassword.admin.username}）的新密码，请妥善保管，关闭后将不可再次查看`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              readOnly
              value={viewPassword?.password || ''}
              onFocus={(e) => e.target.select()}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setViewPassword(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={adminDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdminDeleteTarget(null)
        }}
        title="确认删除"
        description={
          adminDeleteTarget
            ? `确定删除管理员「${adminDeleteTarget.name}（${adminDeleteTarget.username}）」吗？此操作不可撤销。`
            : ''
        }
        confirmText="删除"
        variant="destructive"
        onConfirm={handleAdminDelete}
      />
    </div>
  )
}
