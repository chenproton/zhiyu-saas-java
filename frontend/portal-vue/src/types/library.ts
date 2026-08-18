// 移植自 frontend/packages/shared-types/src/library.ts

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
  | 'other';

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
  other: '其他资源'
};

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
  pdf: 'PDF'
};

export interface ResourceLibraryItem {
  id: string;
  tenantId: string;
  name: string;
  resourceType: ResourceKind;
  url?: string;
  description?: string;
  thumbnail?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
  uploadedBy?: string;
  uploaderName?: string;
  uploaderOrgName?: string;
  uploaderMajorName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ResourceLibraryCreate = Omit<
  ResourceLibraryItem,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;
export type ResourceLibraryUpdate = Partial<ResourceLibraryCreate>;

export interface TagItem {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  resourceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnSiteQuestionLibraryItem {
  id: string;
  tenantId: string;
  questionText: string;
  answer?: string;
  questionType: string;
  score: number;
  difficulty?: string;
  knowledgePointIds?: string[];
  tags?: string[];
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
}
