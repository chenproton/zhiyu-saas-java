import { authedFetch, request, UploadResponse } from '../api-helpers'

export const fileApi = {
  upload: async (file: File): Promise<UploadResponse> => {
    const form = new FormData()
    form.append('file', file)
    const res = await authedFetch('/files/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
  /** 生成短时签名 URL，供 kkFileView 等无登录态的服务端抓取方预览 */
  signUrl: async (name: string): Promise<string> => {
    const data = await request<{ url: string }>(
      `/files/sign-url?name=${encodeURIComponent(name)}`,
    )
    return data.url
  },
}

export interface ImportPreviewItem {
  rowNum: number
  key: string
  name: string
}

export interface ImportPreviewResult {
  created: number
  duplicates: number
  failed: number
  duplicateItems: ImportPreviewItem[]
  errors: string[]
}

export const importExportApi = {
  export: (entity: string) => {
    return authedFetch(`/export/${entity}`)
  },
  import: async (
    entity: string,
    files: File | File[],
    overwrite = false,
    rename = false,
  ): Promise<{
    created: number
    failed: number
    entity: string
    skipped?: number
    permissionSkipped?: number
    errors?: string[]
  }> => {
    const form = new FormData()
    const fileArr = Array.isArray(files) ? files : [files]
    fileArr.forEach((f) => form.append('file', f))
    const res = await authedFetch(
      `/import/${entity}?overwrite=${overwrite}&rename=${rename}`,
      {
        method: 'POST',
        body: form,
      },
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
  importPreview: async (
    entity: string,
    files: File | File[],
    extraQuery?: Record<string, string>,
  ): Promise<ImportPreviewResult> => {
    const form = new FormData()
    const fileArr = Array.isArray(files) ? files : [files]
    fileArr.forEach((f) => form.append('file', f))
    const suffix = extraQuery ? `?${new URLSearchParams(extraQuery).toString()}` : ''
    const res = await authedFetch(`/import/${entity}/preview${suffix}`, { method: 'POST', body: form })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
  importExcel: async (
    entity: string,
    files: File | File[],
    overwrite = false,
    rename = false,
    extraQuery?: Record<string, string>,
  ): Promise<{
    created: number
    failed: number
    skipped: number
    permissionSkipped?: number
    entity: string
    positionCreated?: number
    responsibilities?: number
    abilityBindings?: number
    scenarioCreated?: number
    taskCreated?: number
    errors?: string[]
  }> => {
    const form = new FormData()
    const fileArr = Array.isArray(files) ? files : [files]
    fileArr.forEach((f) => form.append('file', f))
    const suffix = extraQuery ? `&${new URLSearchParams(extraQuery).toString()}` : ''
    const res = await authedFetch(
      `/import/${entity}/excel?overwrite=${overwrite}&rename=${rename}${suffix}`,
      {
        method: 'POST',
        body: form,
      },
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
  importExcelPreview: (
    entity: string,
    files: File | File[],
    extraQuery?: Record<string, string>,
  ): Promise<ImportPreviewResult> => importExportApi.importPreview(entity, files, extraQuery),
  downloadTemplate: (
    entity:
      | 'positions'
      | 'scenarios'
      | 'courses'
      | 'system-courses'
      | 'granular-courses'
      | 'question-banks'
      | 'exams'
      | 'industries'
      | 'majors'
      | 'organizations'
      | 'students'
      | 'teachers'
      | 'schedules'
      | 'program-courses'
      | 'alliance-projects'
      | 'alliance-achievements'
      | 'alliance-agreements'
      | 'alliance-permissions'
      | 'alliance-brands',
    extraQuery?: Record<string, string>,
  ) => {
    const suffix = extraQuery ? `?${new URLSearchParams(extraQuery).toString()}` : ''
    return authedFetch(`/templates/${entity}${suffix}`)
  },
  downloadQuestionTemplate: (bankId: string) => {
    return authedFetch(`/templates/question-banks/${bankId}/questions`)
  },
  exportScenariosExcel: (ids: string[]) => {
    return authedFetch(`/export/scenarios/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportPositionsExcel: (ids: string[]) => {
    return authedFetch(`/export/positions/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportCoursesExcel: (ids: string[]) => {
    return authedFetch(`/export/courses/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportGranularCoursesExcel: (ids: string[]) => {
    return authedFetch(`/export/granular-courses/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportQuestionBanksExcel: (ids: string[]) => {
    return authedFetch(`/export/question-banks/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportQuestionsExcel: (bankId: string, ids: string[]) => {
    return authedFetch(`/export/question-banks/${bankId}/questions/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportExamsExcel: (ids: string[]) => {
    return authedFetch(`/export/exams/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportOrganizationsExcel: (ids: string[]) => {
    return authedFetch(`/export/organizations/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportStudentsExcel: (ids: string[]) => {
    return authedFetch(`/export/students/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
  exportTeachersExcel: (ids: string[]) => {
    return authedFetch(`/export/teachers/excel`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
}
