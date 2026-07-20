"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Shield,
  Upload,
  FileKey,
  Users,
  X,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import type { Tenant as BackendTenant } from "@/lib/types/backend"

interface Admin {
  id: string
  name: string
  account: string
  phone: string
}

interface Tenant {
  id: string
  code: string
  enterpriseName: string
  contact: string
  phone: string
  admins: Admin[]
  userCount: number
  domain: string
  address: string
  enterpriseCode: string
  description: string
  status: "active" | "inactive"
  createdAt: string
}

function mapBackendTenant(t: BackendTenant): Tenant {
  return {
    id: t.id,
    code: t.code,
    enterpriseName: t.name,
    contact: t.contact || "-",
    phone: t.phone || "-",
    admins: (t.adminIds || []).map((id) => ({ id, name: "", account: "", phone: "" })),
    userCount: (t.adminIds || []).length,
    domain: t.domain || "-",
    address: t.address || "-",
    enterpriseCode: t.enterpriseCode || "-",
    description: t.description || "-",
    status: t.status,
    createdAt: t.createdAt,
  }
}

export default function TenantPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false)
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false)
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingAdmins, setEditingAdmins] = useState<Admin[]>([])
  const [newAdmin, setNewAdmin] = useState({ name: "", account: "", phone: "" })
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    userCount: "",
    domain: "",
    address: "",
    enterpriseCode: "",
    description: "",
    status: "active" as "active" | "inactive",
  })
  const [submitting, setSubmitting] = useState(false)
  const [savingAdmins, setSavingAdmins] = useState(false)
  const { toast } = useToast()

  const resetForm = () => {
    setFormData({ name: "", contact: "", phone: "", userCount: "", domain: "", address: "", enterpriseCode: "", description: "", status: "active" })
  }

  const loadTenantToForm = (tenant: Tenant) => {
    setFormData({
      name: tenant.enterpriseName,
      contact: tenant.contact === "-" ? "" : tenant.contact,
      phone: tenant.phone === "-" ? "" : tenant.phone,
      userCount: String(tenant.userCount),
      domain: tenant.domain === "-" ? "" : tenant.domain,
      address: tenant.address === "-" ? "" : tenant.address,
      enterpriseCode: tenant.enterpriseCode === "-" ? "" : tenant.enterpriseCode,
      description: tenant.description === "-" ? "" : tenant.description,
      status: tenant.status,
    })
  }

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      setTenants([mapBackendTenant(res)])
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载租户信息失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading) return
    fetchTenant()
  }, [fetchTenant, authLoading])

  const filteredTenants = useMemo(
    () =>
      tenants.filter(
        (tenant) =>
          tenant.enterpriseName.includes(searchTerm) ||
          tenant.code.includes(searchTerm) ||
          tenant.contact.includes(searchTerm)
      ),
    [tenants, searchTerm]
  )

  const openAdminDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setEditingAdmins([...tenant.admins])
    setNewAdmin({ name: "", account: "", phone: "" })
    setIsAdminDialogOpen(true)
  }

  const addAdmin = () => {
    if (newAdmin.name && newAdmin.account) {
      setEditingAdmins([...editingAdmins, { id: `new-${Date.now()}`, ...newAdmin }])
      setNewAdmin({ name: "", account: "", phone: "" })
    }
  }

  const removeAdmin = (adminId: string) => {
    setEditingAdmins(editingAdmins.filter((a) => a.id !== adminId))
  }

  const saveAdmins = async () => {
    if (!selectedTenant) return
    setSavingAdmins(true)
    try {
      await portalRequest(`/tenants/${selectedTenant.id}`, {
        method: "PUT",
        body: JSON.stringify({ adminIds: editingAdmins.map((a) => a.id) }),
      })
      toast({ title: "保存成功" })
      setTenants((prev) =>
        prev.map((t) =>
          t.id === selectedTenant.id ? { ...t, admins: editingAdmins, userCount: editingAdmins.length } : t
        )
      )
      setIsAdminDialogOpen(false)
    } catch (err) {
      toast({ variant: "destructive", title: "保存失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSavingAdmins(false)
    }
  }

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.contact || !formData.phone) {
      setError("请填写学校名称、联系人、联系电话")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (selectedTenant) {
        await portalRequest(`/tenants/${selectedTenant.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: formData.name,
            contact: formData.contact || null,
            phone: formData.phone || null,
            domain: formData.domain || null,
            address: formData.address || null,
            enterpriseCode: formData.enterpriseCode || null,
            description: formData.description || null,
          }),
        })
      } else {
        await portalRequest("/tenants", {
          method: "POST",
          body: JSON.stringify({
            name: formData.name,
            code: "t" + Math.random().toString(36).substring(2, 9),
            contact: formData.contact || null,
            phone: formData.phone || null,
            domain: formData.domain || null,
            address: formData.address || null,
            enterpriseCode: formData.enterpriseCode || null,
            description: formData.description || null,
          }),
        })
      }
      setIsCreateDialogOpen(false)
      await fetchTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : (selectedTenant ? "更新租户失败" : "创建租户失败"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">租户信息管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理平台租户，配置租户权限和资源</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsLicenseDialogOpen(true)} size="sm">
            <FileKey className="h-4 w-4 mr-1" />
            导入License
          </Button>
          {/* 新增租户已移至 /superadmin */}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索学校名称、标识或联系人..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-1" />
          筛选
        </Button>
      </div>

      {(loading || authLoading) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!authLoading && !tenantId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800 font-medium text-sm">未关联租户</p>
          <p className="text-amber-600 text-xs mt-1">当前账号未关联租户，请联系平台管理员分配租户后重试。</p>
        </div>
      )}

      {!loading && tenantId && (
        <>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">租户标识</TableHead>
                  <TableHead className="text-muted-foreground">学校名称</TableHead>
                  <TableHead className="text-muted-foreground">联系人</TableHead>
                  <TableHead className="text-muted-foreground">联系电话</TableHead>

                  <TableHead className="text-muted-foreground">用户数量</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">创建时间</TableHead>
                  <TableHead className="text-muted-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id} className="border-border">
                    <TableCell className="font-mono text-sm text-muted-foreground">{tenant.code}</TableCell>
                    <TableCell className="font-medium">{tenant.enterpriseName}</TableCell>
                    <TableCell>{tenant.contact}</TableCell>
                    <TableCell className="text-muted-foreground">{tenant.phone}</TableCell>

                    <TableCell>{tenant.userCount}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                        {tenant.status === "active" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tenant.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); loadTenantToForm(tenant); setIsCreateDialogOpen(true) }}>
                            编辑
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      暂无租户信息
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {filteredTenants.length} 条记录</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>上一页</Button>
              <span className="px-2">1 / 1</span>
              <Button variant="outline" size="sm" disabled>下一页</Button>
            </div>
          </div>
        </>
      )}

      {/* 管理员管理对话框 */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>管理员管理</DialogTitle>
            <DialogDescription>管理 {selectedTenant?.enterpriseName} 的管理员账号</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* 现有管理员列表 */}
            <div>
              <Label className="mb-2 block">现有管理员 ({editingAdmins.length}人)</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {editingAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-medium">
                        {admin.name.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{admin.name || "管理员"}</div>
                        <div className="text-xs text-muted-foreground">账号：{admin.account || admin.id} | 电话：{admin.phone || "-"}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAdmin(admin.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {editingAdmins.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">暂无管理员</div>
                )}
              </div>
            </div>

            {/* 添加新管理员 */}
            <div className="border-t pt-4">
              <Label className="mb-2 block">添加管理员</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="姓名"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                />
                <Input
                  placeholder="登录账号"
                  value={newAdmin.account}
                  onChange={(e) => setNewAdmin({ ...newAdmin, account: e.target.value })}
                />
                <Input
                  placeholder="手机号（选填）"
                  value={newAdmin.phone}
                  onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addAdmin}
                disabled={!newAdmin.name || !newAdmin.account}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdminDialogOpen(false)} disabled={savingAdmins}>取消</Button>
            <Button onClick={saveAdmins} disabled={savingAdmins}>
              {savingAdmins ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入License对话框 */}
      <Dialog open={isLicenseDialogOpen} onOpenChange={setIsLicenseDialogOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>导入License</DialogTitle>
            <DialogDescription>上传License文件以导入租户配置和资源</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">点击或拖拽上传License文件</p>
              <p className="text-xs text-gray-400">支持 .lic, .license 格式</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                License文件包含租户配置、资源编码、套餐信息等数据，导入后将自动创建租户和相关资源。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLicenseDialogOpen(false)}>取消</Button>
            <Button onClick={() => setIsLicenseDialogOpen(false)}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增/编辑租户对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTenant ? "编辑租户" : "新增租户"}</DialogTitle>
            <DialogDescription>{selectedTenant ? "修改租户信息，租户标识创建后不可修改" : "创建新的租户"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>租户唯一标识</Label>
                <Input value={selectedTenant?.code || "系统自动生成"} disabled className="bg-muted font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>租户状态</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>学校名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：清华大学" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>联系人 <span className="text-destructive">*</span></Label>
                <Input placeholder="学校联系人姓名" value={formData.contact} onChange={(e) => setFormData((prev) => ({ ...prev, contact: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>联系电话 <span className="text-destructive">*</span></Label>
                <Input placeholder="联系电话" value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>用户数量</Label>
                <Input type="number" placeholder="最大用户数" value={formData.userCount} onChange={(e) => setFormData((prev) => ({ ...prev, userCount: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>绑定域名</Label>
                <Input placeholder="如：xxx.edu.cn" value={formData.domain} onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>学校地址</Label>
              <Input placeholder="学校详细地址" value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>学校代码</Label>
              <Input placeholder="统一社会信用代码" value={formData.enterpriseCode} onChange={(e) => setFormData((prev) => ({ ...prev, enterpriseCode: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>学校简介</Label>
              <Textarea placeholder="学校简介描述" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleCreateOrUpdate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {selectedTenant ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限资源管理对话框 */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>租户权限资源管理</DialogTitle>
            <DialogDescription>为 {selectedTenant?.enterpriseName} 配置可访问的系统资源和权限</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 font-medium">系统模块权限</h4>
              <div className="grid grid-cols-2 gap-3">
                {["基础数据管理", "组织架构管理", "用户管理", "职位管理", "角色权限", "系统设置"].map((module) => (
                  <label key={module} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border" />
                    <span className="text-sm">{module}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 font-medium">数据容量限制</h4>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">最大用户数</span>
                  <Input className="w-32" type="number" defaultValue="1000" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">存储空间 (GB)</span>
                  <Input className="w-32" type="number" defaultValue="100" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>取消</Button>
            <Button onClick={() => { toast({ title: "提示", description: "权限配置功能开发中，敬请期待" }); setIsPermissionDialogOpen(false) }}>保存配置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
