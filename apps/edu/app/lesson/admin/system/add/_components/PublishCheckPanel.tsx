'use client'

import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import { useT } from '@/lib/i18n/locale-provider'

interface PublishCheckPanelProps {
  node: SystemCourseNode | undefined
  hideEval?: boolean
  hideDetailedDescription?: boolean
}

interface CheckItem {
  key: string
  label: string
  check: (node: SystemCourseNode) => boolean
  getStatus: (
    node: SystemCourseNode,
    t: (key: string, vars?: Record<string, string | number>) => string,
  ) => string
}

const CHECK_ITEMS: CheckItem[] = [
  {
    key: 'name',
    label: '节点名称',
    check: (node) => !!node.name?.trim(),
    getStatus: (node, t) => t('已填写：{n}', { n: node.name ?? '' }),
  },
  {
    key: 'goals',
    label: '学习目标',
    check: (node) => !!node.teachingGoals?.trim(),
    getStatus: (node, t) => {
      const lines = node.teachingGoals?.split('\n').filter((l) => l.trim()) ?? []
      return t('已填写：{n} 条目标', { n: lines.length })
    },
  },
  {
    key: 'knowledge',
    label: '涉及知识点',
    check: (node) => (node.knowledgePoints?.length ?? 0) > 0,
    getStatus: (node, t) => t('已关联：{n} 个知识点', { n: node.knowledgePoints?.length ?? 0 }),
  },
  {
    key: 'duration',
    label: '预估课时',
    check: (node) => typeof node.duration === 'number' && node.duration > 0,
    getStatus: (node, t) => t('已设置：{n} 课时', { n: node.duration ?? 0 }),
  },
  {
    key: 'resources',
    label: '课程资源',
    check: (node) => (node.resources?.length ?? 0) > 0,
    getStatus: (node, t) => t('已上传：{n} 个文件', { n: node.resources?.length ?? 0 }),
  },
  {
    key: 'detailedDescription',
    label: '详细描述',
    check: (node) => !!node.detailedDescription?.trim(),
    getStatus: (node, t) => {
      const len = node.detailedDescription?.length ?? 0
      return len > 0 ? t('已填写：{n} 字符', { n: len }) : t('未填写详细描述')
    },
  },
]

export default function PublishCheckPanel({
  node,
  hideEval = false,
  hideDetailedDescription = false,
}: PublishCheckPanelProps) {
  const t = useT()
  const nodeEvalData = (node?.evalData || {}) as {
    methods?: string[]
    evalRuleConfig?: Record<string, any>
  }
  const evalMethods = nodeEvalData.methods || nodeEvalData.evalRuleConfig?.evaluationMethods || []
  const evalCheck: CheckItem & { passed: boolean; statusText: string } = {
    key: 'nodeEval',
    label: '节点评价规则',
    check: () => evalMethods.length > 0,
    getStatus: () => t('已配置：{n} 种测评方式', { n: evalMethods.length }),
    passed: evalMethods.length > 0,
    statusText:
      evalMethods.length > 0
        ? t('已配置：{n} 种测评方式', { n: evalMethods.length })
        : t('未配置节点评价规则'),
  }

  if (!node) {
    return (
      <aside className="w-64 shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-[88px]">
          {!hideEval && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2 p-2 rounded ${evalCheck.passed ? '' : 'bg-amber-50'}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${evalCheck.passed ? 'bg-green-100' : 'bg-amber-100'}`}
                >
                  {evalCheck.passed ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800">{t(evalCheck.label)}</p>
                  <p
                    className={`text-[10px] truncate ${evalCheck.passed ? 'text-green-600' : 'text-amber-600'}`}
                  >
                    {evalCheck.statusText}
                  </p>
                </div>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-400 text-center py-4 mt-2">{t('请选择一个节点查看完整检查')}</p>
        </div>
      </aside>
    )
  }

  const items = CHECK_ITEMS.filter(
    (item) => !(hideDetailedDescription && item.key === 'detailedDescription'),
  )

  const results = items.map((item) => ({
    ...item,
    passed: item.check(node),
    statusText: item.check(node)
      ? item.getStatus(node, t)
      : t('未设置{n}', { n: t(item.label) }),
  }))

  if (!hideEval) {
    results.push(evalCheck)
  }

  const completed = results.filter((r) => r.passed).length
  const total = results.length
  const allDone = completed === total

  const emptyFields = results.filter((r) => !r.passed).map((r) => r.label)

  return (
    <aside className="w-64 shrink-0">
      <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-[88px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
            {t('发布检查')}
          </h3>
          <span className="text-xs text-gray-400">{t('共 {n} 项', { n: total })}</span>
        </div>
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.key}
              className={`flex items-center gap-2 p-2 rounded ${r.passed ? '' : 'bg-amber-50'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  r.passed ? 'bg-green-100' : 'bg-amber-100'
                }`}
              >
                {r.passed ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800">{t(r.label)}</p>
                <p
                  className={`text-[10px] truncate ${
                    r.passed ? 'text-green-600' : 'text-amber-600'
                  }`}
                >
                  {r.statusText}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${allDone ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="text-xs text-gray-700">
              {t('{completed}/{total} 项已完成', { completed, total })}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                allDone ? 'bg-green-500' : 'bg-amber-500'
              }`}
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            {allDone
              ? t('💡 所有检查项已完成，可以发布课程')
              : t('💡 建议完善{n}，提升课程规划准确性', {
                  n: emptyFields.map((l) => t(l)).join('、'),
                })}
          </p>
        </div>
      </div>
    </aside>
  )
}
