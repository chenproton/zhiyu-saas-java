'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import type {
  AIPositionAssistField,
  AIPositionPolish,
  AISuggestedCertificate,
} from '@/lib/api'
import type { Position } from '@/lib/types/job-source'
import { useT } from '@/lib/i18n/locale-provider'

interface AiCompareOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: Position
  suggestions: {
    polish?: AIPositionPolish
    responsibilities?: string[]
    requirements?: string[]
    careerPath?: string
    certificates?: AISuggestedCertificate[]
  }
  regenerating: AIPositionAssistField | null
  onAdopt: (field: AIPositionAssistField) => void
  onRegenerate: (field: AIPositionAssistField) => void
  onAdoptAll: () => void
}

function CompareRow({
  label,
  value,
  pre = false,
}: {
  label: string
  value: string
  pre?: boolean
}) {
  return (
    <div>
      <span className="text-xs text-gray-400 mr-1">{label}</span>
      <span className={`text-sm text-gray-700 ${pre ? 'whitespace-pre-line' : ''}`}>
        {value || '-'}
      </span>
    </div>
  )
}

function ListBlock({ items, accent = false }: { items: string[]; accent?: boolean }) {
  if (items.length === 0) return <span className="text-sm text-gray-400">-</span>
  return (
    <ol className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${accent ? 'border-purple-200 text-purple-700' : ''}`}
          >
            {i + 1}
          </Badge>
          <span className="text-gray-700">{item}</span>
        </li>
      ))}
    </ol>
  )
}

const formatSalary = (range: [number, number]) =>
  `${range[0].toLocaleString()} - ${range[1].toLocaleString()} 元/月`

/** AI 辅助编写结果对比浮层：左侧当前表单内容，右侧 AI 建议，逐项采纳（覆盖全屏，临时让出右侧封面/批次等区域） */
export function AiCompareOverlay({
  open,
  onOpenChange,
  position,
  suggestions,
  regenerating,
  onAdopt,
  onRegenerate,
  onAdoptAll,
}: AiCompareOverlayProps) {
  const t = useT()
  const [adopted, setAdopted] = useState<AIPositionAssistField[]>([])

  if (!open) return null

  const isAdopted = (field: AIPositionAssistField) => adopted.includes(field)

  const handleAdopt = (field: AIPositionAssistField) => {
    onAdopt(field)
    setAdopted((prev) => [...prev, field])
  }

  const handleAdoptAll = () => {
    onAdoptAll()
    setAdopted([])
    onOpenChange(false)
  }

  const groups: {
    field: AIPositionAssistField
    title: string
    hasSuggestion: boolean
    left: React.ReactNode
    right: React.ReactNode
  }[] = [
    {
      field: 'polish',
      title: t('基础信息'),
      hasSuggestion: !!suggestions.polish,
      left: (
        <div className="space-y-2">
          <CompareRow label={t('岗位名称：')} value={position.name} />
          <CompareRow label={t('岗位简称：')} value={position.shortName} />
          <CompareRow label={t('岗位简介：')} value={position.description} pre />
          <CompareRow label={t('参考薪资：')} value={formatSalary(position.salaryRange)} />
        </div>
      ),
      right: suggestions.polish ? (
        <div className="space-y-2">
          <CompareRow label={t('岗位名称：')} value={suggestions.polish.name} />
          <CompareRow label={t('岗位简称：')} value={suggestions.polish.shortName} />
          <CompareRow label={t('岗位简介：')} value={suggestions.polish.description} pre />
          <CompareRow
            label={t('参考薪资：')}
            value={
              suggestions.polish.salaryMin > 0 && suggestions.polish.salaryMax > 0
                ? `${suggestions.polish.salaryMin.toLocaleString()} - ${suggestions.polish.salaryMax.toLocaleString()} 元/月`
                : ''
            }
          />
        </div>
      ) : null,
    },
    {
      field: 'responsibilities',
      title: t('工作职责'),
      hasSuggestion: !!suggestions.responsibilities,
      left: <ListBlock items={position.responsibilities.map((r) => r.name)} />,
      right: suggestions.responsibilities ? (
        <ListBlock items={suggestions.responsibilities} accent />
      ) : null,
    },
    {
      field: 'requirements',
      title: t('任职要求'),
      hasSuggestion: !!suggestions.requirements,
      left: <ListBlock items={position.requirements} />,
      right: suggestions.requirements ? <ListBlock items={suggestions.requirements} accent /> : null,
    },
    {
      field: 'careerPath',
      title: t('晋升路径'),
      hasSuggestion: !!suggestions.careerPath,
      left: <CompareRow label="" value={position.careerPath} pre />,
      right: suggestions.careerPath ? (
        <CompareRow label="" value={suggestions.careerPath} pre />
      ) : null,
    },
    {
      field: 'certificates',
      title: t('相关证书'),
      hasSuggestion: !!suggestions.certificates,
      left: (
        <div className="space-y-1.5">
          {position.certificates.length === 0 ? (
            <span className="text-sm text-gray-400">-</span>
          ) : (
            position.certificates.map((c) => (
              <div key={c.id} className="text-sm text-gray-700">
                <span className="font-medium">{c.name}</span>
                {c.description && (
                  <span className="text-xs text-gray-400 ml-1">{c.description}</span>
                )}
              </div>
            ))
          )}
        </div>
      ),
      right: suggestions.certificates ? (
        <div className="space-y-1.5">
          {suggestions.certificates.map((c, i) => (
            <div key={i} className="text-sm text-gray-700">
              <span className="font-medium text-purple-800">{c.name}</span>
              {c.description && <span className="text-xs text-gray-400 ml-1">{c.description}</span>}
            </div>
          ))}
        </div>
      ) : null,
    },
  ]

  const visibleGroups = groups.filter((g) => isAdopted(g.field) || g.hasSuggestion)

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-900">{t('AI 辅助编写结果')}</h2>
            <span className="text-xs text-gray-400">{t('左右对比，逐项采纳')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />
              {t('关闭')}
            </Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleAdoptAll}>
              <Check className="h-4 w-4 mr-1" />
              {t('全部采纳')}
            </Button>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {visibleGroups.map((g) => (
          <div key={g.field} className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{g.title}</h3>
                {isAdopted(g.field) && (
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    {t('已采纳')}
                  </Badge>
                )}
              </div>
              {!isAdopted(g.field) && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onRegenerate(g.field)}
                    disabled={regenerating !== null}
                  >
                    {regenerating === g.field ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    {t('重新生成')}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                    onClick={() => handleAdopt(g.field)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {t('采纳')}
                  </Button>
                </div>
              )}
            </div>
            {isAdopted(g.field) ? (
              <div className="px-4 py-8 text-center text-sm text-green-700">
                {t('已采纳 AI 建议并应用到表单')}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-100">
                <div className="bg-white p-4 space-y-2">
                  <p className="text-xs text-gray-400 mb-2">{t('当前内容')}</p>
                  {g.left}
                </div>
                <div className="bg-purple-50/30 p-4 space-y-2">
                  <p className="text-xs text-purple-400 mb-2">{t('AI 建议')}</p>
                  {g.right}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
