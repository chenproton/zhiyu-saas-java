export type ResourceKind =
  | "document"
  | "spreadsheet"
  | "image"
  | "link"
  | "audio"
  | "video"
  | "archive"
  | "venue"
  | "facility"
  | "software"
  | "other"

export const RESOURCE_TYPE_LABELS: Record<ResourceKind, string> = {
  document: "文档资源",
  spreadsheet: "表格资源",
  image: "图片资源",
  link: "链接资源",
  audio: "音频资源",
  video: "视频资源",
  archive: "压缩包资源",
  venue: "场地资源",
  facility: "设施设备资源",
  software: "软件资源",
  other: "其他资源",
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
  createdAt: string
  updatedAt: string
}
