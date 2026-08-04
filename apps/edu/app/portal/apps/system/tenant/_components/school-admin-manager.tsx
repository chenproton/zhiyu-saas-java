'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
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
import { Plus, Pencil, Trash2, Loader2, KeyRound } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Label } from '@/components/ui/label'

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
  fetcher: <T>(path: string, options?: RequestInit) => Promise<T>
}

export function SchoolAdminManager({ fetcher }: SchoolAdminManagerProps) {
  const [admins, setAdmins] = useState<TenantAdmin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantAdmin | null>(null)
  const [inline, setInline] = useState<{ id?: string; username: string; name: string } | null>(null)
  const [inlineSubmitting, setInlineSubmitting] = useState(false)
  const [passwordAdmin, setPasswordAdmin] = useState<TenantAdmin | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const { toast } = useToast()

  const fetchAdmins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher<ListResponse<TenantAdmin>>('/admins')
      setAdmins(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载管理员列表失败')
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await fetchAdmins()
    })()
    return () => {
      cancelled = true
    }
  }, [fetchAdmins])

  const startAdd = () => {
    setInline({ username: '', name: '' })
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
      setError('账号和姓名不能为空')
      return
    }

    setInlineSubmitting(true)
    setError(null)
    try {
      if (inline.id) {
        await fetcher(`/admins/${inline.id}`, {
          method: 'PUT',
          body: JSON.stringify({ username: inline.username, name: inline.name }),
        })
        toast({ title: '保存成功' })
      } else {
        const created = await fetcher<TenantAdmin>('/admins', {
          method: 'POST',
          body: JSON.stringify({ username: inline.username, name: inline.name }),
        })
        toast({ title: '创建成功', description: `初始密码：${created.plainPassword}` })
      }
      setInline(null)
      await fetchAdmins()
    } catch (err) {
      setError(err instanceof Error ? err.message : inline.id ? '保存失败' : '创建失败')
    } finally {
      setInlineSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await fetcher(`/admins/${deleteTarget.id}`, { method: 'DELETE' })
      toast({ title: '删除成功' })
      await fetchAdmins()
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
      setPasswordError('请输入新密码')
      return
    }
    if (!PASSWORD_RULE.test(newPassword)) {
      setPasswordError('密码长度至少 8 位，且需同时包含字母和数字')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致')
      return
    }
    setPasswordSubmitting(true)
    setPasswordError(null)
    try {
      await fetcher(`/admins/${passwordAdmin.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      })
      toast({ title: '修改成功' })
      setPasswordAdmin(null)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '修改密码失败')
    } finally {
      setPasswordSubmitting(false)
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
                    onChange={(e) => setInline((p) => (p ? { ...p, username: e.target.value } : p))}
                    disabled={inlineSubmitting}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="姓名"
                    value={inline.name}
                    onChange={(e) => setInline((p) => (p ? { ...p, name: e.target.value } : p))}
                    disabled={inlineSubmitting}
                  />
                </TableCell>
                <TableCell>-</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={submitInline}
                      disabled={inlineSubmitting}
                    >
                      {inlineSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : '保存'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={cancelInline}
                      disabled={inlineSubmitting}
                    >
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
                            onChange={(e) =>
                              setInline((p) => (p ? { ...p, username: e.target.value } : p))
                            }
                            disabled={inlineSubmitting}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={inline.name}
                            onChange={(e) =>
                              setInline((p) => (p ? { ...p, name: e.target.value } : p))
                            }
                            disabled={inlineSubmitting}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={a.status}
                            label={a.status === 'active' ? '启用' : '停用'}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={submitInline}
                              disabled={inlineSubmitting}
                            >
                              {inlineSubmitting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                '保存'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={cancelInline}
                              disabled={inlineSubmitting}
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
                          <StatusBadge
                            status={a.status}
                            label={a.status === 'active' ? '启用' : '停用'}
                          />
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
                              修改密码
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => startEdit(a)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                              onClick={() => setDeleteTarget(a)}
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
                {admins.length === 0 && !loading && !inline && (
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

      <Dialog
        open={passwordAdmin !== null}
        onOpenChange={(open) => {
          if (!open) setPasswordAdmin(null)
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              {passwordAdmin
                ? `为 ${passwordAdmin.name}（${passwordAdmin.username}）设置新密码`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="set-password">新密码</Label>
              <Input
                id="set-password"
                type="password"
                placeholder="至少 8 位，包含字母和数字"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="set-confirm-password">确认新密码</Label>
              <Input
                id="set-confirm-password"
                type="password"
                placeholder="再次输入新密码"
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
              取消
            </Button>
            <Button
              onClick={submitPassword}
              disabled={passwordSubmitting || !newPassword || !confirmPassword}
            >
              {passwordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="确认删除"
        description={
          deleteTarget
            ? `确定删除管理员「${deleteTarget.name}（${deleteTarget.username}）」吗？此操作不可撤销。`
            : ''
        }
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
