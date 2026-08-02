'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalUserExtensionFieldApi, roleApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { Pencil } from 'lucide-react'
import type { Role, UserExtensionField } from '@/lib/types/backend'

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

  const roleNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    roles.forEach((r) => map.set(r.code, r.name))
    return map
  }, [roles])

  const fetchData = useCallback(async () => {
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
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    ;(async () => {
      await fetchData()
    })()
  }, [fetchData])

  const handleToggle = async (field: ExtendField) => {
    const original = rawFields.find((f) => f.id === field.id)
    if (!original) return
    try {
      await portalUserExtensionFieldApi.update(field.id, { isEnabled: !field.enabled })
      toast({ title: '状态已更新' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '操作失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  const handleSave = async (item: ExtendField) => {
    await portalUserExtensionFieldApi.update(item.id, {
      fieldName: item.name.trim(),
      applicableRoleCodes: item.roleCodes,
    })
    toast({ title: '保存成功' })
  }

  const toggleRoleCode = (code: string, current: string[]) => {
    return current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
  }

  const getRoleLabels = (codes: string[]) => {
    return codes.map((code) => roleNameByCode.get(code) || code)
  }

  return (
    <PortalCrudPage
      title="用户字段扩展"
      description="系统预留20个用户扩展字段，您可以根据需要启用、命名这些字段，并指定适用的角色"
      entityLabel="扩展字段"
      items={fields}
      loading={loading}
      error={error ?? null}
      onRetry={fetchData}
      colSpan={5}
      search={false}
      hideImport
      hideCreate
      footer={
        <span className="text-sm text-muted-foreground">
          已启用 {fields.filter((f) => f.enabled).length} / {fields.length} 个扩展字段
        </span>
      }
      createDefault={() => ({
        id: '',
        slotNumber: 0,
        name: '',
        enabled: true,
        roleCodes: [],
      })}
      renderForm={(item, setItem) => (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">字段名称</label>
            <Input
              placeholder="请输入字段名称"
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">适用角色（可多选）</label>
            <p className="text-xs text-muted-foreground">
              选择此字段适用的角色，不选则表示所有角色均可使用
            </p>
            <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
              {roles.map((r) => {
                const selected = item.roleCodes.includes(r.code)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setItem({ ...item, roleCodes: toggleRoleCode(r.code, item.roleCodes) })}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    {r.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      onSave={handleSave}
      onToggleEnabled={handleToggle}
      renderTableHeader={() => (
        <>
          <TableHead className="w-12">序号</TableHead>
          <TableHead>字段名称</TableHead>
          <TableHead>适用角色</TableHead>
          <TableHead className="w-24 text-center">是否启用</TableHead>
          <TableHead className="w-20 text-center">操作</TableHead>
        </>
      )}
      renderTableRow={(field, actions) => (
        <>
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
            <Switch checked={field.enabled} onCheckedChange={actions.toggle} />
          </TableCell>
          <TableRowActions>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={actions.edit}
            >
              <Pencil className="mr-1 h-3 w-3" />
              编辑
            </Button>
          </TableRowActions>
        </>
      )}
    />
  )
}
