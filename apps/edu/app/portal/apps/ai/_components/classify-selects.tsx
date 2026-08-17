'use client'

// 分类字段选择器（v2.4）：所属院系/所属专业（+知识库类型），供知识库/智能体新增与编辑表单复用。
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AI_KB_TYPE_LABELS, type AIKBType } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { useClassifyDicts } from './classify-dicts'

const NONE = '__none__'

export interface ClassifyValue {
  majorId: string
  departmentId: string
  kbType: string
}

export function ClassifySelects({
  value,
  onChange,
  withKbType = false,
}: {
  value: ClassifyValue
  onChange: (v: ClassifyValue) => void
  withKbType?: boolean
}) {
  const t = useT()
  const { majors, departments } = useClassifyDicts()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-2">
        <Label>{t('所属院系')}</Label>
        <Select
          value={value.departmentId || NONE}
          onValueChange={(v) => onChange({ ...value, departmentId: v === NONE ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('不限')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('不限')}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t('所属专业')}</Label>
        <Select
          value={value.majorId || NONE}
          onValueChange={(v) => onChange({ ...value, majorId: v === NONE ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('不限')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('不限')}</SelectItem>
            {majors.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {withKbType && (
        <div className="space-y-2">
          <Label>{t('知识库类型')}</Label>
          <Select
            value={value.kbType || NONE}
            onValueChange={(v) => onChange({ ...value, kbType: v === NONE ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('不限')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t('不限')}</SelectItem>
              {(Object.entries(AI_KB_TYPE_LABELS) as [AIKBType, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {t(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
