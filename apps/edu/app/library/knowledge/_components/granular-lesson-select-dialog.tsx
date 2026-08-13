'use client'

import { useState, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/shared/search-input'
import { useT } from '@/lib/i18n/locale-provider'

export interface GranularLessonOption {
  id: string
  name: string
  code?: string
  description?: string
}

interface GranularLessonSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  granularCourses: GranularLessonOption[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
}

export function GranularLessonSelectDialog({
  open,
  onOpenChange,
  title = '选择颗粒课',
  granularCourses,
  selectedIds,
  onChange,
}: GranularLessonSelectDialogProps) {
  const t = useT()
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () =>
      granularCourses.filter(
        (g) => !search || g.name.includes(search) || (g.code && g.code.includes(search)),
      ),
    [granularCourses, search],
  )

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  const selectedCourses = useMemo(
    () =>
      selectedIds
        .map((id) => granularCourses.find((g) => g.id === id))
        .filter(Boolean) as GranularLessonOption[],
    [selectedIds, granularCourses],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 flex-1 min-h-0 py-4">
          <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
            <SearchInput
              wrapperClassName="mb-3"
              iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              value={search}
              onChange={setSearch}
              placeholder={t('搜索颗粒课名称或编码...')}
            />
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filtered.map((gl) => {
                const isSelected = selectedIds.includes(gl.id)
                return (
                  <div
                    key={gl.id}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                    onClick={() => toggle(gl.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          isSelected ? 'bg-primary border-primary' : 'border-gray-300',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium flex-1">{gl.name}</span>
                      {gl.code && (
                        <Badge variant="outline" className="text-[10px]">
                          {gl.code}
                        </Badge>
                      )}
                    </div>
                    {gl.description ? (
                      <p className="text-xs text-gray-500 mt-1 ml-6">{gl.description}</p>
                    ) : null}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">{t('未找到匹配的颗粒课')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
            <p className="text-sm font-medium mb-3 text-gray-700">
              {t('已选择 ({n})', { n: selectedIds.length })}
            </p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {selectedCourses.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-xs">{t('从左侧选择颗粒课')}</p>
                </div>
              ) : (
                selectedCourses.map((gl) => (
                  <div
                    key={gl.id}
                    className="flex items-center gap-2 p-2 rounded border bg-gray-50"
                  >
                    <span className="text-sm flex-1 truncate">{gl.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400"
                      onClick={() => toggle(gl.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('确定')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
