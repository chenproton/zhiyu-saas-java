"use client"

import { Info, Route } from "lucide-react"
import type { CareerPosition } from "@/lib/types"

interface OverviewTabProps {
  position: CareerPosition
}

const DEFAULT_CAREER_PATH = [
  { name: "实习生/助理", years: "0-1年" },
  { name: "初级工程师", years: "1-3年" },
  { name: "中级工程师", years: "3-5年" },
  { name: "高级工程师", years: "5-8年" },
  { name: "技术专家/总监", years: "8年+" },
]

export function OverviewTab({ position }: OverviewTabProps) {
  const careerPath = position.careerPath
    ? position.careerPath.split("\n").filter(Boolean).map((line) => {
        const parts = line.split(/[-—]/)
        return { name: parts[0]?.trim() || line.trim(), years: parts[1]?.trim() || "" }
      })
    : DEFAULT_CAREER_PATH

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-medium text-[#1f2937] mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-500" />
          岗位简介
        </h3>
        <p className="text-[14px] text-[#1f2937] leading-[1.8] whitespace-pre-line">
          {position.description || "暂无岗位介绍"}
        </p>
      </div>

      <div>
        <h3 className="text-base font-medium text-[#1f2937] mb-4 flex items-center gap-2">
          <Route className="w-5 h-5 text-blue-500" />
          职业发展路线
        </h3>
        <div className="flex items-center justify-center gap-4 py-5 flex-wrap">
          {careerPath.map((node, i) => (
            <div key={i} className="flex items-center gap-4">
              <div
                className={`px-6 py-3 rounded-xl text-center border-2 ${
                  i === 1
                    ? "bg-[#eff6ff] border-blue-500 text-blue-600 font-medium"
                    : "bg-[#f5f5f5] border-[#e7e5e4] text-[#64748b]"
                }`}
              >
                <div className="text-sm">{node.name}</div>
                {node.years && <small className="text-[#94a3b8] text-xs">{node.years}</small>}
              </div>
              {i < careerPath.length - 1 && (
                <svg className="w-5 h-5 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
