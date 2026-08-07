export type ResourceKind =
  | 'document'
  | 'spreadsheet'
  | 'image'
  | 'link'
  | 'audio'
  | 'video'
  | 'archive'
  | 'venue'
  | 'facility'
  | 'software'
  | 'other'

export const RESOURCE_TYPE_LABELS: Record<ResourceKind, string> = {
  document: '文档资源',
  spreadsheet: '表格资源',
  image: '图片资源',
  link: '链接资源',
  audio: '音频资源',
  video: '视频资源',
  archive: '压缩包资源',
  venue: '场地资源',
  facility: '设施设备资源',
  software: '软件资源',
  other: '其他资源',
}

// 资源类型短标签（落地页/选择器等紧凑场景），与 RESOURCE_TYPE_LABELS 语义对齐，
// 并兼容课程/场景侧的遗留类型（file/presentation/pdf）与筛选键 all。
export const RESOURCE_TYPE_SHORT_LABELS: Record<string, string> = {
  all: '全部',
  document: '文档',
  spreadsheet: '表格',
  image: '图片',
  link: '链接',
  audio: '音频',
  video: '视频',
  archive: '压缩包',
  venue: '场地',
  facility: '设施',
  software: '软件',
  other: '其他',
  file: '文件',
  presentation: '演示',
  pdf: 'PDF',
}

export interface ResourceLibraryItem {
  id: string
  tenantId: string
  name: string
  resourceType: ResourceKind
  url?: string
  description?: string
  thumbnail?: string
  fileSize?: number
  metadata?: Record<string, any>
  uploadedBy?: string
  uploaderName?: string
  uploaderOrgName?: string
  uploaderMajorName?: string
  createdAt: string
  updatedAt: string
}

export interface OnSiteQuestionLibraryItem {
  id: string
  tenantId: string
  questionText: string
  answer?: string
  questionType: string
  score: number
  difficulty?: string
  knowledgePointIds?: string[]
  tags?: string[]
  creatorId?: string
  createdAt: string
  updatedAt: string
}

// 资源标签（标签管理功能）
export interface TagItem {
  id: string
  tenantId: string
  name: string
  color: string
  resourceCount?: number
  createdAt: string
  updatedAt: string
}

export interface ResourceTagRelation {
  resourceId: string
  tags: TagItem[]
}

// 引用次数分布（库页面顶部指标卡片用）
export interface CitationBucket {
  label: string
  count: number
}

export interface CitationStats {
  buckets: CitationBucket[]
  zeroCount: number
  total: number
}

// 零引用资源条目（弹窗列表：名称 + 上传时间）
export interface UncitedItem {
  id: string
  name: string
  createdAt: string
}

// 可绑定标签的资源类型（与后端 domain.TagResourceType* 常量一一对应）
export const TAG_RESOURCE_TYPES = {
  knowledge_point: 'knowledge_point',
  resource_library: 'resource_library',
  ability_point: 'ability_point',
  certificate_library: 'certificate_library',
  random_draw_question: 'random_draw_question',
} as const

export type TagResourceType = (typeof TAG_RESOURCE_TYPES)[keyof typeof TAG_RESOURCE_TYPES]
