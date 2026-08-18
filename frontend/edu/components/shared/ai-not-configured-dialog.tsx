'use client'

import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Settings } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

/**
 * AI 未配置引导弹窗（412 ai_not_configured 统一入口）。
 * 配合 lib/ai/use-ai-assist.ts 的 useAiNotConfigured 使用：
 * <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
 */
export function AiNotConfiguredDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            {t('尚未配置 AI 服务')}
          </DialogTitle>
          <DialogDescription>
            {t('请先在 系统管理 > 租户信息 中配置 AI 服务，再使用 AI 辅助编写')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('取消')}
          </Button>
          <Button asChild onClick={() => onOpenChange(false)}>
            <Link to="/portal/apps/system/tenant">{t('前往配置')}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
