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
  }
};
