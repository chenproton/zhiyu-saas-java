'use client'

import { type ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { useT } from '@/lib/i18n/locale-provider'

export interface LogColumn<T> {
  header: string
  cell: (item: T) => ReactNode
  className?: string
}

interface LogTableShellProps<T> {
  loading: boolean
  items: T[]
  columns: LogColumn<T>[]
  emptyText: string
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function LogTableShell<T extends { id: string }>({
  loading,
  items,
  columns,
  emptyText,
  total,
  page,
  totalPages,
  onPageChange,
}: LogTableShellProps<T>) {
  const t = useT()
  return (
    <>
      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              {columns.map((col, i) => (
                <TableHead key={i} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  <span className="mt-2 block text-sm">{t('加载中...')}</span>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="border-border">
                  {columns.map((col, i) => (
                    <TableCell key={i} className={col.className}>
                      {col.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
        <span>{t('共 {total} 条记录', { total })}</span>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          disabled={loading}
        />
      </div>
    </>
  )
}
