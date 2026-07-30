"use client"

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  theory: { label: "课程", color: "#2563eb", bg: "#dbeafe" },
  practice: { label: "实践", color: "#16a34a", bg: "#dcfce7" },
  scene: { label: "场景", color: "#ea580c", bg: "#ffedd5" },
}

/** 教学计划条目类型徽标（theory/practice/scene，scene 为橙色「场景」） */
export function EntryTypeBadge({ type, className }: { type: string; className?: string }) {
  const config = TYPE_CONFIG[type] || { label: type, color: "#64748b", bg: "#f1f5f9" }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className || ""}`}
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}
