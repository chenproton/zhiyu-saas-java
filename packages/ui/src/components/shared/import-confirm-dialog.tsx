'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ImportPreviewRow {
  rowNum?: number
  key?: string
  name?: string
}

export interface ImportConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel?: string
  created: number
  duplicates: number
  failed: number
  duplicateItems: ImportPreviewRow[]
  onConfirmOverwrite: () => void
  onConfirmSkip: () => void
  /** 传入后展示「新增并导入」：为重名对象追加 4 位随机后缀后按新对象导入 */
  onConfirmNew?: () => void
}

export function ImportConfirmDialog({
  open,
  onOpenChange,
  entityLabel = '数据',
  created,
  duplicates,
  failed,
  duplicateItems,
  onConfirmOverwrite,
  onConfirmSkip,
  onConfirmNew,
}: ImportConfirmDialogProps) {
  const displayedItems = duplicateItems.slice(0, 10)
  const hasMore = duplicateItems.length > 10

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            检测到 {duplicates} 条已存在{entityLabel}
          </DialogTitle>
          <DialogDescription>
            请确认处理方式：仅导入新数据不会覆盖已有记录；覆盖并继续会用文件内容替换已有记录；
            {onConfirmNew ? '新增并导入会自动为重名对象追加 4 位随机后缀后新建。' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="text-lg font-semibold text-green-600">{created}</div>
              <div className="text-xs text-muted-foreground">新增</div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="text-lg font-semibold text-amber-600">{duplicates}</div>
              <div className="text-xs text-muted-foreground">已存在</div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="text-lg font-semibold text-destructive">{failed}</div>
              <div className="text-xs text-muted-foreground">校验失败</div>
            </div>
          </div>

          {displayedItems.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                已存在记录示例（前 {displayedItems.length} 条）
              </div>
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-3">
                  {displayedItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1.5 text-sm border-b last:border-0"
                    >
                      <span className="font-medium truncate max-w-[260px]" title={item.name}>
                        {item.name || item.key}
                      </span>
                      {item.rowNum != null && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          第 {item.rowNum} 行
                        </span>
                      )}
                    </div>
                  ))}
                  {hasMore && (
                    <div className="py-1.5 text-xs text-muted-foreground text-center">
                      等共 {duplicates} 条
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="default" onClick={onConfirmSkip}>
            仅导入新数据
          </Button>
          {onConfirmNew && (
            <Button variant="default" onClick={onConfirmNew}>
              新增并导入
            </Button>
          )}
          <Button variant="default" onClick={onConfirmOverwrite}>
            覆盖并继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
