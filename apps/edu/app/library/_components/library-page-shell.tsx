'use client'

import type { ReactNode } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

interface LibraryPageShellProps<T> {
  title: string
  statLabel: string
  statIcon: ReactNode
  statGradient: string
  statCount: number
  searchPlaceholder: string
  searchQuery: string
  onSearchChange: (q: string) => void
  onAdd: () => void
  addLabel: string
  loading: boolean
  items: T[]
  emptyMessage?: string
  tableHeaders: ReactNode
  tableBody: (item: T) => ReactNode
  deleteTarget: string | null
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  deleteLabel?: string
  dialog: ReactNode
  children?: ReactNode
}

export function LibraryPageShell<T>({
  title,
  statLabel,
  statIcon,
  statGradient,
  statCount,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  onAdd,
  addLabel,
  loading,
  items,
  emptyMessage = '暂无数据',
  tableHeaders,
  tableBody,
  deleteTarget,
  onDeleteCancel,
  onDeleteConfirm,
  deleteLabel = '此资源',
  dialog,
  children,
}: LibraryPageShellProps<T>) {
  return (
    <div className="p-6 space-y-5">
      <Card className={`border-0 shadow-sm bg-gradient-to-br ${statGradient}`}>
        <CardContent className="p-4 flex items-center gap-3">
          {statIcon}
          <div>
            <div className="text-2xl font-bold">{statCount}</div>
            <div className="text-xs opacity-70">{statLabel}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Button onClick={onAdd} size="sm">
            <Plus className="size-4 mr-1" />
            {addLabel}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <Button variant="ghost" size="sm" onClick={() => onSearchChange('')}>
                清除
              </Button>
            )}
          </div>
          {children}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">{tableHeaders}</TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={99} className="p-12 text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={99} className="p-12 text-center text-muted-foreground">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => tableBody(item))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) onDeleteCancel()
        }}
        title="确认删除"
        description={`确定要删除该${deleteLabel}吗？此操作不可恢复。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={onDeleteConfirm}
      />

      {dialog}
    </div>
  )
}
