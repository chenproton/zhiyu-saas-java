'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { useToast } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalMeApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

/**
 * 个人中心-账号信息（学生/教师/学校管理员共用）：
 * 用户ID 与用户名只读展示，仅姓名可修改。
 */
export function AccountInfoForm() {
  const { user, refresh } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!user) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ variant: 'destructive', title: t('保存失败'), description: t('姓名不能为空') })
      return
    }
    setSaving(true)
    try {
      await portalMeApi.updateName(trimmed)
      setName(trimmed)
      await refresh()
      toast({ title: t('保存成功'), description: t('姓名已更新') })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: e instanceof Error ? e.message : t('更新姓名失败'),
      })
    } finally {
      setSaving(false)
    }
  }

  const unchanged = !user || name.trim() === (user.name || '') || !name.trim()

  return (
    <div className="space-y-4">
      <FormFieldGrid>
        <FormFieldRow label={t('用户ID')} labelClassName="text-gray-700">
          <Input value={user?.id || '—'} disabled className="bg-gray-50 border-gray-100" />
        </FormFieldRow>
        <FormFieldRow label={t('用户名（登录账号）')} labelClassName="text-gray-700">
          <Input value={user?.username || '—'} disabled className="bg-gray-50 border-gray-100" />
        </FormFieldRow>
        <FormFieldRow label={t('姓名')} labelClassName="text-gray-700">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('请输入姓名')}
            maxLength={50}
          />
        </FormFieldRow>
      </FormFieldGrid>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || unchanged}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('保存姓名')}
        </Button>
      </div>
    </div>
  )
}
