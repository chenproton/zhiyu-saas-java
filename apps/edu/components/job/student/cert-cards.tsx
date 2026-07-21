"use client"

import { useState } from "react"
import { Award, Building2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import type { PositionCertificate } from "@/lib/types"

interface CertCardsProps {
  certificates: PositionCertificate[]
}

const GRADIENTS = [
  "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
  "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ffc53d 100%)",
]

export function CertCards({ certificates }: CertCardsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (certificates.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        <Award className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <div>暂无相关证书</div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-[#64748b] mb-5">
        共涉及 <strong className="text-blue-500">{certificates.length}</strong> 个相关证书
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certificates.map((cert, i) => {
          const isExpanded = expanded[cert.id]
          return (
            <div key={cert.id} className="bg-white rounded-2xl border border-[#f5f5f4] overflow-hidden transition-all hover:shadow-md hover:border-[#d9d9d9]">
              <div
                className="h-40 flex items-center justify-center text-white relative"
                style={{ background: GRADIENTS[i % GRADIENTS.length] }}
              >
                <Award className="w-14 h-14 opacity-40" />
              </div>
              <div className="p-5">
                <div className="text-base font-semibold text-[#1f2937] mb-2">{cert.name}</div>
                <div className="flex items-center gap-2 text-[13px] text-[#64748b] mb-3">
                  <Building2 className="w-4 h-4 text-[#94a3b8]" />
                  {cert.description ? cert.description.slice(0, 20) : "官方认证"}
                </div>
                {cert.description && (
                  <div className="relative mb-3">
                    <p className={`text-[13px] text-[#64748b] leading-[1.7] ${isExpanded ? "" : "line-clamp-3"}`}>
                      {cert.description}
                    </p>
                    <button
                      className="text-xs text-blue-500 font-medium inline-flex items-center gap-1 mt-1 hover:underline"
                      onClick={() => setExpanded((prev) => ({ ...prev, [cert.id]: !prev[cert.id] }))}
                    >
                      {isExpanded ? <><ChevronUp className="w-3 h-3" /> 收起</> : <><ChevronDown className="w-3 h-3" /> 展示</>}
                    </button>
                  </div>
                )}
                {cert.url ? (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#eff6ff] text-blue-500 text-[13px] hover:bg-blue-500 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> 查看证书详情
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#f5f5f5] text-[#bfbfbf] text-[13px] cursor-not-allowed">
                    <ExternalLink className="w-3.5 h-3.5" /> 暂无详情链接
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
