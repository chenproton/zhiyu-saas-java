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
import { useT } from '@/lib/i18n/locale-provider'

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
  const t = useT()

  const fetchAdmins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher<ListResponse<TenantAdmin>>('/admins')
      setAdmins(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('加载管理员列表失败'))
    } finally {
      setLoading(false)
    }
  }, [fetcher, t])

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
      setError(t('账号和姓名不能为空'))
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
        toast({ title: t('保存成功') })
      } else {
        const created = await fetcher<TenantAdmin>('/admins', {
          method: 'POST',
          body: JSON.stringify({ username: inline.username, name: inline.name }),
        })
        toast({
          title: t('创建成功'),
          description: t('初始密码：{pwd}', { pwd: created.newPassword ?? '' }),
        })
      }
      setInline(null)
      await fetchAdmins()
    } catch (err) {
      setError(err instanceof Error ? err.message : t(inline.id ? '保存失败' : '创建失败'))
    } finally {
      setInlineSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await fetcher(`/admins/${deleteTarget.id}`, { method: 'DELETE' })
      toast({ title: t('删除成功') })
      await fetchAdmins()
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
      await fetcher(`/admins/${passwordAdmin.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      })
      toast({ title: t('修改成功') })
      setPasswordAdmin(null)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('修改密码失败'))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{t('学校管理员')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('管理当前租户的学校管理员账号')}</p>
        </div>
        <Button size="sm" onClick={startAdd} disabled={inline !== null}>
          <Plus className="h-4 w-4 mr-1" />
          {t('新增')}
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
              <TableHead className="text-muted-foreground">{t('账号')}</TableHead>
              <TableHead className="text-muted-foreground">{t('姓名')}</TableHead>
              <TableHead className="text-muted-foreground">{t('状态')}</TableHead>
              <TableHead className="text-muted-foreground text-right w-32">{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inline && !inline.id && (
              <TableRow className="border-border bg-slate-50/50">
                <TableCell>
                  <Input
                    placeholder={t('登录账号')}
                    value={inline.username}
                    onChange={(e) => setInline((p) => (p ? { ...p, username: e.target.value } : p))}
                    disabled={inlineSubmitting}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder={t('姓名')}
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
                      {inlineSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : t('保存')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={cancelInline}
                      disabled={inlineSubmitting}
                    >
                      {t('取消')}
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
                            label={t(a.status === 'active' ? '启用' : '停用')}
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
                                t('保存')
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={cancelInline}
                              disabled={inlineSubmitting}
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
                          <StatusBadge
                            status={a.status}
                            label={t(a.status === 'active' ? '启用' : '停用')}
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
                              {t('修改密码')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => startEdit(a)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              {t('编辑')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                              onClick={() => setDeleteTarget(a)}
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
                {admins.length === 0 && !loading && !inline && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      {t('暂无学校管理员')}
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
              {passwordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('确认删除')}
        description={
          deleteTarget
            ? t('确定删除管理员「{name}（{username}）」吗？此操作不可撤销。', {
                name: deleteTarget.name,
                username: deleteTarget.username,
              })
            : ''
        }
        confirmText={t('删除')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
