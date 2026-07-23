"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalUserExtensionFieldApi, roleApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Pencil, AlertCircle, Loader2, RotateCcw } from "lucide-react"
import type { Role, UserExtensionField } from "@/lib/types/backend"

interface ExtendField {
  id: string
  slotNumber: number
  name: string
  enabled: boolean
  roleCodes: string[]
}

export default function UserFieldsPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [fields, setFields] = useState<ExtendField[]>([])
  const [rawFields, setRawFields] = useState<UserExtensionField[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [showDialog, setShowDialog] = useState(false)
  const [editingField, setEditingField] = useState<ExtendField | null>(null)
  const [editName, setEditName] = useState("")
  const [editRoleCodes, setEditRoleCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const roleNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    roles.forEach((r) => map.set(r.code, r.name))
    return map
  }, [roles])

  const fetchData = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(undefined)
    try {
      const [fieldsRes, rolesRes] = await Promise.all([
        portalUserExtensionFieldApi.list({ tenantId }),
        roleApi.list({ tenantId, limit: 1000 }),
      ])
      setRoles(rolesRes.items)
      setRawFields(fieldsRes.items)
      setFields(
        fieldsRes.items.map((f) => ({
          id: f.id,
          slotNumber: f.slotNumber,
          name: f.fieldName,
          enabled: f.isEnabled,
          roleCodes: f.applicableRoleCodes || [],
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [tenantId])

  const handleToggle = async (field: ExtendField) => {
    const original = rawFields.find((f) => f.id === field.id)
    if (!original) return
    try {
      await portalUserExtensionFieldApi.update(field.id, { isEnabled: !field.enabled })
      toast({ title: "状态已更新" })
      await fetchData()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const handleEdit = (field: ExtendField) => {
    setEditingField(field)
    setEditName(field.name)
    setEditRoleCodes(field.roleCodes)
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!editingField) return
    setSaving(true)
    try {
      await portalUserExtensionFieldApi.update(editingField.id, {
        fieldName: editName.trim(),
        applicableRoleCodes: editRoleCodes,
      })
      toast({ title: "保存成功" })
      setShowDialog(false)
      await fetchData()
    } catch (err) {
      toast({ variant: "destructive", title: "保存失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const toggleRoleCode = (code: string) => {
    setEditRoleCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const getRoleLabels = (codes: string[]) => {
    return codes.map((code) => roleNameByCode.get(code) || code)
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">用户字段扩展</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          系统预留20个用户扩展字段，您可以根据需要启用、命名这些字段，并指定适用的角色
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            <span className="flex-1">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RotateCcw className="h-4 w-4 mr-1" />重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">序号</TableHead>
              <TableHead>字段名称</TableHead>
              <TableHead>适用角色</TableHead>
              <TableHead className="w-24 text-center">是否启用</TableHead>
              <TableHead className="w-20 text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                </TableCell>
              </TableRow>
            ) : fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  暂无扩展字段数据
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field) => (
                <TableRow key={field.id} className="group">
                  <TableCell className="text-muted-foreground">{field.slotNumber}</TableCell>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>
                    {field.roleCodes.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {getRoleLabels(field.roleCodes).map((label, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">未指定</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={field.enabled} onCheckedChange={() => handleToggle(field)} />
                  </TableCell>
                  <TableCell className="text-right relative">
                    <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleEdit(field)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        编辑
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        已启用 {fields.filter((f) => f.enabled).length} / {fields.length} 个扩展字段
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>编辑扩展字段</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>字段名称</Label>
              <Input placeholder="请输入字段名称" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>适用角色（可多选）</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRoleCode(r.code)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      editRoleCodes.includes(r.code)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                选择此字段适用的角色，不选则表示所有角色均可使用
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
