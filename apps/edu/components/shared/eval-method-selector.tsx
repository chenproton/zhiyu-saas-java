'use client'

import { useState } from 'react'
import {
  Database,
  ClipboardList,
  FileQuestion,
  Gavel,
  FolderCheck,
  BookOpen,
  CheckCircle2,
  Package,
  Shield,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n/locale-provider'
import { cn } from '@/lib/utils'

type EvalMethodKey =
  'question_bank' | 'paper' | 'quiz' | 'random_draw' | 'review' | 'outcome' | 'homework'

export interface EvaluationMethodOption {
  key: EvalMethodKey | string
  label: string
  icon: React.ReactNode
  color: string
  available: boolean
  desc: string
  primaryCategory: 'platform' | 'industry'
  secondaryCategory: string
}

export const EVALUATION_METHOD_OPTIONS: EvaluationMethodOption[] = [
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
    key: 'quiz',
    label: '随堂测',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-red-50 text-red-600 border-red-200',
    available: true,
    desc: '课堂即时测验',
    primaryCategory: 'platform',
    secondaryCategory: '知识评价',
  },
  {
    key: 'random_draw',
    label: '现场问答',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    available: true,
    desc: '从题库抽取题目，教师现场提问',
    primaryCategory: 'platform',
    secondaryCategory: '过程评价',
  },
  {
    key: 'review',
    label: '现场评审',
    icon: <Gavel className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    available: true,
    desc: '教师根据表现/材料给评价点打分',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
  {
    key: 'outcome',
    label: '成果评价',
    icon: <FolderCheck className="h-5 w-5" />,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    available: true,
    desc: '对学生成果进行评价',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
  {
    key: 'homework',
    label: '作业',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    available: true,
    desc: '学生提交作业进行评价',
    primaryCategory: 'platform',
    secondaryCategory: '成果评价',
  },
  {
    key: 'wms_inbound',
    label: 'WMS(入库单)自动化评分',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    available: false,
    desc: '基于 WMS 入库单操作的自动化评分',
    primaryCategory: 'industry',
    secondaryCategory: '智慧物流',
  },
  {
    key: 'wms_outbound',
    label: 'WMS(出库单)自动化评分',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    available: false,
    desc: '基于 WMS 出库单操作的自动化评分',
    primaryCategory: 'industry',
    secondaryCategory: '智慧物流',
  },
  {
    key: 'wms_wave',
    label: 'WMS(波次分拣)自动化评分',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    available: false,
    desc: '基于 WMS 波次分拣操作的自动化评分',
    primaryCategory: 'industry',
    secondaryCategory: '智慧物流',
  },
  {
    key: 'network_traffic',
    label: '网络流量分析自助评价',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    available: false,
    desc: '基于网络流量分析的自助评价',
    primaryCategory: 'industry',
    secondaryCategory: '网络安全',
  },
  {
    key: 'cyber_range',
    label: '网络靶场自助评价',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    available: false,
    desc: '基于网络靶场环境的自助评价',
    primaryCategory: 'industry',
    secondaryCategory: '网络安全',
  },
]

interface EvalMethodSelectorProps {
  value?: string[]
  onChange?: (methods: string[]) => void
}

export function EvalMethodSelector({ value = [], onChange }: EvalMethodSelectorProps) {
  const t = useT()
  const [primaryTab, setPrimaryTab] = useState<'platform' | 'industry'>('platform')
  const [secondaryTab, setSecondaryTab] = useState('全部')

  const primaryTabs = [
    { key: 'platform' as const, label: t('平台通用') },
    { key: 'industry' as const, label: t('行业专属') },
  ]

  const secondaryTabsMap: Record<string, string[]> = {
    platform: ['全部', '知识评价', '过程评价', '成果评价'],
    industry: ['全部', '智慧物流', '网络安全'],
  }

  const methodOptions = EVALUATION_METHOD_OPTIONS.map((m) => ({
    ...m,
    label: t(m.label),
    desc: t(m.desc),
    secondaryCategory: t(m.secondaryCategory),
  }))

  const toggleMethod = (key: string) => {
    const opt = EVALUATION_METHOD_OPTIONS.find((o) => o.key === key)
    if (!opt || !opt.available) return
    const enabled = value.includes(key)
    const newMethods = enabled ? value.filter((m) => m !== key) : [...value, key]
    onChange?.(newMethods)
  }

  const secondaryTabs = secondaryTabsMap[primaryTab]
  const filteredMethods = methodOptions.filter((m) => {
    if (m.primaryCategory !== primaryTab) return false
    if (secondaryTab === '全部') return true
    return m.secondaryCategory === t(secondaryTab)
  })

  return (
    <div className="space-y-4">
      {/* 分类 tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        {primaryTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
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
      <div className="flex items-center gap-2">
        {secondaryTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSecondaryTab(tab)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors border',
              secondaryTab === tab
                ? 'border-primary text-primary bg-primary/5'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* 测评方式网格 */}
      <div className="grid grid-cols-2 gap-2">
        {filteredMethods.map((method) => {
          const enabled = value.includes(method.key)
          return (
            <button
              key={method.key}
              type="button"
              disabled={!method.available}
              onClick={() => toggleMethod(method.key)}
              className={cn(
                'p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1.5 relative overflow-hidden',
                !method.available
                  ? 'opacity-50 cursor-not-allowed bg-white border-gray-200'
                  : enabled
                    ? 'border-primary bg-white ring-1 ring-primary/20 shadow-sm'
                    : 'border-gray-200 hover:border-primary/40 bg-white hover:shadow-sm',
              )}
            >
              {!method.available && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <span className="text-xl font-bold text-gray-300/60 rotate-[-12deg] select-none border-2 border-gray-300/40 px-3 py-1 rounded">
                    {t('未开通')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      method.available ? method.color : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {method.icon}
                  </div>
                  <div>
                    <p
                      className={cn('text-sm font-semibold', !method.available && 'text-gray-400')}
                    >
                      {method.label}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{method.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {enabled && (
                    <div className="flex items-center gap-1.5 text-primary text-xs font-medium bg-primary/5 px-2 py-1 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('已开通')}
                    </div>
                  )}
                  {!method.available && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-gray-400 border-gray-300 bg-white"
                    >
                      {t('未开通')}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
