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
  BannerConfig,
  LearnRoad,
} from '../types/job'
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
        category: string
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
  list: (params?: {
    category?: string
    isPublic?: boolean
    search?: string
    creatorId?: string
    limit?: number
    offset?: number
  }) => request<ListResponse<AbilityPoint>>(`/job/abilities${buildQuery(params || {})}`),
  get: (id: string) => request<AbilityPoint>(`/job/abilities/${id}`),
  create: (req: Omit<AbilityPoint, 'id' | 'createdAt'>) =>
    request<AbilityPoint>('/job/abilities', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<AbilityPoint, 'id' | 'createdAt'>>) =>
    request<AbilityPoint>(`/job/abilities/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/job/abilities/${id}`, { method: 'DELETE' }),
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

export const positionResponsibilityApi = {
  list: (params?: { careerPositionId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<PositionResponsibility>>(
      `/job/position-responsibilities${buildQuery(params || {})}`,
    ),
  get: (id: string) => request<PositionResponsibility>(`/job/position-responsibilities/${id}`),
  create: (req: Omit<PositionResponsibility, 'id'>) =>
    request<PositionResponsibility>('/job/position-responsibilities', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<Omit<PositionResponsibility, 'id'>>) =>
    request<PositionResponsibility>(`/job/position-responsibilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/job/position-responsibilities/${id}`, { method: 'DELETE' }),
}

export const positionCertificateApi = {
  list: (params?: { careerPositionId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<PositionCertificate>>(
      `/job/position-certificates${buildQuery(params || {})}`,
    ),
  get: (id: string) => request<PositionCertificate>(`/job/position-certificates/${id}`),
  create: (req: Omit<PositionCertificate, 'id'>) =>
    request<PositionCertificate>('/job/position-certificates', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<Omit<PositionCertificate, 'id'>>) =>
    request<PositionCertificate>(`/job/position-certificates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/job/position-certificates/${id}`, { method: 'DELETE' }),
}

export const certificateLibraryApi = {
  list: (params?: { search?: string; creatorId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertificateLibraryItem>>(
      `/job/certificate-library${buildQuery(params || {})}`,
    ),
  get: (id: string) => request<CertificateLibraryItem>(`/job/certificate-library/${id}`),
  create: (req: Omit<CertificateLibraryItem, 'id' | 'tenantId' | 'createdAt'>) =>
    request<CertificateLibraryItem>('/job/certificate-library', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (
    id: string,
    req: Partial<Omit<CertificateLibraryItem, 'id' | 'tenantId' | 'createdAt'>>,
  ) =>
    request<CertificateLibraryItem>(`/job/certificate-library/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/job/certificate-library/${id}`, { method: 'DELETE' }),
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

export const learnRoadApi = createCrudApi<
  LearnRoad,
  Omit<LearnRoad, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<LearnRoad, 'id' | 'createdAt' | 'updatedAt'>>
>('/job/learn-roads')

export const jobBannerApi = createCrudApi<
  BannerConfig,
  Omit<BannerConfig, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<BannerConfig, 'id' | 'createdAt' | 'updatedAt'>>
>('/job/banners')
