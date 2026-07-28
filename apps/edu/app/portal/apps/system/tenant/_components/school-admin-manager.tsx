"use client"

import { useEffect, useState } from "react"
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
import { Plus, Pencil, Trash2, Loader2, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

interface TenantAdmin {
  id: string
  tenantId: string
  username: string
  loginName: string
  name: string
  status: string
  plainPassword?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

interface ListResponse<T> {
  items: T[]
  total: number
}

interface SchoolAdminManagerProps {
  tenantId: string
  fetcher: <T>(path: string, options?: RequestInit) => Promise<T>
}

export function SchoolAdminManager({ tenantId, fetcher }: SchoolAdminManagerProps) {
  const [admins, setAdmins] = useState<TenantAdmin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantAdmin | null>(null)
  const [inline, setInline] = useState<{ id?: string; username: string; name: string } | null>(null)
  const [inlineSubmitting, setInlineSubmitting] = useState(false)
  const [viewPassword, setViewPassword] = useState<{ admin: TenantAdmin; password: string } | null>(null)
  const { toast } = useToast()

  const fetchAdmins = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher<ListResponse<TenantAdmin>>("/admins")
      setAdmins(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载管理员列表失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const startAdd = () => {
    setInline({ username: "", name: "" })
    setError(null)
  }

  const startEdit = (a: TenantAdmin) => {
    setInline({ id: a.id, username: a.username, name: a.name })
    setError(null)
  }

  const cancelInline = () => {
    setInline(null)
    setError(null)
  }

  const submitInline = async () => {
    if (!inline) return
    if (!inline.username || !inline.name) {
      setError("账号和姓名不能为空")
      return
    }

    setInlineSubmitting(true)
    setError(null)
    try {
      if (inline.id) {
        await fetcher(`/admins/${inline.id}`, {
          method: "PUT",
          body: JSON.stringify({ username: inline.username, name: inline.name }),
        })
        toast({ title: "保存成功" })
      } else {
        const created = await fetcher<TenantAdmin>("/admins", {
          method: "POST",
          body: JSON.stringify({ username: inline.username, name: inline.name }),
        })
        toast({ title: "创建成功", description: `初始密码：${created.plainPassword}` })
      }
      setInline(null)
      await fetchAdmins()
    } catch (err) {
      setError(err instanceof Error ? err.message : (inline.id ? "保存失败" : "创建失败"))
    } finally {
      setInlineSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await fetcher(`/admins/${deleteTarget.id}`, { method: "DELETE" })
      toast({ title: "删除成功" })
      await fetchAdmins()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleViewPassword = async (a: TenantAdmin) => {
    try {
      const res = await fetcher<{ id: string; newPassword: string }>(`/admins/${a.id}/preview-password`, {
        method: "POST",
      })
      setViewPassword({ admin: a, password: res.newPassword })
    } catch (err) {
      toast({ variant: "destructive", title: "获取密码失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">学校管理员</h3>
          <p className="text-xs text-muted-foreground mt-0.5">管理当前租户的学校管理员账号</p>
        </div>
        <Button size="sm" onClick={startAdd} disabled={inline !== null}>
          <Plus className="h-4 w-4 mr-1" />
          新增
        </Button>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

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
            {inline && !inline.id && (
              <TableRow className="border-border bg-slate-50/50">
                <TableCell>
                  <Input
                    placeholder="登录账号"
                    value={inline.username}
                    onChange={(e) => setInline((p) => p ? { ...p, username: e.target.value } : p)}
                    disabled={inlineSubmitting}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="姓名"
                    value={inline.name}
                    onChange={(e) => setInline((p) => p ? { ...p, name: e.target.value } : p)}
                    disabled={inlineSubmitting}
                  />
                </TableCell>
                <TableCell>-</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={submitInline} disabled={inlineSubmitting}>
                      {inlineSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "保存"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={cancelInline} disabled={inlineSubmitting}>
                      取消
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {admins.map((a) => (
                  <TableRow key={a.id} className="border-border">
                    {inline && inline.id === a.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={inline.username}
                            onChange={(e) => setInline((p) => p ? { ...p, username: e.target.value } : p)}
                            disabled={inlineSubmitting}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={inline.name}
                            onChange={(e) => setInline((p) => p ? { ...p, name: e.target.value } : p)}
                            disabled={inlineSubmitting}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.status === "active" ? "default" : "secondary"}>
                            {a.status === "active" ? "启用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" className="h-7 px-2 text-xs" onClick={submitInline} disabled={inlineSubmitting}>
                              {inlineSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "保存"}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={cancelInline} disabled={inlineSubmitting}>
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
                          <Badge variant={a.status === "active" ? "default" : "secondary"}>
                            {a.status === "active" ? "启用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleViewPassword(a)}>
                              <Eye className="mr-1 h-3 w-3" />
                              查看密码
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit(a)}>
                              <Pencil className="mr-1 h-3 w-3" />
                              编辑
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => setDeleteTarget(a)}>
                              <Trash2 className="mr-1 h-3 w-3" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {admins.length === 0 && !loading && !inline && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      暂无学校管理员
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={viewPassword !== null} onOpenChange={(open) => { if (!open) setViewPassword(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>查看密码</DialogTitle>
            <DialogDescription>
              {viewPassword ? `${viewPassword.admin.name}（${viewPassword.admin.username}）的登录密码` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input readOnly value={viewPassword?.password || ""} onFocus={(e) => e.target.select()} />
          </div>
          <DialogFooter>
            <Button onClick={() => setViewPassword(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="确认删除"
        description={deleteTarget ? `确定删除管理员「${deleteTarget.name}（${deleteTarget.username}）」吗？此操作不可撤销。` : ""}
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
