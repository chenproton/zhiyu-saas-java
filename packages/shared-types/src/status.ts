export type ContentStatus = "draft" | "pending" | "approved" | "rejected" | "published" | "archived" | "reviewing"

interface StatusConfig {
  label: string
  color: string
  bg: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  draft:         { label: "草稿",    color: "#64748b", bg: "#f1f5f9" },
  pending:       { label: "审核中",  color: "#2563eb", bg: "#dbeafe" },
  approved:      { label: "已通过",  color: "#16a34a", bg: "#dcfce7" },
  rejected:      { label: "已驳回",  color: "#dc2626", bg: "#fee2e2" },
  published:     { label: "已发布",  color: "#16a34a", bg: "#dcfce7" },
  archived:      { label: "已归档",  color: "#8f959e", bg: "#f5f6f7" },
  reviewing:     { label: "审批中",  color: "#f59e0b", bg: "#fef3c7" },
  open:          { label: "进行中",  color: "#2563eb", bg: "#eff6ff" },
  closed:        { label: "已关闭",  color: "#8f959e", bg: "#f5f6f7" },
  ready:         { label: "待发布",  color: "#4f46e5", bg: "#e0e7ff" },
  not_submitted: { label: "未提交",  color: "#d97706", bg: "#fef3c7" },
  none:          { label: "无规则",  color: "#8f959e", bg: "#f5f6f7" },
  disabled:      { label: "已禁用",  color: "#8f959e", bg: "#f5f6f7" },
  in_progress:   { label: "进行中",  color: "#16a34a", bg: "#dcfce7" },
  finished:      { label: "已结束",  color: "#8f959e", bg: "#f5f6f7" },
}

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] || { label: status, color: "#64748b", bg: "#f1f5f9" }
}
