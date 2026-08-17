'use client'

// YIKnow 聊天统一弹窗（v2.7.2）：全站唯一入口组件——
// /portal/apps 卡片与常用服务、落地页「立即体验」、右下角浮动机器人共用。
// 居中 + 遮罩（Dialog 自带）+ 原 demo 面板质感（毛玻璃/顶部渐变装饰线/深阴影）。
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
  onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 跳详情/对话页时回调（调用方可顺便做额外清理；弹窗本身即关闭） */
  onNavigate?: () => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[min(1240px,94vw)] w-[min(1240px,94vw)] h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl"
        style={{
          background: 'oklch(from var(--background) l c h / 0.92)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          boxShadow:
            '0 25px 60px -12px oklch(0 0 0 / 0.25), 0 8px 24px -6px oklch(0 0 0 / 0.08), inset 0 1px 0 oklch(1 1 0 / 0.06)',
        }}
      >
        <DialogTitle className="sr-only">{t('YI Know 助手')}</DialogTitle>
        {/* 顶部渐变装饰线（原 demo 面板质感） */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 rounded-t-2xl z-10 pointer-events-none" />
        {/* 打开期间保持会话状态；关闭即销毁（重新打开回到新会话视图） */}
        {open && (
          <YIKnowChat
            variant="modal"
            onNavigate={() => {
              onOpenChange(false)
              onNavigate?.()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
