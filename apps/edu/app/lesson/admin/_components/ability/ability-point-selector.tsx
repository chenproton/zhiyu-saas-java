'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, X, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

export interface AbilityPointItem {
  id: string
  name: string
  code?: string
  description?: string
}

interface AbilityPointSelectorProps {
  selected: AbilityPointItem[]
  pool: AbilityPointItem[]
  onChange?: (selected: AbilityPointItem[]) => void
  onAddCustom?: (name: string, description?: string) => void
}

export function AbilityPointSelector({
  selected,
  pool,
  onChange,
  onAddCustom,
}: AbilityPointSelectorProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pool
    return pool.filter(
      (ap) =>
        (ap.name || '').toLowerCase().includes(q) ||
        (ap.code || '').toLowerCase().includes(q) ||
        (ap.description || '').toLowerCase().includes(q),
    )
  }, [pool, search])

  const toggle = (ap: AbilityPointItem) => {
    const exists = selected.find((s) => s.id === ap.id)
    if (exists) {
      onChange?.(selected.filter((s) => s.id !== ap.id))
    } else {
      onChange?.([...selected, ap])
    }
  }

  const handleAddCustom = () => {
    if (!newName.trim()) return
    onAddCustom?.(newName.trim(), newDesc.trim())
    setNewName('')
    setNewDesc('')
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((ap) => (
            <Badge key={ap.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
              <Award className="h-3 w-3" />
              <span>{ap.name}</span>
              <button onClick={() => toggle(ap)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs h-9">
            <Award className="h-3.5 w-3.5 mr-1.5" />
            {selected.length > 0 ? t('调整能力点') : t('关联能力点')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('关联能力点')}</DialogTitle>
          </DialogHeader>
          <div className="relative my-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('搜索能力点名称、编码、描述')}
              className="pl-9 text-sm h-9"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 && !adding && (
              <p className="text-sm text-gray-400 text-center py-4">{t('未找到匹配的能力点')}</p>
            )}
            {filtered.map((ap) => {
              const isSelected = selected.some((s) => s.id === ap.id)
              return (
                <button
                  key={ap.id}
                  onClick={() => toggle(ap)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-gray-200 hover:border-primary/40 bg-white',
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5',
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300',
                    )}
                  >
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ap.name}</p>
                    {ap.code && <p className="text-[10px] text-gray-400">{ap.code}</p>}
                    {ap.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{ap.description}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {adding ? (
            <div className="space-y-2 py-2 border-t">
              <Label className="text-xs">{t('新增能力点')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('名称')}
                className="h-9 text-sm"
              />
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t('描述（可选）')}
                className="h-9 text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setAdding(false)}
                >
                  {t('取消')}
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={handleAddCustom}
                  disabled={!newName.trim()}
                >
                  {t('添加')}
                </Button>
              </div>
            </div>
          ) : (
            onAddCustom && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs mt-2"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('自定义能力点')}
              </Button>
            )
          )}
          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>
              {t('完成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
