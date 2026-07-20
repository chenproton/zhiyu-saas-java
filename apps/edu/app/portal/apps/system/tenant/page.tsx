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
  Loader2,
  Pencil,
  Search,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import type { Tenant as BackendTenant } from "@/lib/types/backend"

interface Tenant {
  id: string
  code: string
  enterpriseName: string
  contact: string
  phone: string
  adminCount: number
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
    adminCount: (t.adminIds || []).length,
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    domain: "",
    address: "",
    enterpriseCode: "",
    description: "",
    status: "active" as "active" | "inactive",
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const loadTenantToForm = (tenant: Tenant) => {
    setFormData({
      name: tenant.enterpriseName,
      contact: tenant.contact === "-" ? "" : tenant.contact,
      phone: tenant.phone === "-" ? "" : tenant.phone,
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

  const handleUpdate = async () => {
    if (!formData.name || !formData.contact || !formData.phone || !selectedTenant) {
      setError("请填写学校名称、联系人、联系电话")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
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
      setIsEditDialogOpen(false)
      toast({ title: "保存成功" })
      await fetchTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新租户失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">租户信息管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看和编辑当前租户信息</p>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索关键词..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
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
                  <TableHead className="text-muted-foreground">管理员数</TableHead>
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
                    <TableCell>{tenant.adminCount}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                        {tenant.status === "active" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tenant.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedTenant(tenant); loadTenantToForm(tenant); setIsEditDialogOpen(true) }}>
                        <Pencil className="h-4 w-4 mr-1" />
                        编辑
                      </Button>
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
        </>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>编辑租户</DialogTitle>
            <DialogDescription>修改租户信息，租户标识创建后不可修改</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>租户唯一标识</Label>
                <Input value={selectedTenant?.code || ""} disabled className="bg-muted font-mono" />
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
            <div className="grid gap-2">
              <Label>绑定域名</Label>
              <Input placeholder="如：xxx.edu.cn" value={formData.domain} onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))} />
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
