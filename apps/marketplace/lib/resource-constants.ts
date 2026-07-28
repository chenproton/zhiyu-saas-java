import type { Resource } from "@zhiyu/api-client"

export type ResourceStatus = Resource["status"]

export const RESOURCE_CATEGORIES = [
  { id: "post", name: "岗位包", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: "scene", name: "场景包", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { id: "course", name: "课程包", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "assessment", name: "测评包", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "material", name: "素材包", color: "bg-rose-100 text-rose-700 border-rose-200" },
] as const

export type ResourceCategoryId = (typeof RESOURCE_CATEGORIES)[number]["id"]

export function getCategoryName(categoryId: string): string {
  return RESOURCE_CATEGORIES.find((c) => c.id === categoryId)?.name || categoryId
}

export function getCategoryColor(categoryId: string): string {
  return RESOURCE_CATEGORIES.find((c) => c.id === categoryId)?.color || "bg-gray-100 text-gray-700"
}

export const MAJOR_TAGS = [
  "信息安全",
  "计算机网络",
  "软件技术",
  "大数据技术",
  "人工智能",
  "物联网",
  "云计算",
  "数字媒体",
  "电子商务",
  "智能制造",
]

export const INDUSTRY_TAGS = [
  "网络安全",
  "软件开发",
  "云计算服务",
  "数据分析",
  "智能硬件",
  "互联网运营",
  "金融科技",
  "教育培训",
]

export const EDUCATION_LEVELS = ["中职", "高职", "本科"] as const
export type EducationLevel = (typeof EDUCATION_LEVELS)[number]

export const DIFFICULTY_LEVELS = ["初级", "中级", "高级"] as const
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]
