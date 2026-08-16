'use client'

// AI 智能服务中心 · 第三方挂接管理（school_admin，spec: docs/spec/ai-service-center.md §4.8/§5.4）
// 挂接 = 纯链接卡片（D6）；可见性由后端 RequireRole(school_admin) 保证。
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Bot, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast, ConfirmDialog, EmptyState, FormDialogFooter } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { Spinner } from '@/components/ui/spinner'
import { aiCenterAdminApi } from '@/lib/api'
import type { AIIntegration } from '@/lib/api'
import { isSafeExternalUrl } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'

type IntegrationKind = 'agent' | 'app'

interface IntegrationForm {
  name: string
  url: string
  icon: string
  description: string
  category: string
  sort: string
}

const EMPTY_FORM: IntegrationForm = {
  name: '',
  url: '',
  icon: '',
  description: '',
  category: '',
  sort: '0',
}

export default function AIAdminIntegrationsPage() {
  const t = useT()
  const { toast } = useToast()

  const [kind, setKind] = useState<IntegrationKind>('agent')
  const [items, setItems] = useState<AIIntegration[]>([])
  const [loading, setLoading] = useState(true)
  // 增删后自增以触发重新拉取（setLoading(true) 放在事件回调里，避免 effect 内同步 setState）
  const [refreshKey, setRefreshKey] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AIIntegration | null>(null)
  const [form, setForm] = useState<IntegrationForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AIIntegration | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    aiCenterAdminApi
      .listIntegrations(kind)
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err) => {
        if (cancelled) return
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, refreshKey, t, toast])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (item: AIIntegration) => {
    setEditing(item)
    setForm({
      name: item.name,
      url: item.url,
      icon: item.icon,
      description: item.description,
      category: item.category,
      sort: String(item.sort ?? 0),
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    const name = form.name.trim()
    const url = form.url.trim()
    if (!name) {
      toast({ title: t('请填写名称'), variant: 'destructive' })
      return
    }
    // url 仅允许 http/https（与后端校验、XSS 防线一致，见 spec §4.8）
    if (!/^https?:\/\//.test(url) || !isSafeExternalUrl(url)) {
      toast({ title: t('请输入合法的 http(s) 链接'), variant: 'destructive' })
      return
    }
    const body = {
      kind,
      name,
      url,
      icon: form.icon.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      sort: Number(form.sort) || 0,
    }
    setSaving(true)
    try {
      if (editing) {
        await aiCenterAdminApi.updateIntegration(editing.id, body)
      } else {
        await aiCenterAdminApi.createIntegration(body)
      }
      toast({ title: editing ? t('保存成功') : t('创建成功') })
      setDialogOpen(false)
      setLoading(true)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (item: AIIntegration) => {
    const next = item.status === 'active' ? 'inactive' : 'active'
    try {
      await aiCenterAdminApi.toggleIntegration(item.id, next)
      // 局部更新，无需整表刷新
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: next } : it)))
      toast({ title: t('操作成功') })
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await aiCenterAdminApi.removeIntegration(deleteTarget.id)
      toast({ title: t('删除成功') })
      setDeleteTarget(null)
      setLoading(true)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      toast({
        title: t('删除失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">{t('第三方挂接')}</h1>
            <p className="text-xs text-muted-foreground">
              {t('维护第三方智能体与应用的链接卡片，上架后展示在 AI 广场')}
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          {t('新增')}
        </Button>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="px-4 pt-4">
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v as IntegrationKind)
              setLoading(true)
            }}
          >
            <TabsList>
              <TabsTrigger value="agent">{t('第三方智能体')}</TabsTrigger>
              <TabsTrigger value="app">{t('应用')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Bot className="w-10 h-10" />}
              title={t('暂无挂接')}
              description={t('点击右上角「新增」创建链接卡片')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('图标')}</TableHead>
                  <TableHead>{t('名称')}</TableHead>
                  <TableHead>{t('描述')}</TableHead>
                  <TableHead>{t('分类')}</TableHead>
                  <TableHead className="w-16">{t('排序')}</TableHead>
                  <TableHead>{t('状态')}</TableHead>
                  <TableHead className="text-right">{t('操作')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xl">{item.icon || '🔗'}</TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">{item.name}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground">
                      {item.description || '-'}
                    </TableCell>
                    <TableCell>{item.category || '-'}</TableCell>
                    <TableCell>{item.sort}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={item.status}
                        label={item.status === 'active' ? t('已上架') : t('已下架')}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          {t('编辑')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggle(item)}>
                          {item.status === 'active' ? t('下架') : t('上架')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          aria-label={t('删除')}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('编辑挂接') : t('新增挂接')}</DialogTitle>
            <DialogDescription>
              {kind === 'agent' ? t('第三方智能体链接卡片') : t('第三方应用链接卡片')}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="space-y-1.5">
              <Label>
                {t('名称')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('例如：文心一言')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                URL <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('图标（emoji）')}</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="🤖"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('分类')}</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder={t('例如：效率工具')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('描述')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder={t('一句话介绍')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('排序')}</Label>
              <Input
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('数字越小越靠前')}</p>
            </div>
            <FormDialogFooter
              onCancel={() => setDialogOpen(false)}
              confirmText={editing ? t('保存') : t('创建')}
              loading={saving}
            />
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('删除挂接')}
        description={t('删除后该链接卡片将立即从 AI 广场移除，且不可恢复。确认删除？')}
        confirmText={t('删除')}
        variant="destructive"
        pending={deleting}
        onConfirm={remove}
      />
    </div>
  )
}
