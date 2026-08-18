'use client'

import { QRCodeSVG } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useT } from '@/lib/i18n/locale-provider'
import { buildMobileAccessUrl } from './mobile-access-url'

interface MobileAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileAccessDialog({ open, onOpenChange }: MobileAccessDialogProps) {
  const t = useT()
  const qrValue =
    typeof window !== 'undefined' && open
      ? buildMobileAccessUrl(
          import.meta.env.VITE_SITE_URL || window.location.origin,
          window.location.pathname,
          window.location.search,
        )
      : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="flex flex-col items-center gap-4">
        <DialogHeader className="text-center">
          <DialogTitle>{t('移动端访问')}</DialogTitle>
          <DialogDescription>{t('使用手机扫描二维码，打开当前页面')}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border p-3">
          <QRCodeSVG value={qrValue} size={168} level="M" />
        </div>
        <p className="max-w-full text-center text-xs text-muted-foreground break-all">{qrValue}</p>
      </DialogContent>
    </Dialog>
  )
}
