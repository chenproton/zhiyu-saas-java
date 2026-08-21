import { authedFetch } from './http';

export interface UploadResponse {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export const fileApi = {
  upload: async (file: File): Promise<UploadResponse> => {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch('/files/upload', { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  }
};

export interface ImportPreviewResult {
  entity: string;
  total: number;
  valid: number;
  invalid: number;
  rows: { row: number; name?: string; code?: string; error?: string; conflict?: boolean }[];
}

export interface ImportResult {
  created: number;
  failed: number;
  entity: string;
  skipped?: number;
  permissionSkipped?: number;
  errors?: string[];
}

/** Excel 导入预览条目（对齐 React ImportPreviewItem） */
export interface ImportExcelPreviewItem {
  rowNum: number;
  key: string;
  name: string;
}

/** Excel 导入预览结果（对齐 React ImportPreviewResult：题目/方案课程等 Excel 实体） */
export interface ImportExcelPreviewResult {
  created: number;
  duplicates: number;
  failed: number;
  duplicateItems: ImportExcelPreviewItem[];
  errors: string[];
}

/** Excel 导入落库结果（对齐 React importExcel 返回结构） */
export interface ImportExcelResult {
  created: number;
  failed: number;
  skipped: number;
  permissionSkipped?: number;
  entity: string;
  errors?: string[];
}

export const importExportApi = {
  export: async (entity: string): Promise<Blob> => {
    const res = await authedFetch(`/export/${entity}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.blob();
  },
  importPreview: async (entity: string, files: File | File[]): Promise<ImportPreviewResult> => {
    const form = new FormData();
    const arr = Array.isArray(files) ? files : [files];
    arr.forEach((f) => form.append('file', f));
    const res = await authedFetch(`/import/${entity}/preview`, { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  import: async (entity: string, files: File | File[], overwrite = false, rename = false): Promise<ImportResult> => {
    const form = new FormData();
    const arr = Array.isArray(files) ? files : [files];
    arr.forEach((f) => form.append('file', f));
    const res = await authedFetch(
      `/import/${entity}?overwrite=${overwrite}&rename=${rename}`,
      { method: 'POST', body: form }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  /** Excel 导入落库（POST /import/{entity}/excel，对齐 React importExportApi.importExcel） */
  importExcel: async (
    entity: string,
    files: File | File[],
    overwrite = false,
    rename = false
  ): Promise<ImportExcelResult> => {
    const form = new FormData();
    const arr = Array.isArray(files) ? files : [files];
    arr.forEach((f) => form.append('file', f));
    const res = await authedFetch(`/import/${entity}/excel?overwrite=${overwrite}&rename=${rename}`, {
      method: 'POST',
      body: form
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  /** Excel 导入预览（POST /import/{entity}/preview，对齐 React importExportApi.importExcelPreview） */
  importExcelPreview: async (
    entity: string,
    files: File | File[]
  ): Promise<ImportExcelPreviewResult> => {
    const form = new FormData();
    const arr = Array.isArray(files) ? files : [files];
    arr.forEach((f) => form.append('file', f));
    const res = await authedFetch(`/import/${entity}/preview`, { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  /** 导入模板下载（GET /templates/{entity}，Java 泛化模板端点，返回 xlsx 附件） */
  downloadTemplate: (entity: string): Promise<Response> => authedFetch(`/templates/${entity}`),
  /** 题目批量导入模板下载（GET /templates/question-banks/{bankId}/questions） */
  downloadQuestionTemplate: (bankId: string): Promise<Response> =>
    authedFetch(`/templates/question-banks/${bankId}/questions`),
  /** 题目批量导出（POST /export/question-banks/{bankId}/questions/excel） */
  exportQuestionsExcel: (bankId: string, ids: string[]): Promise<Response> =>
    authedFetch(`/export/question-banks/${bankId}/questions/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
};
