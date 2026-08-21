// 通用内容列表页类型契约 —— 对齐原 React 版 content-list-page.tsx
// 说明：领域后端对象形态不一，itemApi/create/update/mapItem 入参以 any 承接，
// 值约束由各域 mapItem/createPayload 承担（与 React ContentListPageConfig 一致）。

import type { ListResponse } from '@/api/http';

/** 列表项（mapItem 产出）最小契约；各域可携带额外字段 */
export interface ContentListItem {
  id: string;
  name: string;
  status: string;
  batchId?: string;
  creatorId?: string;
  coCreatorIds?: string[];
  rejectReason?: string;
  code?: string;
  description?: string;
  [key: string]: unknown;
}

/** 批次分组（mapBatch 产出）最小契约 */
export interface ContentBatch {
  id: string;
  name: string;
  workflowId?: string;
  [key: string]: unknown;
}

/** 内容流 CRUD + 状态操作 API（等价 React ContentApi） */
export interface ContentApi {
  list: (params?: Record<string, unknown>) => Promise<ListResponse<unknown>>;
  create: (req: unknown) => Promise<unknown>;
  submit: (id: string) => Promise<unknown>;
  withdraw: (id: string) => Promise<unknown>;
  publish: (id: string) => Promise<unknown>;
  unpublish: (id: string) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  invite: (id: string, userId: string) => Promise<unknown>;
  update: (id: string, req: Record<string, unknown>) => Promise<unknown>;
  clone?: (id: string, body?: Record<string, unknown>) => Promise<unknown>;
}

/** 批次分组 API（等价 React ContentBatchApi） */
export interface ContentBatchApi {
  list: (params?: Record<string, unknown>) => Promise<ListResponse<unknown>>;
}

/** 审批 API（等价 React ContentApprovalApi；组件只用 list/create，review 由页面级代码负责） */
export interface ContentApprovalApi {
  list: (params?: Record<string, unknown>) => Promise<ListResponse<unknown>>;
  create: (req: { targetType: string; targetId: string; workflowId?: string }) => Promise<unknown>;
}

/** 导入预览行（Vue/Java 后端形态） */
export interface ImportPreviewRow {
  row: number;
  name?: string;
  code?: string;
  error?: string;
  conflict?: boolean;
}

export interface ImportPreviewResult {
  entity?: string;
  total?: number;
  valid?: number;
  invalid?: number;
  rows?: ImportPreviewRow[];
  // 兼容 React 版形态
  duplicates?: number;
  created?: number;
  failed?: number;
  duplicateItems?: { row?: number; name?: string }[];
  [key: string]: unknown;
}

export interface ImportResult {
  created: number;
  failed: number;
  entity?: string;
  skipped?: number;
  permissionSkipped?: number;
  errors?: string[];
}

/** 导入导出 API（等价 React ContentImportExportApi 的 Vue 侧子集；Excel 模板/Excel 导出直连 authedFetch） */
export interface ContentImportExportApi {
  export: (entity: string) => Promise<Blob>;
  importPreview: (entity: string, file: File) => Promise<ImportPreviewResult>;
  import: (
    entity: string,
    file: File,
    overwrite?: boolean,
    rename?: boolean,
  ) => Promise<ImportResult>;
}

export interface StatusFilterOption {
  value: string;
  label: string;
}

export interface GroupStatusFilterOption {
  value: string;
  label: string;
  /** 该分组命中的状态集合 */
  statuses: string[];
}

export type TabType = 'my' | 'collab' | 'public' | 'all';
export type ViewMode = 'list' | 'group';

export type RowActionType = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default';

export interface RowAction {
  key: string;
  label: string;
  type: RowActionType;
  handler: () => void;
}

/** 列表插槽对外暴露的 props（等价 React ListRenderProps，Map 改为普通对象便于模板访问） */
export interface ListSlotProps<T extends ContentListItem = ContentListItem> {
  activeTab: TabType;
  items: T[];
  selectedIds: string[];
  batchMap: Record<string, string>;
  loading: boolean;
  handleSelectId: (id: string, checked: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  handleClone: (item: T) => void;
  handleDelete: (item: T) => void;
  handleSubmitApproval: (item: T) => void;
  handleWithdrawApproval: (item: T) => void;
  handleViewRejectReason: (item: T) => void;
  handlePublish: (item: T) => void;
  handleUnpublish: (item: T) => void;
  handleArchive: (item: T) => void;
  handleInviteCoBuild: (item: T) => void;
  /** 按 status 计算的可见行操作（含 type，供 el-button 直接用） */
  rowActions: (item: T) => RowAction[];
}

/** 组件配置（等价 React ContentListPageConfig，单 config 属性传入） */
export interface ContentListPageConfig {
  title: string;
  subtitle: string;
  entityLabel: string;
  addHref: string;
  permissionModule: string;
  permissionResource: string;
  itemApi: ContentApi;
  batchApi: ContentBatchApi;
  approvalApi: ContentApprovalApi;
  importExportApi: ContentImportExportApi;
  approvalTargetType: string;
  importEntityName?: string;
  exportEntityName?: string;
  /** Excel 导入/导出资源键（positions/scenarios/courses/granular-courses/question-banks/exams 等） */
  importExcelEntity?: string;
  statusFilterOptions: StatusFilterOption[];
  groupStatusFilterOptions?: GroupStatusFilterOption[];
  mapItem: (backend: unknown, currentUserId: string) => ContentListItem;
  mapBatch: (backend: unknown) => ContentBatch;
  afterLoad?: (
    items: ContentListItem[],
    batches: ContentBatch[],
  ) => ContentListItem[] | Promise<ContentListItem[]>;
  createPayload: (userId: string, entityLabel: string) => Record<string, unknown>;
  createRedirectUrl?: (id: string) => string;
  listParams?: Record<string, unknown>;
  /** 共建人字段名（岗位 collaborators / 场景 coBuilderIds / 试卷 collaboratorIds） */
  coBuilderField?: string;
  /** 是否展示克隆能力，默认 true */
  enableClone?: boolean;
  /** 是否展示批量导出按钮，默认 true */
  enableBatchExport?: boolean;
  /** 提供时新建走回调（如试卷弹窗表单），否则走 createPayload + 跳转 */
  onCreate?: () => void;
}

/** 分页全量拉取（后端 maxPageSize=200，单次请求会静默截断超量数据） */
export async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  pageSize = 200,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    // 防呆：服务端分页异常（恒返回满页/忽略 offset）时熔断，避免无限循环挂死页面
    if (page >= 1000) {
      throw new Error('fetchAllPages: 超过最大页数 1000，疑似分页未生效，已中止');
    }
    const res = await fetcher(page, pageSize);
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

/** Blob 下载（等价 React downloadBlob） */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
