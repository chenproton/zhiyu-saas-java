// 库页面共享类型（对齐 frontend/packages/shared-types/src/library.ts 与
// frontend/packages/api-client 的 CitationStats / UncitedItem 契约）

export interface CitationBucket {
  label: string;
  count: number;
}

export interface CitationStats {
  buckets: CitationBucket[];
  zeroCount: number;
  total: number;
}

export interface UncitedItem {
  id: string;
  name: string;
  createdAt: string;
}

export interface GranularLessonOption {
  id: string;
  name: string;
  code?: string;
  description?: string;
}
