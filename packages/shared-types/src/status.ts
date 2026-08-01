export type ContentStatus = "draft" | "pending" | "approved" | "rejected" | "published" | "archived" | "reviewing"

interface StatusConfig {
  label: string
  color: string
  bg: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  draft:         { label: "草稿",    color: "#64748b", bg: "#f1f5f9" },
  pending:       { label: "审核中",  color: "#2563eb", bg: "#dbeafe" },
  approved:      { label: "已通过",  color: "#7c3aed", bg: "#ede9fe" },
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
  active:        { label: "正常",    color: "#16a34a", bg: "#dcfce7" },
  inactive:      { label: "已停用",  color: "#8f959e", bg: "#f5f6f7" },
  graduated:     { label: "毕业",    color: "#8f959e", bg: "#f5f6f7" },
  in_progress:   { label: "进行中",  color: "#16a34a", bg: "#dcfce7" },
  finished:      { label: "已结束",  color: "#8f959e", bg: "#f5f6f7" },
  confirmed:     { label: "已确认",  color: "#16a34a", bg: "#dcfce7" },
  planned:       { label: "待排课",  color: "#d97706", bg: "#fef3c7" },
  scheduled:     { label: "已排课",  color: "#2563eb", bg: "#dbeafe" },
  // Portal workspace 中文状态键（与后端/共享类型保持一致）
  "未开始":      { label: "未开始",  color: "#4b5563", bg: "#f3f4f6" },
  "进行中":      { label: "进行中",  color: "#2563eb", bg: "#eff6ff" },
  "待提交":      { label: "待提交",  color: "#d97706", bg: "#fef3c7" },
  "已批改":      { label: "已批改",  color: "#7c3aed", bg: "#ede9fe" },
  "已完成":      { label: "已完成",  color: "#16a34a", bg: "#dcfce7" },
  "待考":        { label: "待考",    color: "#d97706", bg: "#fef3c7" },
  "已结课":      { label: "已结课",  color: "#16a34a", bg: "#dcfce7" },
  // 评分/阅卷场景
  graded:        { label: "已评分",  color: "#16a34a", bg: "#dcfce7" },
  "已评分":      { label: "已评分",  color: "#16a34a", bg: "#dcfce7" },
  "待评分":      { label: "待评分",  color: "#d97706", bg: "#fef3c7" },
}

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] || { label: status, color: "#64748b", bg: "#f1f5f9" }
}
