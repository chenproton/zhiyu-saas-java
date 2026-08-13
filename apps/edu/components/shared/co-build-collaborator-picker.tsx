'use client'

// 共建岗位编辑页共建人选择器（partner 端）：数据源为合作学校共建人候选接口
// （学校教师 + 企业专家），保存值为可写回 collaborators 的 users.id 数组。
import { useMemo, useState } from 'react'
import { Briefcase, GraduationCap, Search, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { partnerCobuildSchoolApi } from '@/lib/api'
import type { CoBuildUserOption } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

interface CoBuildCollaboratorPickerProps {
  schoolTenantId: string
  value: string[]
  onChange: (userIds: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function CoBuildCollaboratorPicker({
  schoolTenantId,
  value,
  onChange,
  placeholder,
  disabled = false,
}: CoBuildCollaboratorPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<CoBuildUserOption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const loadOptions = async () => {
    if (options !== null) return
    setLoading(true)
    try {
      const res = await partnerCobuildSchoolApi.coBuilders(schoolTenantId)
      setOptions(res.items || [])
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  const optionMap = useMemo(() => {
    const map = new Map<string, CoBuildUserOption>()
    ;(options || []).forEach((o) => map.set(o.id, o))
    return map
  }, [options])

  const selectedNames = useMemo(
    () =>
      value
        .map((id) => optionMap.get(id))
        .filter((o): o is CoBuildUserOption => Boolean(o))
        .map((o) => o.name),
    [value, optionMap],
  )

  const filtered = useMemo(() => {
    if (!options) return []
    const kw = search.trim().toLowerCase()
    if (!kw) return options
    return options.filter((o) => o.name.toLowerCase().includes(kw))
  }, [options, search])

  const teachers = filtered.filter((o) => o.group === 'teacher')
  const experts = filtered.filter((o) => o.group === 'expert')

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const selectedSet = useMemo(() => new Set(value), [value])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedNames.length > 0 ? (
          selectedNames.map((name, i) => (
            <Badge key={value[i]} variant="secondary" className="gap-1">
              {name}
              {!disabled && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => toggle(value[i])}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">
            {placeholder || t('点击选择共建人')}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            setOpen(true)
            loadOptions()
          }}
        >
          {t('选择')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('选择共建人')}</DialogTitle>
            <DialogDescription>
              {t('可从合作学校的教师与企业专家中选择，共同维护该岗位。')}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              autoComplete="off"
              className="pl-8"
              placeholder={t('搜索姓名...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
            {loading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loading && teachers.length === 0 && experts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('暂无符合条件的共建人')}
              </p>
            )}
            {teachers.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {t('学校教师')}
                </p>
                <div className="space-y-1">
                  {teachers.map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer"
                    >
                      <Checkbox checked={selectedSet.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                      <span className="text-sm">{o.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {experts.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" />
                  {t('企业专家')}
                </p>
                <div className="space-y-1">
                  {experts.map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer"
                    >
                      <Checkbox checked={selectedSet.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                      <span className="text-sm">
                        {o.name}
                        {o.enterpriseName && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {o.enterpriseName}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              <Check className="h-4 w-4 mr-1" />
              {t('完成')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
