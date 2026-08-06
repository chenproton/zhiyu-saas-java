'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FormFieldRow } from '@/components/shared/form-field-row'
import type { AllianceDictionary, AllianceListResponse } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

function DictionaryTab({ dictType }: { dictType: string }) {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [items, setItems] = useState<AllianceDictionary[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formItem, setFormItem] = useState<{ code: string; name: string; sortOrder: number }>({
    code: '',
    name: '',
    sortOrder: 0,
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AllianceDictionary | null>(null)
  const [, setDeleting] = useState(false)
  const fetchItems = useCallback(async () => {
    if (!tenantId) return

    try {
      const data = await portalRequest<AllianceListResponse<AllianceDictionary>>(
        `/alliance/dictionaries/${dictType}`,
      )
      setItems(data.items || [])
    } catch (err) {
      reportError(err, '加载联盟字典列表')
    } finally {
      setLoading(false)
    }
  }, [tenantId, dictType])

  useEffect(() => {
    if (authLoading || !tenantId) return
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await fetchItems()
    })()
  }, [tenantId, authLoading, fetchItems])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editId) {
        await portalRequest(`/alliance/dictionaries/${dictType}/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(formItem),
        })
      } else {
        await portalRequest(`/alliance/dictionaries/${dictType}`, {
          method: 'POST',
          body: JSON.stringify(formItem),
        })
      }
      setDialogOpen(false)
      setEditId(null)
      await fetchItems()
      toast({ title: t('已保存') })
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await portalRequest(`/alliance/dictionaries/${dictType}/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      setDeleteTarget(null)
      await fetchItems()
      toast({ title: t('已删除') })
    } catch (e: any) {
      toast({ title: t('删除失败'), description: e.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            setFormItem({ code: '', name: '', sortOrder: items.length })
            setEditId(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('新增')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('共 {count} 项', { count: items.length })}
        </span>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <TableHead>{t('编码')}</TableHead>
              <TableHead>{t('名称')}</TableHead>
              <TableHead>{t('排序')}</TableHead>
              <TableHead>{t('操作')}</TableHead>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('加载中...')}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('暂无')}
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id} className="border-b hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">{d.code}</TableCell>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.sortOrder}</TableCell>
                  <TableCell>
                    <TableRowActions>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormItem({ code: d.code, name: d.name, sortOrder: d.sortOrder })
                          setEditId(d.id)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {t('编辑')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setDeleteTarget(d)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t('删除')}
                      </Button>
                    </TableRowActions>
                  </TableCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">
              {editId ? t('编辑字典项') : t('新增字典项')}
            </h2>
            <div className="space-y-4">
              <FormFieldRow label={t('编码')} required>
                <Input
                  value={formItem.code}
                  onChange={(e) => setFormItem({ ...formItem, code: e.target.value })}
                  disabled={!!editId}
                />
              </FormFieldRow>
              <FormFieldRow label={t('名称')} required>
                <Input
                  value={formItem.name}
                  onChange={(e) => setFormItem({ ...formItem, name: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('排序')}>
                <Input
                  type="number"
                  value={formItem.sortOrder}
                  onChange={(e) =>
                    setFormItem({ ...formItem, sortOrder: parseInt(e.target.value) || 0 })
                  }
                />
              </FormFieldRow>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('取消')}
              </Button>
              <Button onClick={handleSave} disabled={saving || !formItem.code || !formItem.name}>
                {saving ? t('保存中...') : t('保存')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
        title={t('确认删除')}
        description={deleteTarget ? t('确定要删除「{name}」吗？', { name: deleteTarget.name }) : ''}
        variant="destructive"
        confirmText={t('删除')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default function AllianceDictionariesPage() {
  const t = useT()
  const tabs = [
    {
      dictType: 'cooperation_type',
      label: t('合作类型'),
      desc: t('校企合作类型字典（人才培养/实习实训/技术研发等）'),
    },
    {
      dictType: 'cooperation_rating',
      label: t('合作评级'),
      desc: t('企业合作评级字典（战略合作/深度合作/一般合作）'),
    },
    {
      dictType: 'enterprise_status',
      label: t('合作状态'),
      desc: t('企业合作状态字典（洽谈中/合作中/已暂停/已终止）'),
    },
    {
      dictType: 'achievement_type',
      label: t('成果类型'),
      desc: t('合作成果类型字典（岗位/场景/课程/自定义）'),
    },
    {
      dictType: 'agreement_type',
      label: t('协议类型'),
      desc: t('合作协议类型字典'),
    },
    {
      dictType: 'agreement_status',
      label: t('协议状态'),
      desc: t('合作协议状态字典'),
    },
    {
      dictType: 'expert_rating',
      label: t('专家评级'),
      desc: t('专家评级字典（金牌/银牌/铜牌）'),
    },
    {
      dictType: 'project_type',
      label: t('项目类型'),
      desc: t('合作项目类型字典'),
    },
  ]
  const [active, setActive] = useState(tabs[0].dictType)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('字典管理')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('维护联盟业务字典，供各模块下拉使用')}
        </p>
      </div>
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.dictType}
            onClick={() => setActive(tab.dictType)}
            className={`px-4 py-2 text-sm border-b-2 whitespace-nowrap transition-colors ${active === tab.dictType ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs
        .filter((tab) => tab.dictType === active)
        .map((tab) => (
          <div key={tab.dictType} className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-1">{t('{label}字典', { label: tab.label })}</h2>
            <p className="text-sm text-muted-foreground mb-4">{tab.desc}</p>
            <DictionaryTab dictType={tab.dictType} />
          </div>
        ))}
    </div>
  )
}
