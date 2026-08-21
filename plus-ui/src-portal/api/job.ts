import { createContentApi, createCrudApi, request, buildQuery } from './http';
import type { ListResponse } from './http';
import type {
  CareerPosition,
  PositionResponsibility,
  PositionCertificate,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain,
  JobBatch,
  CertificateLibraryItem,
  PositionRecommendation,
  LearnRoad
} from '@/types/job';

type PositionCreate = Partial<Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>>;
type PositionUpdate = Partial<Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>>;

export const positionApi = {
  ...createContentApi<CareerPosition, PositionCreate, PositionUpdate>('/job/positions'),
  clone: (id: string, body?: { name?: string }) =>
    request<CareerPosition>(`/job/positions/${id}/clone`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),
  saveFull: (id: string, req: Record<string, unknown>) =>
    request<{ position: CareerPosition }>(`/job/positions/${id}/save-full`, {
      method: 'PUT',
      body: JSON.stringify(req)
    }),
  getFavorite: (id: string) =>
    request<{ isFavorite: boolean; favoriteCount: number }>(`/job/positions/${id}/favorite`),
  favorite: (id: string) =>
    request<{ isFavorite: boolean; favoriteCount: number }>(`/job/positions/${id}/favorite`, {
      method: 'POST'
    }),
  listFavorites: () => request<ListResponse<CareerPosition>>('/job/positions/favorites')
};

export const publicPositionApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<CareerPosition>>(`/job/public/positions${buildQuery(params || {})}`),
  get: (id: string) => request<CareerPosition>(`/job/public/positions/${id}`)
};

export const positionResponsibilityApi = createCrudApi<
  PositionResponsibility,
  Partial<Omit<PositionResponsibility, 'id'>>,
  Partial<Omit<PositionResponsibility, 'id'>>
>('/job/position-responsibilities');

export const positionCertificateApi = createCrudApi<
  PositionCertificate,
  Partial<Omit<PositionCertificate, 'id'>>,
  Partial<Omit<PositionCertificate, 'id'>>
>('/job/position-certificates');

export const abilityApi = {
  ...createCrudApi<AbilityPoint, Partial<Omit<AbilityPoint, 'id' | 'createdAt'>>, Partial<Omit<AbilityPoint, 'id'>>>(
    '/job/abilities'
  ),
  listBindings: (params?: { careerPositionId?: string; responsibilityId?: string }) =>
    request<ListResponse<PositionAbilityBinding>>(`/job/position-abilities${buildQuery(params || {})}`),
  createBinding: (req: Partial<Omit<PositionAbilityBinding, 'id'>>) =>
    request<PositionAbilityBinding>('/job/position-abilities', { method: 'POST', body: JSON.stringify(req) }),
  updateBinding: (id: string, req: Partial<Omit<PositionAbilityBinding, 'id'>>) =>
    request<PositionAbilityBinding>(`/job/position-abilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req)
    }),
  deleteBinding: (id: string) =>
    request<{ id: string }>(`/job/position-abilities/${id}`, { method: 'DELETE' }),
  listDomains: (careerPositionId: string) =>
    request<ListResponse<AbilityDomain>>(`/job/ability-domains?careerPositionId=${careerPositionId}`),
  createDomain: (req: Partial<Omit<AbilityDomain, 'id'>>) =>
    request<AbilityDomain>('/job/ability-domains', { method: 'POST', body: JSON.stringify(req) }),
  updateDomain: (id: string, req: Partial<Omit<AbilityDomain, 'id'>>) =>
    request<AbilityDomain>(`/job/ability-domains/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  deleteDomain: (id: string) =>
    request<{ id: string }>(`/job/ability-domains/${id}`, { method: 'DELETE' })
};

export const batchApi = {
  ...createCrudApi<JobBatch, Partial<Omit<JobBatch, 'id' | 'createdAt' | 'updatedAt'>>, Partial<Omit<JobBatch, 'id' | 'createdAt' | 'updatedAt'>>>(
    '/job/batches'
  ),
  updateStatus: (id: string, status: string) =>
    request<JobBatch>(`/job/batches/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
};

export const certificateLibraryApi = createCrudApi<
  CertificateLibraryItem,
  Partial<Omit<CertificateLibraryItem, 'id' | 'tenantId' | 'createdAt'>>,
  Partial<Omit<CertificateLibraryItem, 'id' | 'tenantId' | 'createdAt'>>
>('/job/certificate-library');

export const recommendApi = createCrudApi<
  PositionRecommendation,
  Partial<Omit<PositionRecommendation, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<PositionRecommendation, 'id' | 'createdAt' | 'updatedAt'>>
>('/job/recommendations');

export const learnRoadApi = createCrudApi<
  LearnRoad,
  Partial<Omit<LearnRoad, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<LearnRoad, 'id' | 'createdAt' | 'updatedAt'>>
>('/job/learn-roads');
