'use client'

import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/shared/date-input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

export interface ExamActivationValue {
  activationMode?: string
  scheduledTime?: string
  scheduledEndTime?: string
}

interface ExamActivationConfigProps {
  value: ExamActivationValue
  onChange: (updates: Partial<ExamActivationValue>) => void
}

/**
 * 测评启用条件公共配置：手动启用 / 定时启用（起止时间）/ 随时作答。
 * 场景任务与课程节点的试卷/题库/随堂测测评方式共用，生成考试安排时按此配置落库起止时间窗。
 */
export function ExamActivationConfig({ value, onChange }: ExamActivationConfigProps) {
  const t = useT()
  const mode = value.activationMode ?? 'manual'
  return (
    <div className="mt-4 pt-4 border-t">
      <Label className="text-xs text-gray-500 mb-2">{t('启用条件')}</Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
        {[
          { key: 'manual', label: '手动启用', desc: '老师手动开启后学生可作答' },
          {
            key: 'scheduled',
            label: '定时启用',
            desc: '预设开始结束时间，到时间自动开启关闭',
          },
          {
            key: 'always',
            label: '随时作答',
            desc: '创建后立即开放，学生随时可进入作答',
          },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => onChange({ activationMode: m.key })}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-all',
              mode === m.key
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                  mode === m.key ? 'bg-primary border-primary' : 'border-gray-300',
                )}
              >
                {mode === m.key && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-xs font-medium">{t(m.label)}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 ml-6">{t(m.desc)}</p>
          </button>
        ))}
      </div>
      {mode === 'scheduled' && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormFieldRow label={t('启用时间')} labelClassName="text-xs text-gray-500">
            <DateInput
              type="datetime-local"
              value={value.scheduledTime ?? ''}
              onChange={(e) => onChange({ scheduledTime: e.target.value })}
              onFocus={(e) => e.currentTarget.showPicker?.()}
              className="text-sm"
            />
          </FormFieldRow>
          <FormFieldRow label={t('停用时间')} labelClassName="text-xs text-gray-500">
            <DateInput
              type="datetime-local"
              value={value.scheduledEndTime ?? ''}
              onChange={(e) => onChange({ scheduledEndTime: e.target.value })}
              onFocus={(e) => e.currentTarget.showPicker?.()}
              className="text-sm"
            />
          </FormFieldRow>
        </div>
      )}
    </div>
  )
}
