'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  Pencil,
  Power,
  Trash2,
  Search,
  Loader2,
  Users,
  KeyRound,
  Package,
  LogIn,
  LogOut,
  Shield,
  Palette,
  Eye,
} from 'lucide-react'
import { platformModuleDefs } from '@/lib/navigation-config'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { LogTableShell } from '@/components/shared/log-table-shell'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { ThemeColorPicker } from '@/components/shared/theme-color-picker'
import { getToken, setToken, removeToken, saasRequest, type ListResponse } from '@zhiyu/api-client'
import { authApi } from '@/lib/api'
import { formatDate } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import {
  applyBrandColor,
  fetchThemeColor,
  isHexColor,
  DEFAULT_BRAND_COLOR,
  BRAND_CHANGED_EVENT,
} from '@/lib/theme-brand'

const TENANTS_API = '/admin/tenants'
const PAGE_SIZE = 20

interface AdminTenant {
  id: string
  name: string
  code: string
  type?: 'school' | 'enterprise'
  logoUrl?: string
  domain?: string
  enterpriseCode?: string
  contact?: string
  phone?: string
  address?: string
  description?: string
  validFrom?: string
  validUntil?: string
  adminIds: string[]
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

/** 超管视角的企业主体信息（GET /admin/tenants/{id}/enterprise） */
interface AdminEnterpriseProfile {
  id: string
  tenantId: string
  name: string
  unifiedSocialCreditCode?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  description?: string
  enablePublic: boolean
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
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
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
    validFrom: '',
    validUntil: '',
    status: 'active' as 'active' | 'inactive',
  })

  const [toggleTarget, setToggleTarget] = useState<AdminTenant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [adminModalTenant, setAdminModalTenant] = useState<AdminTenant | null>(null)
  // 管理员弹窗类型：school（/admins）/ enterprise（/enterprise-admins）
  const [adminKind, setAdminKind] = useState<'school' | 'enterprise'>('school')
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
  const [passwordAdmin, setPasswordAdmin] = useState<TenantAdmin | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

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

  const [themeColor, setThemeColor] = useState(DEFAULT_BRAND_COLOR)
  const [themeSaving, setThemeSaving] = useState(false)

  const [tenantThemeTarget, setTenantThemeTarget] = useState<AdminTenant | null>(null)
  const [tenantThemeColor, setTenantThemeColor] = useState(DEFAULT_BRAND_COLOR)
  const [tenantThemeSaving, setTenantThemeSaving] = useState(false)

  // 租户类型 Tab（学校租户/企业租户）
  const [tenantTab, setTenantTab] = useState<'school' | 'enterprise'>('school')

  // 企业租户新建：管理员账号（type=enterprise 时必填）
  const [entUsername, setEntUsername] = useState('')
  const [entPassword, setEntPassword] = useState('')

  // 企业租户表单（创建/编辑共用，对齐 /partner/login 注册字段）
  const [entForm, setEntForm] = useState({
    creditCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
  })

  // 企业租户查看/编辑：企业主体信息
  const [viewTarget, setViewTarget] = useState<AdminTenant | null>(null)
  const [viewProfile, setViewProfile] = useState<AdminEnterpriseProfile | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [profileForm, setProfileForm] = useState<{
    unifiedSocialCreditCode: string
    contactPerson: string
    contactPhone: string
    contactEmail: string
    enablePublic: boolean
  }>({
    unifiedSocialCreditCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    enablePublic: false,
  })

  const { toast } = useToast()
  const t = useT()

  // 加载平台主题配置（公开接口）
  useEffect(() => {
    if (!authenticated) return
    ;(async () => {
      setThemeColor(await fetchThemeColor())
    })()
  }, [authenticated])

  const saveTheme = async (color: string) => {
    if (!isHexColor(color)) {
      toast({
        variant: 'destructive',
        title: t('主题色格式错误'),
        description: t('应为 #RRGGBB 格式'),
      })
      return
    }
    setThemeSaving(true)
    try {
      await saasRequest('/admin/settings/theme', {
        method: 'PUT',
        body: JSON.stringify({ primary: color }),
      })
      applyBrandColor(color)
      window.dispatchEvent(new Event(BRAND_CHANGED_EVENT))
      setThemeColor(color)
      toast({ title: t('主题色已保存并生效') })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setThemeSaving(false)
    }
  }

  const openTenantTheme = async (ten: AdminTenant) => {
    setTenantThemeTarget(ten)
    setTenantThemeSaving(false)
    setTenantThemeColor(await fetchThemeColor(ten.id))
  }

  const saveTenantTheme = async (ten: AdminTenant, color: string) => {
    if (!isHexColor(color)) {
      toast({
        variant: 'destructive',
        title: t('主题色格式错误'),
        description: t('应为 #RRGGBB 格式'),
      })
      return
    }
    setTenantThemeSaving(true)
    try {
      await saasRequest(`/admin/tenants/${ten.id}/settings/theme`, {
        method: 'PUT',
        body: JSON.stringify({ primary: color }),
      })
      setTenantThemeColor(color)
      toast({ title: t('已保存，租户「{name}」主题色生效', { name: ten.name }) })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setTenantThemeSaving(false)
    }
  }

  const clearTenantTheme = async (ten: AdminTenant) => {
    setTenantThemeSaving(true)
    try {
      await saasRequest(`/admin/tenants/${ten.id}/settings/theme`, { method: 'DELETE' })
      setTenantThemeColor(DEFAULT_BRAND_COLOR)
      toast({ title: t('已恢复平台默认主题色') })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('恢复失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setTenantThemeSaving(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const token = getToken('saas')
      if (token) {
        try {
          const payload = JSON.parse(
            atob(
              token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') +
                '==='.slice((token.split('.')[1].length + 3) % 4),
            ),
          )
          if (payload.roleCodes?.includes('platform_admin')) {
            setAuthenticated(true)
            setAuthUser(payload.username || t('管理员'))
          } else {
            setAuthenticated(false)
            setLoginError(t('当前账号不是平台管理员'))
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
  }, [t])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const data = await authApi.saasLogin({ username: loginUsername, password: loginPassword })
      const payload = JSON.parse(
        atob(
          data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') +
            '==='.slice((data.token.split('.')[1].length + 3) % 4),
        ),
      )
      if (!payload.roleCodes?.includes('platform_admin')) {
        throw new Error(t('当前账号不是平台管理员，无权限访问'))
      }
      setToken(data.token, 'saas')
      setAuthenticated(true)
      setAuthUser(data.user.username || data.user.name || t('管理员'))
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t('登录失败'))
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
      validFrom: '',
      validUntil: '',
      status: 'active',
    })
    setEntUsername('')
    setEntPassword('')
    setEntForm({ creditCode: '', contactPerson: '', contactPhone: '', contactEmail: '' })
  }

  const loadForm = (ten: AdminTenant) => {
    setFormData({
      name: ten.name,
      code: ten.code,
      contact: ten.contact || '',
      phone: ten.phone || '',
      domain: ten.domain || '',
      enterpriseCode: ten.enterpriseCode || '',
      address: ten.address || '',
      description: ten.description || '',
      validFrom: ten.validFrom || '',
      validUntil: ten.validUntil || '',
      status: ten.status,
    })
  }

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      params.set('type', tenantTab)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String((page - 1) * PAGE_SIZE))
      const res = await adminFetch<ListResponse<AdminTenant>>(`?${params.toString()}`)
      setTenants(res.items)
      setTotal(res.total)
      if (res.items.length === 0 && page > 1) {
        setPage((p) => p - 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('加载租户列表失败'))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, tenantTab, t])

  // 仅搜索输入防抖：停止输入 300ms 后回到第 1 页并刷新；翻页立即请求，不再经过防抖
  useEffect(() => {
    if (!authenticated) return
    const timer = setTimeout(() => {
      setPage(1)
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, authenticated])

  // Tab 切换：回到第 1 页并立即刷新（不经过搜索防抖）
  const switchTab = (tab: 'school' | 'enterprise') => {
    if (tab === tenantTab) return
    setTenantTab(tab)
    setSearchTerm('')
    setDebouncedSearch('')
    setPage(1)
  }

  useEffect(() => {
    if (!authenticated) return
    ;(async () => {
      await fetchTenants()
    })()
  }, [authenticated, fetchTenants])

  // 管理员弹窗 API 前缀：学校 /admins，企业 /enterprise-admins
  const adminApiBase = (tenantId: string, kind: 'school' | 'enterprise' = adminKind) =>
    kind === 'enterprise' ? `/${tenantId}/enterprise-admins` : `/${tenantId}/admins`

  const openAdminModal = (ten: AdminTenant) => {
    const kind = ten.type === 'enterprise' ? 'enterprise' : 'school'
    setAdminModalTenant(ten)
    setAdminKind(kind)
    setAdminModalOpen(true)
    setAdminInline(null)
    setAdminError(null)
    fetchAdmins(ten.id, kind)
  }

  const fetchAdmins = async (tenantId: string, kind: 'school' | 'enterprise' = adminKind) => {
    setAdminLoading(true)
    setAdminError(null)
    try {
      const res = await adminFetch<ListResponse<TenantAdmin>>(`${adminApiBase(tenantId, kind)}`)
      setAdmins(res.items)
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : t('加载管理员列表失败'))
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
      setAdminError(t('账号和姓名不能为空'))
      return
    }

    setAdminInlineSubmitting(true)
    setAdminError(null)
    try {
      if (adminInline.id) {
        await adminFetch(`${adminApiBase(adminModalTenant.id)}/${adminInline.id}`, {
          method: 'PUT',
          body: JSON.stringify({ username: adminInline.username, name: adminInline.name }),
        })
        toast({ title: t('保存成功') })
      } else {
        const created = await adminFetch<TenantAdmin>(`${adminApiBase(adminModalTenant.id)}`, {
          method: 'POST',
          body: JSON.stringify({ username: adminInline.username, name: adminInline.name }),
        })
        toast({
          title: t('创建成功'),
          description: created.newPassword
            ? t('初始密码：{pwd}', { pwd: created.newPassword })
            : t('创建成功'),
        })
      }
      setAdminInline(null)
      await fetchAdmins(adminModalTenant.id)
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : t(adminInline.id ? '保存失败' : '创建失败'),
      )
    } finally {
      setAdminInlineSubmitting(false)
    }
  }

  const handleAdminDelete = async () => {
    if (!adminModalTenant || !adminDeleteTarget) return
    try {
      await adminFetch(`${adminApiBase(adminModalTenant.id)}/${adminDeleteTarget.id}`, {
        method: 'DELETE',
      })
      toast({ title: t('删除成功') })
      await fetchAdmins(adminModalTenant.id)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setAdminDeleteTarget(null)
    }
  }

  const handlePasswordClick = (a: TenantAdmin) => {
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordAdmin(a)
  }

  const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

  const submitPassword = async () => {
    if (!passwordAdmin) return
    if (!newPassword) {
      setPasswordError(t('请输入新密码'))
      return
    }
    if (!PASSWORD_RULE.test(newPassword)) {
      setPasswordError(t('密码长度至少 8 位，且需同时包含字母和数字'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('两次输入的密码不一致'))
      return
    }
    setPasswordSubmitting(true)
    setPasswordError(null)
    try {
      await adminFetch(
        `${adminApiBase(passwordAdmin.tenantId)}/${passwordAdmin.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ password: newPassword }),
        },
      )
      toast({ title: t('修改成功') })
      setPasswordAdmin(null)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('修改密码失败'))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const openSubscriptionModal = (ten: AdminTenant) => {
    setSubscriptionTenant(ten)
    setSubscriptionDialogOpen(true)
    setSubscriptionLoading(true)
    adminFetch<{
      id: string
      name: string
      validUntil?: string
      status: string
      modules: Record<string, boolean>
    }>(`/${ten.id}/subscription`)
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
          title: t('加载套餐失败'),
          description: err instanceof Error ? err.message : t('未知错误'),
        })
      })
      .finally(() => setSubscriptionLoading(false))
  }

  const handleSubscriptionSubmit = async () => {
    if (!subscriptionTenant) return
    if (!subscriptionData.name) {
      toast({ variant: 'destructive', title: t('套餐名称不能为空') })
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
      toast({ title: t('保存成功') })
      setSubscriptionDialogOpen(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
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

  const openEdit = (ten: AdminTenant) => {
    setEditingTenant(ten)
    loadForm(ten)
    setDialogOpen(true)
    if (ten.type === 'enterprise') {
      void loadEnterpriseProfile(ten)
    }
  }

  const loadEnterpriseProfile = async (ten: AdminTenant) => {
    setViewLoading(true)
    try {
      const res = await adminFetch<{ tenant: AdminTenant; enterprise: AdminEnterpriseProfile }>(
        `/${ten.id}/enterprise`,
      )
      setViewProfile(res.enterprise)
      setEntForm({
        creditCode: res.enterprise.unifiedSocialCreditCode || '',
        contactPerson: res.enterprise.contactPerson || '',
        contactPhone: res.enterprise.contactPhone || '',
        contactEmail: res.enterprise.contactEmail || '',
      })
      setProfileForm({
        unifiedSocialCreditCode: res.enterprise.unifiedSocialCreditCode || '',
        contactPerson: res.enterprise.contactPerson || '',
        contactPhone: res.enterprise.contactPhone || '',
        contactEmail: res.enterprise.contactEmail || '',
        enablePublic: res.enterprise.enablePublic,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('加载企业信息失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setViewLoading(false)
    }
  }

  const openView = async (ten: AdminTenant) => {
    setViewTarget(ten)
    setViewProfile(null)
    await loadEnterpriseProfile(ten)
  }

  const saveEnterpriseProfile = async (ten: AdminTenant) => {
    try {
      await adminFetch(`/${ten.id}/enterprise`, {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      })
      toast({ title: t('企业信息已更新') })
      await loadEnterpriseProfile(ten)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    }
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      setError(t('企业名称不能为空'))
      return
    }
    if (tenantTab === 'enterprise' && !editingTenant) {
      if (!entUsername) {
        setError(t('企业管理员用户名不能为空'))
        return
      }
      if (!entPassword || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(entPassword)) {
        setError(t('密码长度至少 8 位，且需同时包含字母和数字'))
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      if (editingTenant) {
        if (editingTenant.type === 'enterprise') {
          // 企业编辑：一次合并更新租户+企业主体（名称/状态/信用代码/联系人/电话/邮箱/展示开关）
          await adminFetch(`/${editingTenant.id}/enterprise`, {
            method: 'PUT',
            body: JSON.stringify({
              name: formData.name,
              unifiedSocialCreditCode: entForm.creditCode || null,
              contactPerson: entForm.contactPerson || null,
              contactPhone: entForm.contactPhone || null,
              contactEmail: entForm.contactEmail || null,
              enablePublic: profileForm.enablePublic,
              status: formData.status,
              validFrom: formData.validFrom || '',
              validUntil: formData.validUntil || '',
            }),
          })
          toast({ title: t('更新成功') })
        } else {
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
              validFrom: formData.validFrom || null,
              validUntil: formData.validUntil || null,
            }),
          })
          toast({ title: t('更新成功') })
        }
      } else if (tenantTab === 'enterprise') {
        const created = await adminFetch<{
          tenant: AdminTenant
          adminUser?: { username: string; initialPassword?: string }
        }>('', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            type: 'enterprise',
            username: entUsername,
            password: entPassword,
            contact: entForm.contactPerson || null,
            phone: entForm.contactPhone || null,
            contactEmail: entForm.contactEmail || null,
            enterpriseCode: entForm.creditCode || null,
            validFrom: formData.validFrom || null,
            validUntil: formData.validUntil || null,
          }),
        })
        toast({
          title: t('创建成功'),
          description: created.adminUser
            ? t('管理员账号：{username} ｜ 初始密码：{pwd}', {
                username: created.adminUser.username,
                pwd: created.adminUser.initialPassword || '',
              })
            : undefined,
        })
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
            validFrom: formData.validFrom || null,
            validUntil: formData.validUntil || null,
          }),
        })
        toast({ title: t('创建成功') })
      }
      setDialogOpen(false)
      await fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : t(editingTenant ? '更新失败' : '创建失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleClick = (ten: AdminTenant) => {
    setToggleTarget(ten)
  }

  const confirmToggleStatus = async () => {
    if (!toggleTarget) return
    const newStatus = toggleTarget.status === 'active' ? 'inactive' : 'active'
    const label = t(newStatus === 'active' ? '启用' : '停用')
    try {
      await adminFetch(`/${toggleTarget.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      })
      toast({ title: t('{label}成功', { label }) })
      await fetchTenants()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('{label}失败', { label }),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setToggleTarget(null)
    }
  }

  const handleDeleteClick = (ten: AdminTenant) => {
    setDeleteConfirmName('')
    setDeleteTarget(ten)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminFetch(`/${deleteTarget.id}`, { method: 'DELETE' })
      toast({ title: t('删除成功') })
      await fetchTenants()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
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
              <h1 className="text-2xl font-bold text-foreground">{t('超级管理员控制台')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('请使用平台管理员账号登录')}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('账号')}</Label>
                <Input
                  id="username"
                  placeholder={t('请输入平台管理员账号')}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                  disabled={loginLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('密码')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('请输入密码')}
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
                    {t('登录中...')}
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('登录')}
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
          <h1 className="text-xl font-semibold text-foreground">{t('超级管理员 - 租户管理')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('管理所有平台租户，支持增删改查')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{authUser}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            {t('退出')}
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t(tenantTab === 'enterprise' ? '新建企业租户' : '新建租户')}
          </Button>
        </div>
      </div>

      {/* 学校租户 / 企业租户 Tab 切换 */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-gray-100 bg-white p-1 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => switchTab('school')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            tenantTab === 'school'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('学校租户')}
        </button>
        <button
          type="button"
          onClick={() => switchTab('enterprise')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            tenantTab === 'enterprise'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('企业租户')}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('搜索企业名称或标识...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 平台主题配置 */}
      <div className="mb-6 rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('平台主题配置')}</h2>
            <p className="text-xs text-muted-foreground">
              {t(
                '设置全平台主题色，保存后对所有用户实时生效（刷新或新开页面即同步）；可在下方租户列表中为单个租户单独配置',
              )}
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <ThemeColorPicker
            color={themeColor}
            onChange={setThemeColor}
            onSubmit={saveTheme}
            submitting={themeSaving}
            secondary={[
              {
                label: t('恢复默认'),
                onClick: () => {
                  setThemeColor(DEFAULT_BRAND_COLOR)
                  void saveTheme(DEFAULT_BRAND_COLOR)
                },
              },
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <LogTableShell
        loading={loading}
        items={tenants}
        columns={[
          {
            header: t('租户标识'),
            className: 'font-mono text-sm text-muted-foreground w-24',
            cell: (ten) => ten.code,
          },
          {
            header: t('租户名称'),
            className: 'font-medium',
            cell: (ten) => ten.name,
          },
          {
            header: t('联系人'),
            cell: (ten) => ten.contact || '-',
          },
          {
            header: t('联系电话'),
            className: 'text-muted-foreground',
            cell: (ten) => ten.phone || '-',
          },
          {
            header: t('状态'),
            cell: (ten) => <StatusBadge status={ten.status} />,
          },
          {
            header: t('有效期'),
            className: 'text-muted-foreground whitespace-nowrap',
            cell: (ten) => {
              if (!ten.validFrom && !ten.validUntil) return t('不限')
              return [ten.validFrom || '-', ten.validUntil || '-'].join(' ~ ')
            },
          },
          {
            header: t('创建时间'),
            className: 'text-muted-foreground whitespace-nowrap',
            cell: (ten) => formatDate(ten.createdAt),
          },
          {
            header: t('操作'),
            className: 'text-right w-16',
            cell: (ten) => (
              <TableRowActions>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openAdminModal(ten)}
                >
                  <Users className="mr-1 h-3 w-3" />
                  {t(ten.type === 'enterprise' ? '企业管理员配置' : '学校管理员配置')}
                </Button>
                {ten.type === 'enterprise' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openView(ten)}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    {t('查看')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openSubscriptionModal(ten)}
                  >
                    <Package className="mr-1 h-3 w-3" />
                    {t('套餐配置')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openTenantTheme(ten)}
                >
                  <Palette className="mr-1 h-3 w-3" />
                  {t('主题配置')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openEdit(ten)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  {t('编辑')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleToggleClick(ten)}
                >
                  <Power className="mr-1 h-3 w-3" />
                  {t(ten.status === 'active' ? '停用' : '启用')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                  onClick={() => handleDeleteClick(ten)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('删除')}
                </Button>
              </TableRowActions>
            ),
          },
        ]}
        emptyText={t('暂无租户')}
        total={total}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(editingTenant ? '编辑租户' : '新增租户')}</DialogTitle>
            <DialogDescription>
              {tenantTab === 'enterprise'
                ? t(
                    editingTenant
                      ? '修改企业租户信息，管理员账号不可修改'
                      : '创建企业租户及企业管理员账号（与 partner 自助注册一致）',
                  )
                : t(editingTenant ? '修改租户信息，租户标识创建后不可修改' : '创建新的平台租户')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {tenantTab === 'school' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>
                    {t('租户标识')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder={t('唯一标识，创建后不可修改')}
                    value={formData.code}
                    onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                    disabled={!!editingTenant}
                    className={editingTenant ? 'bg-muted font-mono' : 'font-mono'}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('状态')}</Label>
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
                      <SelectItem value="active">{t('启用')}</SelectItem>
                      <SelectItem value="inactive">{t('停用')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {tenantTab === 'enterprise' && !editingTenant && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>
                    {t('企业管理员用户名')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder={t('企业登录用户名（同一账号可加入多个企业）')}
                    value={entUsername}
                    onChange={(e) => setEntUsername(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    {t('初始密码')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="password"
                    placeholder={t('至少 8 位，包含字母和数字')}
                    value={entPassword}
                    onChange={(e) => setEntPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label>
                {t('企业名称')} <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={t('如：清华大学')}
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            {tenantTab === 'school' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t('联系人')}</Label>
                    <Input
                      placeholder={t('企业联系人姓名')}
                      value={formData.contact}
                      onChange={(e) => setFormData((p) => ({ ...p, contact: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('联系电话')}</Label>
                    <Input
                      placeholder={t('联系电话')}
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t('绑定域名')}</Label>
                    <Input
                      placeholder={t('如：xxx.edu.cn')}
                      value={formData.domain}
                      onChange={(e) => setFormData((p) => ({ ...p, domain: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('企业代码')}</Label>
                    <Input
                      placeholder={t('统一社会信用代码')}
                      value={formData.enterpriseCode}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, enterpriseCode: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t('企业地址')}</Label>
                  <Input
                    placeholder={t('企业详细地址')}
                    value={formData.address}
                    onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('企业简介')}</Label>
                  <Textarea
                    placeholder={t('企业简介描述')}
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                  />
                </div>
              </>
            )}

            {tenantTab === 'enterprise' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t('统一社会信用代码')}</Label>
                    <Input
                      placeholder={t('如：91320594MA1P7XXXX1')}
                      value={entForm.creditCode}
                      onChange={(e) => setEntForm((p) => ({ ...p, creditCode: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('联系人')}</Label>
                    <Input
                      placeholder={t('企业联系人姓名')}
                      value={entForm.contactPerson}
                      onChange={(e) => setEntForm((p) => ({ ...p, contactPerson: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t('手机号')}</Label>
                    <Input
                      placeholder={t('联系电话')}
                      value={entForm.contactPhone}
                      onChange={(e) => setEntForm((p) => ({ ...p, contactPhone: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('联系邮箱（选填）')}</Label>
                    <Input
                      type="email"
                      placeholder={t('联系邮箱')}
                      value={entForm.contactEmail}
                      onChange={(e) => setEntForm((p) => ({ ...p, contactEmail: e.target.value }))}
                    />
                  </div>
                </div>
                {editingTenant && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>{t('状态')}</Label>
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
                            <SelectItem value="active">{t('启用')}</SelectItem>
                            <SelectItem value="inactive">{t('停用')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={profileForm.enablePublic}
                        onCheckedChange={(v) => setProfileForm((p) => ({ ...p, enablePublic: v }))}
                      />
                      <Label>{t('企业愿意在联盟前台对外展示')}</Label>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('有效期开始日期')}</Label>
                <Input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData((p) => ({ ...p, validFrom: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('有效期结束日期')}</Label>
                <Input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData((p) => ({ ...p, validUntil: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('留空表示不限；有效期外租户内所有用户无法登录')}
            </p>
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {t('取消')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t(editingTenant ? '保存' : '创建')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 企业租户查看：租户信息 + 企业主体信息 */}
      <Dialog open={viewTarget !== null} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('企业租户详情')}</DialogTitle>
            <DialogDescription>
              {viewTarget ? t('租户「{name}」与企业主体信息', { name: viewTarget.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          {viewLoading && !viewProfile ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('租户标识')}：</span>
                  <span className="font-mono">{viewTarget?.code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('状态')}：</span>
                  <StatusBadge status={viewTarget?.status || 'inactive'} />
                </div>
                <div>
                  <span className="text-muted-foreground">{t('企业名称')}：</span>
                  <span className="font-medium">{viewProfile?.name || viewTarget?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('统一社会信用代码')}：</span>
                  {viewProfile?.unifiedSocialCreditCode || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('联系人')}：</span>
                  {viewProfile?.contactPerson || viewTarget?.contact || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('联系电话')}：</span>
                  {viewProfile?.contactPhone || viewTarget?.phone || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('联系邮箱')}：</span>
                  {viewProfile?.contactEmail || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('绑定域名')}：</span>
                  {viewTarget?.domain || '-'}
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">{t('企业地址')}：</span>
                  {viewTarget?.address || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('前台展示开关')}：</span>
                  <Switch
                    checked={viewProfile?.enablePublic || false}
                    onCheckedChange={(v) => {
                      if (viewTarget && viewProfile) {
                        setProfileForm((p) => ({ ...p, enablePublic: v }))
                        void saveEnterpriseProfile(viewTarget)
                        setViewProfile((p) => (p ? { ...p, enablePublic: v } : p))
                      }
                    }}
                  />
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t('企业愿意在联盟前台对外展示')}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">{t('企业简介')}：</span>
                  {viewProfile?.description || viewTarget?.description || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">{t('创建时间')}：</span>
                  {formatDate(viewTarget?.createdAt)}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('套餐配置')}</DialogTitle>
            <DialogDescription>
              {subscriptionTenant
                ? t('配置租户「{name}」的订阅套餐', { name: subscriptionTenant.name })
                : ''}
            </DialogDescription>
          </DialogHeader>

          {subscriptionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>
                    {t('套餐名称')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder={t('如：默认全功能套餐')}
                    value={subscriptionData.name}
                    onChange={(e) => setSubscriptionData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('有效期至')}</Label>
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
                <Label>{t('状态')}</Label>
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
                    <SelectItem value="active">{t('启用')}</SelectItem>
                    <SelectItem value="inactive">{t('停用')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t('平台模块')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border p-3">
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
              {t('取消')}
            </Button>
            <Button
              onClick={handleSubscriptionSubmit}
              disabled={subscriptionLoading || subscriptionSubmitting}
            >
              {subscriptionSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={tenantThemeTarget !== null}
        onOpenChange={(open) => !open && setTenantThemeTarget(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('租户主题配置')}</DialogTitle>
            <DialogDescription>
              {tenantThemeTarget
                ? t(
                    '为租户「{name}」单独配置主题色，该租户下所有用户生效；不配置则使用平台默认色',
                    {
                      name: tenantThemeTarget.name,
                    },
                  )
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <ThemeColorPicker
              color={tenantThemeColor}
              onChange={setTenantThemeColor}
              onSubmit={(color) => {
                if (tenantThemeTarget) void saveTenantTheme(tenantThemeTarget, color)
              }}
              submitting={tenantThemeSaving}
              submitLabel={t('保存')}
              secondary={
                tenantThemeTarget
                  ? [
                      {
                        label: t('恢复平台默认'),
                        onClick: () => clearTenantTheme(tenantThemeTarget),
                        disabled: tenantThemeSaving,
                      },
                    ]
                  : []
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setToggleTarget(null)
        }}
        title={
          toggleTarget
            ? t('{action}租户', {
                action: toggleTarget.status === 'active' ? t('停用') : t('启用'),
              })
            : ''
        }
        description={
          toggleTarget
            ? t('确定{action}租户「{name}」吗？', {
                action: toggleTarget.status === 'active' ? t('停用') : t('启用'),
                name: toggleTarget.name,
              })
            : ''
        }
        confirmText={toggleTarget ? t(toggleTarget.status === 'active' ? '停用' : '启用') : ''}
        onConfirm={confirmToggleStatus}
      />
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('确认删除')}</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? t('确定删除租户「{name}」吗？此操作不可撤销。请输入租户名称以确认删除。', {
                    name: deleteTarget.name,
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Input
              placeholder={
                deleteTarget ? t('请输入租户名称「{name}」', { name: deleteTarget.name }) : ''
              }
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              autoFocus
            />
            {deleteConfirmName.trim() !== '' &&
              deleteTarget &&
              deleteConfirmName.trim() !== deleteTarget.name && (
                <p className="text-sm text-destructive">{t('租户名称不匹配')}</p>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('取消')}
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || deleteConfirmName.trim() !== deleteTarget.name}
              onClick={confirmDelete}
            >
              {t('删除')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex-row items-center justify-between">
            <div>
              <DialogTitle>
                {t(adminKind === 'enterprise' ? '企业管理员配置' : '学校管理员配置')}
              </DialogTitle>
              <DialogDescription>
                {adminModalTenant
                  ? t(
                      adminKind === 'enterprise'
                        ? '管理租户「{name}」的企业管理员账号（可登录企业服务台）'
                        : '管理租户「{name}」的学校管理员账号',
                      { name: adminModalTenant.name },
                    )
                  : ''}
              </DialogDescription>
            </div>
            <Button size="sm" onClick={startAddAdmin} disabled={adminInline !== null}>
              <Plus className="h-4 w-4 mr-1" />
              {t('新增')}
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
                    <TableHead className="text-muted-foreground">{t('账号')}</TableHead>
                    <TableHead className="text-muted-foreground">{t('姓名')}</TableHead>
                    <TableHead className="text-muted-foreground">{t('状态')}</TableHead>
                    <TableHead className="text-muted-foreground text-right w-32">
                      {t('操作')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminInline && !adminInline.id && (
                    <TableRow className="border-border bg-slate-50/50">
                      <TableCell>
                        <Input
                          placeholder={t('登录账号')}
                          value={adminInline.username}
                          onChange={(e) =>
                            setAdminInline((p) => (p ? { ...p, username: e.target.value } : p))
                          }
                          disabled={adminInlineSubmitting}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={t('姓名')}
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
                              t('保存')
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={cancelInlineAdmin}
                            disabled={adminInlineSubmitting}
                          >
                            {t('取消')}
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
                                      t('保存')
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={cancelInlineAdmin}
                                    disabled={adminInlineSubmitting}
                                  >
                                    {t('取消')}
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
                                    onClick={() => handlePasswordClick(a)}
                                  >
                                    <KeyRound className="mr-1 h-3 w-3" />
                                    {t('修改密码')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => startEditAdmin(a)}
                                  >
                                    <Pencil className="mr-1 h-3 w-3" />
                                    {t('编辑')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                                    onClick={() => setAdminDeleteTarget(a)}
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    {t('删除')}
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
                            {t(adminKind === 'enterprise' ? '暂无企业管理员' : '暂无学校管理员')}
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
        open={passwordAdmin !== null}
        onOpenChange={(open) => {
          if (!open) setPasswordAdmin(null)
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('修改密码')}</DialogTitle>
            <DialogDescription>
              {passwordAdmin
                ? t('为 {name}（{username}）设置新密码', {
                    name: passwordAdmin.name,
                    username: passwordAdmin.username,
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="set-password">{t('新密码')}</Label>
              <Input
                id="set-password"
                type="password"
                placeholder={t('至少 8 位，包含字母和数字')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="set-confirm-password">{t('确认新密码')}</Label>
              <Input
                id="set-confirm-password"
                type="password"
                placeholder={t('再次输入新密码')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordAdmin(null)}
              disabled={passwordSubmitting}
            >
              {t('取消')}
            </Button>
            <Button
              onClick={submitPassword}
              disabled={passwordSubmitting || !newPassword || !confirmPassword}
            >
              {passwordSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={adminDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdminDeleteTarget(null)
        }}
        title={t('确认删除')}
        description={
          adminDeleteTarget
            ? t('确定删除管理员「{name}（{username}）」吗？此操作不可撤销。', {
                name: adminDeleteTarget.name,
                username: adminDeleteTarget.username,
              })
            : ''
        }
        confirmText={t('删除')}
        variant="destructive"
        onConfirm={handleAdminDelete}
      />
    </div>
  )
}
