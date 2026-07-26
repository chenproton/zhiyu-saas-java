"use client"

import { CheckCircle2, AlertCircle } from "lucide-react"
import type { SystemCourseNode, NodeRefType } from "@/lib/types/lesson-source"

interface PublishCheckPanelProps {
  node: SystemCourseNode | undefined
}

interface CheckItem {
  key: string
  label: string
  check: (node: SystemCourseNode) => boolean
  getStatus: (node: SystemCourseNode) => string
}

const CHECK_ITEMS: CheckItem[] = [
  {
    key: "name",
    label: "节点名称",
    check: (node) => !!node.name?.trim(),
    getStatus: (node) => `已填写：${node.name}`,
  },
  {
    key: "goals",
    label: "学习目标",
    check: (node) => !!node.teachingGoals?.trim(),
    getStatus: (node) => {
      const lines = node.teachingGoals?.split("\n").filter((l) => l.trim()) ?? []
      return `已填写：${lines.length} 条目标`
    },
  },
  {
    key: "knowledge",
    label: "涉及知识点",
    check: (node) => (node.knowledgePoints?.length ?? 0) > 0,
    getStatus: (node) => `已关联：${node.knowledgePoints?.length ?? 0} 个知识点`,
  },
  {
    key: "duration",
    label: "预估课时",
    check: (node) => typeof node.duration === "number" && node.duration > 0,
    getStatus: (node) => `已设置：${node.duration} 课时`,
  },
  {
    key: "resources",
    label: "课程资源",
    check: (node) => (node.resources?.length ?? 0) > 0,
    getStatus: (node) => `已上传：${node.resources?.length ?? 0} 个文件`,
  },
  {
    key: "quiz",
    label: "测验",
    check: (node) =>
      (node.quizzes?.length ?? 0) > 0 || (node.homeworks?.length ?? 0) > 0,
    getStatus: (node) => {
      const q = node.quizzes?.length ?? 0
      const h = node.homeworks?.length ?? 0
      if (q > 0 && h > 0) return `已配置：${q} 个测验, ${h} 个作业`
      if (q > 0) return `已配置：${q} 个测验`
      if (h > 0) return `已配置：${h} 个作业`
      return "未设置测验"
    },
  },
]

export default function PublishCheckPanel({ node }: PublishCheckPanelProps) {
  if (!node) {
    return (
      <aside className="w-64 shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-[88px]">
          <p className="text-sm text-gray-400 text-center py-8">请选择一个节点</p>
        </div>
      </aside>
    )
  }

  const items = CHECK_ITEMS

  const results = items.map((item) => ({
    ...item,
    passed: item.check(node),
    statusText: item.check(node) ? item.getStatus(node) : `未设置${item.label}`,
  }))

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
            发布检查
          </h3>
          <span className="text-xs text-gray-400">共 {total} 项</span>
        </div>
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.key}
              className={`flex items-center gap-2 p-2 rounded ${
                r.passed ? "" : "bg-amber-50"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  r.passed ? "bg-green-100" : "bg-amber-100"
                }`}
              >
                {r.passed ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800">{r.label}</p>
                <p
                  className={`text-[10px] truncate ${
                    r.passed ? "text-green-600" : "text-amber-600"
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
            <span
              className={`w-2 h-2 rounded-full ${
                allDone ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            <span className="text-xs text-gray-700">
              {completed}/{total} 项已完成
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                allDone ? "bg-green-500" : "bg-amber-500"
              }`}
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            {allDone
              ? "💡 所有检查项已完成，可以发布课程"
              : `💡 建议完善${emptyFields.join("、")}，提升课程规划准确性`}
          </p>
        </div>
      </div>
    </aside>
  )
}
