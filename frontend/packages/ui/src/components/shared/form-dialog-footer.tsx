'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

export interface FormDialogFooterProps {
  onCancel: () => void
  confirmText?: React.ReactNode
  cancelText?: React.ReactNode
  confirmDisabled?: boolean
  loading?: boolean
  variant?: 'default' | 'destructive' | 'outline'
  confirmType?: 'button' | 'submit'
  extra?: React.ReactNode
}

export function FormDialogFooter({
  onCancel,
  confirmText = '保存',
  cancelText = '取消',
  confirmDisabled,
  loading = false,
  variant = 'default',
  confirmType = 'submit',
  extra,
}: FormDialogFooterProps) {
  return (
    <DialogFooter>
      {extra}
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelText}
      </Button>
      <Button type={confirmType} variant={variant} disabled={confirmDisabled} loading={loading}>
        {confirmText}
      </Button>
    </DialogFooter>
  )
}
