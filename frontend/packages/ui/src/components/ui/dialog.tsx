'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DismissableLayerPrimitive from '@radix-ui/react-dismissable-layer'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { shouldBlockClose } from '../../lib/unsaved-changes'
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard'
import { ConfirmDialog } from '../shared/confirm-dialog'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

/**
 * 将指定内容注册为上层 Dialog 的 DismissableLayer branch：
 * 对 branch 内元素的 pointerdown/focus 视作“弹窗内部”，不会触发外层 Dialog 的点击外部关闭。
 * 典型场景：在 Dialog 内部通过 portal 渲染的次级浮层（如资源预览弹窗）。
 */
function DialogBranch({ ...props }: React.ComponentProps<typeof DismissableLayerPrimitive.Branch>) {
  return <DismissableLayerPrimitive.Branch data-slot="dialog-branch" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

/** 「未保存内容」二次确认文案（全局统一，见 docs/spec/05-prototype-interaction.md §3.2） */
const UNSAVED_CONFIRM_TITLE = '确认离开？未保存内容将丢失'
const UNSAVED_CONFIRM_DESCRIPTION = '弹窗中已填写的内容尚未保存，离开将丢失这些内容。'

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = 'default',
  unsavedGuard = 'auto',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  size?: 'sm' | 'default' | 'lg' | 'xl' | 'full'
  /**
   * 关闭前「未保存内容」守卫，覆盖遮罩点击 / ESC / 右上角 X 三条误关闭路径：
   * - `'auto'`（默认）：自动检测弹窗内表单是否被用户改动过，改动过才二次确认，空表单直接关闭；
   * - `true`：强制视为有未保存内容（画布/自定义编辑器等 DOM 检测不到的场景）；
   * - `false`：关闭守卫（纯展示弹窗、弹窗内即时保存的场景）。
   *
   * 表单内不算「内容」的控件（搜索框等）可加 `data-unsaved-ignore` 排除。
   */
  unsavedGuard?: boolean | 'auto'
}) {
  const {
    setNode: setContentNode,
    nodeRef: contentRef,
    hasUnsavedChanges,
  } = useUnsavedChangesGuard<HTMLDivElement>(unsavedGuard === 'auto')
  const forceCloseRef = React.useRef<HTMLButtonElement>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const guardEnabled = unsavedGuard !== false

  /** 拦截关闭：有未保存内容时弹二次确认，返回 true 表示本次关闭已被拦截 */
  const blockClose = React.useCallback(() => {
    if (!shouldBlockClose(unsavedGuard, hasUnsavedChanges)) return false
    setConfirmOpen(true)
    return true
  }, [unsavedGuard, hasUnsavedChanges])

  /** 用户确认放弃：先让确认框退场，下一帧再关外层弹窗（避免嵌套 modal 同帧卸载） */
  const confirmDiscard = React.useCallback(() => {
    setConfirmOpen(false)
    requestAnimationFrame(() => forceCloseRef.current?.click())
  }, [])

  const focusFirstFocusable = React.useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const selector =
      'button:not([disabled]):not([data-dialog-force-close]), [href]:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([data-slot="dialog-content"])'
    const firstFocusable = content.querySelector<HTMLElement>(selector)
    firstFocusable?.focus({ preventScroll: true })
  }, [contentRef])

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        {...props}
        ref={setContentNode}
        data-slot="dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 max-h-[calc(100dvh-2rem)] overflow-y-auto',
          {
            'sm:max-w-lg': size === 'default',
            'sm:max-w-md': size === 'sm',
            'sm:max-w-2xl': size === 'lg',
            'sm:max-w-4xl': size === 'xl',
            '!w-[95vw] sm:!max-w-none !p-0 !gap-0 overflow-hidden max-h-[100dvh]': size === 'full',
          },
          className,
        )}
        onOpenAutoFocus={(e) => {
          props.onOpenAutoFocus?.(e)
          if (!e.defaultPrevented) {
            e.preventDefault()
            requestAnimationFrame(focusFirstFocusable)
          }
        }}
        onFocusCapture={(e) => {
          props.onFocusCapture?.(e)
          if (e.target === e.currentTarget) {
            e.preventDefault()
            e.stopPropagation()
            requestAnimationFrame(focusFirstFocusable)
          }
        }}
        onInteractOutside={(e) => {
          // Radix 顺序为 onPointerDownOutside/onFocusOutside → onInteractOutside → onDismiss；
          // 挂在最后一环才能尊重消费方（以及 Radix 自身的右键判定）已 preventDefault 的关闭
          props.onInteractOutside?.(e)
          if (e.defaultPrevented) return
          if (blockClose()) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          props.onEscapeKeyDown?.(e)
          if (e.defaultPrevented) return
          if (blockClose()) e.preventDefault()
        }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            onClick={(e) => {
              // preventDefault 会阻断 Radix Close 内置的关闭（composeEventHandlers 检查默认行为）
              if (blockClose()) e.preventDefault()
            }}
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {/*
         * 守卫件必须挂在 Content 内部：DialogPortal 对每个子节点做 Presence + Portal asChild，
         * 需要能接 ref 的单个元素，Fragment 子节点整支不会渲染（确认框会消失）。
         * ConfirmDialog 自带 portal，位置在这里不影响它渲染到 body。
         */}
        {guardEnabled && (
          <DialogPrimitive.Close
            ref={forceCloseRef}
            data-dialog-force-close=""
            aria-hidden
            tabIndex={-1}
            className="hidden"
          />
        )}
        {guardEnabled && (
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={UNSAVED_CONFIRM_TITLE}
            description={UNSAVED_CONFIRM_DESCRIPTION}
            confirmText="离开"
            cancelText="继续编辑"
            variant="destructive"
            onConfirm={confirmDiscard}
          />
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBranch,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
