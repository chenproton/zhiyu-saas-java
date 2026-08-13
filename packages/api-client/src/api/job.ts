import type {
  CareerPosition,
  PositionCertificate,
  CertificateLibraryItem,
  PositionResponsibility,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain,
  JobBatch,
  PositionRecommendation,
  LearnRoad,
} from '../types/job'
import type { CitationStats, UncitedItem } from '../types/citation'
import { request, buildQuery, ListResponse } from '../api-helpers'
import { createCrudApi, createContentApi } from '../api-factory'

export const publicPositionApi = createCrudApi<CareerPosition, never, never>(
  '/job/public/positions',
)

export const positionApi = {
  ...createContentApi<
    CareerPosition,
    Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>>
  >('/job/positions'),
  clone: (id: string, body?: { name?: string }) =>
    request<CareerPosition>(`/job/positions/${id}/clone`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  saveFull: (
    id: string,
    req: {
      batchId: string
      name: string
      shortName: string
      industry: string
      majors: string[]
      positionType: string
      salaryRange: [number, number]
      coverImage?: string
      description?: string
      requirements: string[]
      careerPath?: string
      version: string
      collaborators: string[]
      responsibilities: { id: string; name: string; description?: string }[]
      certificates: {
        id: string
        name: string
        url?: string
        description?: string
        image?: string
      }[]
      abilityBindings: {
        id: string
        responsibilityId: string
        source: string
        publicAbilityId?: string
        abilityPointId?: string
        name: string
        level: string
        rubricDescription?: string
        description?: string
        attributes?: string[]
        domain?: string
      }[]
      abilityDomains: { id: string; name: string; description?: string; bindingIds: string[] }[]
    },
  ) =>
    request<{ position: CareerPosition }>(`/job/positions/${id}/save-full`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  getFavorite: (id: string) =>
    request<{ isFavorite: boolean; favoriteCount: number }>(`/job/positions/${id}/favorite`),
  favorite: (id: string) =>
    request<{ isFavorite: boolean; favoriteCount: number }>(`/job/positions/${id}/favorite`, {
      method: 'POST',
    }),
  listFavorites: () => request<ListResponse<CareerPosition>>('/job/positions/favorites'),
}

export const abilityApi = {
  ...createCrudApi<
    AbilityPoint,
    Omit<AbilityPoint, 'id' | 'createdAt'>,
    Partial<Omit<AbilityPoint, 'id' | 'createdAt'>>
  >('/job/abilities'),
  citationStats: () => request<CitationStats>('/job/abilities/citation-stats'),
  uncited: (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) =>
    request<ListResponse<UncitedItem>>(`/job/abilities/uncited${buildQuery(params || {})}`),
  listBindings: (params?: { careerPositionId?: string; responsibilityId?: string }) =>
    request<ListResponse<PositionAbilityBinding>>(
      `/job/position-abilities${buildQuery(params || {})}`,
    ),
  createBinding: (req: Omit<PositionAbilityBinding, 'id'>) =>
    request<PositionAbilityBinding>('/job/position-abilities', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  updateBinding: (id: string, req: Partial<Omit<PositionAbilityBinding, 'id'>>) =>
    request<PositionAbilityBinding>(`/job/position-abilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  deleteBinding: (id: string) =>
    request<{ id: string }>(`/job/position-abilities/${id}`, { method: 'DELETE' }),
  listDomains: (careerPositionId: string) =>
    request<ListResponse<AbilityDomain>>(
      `/job/ability-domains?careerPositionId=${careerPositionId}`,
    ),
  createDomain: (req: Omit<AbilityDomain, 'id'>) =>
    request<AbilityDomain>('/job/ability-domains', { method: 'POST', body: JSON.stringify(req) }),
  updateDomain: (id: string, req: Partial<Omit<AbilityDomain, 'id'>>) =>
    request<AbilityDomain>(`/job/ability-domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  deleteDomain: (id: string) =>
    request<{ id: string }>(`/job/ability-domains/${id}`, { method: 'DELETE' }),
}

export const positionResponsibilityApi = createCrudApi<
  PositionResponsibility,
  Omit<PositionResponsibility, 'id'>,
  Partial<Omit<PositionResponsibility, 'id'>>
>('/job/position-responsibilities')

export const positionCertificateApi = createCrudApi<
  PositionCertificate,
  Omit<PositionCertificate, 'id'>,
  Partial<Omit<PositionCertificate, 'id'>>
>('/job/position-certificates')

export const certificateLibraryApi = {
  ...createCrudApi<
    CertificateLibraryItem,
    Omit<CertificateLibraryItem, 'id' | 'tenantId' | 'createdAt'>,
    Partial<Omit<CertificateLibraryItem, 'id' | 'tenantId' | 'createdAt'>>
  >('/job/certificate-library'),
  citationStats: () => request<CitationStats>('/job/certificate-library/citation-stats'),
  uncited: (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) =>
    request<ListResponse<UncitedItem>>(
      `/job/certificate-library/uncited${buildQuery(params || {})}`,
    ),
}

export const batchApi = {
  ...createCrudApi<
    JobBatch,
    Omit<
      JobBatch,
      'id' | 'positionCount' | 'publishedCount' | 'pendingCount' | 'createdAt' | 'updatedAt'
    >,
    Partial<Omit<JobBatch, 'id' | 'createdAt' | 'updatedAt'>>
  >('/job/batches'),
  updateStatus: (id: string, status: string) =>
    request<JobBatch>(`/job/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
}

export const recommendApi = createCrudApi<
  PositionRecommendation,
  Omit<PositionRecommendation, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<PositionRecommendation, 'id' | 'createdAt' | 'updatedAt'>>
>('/job/recommendations')

// 当前学生目标岗位（唯一来源：人培方案按班级排的岗位）
export const targetPositionApi = {
  list: () => request<ListResponse<CareerPosition>>('/job/landing/target-positions'),
}

export const learnRoadApi = createCrudApi<
  LearnRoad,
  Omit<LearnRoad, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<LearnRoad, 'id' | 'createdAt' | 'updatedAt'>>
>('/job/learn-roads')
