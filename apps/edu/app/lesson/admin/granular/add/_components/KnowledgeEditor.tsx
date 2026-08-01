'use client'

import { useState, useRef } from 'react'
import { X, Link2, PenLine } from 'lucide-react'

interface KnowledgePoint {
  id: string
  name: string
  linked: boolean
}

// 知识图谱节点应由后端知识图谱 API 提供，默认空状态
const GRAPH_NODES: string[] = []

export default function KnowledgeEditor() {
  const [points, setPoints] = useState<KnowledgePoint[]>([])
  const [input, setInput] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addPoint = (name: string, linked: boolean) => {
    if (!name.trim()) return
    if (points.some((p) => p.name === name.trim())) return
    setPoints((prev) => [...prev, { id: String(Date.now()), name: name.trim(), linked }])
    setInput('')
    setShowSuggest(false)
  }

  const removePoint = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id))
  }

  const suggestions = input.trim()
    ? GRAPH_NODES.filter(
        (n) => n.toLowerCase().includes(input.toLowerCase()) && !points.some((p) => p.name === n),
      )
    : []

  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-500">
        涉及知识点（输入知识点名称，回车添加；命中知识图谱将自动关联 🔗）
      </label>
      <div className="relative">
        <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-md min-h-[42px]">
          {points.map((p) => (
            <span
              key={p.id}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                p.linked ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'
              }`}
              title={p.linked ? '已关联知识图谱节点' : '未关联知识图谱（纯文本）'}
            >
              {p.linked ? <Link2 className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
              {p.name}
              <button
                onClick={() => removePoint(p.id)}
                className="ml-0.5 text-current/50 hover:text-current"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setShowSuggest(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const matched = GRAPH_NODES.find((n) => n.toLowerCase() === input.toLowerCase())
                addPoint(input, !!matched)
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder={points.length === 0 ? '输入知识点...' : ''}
            className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
          />
        </div>

        {showSuggest && input.trim() && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestions.length > 0 && (
              <>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addPoint(s, true)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Link2 className="w-3 h-3 text-indigo-500" />
                    <span className="text-indigo-600">{s}</span>
                    <span className="ml-auto text-[10px] text-gray-400">知识图谱</span>
                  </button>
                ))}
              </>
            )}
            <button
              onClick={() => addPoint(input, false)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
            >
              <PenLine className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">作为纯文本添加 &quot;{input}&quot;</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
