"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Pencil, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import type { AllianceEnterprise, AllianceListResponse } from "@/lib/types"

export default function AllianceEnterprisesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEnterprises = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await portalRequest<AllianceListResponse<AllianceEnterprise>>("/alliance/enterprises")
      setEnterprises(data.items || [])
    } catch (e: any) {
      setError(e.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading || !tenantId) return
    fetchEnterprises()
  }, [tenantId, authLoading, fetchEnterprises])

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
        items.filter((e) =>
          !search ||
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          (e.industry || "").toLowerCase().includes(search.toLowerCase())
        )
      }
      importConfig={{ importType: "alliance-enterprises", entityLabel: "合作企业", templateFileName: "合作企业批量导入模板.xlsx" }}
      createHref="/portal/apps/alliance/enterprises/new"
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>企业名称</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>行业</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>评级</TableHead>
          <TableHead>联系人</TableHead>
          <TableHead>公开</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(enterprise: any, actions: any) => (
        <>
          <TableCell className="font-medium">{enterprise.name}</TableCell>
          <TableCell>{enterprise.enterpriseType === "platform" ? "平台企业" : "校本企业"}</TableCell>
          <TableCell>{enterprise.industry || "-"}</TableCell>
          <TableCell><StatusBadge status={enterprise.status} /></TableCell>
          <TableCell>{enterprise.rating || "-"}</TableCell>
          <TableCell>{enterprise.contactPerson || "-"}</TableCell>
          <TableCell>{enterprise.isPublic ? "是" : "否"}</TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}`}>
              <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />查看</Button>
            </Link>
            <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}/edit`}>
              <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({
        id: "",
        name: "",
        enterpriseType: "platform",
        status: "negotiating",
        rating: "general",
        isPublic: false as any,
        industry: "",
        region: "",
        description: "",
        contactPerson: "",
        contactPhone: "",
        contactEmail: "",
        cooperationTypes: [] as any,
        businessLicensePhotos: [] as any,
        qualificationPhotos: [] as any,
        intellectualPropertyPhotos: [] as any,
        coverPhotos: [] as any,
        secondaryColleges: [] as any,
        createdAt: "",
        updatedAt: "",
      } as AllianceEnterprise & { enabled?: boolean })}
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>企业名称 *</Label>
              <Input value={item.name || ""} onChange={(e: any) => setItem({ ...item, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>企业类型</Label>
              <Select value={item.enterpriseType || "platform"} onValueChange={(v: any) => setItem({ ...item, enterpriseType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">平台企业</SelectItem>
                  <SelectItem value="school-based">校本企业</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>所属行业</Label>
              <Input value={item.industry || ""} onChange={(e: any) => setItem({ ...item, industry: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>所在地区</Label>
              <Input value={item.region || ""} onChange={(e: any) => setItem({ ...item, region: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>合作状态</Label>
              <Select value={item.status || "negotiating"} onValueChange={(v: any) => setItem({ ...item, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="negotiating">洽谈中</SelectItem>
                  <SelectItem value="active">合作中</SelectItem>
                  <SelectItem value="paused">已暂停</SelectItem>
                  <SelectItem value="terminated">已终止</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>合作评级</Label>
              <Select value={item.rating || "general"} onValueChange={(v: any) => setItem({ ...item, rating: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategic">战略合作</SelectItem>
                  <SelectItem value="deep">深度合作</SelectItem>
                  <SelectItem value="general">一般合作</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>联系人</Label>
              <Input value={item.contactPerson || ""} onChange={(e: any) => setItem({ ...item, contactPerson: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>联系电话</Label>
              <Input value={item.contactPhone || ""} onChange={(e: any) => setItem({ ...item, contactPhone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>联系邮箱</Label>
              <Input value={item.contactEmail || ""} onChange={(e: any) => setItem({ ...item, contactEmail: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Logo URL</Label>
              <Input value={item.logoUrl || ""} onChange={(e: any) => setItem({ ...item, logoUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label>企业地址</Label>
              <Input value={item.address || ""} onChange={(e: any) => setItem({ ...item, address: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={item.isPublic || false} onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })} />
              <Label>公开显示</Label>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>企业描述</Label>
            <Textarea value={item.description || ""} onChange={(e: any) => setItem({ ...item, description: e.target.value })} rows={4} />
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => (<>确定要删除合作企业 <b>{item.name}</b> 吗？此操作不可撤销。</>)}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await portalRequest(`/alliance/enterprises/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        } else {
          await portalRequest("/alliance/enterprises", { method: "POST", body: JSON.stringify(item) })
        }
        toast({ title: `企业已${isEdit ? "更新" : "创建"}` })
        await fetchEnterprises()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/enterprises/${item.id}`, { method: "DELETE" })
        toast({ title: "企业已删除" })
        await fetchEnterprises()
      }}
      onToggleEnabled={async (item: any) => {
        await portalRequest(`/alliance/enterprises/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...item, isPublic: !item.isPublic }),
        })
        await fetchEnterprises()
      }}
    />
  )
}
