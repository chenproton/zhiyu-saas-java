'use client'

import { CheckCircle2, ClipboardList, Database, BookOpen, FileQuestion } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface EvalMethodOption {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  available: boolean
  desc: string
  primaryCategory: 'platform' | 'industry'
  secondaryCategory: string
}

interface EvaluationMethodSelectorProps {
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  allowedKeys?: string[]
}

const evaluationMethodOptions: EvalMethodOption[] = [
  {
    key: 'paper',
    label: '试卷',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-green-50 text-green-600 border-green-200',
    available: true,
    desc: '使用固定试卷进行考核',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  {
    key: 'question_bank',
    label: '题库',
    icon: <Database className="h-5 w-5" />,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    available: true,
    desc: '从题库选题组成测评资源',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  {
    key: 'quiz',
    label: '随堂测',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    available: true,
    desc: '课堂即时测验',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  {
    key: 'exam',
    label: '作业',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    available: true,
    desc: '组织标准化作业进行考核',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
]

export function EvaluationMethodSelector({
  selectedKeys,
  onChange,
  allowedKeys,
}: EvaluationMethodSelectorProps) {
  const [primaryTab, setPrimaryTab] = useState<'platform' | 'industry'>('platform')
  const [secondaryTab, setSecondaryTab] = useState('全部')

  const primaryTabs = [
    { key: 'platform' as const, label: '平台通用' },
    { key: 'industry' as const, label: '行业专属' },
  ]

  const secondaryTabsMap: Record<string, string[]> = {
    platform: ['全部', '知识评价', '成果评价'],
    industry: ['全部'],
  }

  const toggleMethod = (key: string) => {
    const opts = evaluationMethodOptions.find((o) => o.key === key)
    if (!opts || !opts.available) return
    const enabled = selectedKeys.includes(key)
    onChange(enabled ? selectedKeys.filter((m) => m !== key) : [...selectedKeys, key])
  }

  const visibleOptions = allowedKeys
    ? evaluationMethodOptions.filter((o) => allowedKeys.includes(o.key))
    : evaluationMethodOptions

  const filteredMethods = visibleOptions.filter((m) => {
    if (m.primaryCategory !== primaryTab) return false
    if (secondaryTab === '全部') return true
    return m.secondaryCategory === secondaryTab
  })

  return (
    <div className="space-y-4">
      {/* 一级分类 */}
      <div className="flex items-center gap-2 border-b pb-2">
        {primaryTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setPrimaryTab(tab.key)
              setSecondaryTab('全部')
            }}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              primaryTab === tab.key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 二级分类 */}
      <div className="flex items-center gap-2">
        {secondaryTabsMap[primaryTab].map((tab) => (
          <button
            key={tab}
            onClick={() => setSecondaryTab(tab)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors border',
              secondaryTab === tab
                ? 'border-primary text-primary bg-primary/5'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 测评方式网格 */}
      <div className="grid grid-cols-2 gap-3">
        {filteredMethods.map((method) => {
          const enabled = selectedKeys.includes(method.key)
          return (
            <button
              key={method.key}
              onClick={() => toggleMethod(method.key)}
              className={cn(
                'p-4 rounded-xl border text-left transition-all flex flex-col gap-2 relative overflow-hidden',
                enabled
                  ? 'border-primary bg-white ring-1 ring-primary/20 shadow-sm'
                  : 'border-gray-200 hover:border-primary/40 bg-white hover:shadow-sm',
              )}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-lg border', method.color)}>{method.icon}</div>
                  <div>
                    <p className="text-sm font-semibold">{method.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{method.desc}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {method.secondaryCategory}
                  </Badge>
                  {enabled && (
                    <div className="flex items-center gap-1 text-primary text-xs font-medium bg-primary/5 px-2 py-1 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已选择
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {filteredMethods.length === 0 && (
        <div className="p-12 text-center text-gray-400 border border-dashed rounded-xl">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">该分类下暂无可用测评方式</p>
        </div>
      )}

      {selectedKeys.length === 0 && filteredMethods.length > 0 && (
        <div className="p-4 text-center text-gray-400 border border-dashed rounded-xl text-sm">
          请选择至少一种评价方式
        </div>
      )}
    </div>
  )
}
