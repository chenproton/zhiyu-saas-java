'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

// ─── 列宽持久化与页签内同步（resizable 模式）────────────────────────────────
//
// 能力契约（见 docs/forms-tables.md §六）：
//   <Table resizable storageKey="唯一标识">
//     <TableHead columnKey="name" defaultWidth={160} minWidth={96}>名称</TableHead>
//   </Table>
// - 开启后表格切换为 table-layout: fixed，注册列按持久化/默认宽度渲染；
//   未注册 columnKey 的列自动分摊剩余宽度。
// - 列宽按浏览器 localStorage 持久化（key: zhiyu:table-widths:<storageKey>），
//   刷新/重新进入保持不变，符合「当前浏览器上保存」的需求。
// - 同 storageKey 的多表格实例（如分组视图每批次一张表）在页签内同步宽度变更。

const TABLE_WIDTHS_PREFIX = 'zhiyu:table-widths:'
const MIN_COLUMN_WIDTH = 40
const MAX_COLUMN_WIDTH = 800

/** 读取持久化列宽（SSR/隐私模式下安全返回空对象），非法值钳制到 [40, 800] */
export function loadTableWidths(storageKey: string): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(TABLE_WIDTHS_PREFIX + storageKey)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        out[key] = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, value))
      }
    }
    return out
  } catch {
    return {}
  }
}

/** 写入持久化列宽（配额/隐私模式失败时静默忽略，不影响拖拽交互） */
export function saveTableWidths(storageKey: string, widths: Record<string, number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TABLE_WIDTHS_PREFIX + storageKey, JSON.stringify(widths))
  } catch {
    // 忽略持久化失败
  }
}

/** 列宽钳制到 [minWidth, MAX_COLUMN_WIDTH] 并取整 */
export function clampColumnWidth(width: number, minWidth = 48): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(minWidth, Math.round(width)))
}

const tableWidthsListeners = new Map<string, Set<(widths: Record<string, number>) => void>>()

function subscribeTableWidths(
  storageKey: string,
  listener: (widths: Record<string, number>) => void,
): () => void {
  let set = tableWidthsListeners.get(storageKey)
  if (!set) {
    set = new Set()
    tableWidthsListeners.set(storageKey, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) tableWidthsListeners.delete(storageKey)
  }
}

function publishTableWidths(storageKey: string, widths: Record<string, number>): void {
  tableWidthsListeners.get(storageKey)?.forEach((listener) => listener(widths))
}

// ─── 表格原语 ───────────────────────────────────────────────────────────────

interface ResizableTableState {
  widths: Record<string, number>
  commitWidth: (key: string, width: number) => void
}

const ResizableTableContext = React.createContext<ResizableTableState | null>(null)

interface TableProps extends React.ComponentProps<'table'> {
  /** 开启列宽拖拽调整（需配合 TableHead 的 columnKey/defaultWidth） */
  resizable?: boolean
  /** 列宽持久化的唯一标识（localStorage key 后缀），resizable 时必填 */
  storageKey?: string
}

function Table({ resizable, storageKey, className, children, ...props }: TableProps) {
  const [widths, setWidths] = React.useState<Record<string, number>>({})
  const widthsRef = React.useRef(widths)
  widthsRef.current = widths

  // 挂载后从 localStorage 恢复；并订阅同 key 其他实例的变更（分组视图多表同步）
  React.useEffect(() => {
    if (!resizable || !storageKey) return
    const saved = loadTableWidths(storageKey)
    if (Object.keys(saved).length > 0) {
      setWidths((prev) => ({ ...prev, ...saved }))
    }
    return subscribeTableWidths(storageKey, (next) => {
      setWidths((prev) => {
        const changed = Object.keys(next).some((key) => prev[key] !== next[key])
        return changed ? { ...prev, ...next } : prev
      })
    })
  }, [resizable, storageKey])

  const commitWidth = React.useCallback(
    (key: string, width: number) => {
      const next = { ...widthsRef.current, [key]: width }
      widthsRef.current = next
      setWidths(next)
      if (storageKey) {
        saveTableWidths(storageKey, next)
        publishTableWidths(storageKey, next)
      }
    },
    [storageKey],
  )

  const ctx: ResizableTableState | null =
    resizable && storageKey ? { widths, commitWidth } : null

  return (
    <ResizableTableContext.Provider value={ctx}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto">
        <table
          data-slot="table"
          className={cn(
            'caption-bottom text-sm',
            // resizable：表格宽度 = 注册列宽之和（所见即所得，窄屏由外层 overflow-x-auto 滚动）
            ctx ? 'table-fixed w-max' : 'w-full',
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </ResizableTableContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  )
}

interface TableHeadProps extends React.ComponentProps<'th'> {
  /** 列标识；配合 Table resizable 开启该列列宽控制（宽度按此 key 持久化） */
  columnKey?: string
  /** 默认列宽（px）；localStorage 无持久化值时使用 */
  defaultWidth?: number
  /** 拖拽最小宽度（px），默认 48 */
  minWidth?: number
  /** 关闭该列拖拽手柄（宽度仍按 columnKey 生效），如全选框列 */
  resizable?: boolean
  /** 拖拽手柄的无障碍标签，默认「拖拽调整列宽」 */
  resizeLabel?: string
}

const TABLE_HEAD_BASE_CLASSES =
  'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'

function TableHead({
  className,
  style,
  columnKey,
  defaultWidth,
  minWidth = 48,
  resizable = true,
  resizeLabel = '拖拽调整列宽',
  children,
  ...props
}: TableHeadProps) {
  const ctx = React.useContext(ResizableTableContext)
  const thRef = React.useRef<HTMLTableCellElement>(null)
  const dragStartRef = React.useRef<{ x: number; width: number } | null>(null)

  const registered = !!ctx && !!columnKey
  const hasHandle = registered && resizable
  const width = registered && columnKey ? (ctx!.widths[columnKey] ?? defaultWidth) : undefined

  const applyWidth = (w: number) => {
    if (thRef.current) thRef.current.style.width = `${w}px`
  }

  const currentWidth = () =>
    thRef.current ? thRef.current.getBoundingClientRect().width : (width ?? minWidth)

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    if (!start || !ctx || !columnKey) return
    const w = clampColumnWidth(start.width + e.clientX - start.x, minWidth)
    dragStartRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    applyWidth(w)
    ctx.commitWidth(columnKey, w)
  }

  return (
    <th
      ref={thRef}
      data-slot="table-head"
      className={cn(TABLE_HEAD_BASE_CLASSES, registered && 'relative', className)}
      style={registered ? { width, ...style } : style}
      {...props}
    >
      {children}
      {hasHandle && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={resizeLabel}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault()
            dragStartRef.current = { x: e.clientX, width: currentWidth() }
            e.currentTarget.setPointerCapture(e.pointerId)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          onPointerMove={(e) => {
            const start = dragStartRef.current
            if (!start) return
            applyWidth(clampColumnWidth(start.width + e.clientX - start.x, minWidth))
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            if (!ctx || !columnKey) return
            const base = thRef.current
              ? thRef.current.getBoundingClientRect().width
              : (width ?? minWidth)
            const w = clampColumnWidth(base + (e.key === 'ArrowRight' ? 16 : -16), minWidth)
            applyWidth(w)
            ctx.commitWidth(columnKey, w)
          }}
          className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none select-none outline-none hover:bg-primary/30 focus-visible:bg-primary/50 active:bg-primary/50"
        />
      )}
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
