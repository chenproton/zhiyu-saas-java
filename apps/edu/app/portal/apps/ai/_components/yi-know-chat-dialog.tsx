'use client'

// YIKnow 聊天弹窗（v2.7）：前台入口（/portal/apps 卡片、落地页「立即体验」）统一弹窗开聊，
// 避免「返回首页」按来源产生错误导航；关窗即回到来源页。体验本体复用 YIKnowChat 组件。
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { YIKnowChat } from './yi-know-chat'
import { useT } from '@/lib/i18n/locale-provider'

export function useYIKnowChatDialog() {
  const [open, setOpen] = useState(false)
  return { open, openChat: () => setOpen(true), dialogProps: { open, onOpenChange: setOpen } }
}

export function YIKnowChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(1240px,94vw)] w-[min(1240px,94vw)] h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">{t('YI Know 助手')}</DialogTitle>
        {/* 打开期间保持会话状态；关闭即销毁（回到来源页后重新打开为新会话视图） */}
        {open && <YIKnowChat variant="modal" />}
      </DialogContent>
    </Dialog>
  )
}
