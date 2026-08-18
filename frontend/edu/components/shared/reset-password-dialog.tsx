'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PasswordInput } from '@zhiyu/ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { AlertCircle } from 'lucide-react'
import { portalUserManagementApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { FormDialogFooter } from '@zhiyu/ui'

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  userName?: string
  onSuccess?: () => void
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: ResetPasswordDialogProps) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!open || cancelled) return
      setPassword('')
      setConfirmPassword('')
      setError(null)
      setSubmitting(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const validate = (): string | null => {
    if (!password) return t('请输入新密码')
    if (!PASSWORD_RULE.test(password)) {
      return t('密码长度至少 8 位，且需同时包含字母和数字')
    }
    if (password !== confirmPassword) return t('两次输入的密码不一致')
    return null
  }

  const handleSubmit = async () => {
    if (!userId) return
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalUserManagementApi.resetPassword(userId, password)
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('重置密码失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('重置密码')}</DialogTitle>
          <DialogDescription>
            {t('正在为')} <span className="font-medium">{userName || t('该用户')}</span>{' '}
            {t('设置新密码')}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="grid gap-4"
        >
          <div className="grid gap-4 py-4">
          <FormFieldRow label={t('新密码')} htmlFor="reset-password">
            <PasswordInput
              id="reset-password"
              placeholder={t('至少 8 位，包含字母和数字')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormFieldRow>
          <FormFieldRow label={t('确认新密码')} htmlFor="reset-confirm-password">
            <PasswordInput
              id="reset-confirm-password"
              placeholder={t('再次输入新密码')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormFieldRow>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <FormDialogFooter
          onCancel={() => onOpenChange(false)}
          confirmText={t('确认重置')}
          cancelText={t('取消')}
          confirmDisabled={!password || !confirmPassword}
          loading={submitting}
        />
        </form>
      </DialogContent>
    </Dialog>
  )
}
