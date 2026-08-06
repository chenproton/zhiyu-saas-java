'use client'

import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

import { SCENE_PLATFORM_URL } from '@/lib/external-links'
import { useT } from '@/lib/i18n/locale-provider'

const GRADING_URL = `${SCENE_PLATFORM_URL}/approvals/grading`

interface GradingIframeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  className?: string
}

export function GradingIframeDialog({
  open,
  onOpenChange,
  sessionTitle,
  className,
}: GradingIframeDialogProps) {
  const t = useT()
  const [loading, setLoading] = useState(true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-amber-600" />
            {t('前往评分')}
          </DialogTitle>
          <DialogDescription>
            {sessionTitle} · {className || t('全部学生')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                <span className="text-sm text-gray-500">{t('加载评分页面...')}</span>
              </div>
            </div>
          )}
          <iframe
            src={GRADING_URL}
            className="w-full h-[70vh] border-0 rounded-lg"
            title={t('评分页面')}
            onLoad={() => setLoading(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
