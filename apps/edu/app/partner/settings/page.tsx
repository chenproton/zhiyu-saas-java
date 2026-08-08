'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Loader2 } from 'lucide-react'
import { partnerMeApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerSettingsPage() {
  const { toast } = useToast()
  const t = useT()
  const { user, logout } = usePartnerAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ title: t('两次输入的新密码不一致'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await partnerMeApi.changePassword({ oldPassword, newPassword })
      toast({ title: t('密码已修改，请重新登录') })
      logout()
    } catch (err: any) {
      toast({ title: t('修改失败'), description: err.message, variant: 'destructive' })
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('账号安全')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('当前登录账号：{name}', { name: user?.username || '' })}
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t('修改密码')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormFieldRow label={t('当前密码')} required>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </FormFieldRow>
            <FormFieldRow label={t('新密码')} required>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </FormFieldRow>
            <FormFieldRow label={t('确认新密码')} required>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </FormFieldRow>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('保存')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
