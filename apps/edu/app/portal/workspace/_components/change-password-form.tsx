'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { useToast } from '@zhiyu/ui'
import { portalMeApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

/**
 * 个人中心-修改密码（学生/教师/学校管理员共用）：
 * 无需校验旧密码，输入两遍新密码即可。
 */
export function ChangePasswordForm() {
  const { toast } = useToast()
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!PASSWORD_RULE.test(password)) {
      setError(t('密码长度至少 8 位，且需同时包含字母和数字'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('两次输入的密码不一致'))
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await portalMeApi.changePassword(password)
      toast({ title: t('修改成功'), description: t('密码已更新，下次登录请使用新密码') })
      setPassword('')
      setConfirmPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('修改密码失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <FormFieldGrid>
        <FormFieldRow label={t('新密码')} htmlFor="new-password" labelClassName="text-gray-700">
          <Input
            id="new-password"
            type="password"
            placeholder={t('至少 8 位，包含字母和数字')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormFieldRow>
        <FormFieldRow
          label={t('确认新密码')}
          htmlFor="confirm-new-password"
          labelClassName="text-gray-700"
        >
          <Input
            id="confirm-new-password"
            type="password"
            placeholder={t('再次输入新密码')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormFieldRow>
      </FormFieldGrid>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting || !password || !confirmPassword}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('确认修改')}
        </Button>
      </div>
    </div>
  )
}
