'use client'

// 共建岗位编辑页共建人选择器（partner 端）：数据源为合作学校共建人候选接口
// （学校教师 + 企业专家），保存值为可写回 collaborators 的 users.id 数组。
import { useMemo, useState, useRef } from 'react'
import { Briefcase, GraduationCap, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { SearchInput } from '@/components/shared/search-input'

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
  const loadedTenantRef = useRef<string | null>(null)
  const loadSeqRef = useRef(0)
  const [prevTenantId, setPrevTenantId] = useState(schoolTenantId)

  // 切换合作学校时清空缓存（渲染期同步派生状态），确保重新拉取该租户的共建人候选
  if (prevTenantId !== schoolTenantId) {
    setPrevTenantId(schoolTenantId)
    setOptions(null)
  }

  const loadOptions = async () => {
    if (options !== null && loadedTenantRef.current === schoolTenantId) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const res = await partnerCobuildSchoolApi.coBuilders(schoolTenantId)
      if (seq !== loadSeqRef.current) return
      setOptions(res.items || [])
      loadedTenantRef.current = schoolTenantId
    } catch {
      if (seq !== loadSeqRef.current) return
      setOptions([])
      loadedTenantRef.current = schoolTenantId
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
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
        {/* 勾选即时同步给父级表单，关闭不会丢内容 → 不需要未保存守卫 */}
        <DialogContent className="sm:max-w-md" unsavedGuard={false}>
          <DialogHeader>
            <DialogTitle>{t('选择共建人')}</DialogTitle>
            <DialogDescription>
              {t('可从合作学校的教师与企业专家中选择，共同维护该岗位。')}
            </DialogDescription>
          </DialogHeader>
          <SearchInput
            iconClassName="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            inputClassName="pl-8"
            placeholder={t('搜索姓名...')}
            value={search}
            onChange={setSearch}
          />
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
