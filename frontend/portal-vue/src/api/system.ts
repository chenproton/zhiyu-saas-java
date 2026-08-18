import { createCrudApi, request, buildQuery } from './http';
import type { Organization, Workflow, Role, Major, Industry, OrgType } from '@/types/system';

type OrgCreate = Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>;
type OrgUpdate = Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>;

export const organizationApi = {
  ...createCrudApi<Organization, OrgCreate, OrgUpdate>('/organizations'),
  tree: (params?: { tenantId?: string; typeId?: string }) =>
    request<{ items: Organization[] }>(`/organizations/tree${buildQuery(params || {})}`)
};

export const workflowApi = createCrudApi<
  Workflow,
  Partial<Omit<Workflow, 'id' | 'createdAt'>>,
  Partial<Omit<Workflow, 'id' | 'createdAt'>>
>('/workflows');

export const roleApi = createCrudApi<
  Role,
  Partial<Omit<Role, 'id' | 'createdAt'>>,
  Partial<Omit<Role, 'id' | 'createdAt'>>
>('/roles');

export const majorApi = createCrudApi<
  Major,
  Partial<Omit<Major, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<Major, 'id' | 'createdAt' | 'updatedAt'>>
>('/majors');

export const industryApi = createCrudApi<
  Industry,
  Partial<Omit<Industry, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<Industry, 'id' | 'createdAt' | 'updatedAt'>>
>('/industries');

export const orgTypeApi = createCrudApi<
  OrgType,
  Partial<Omit<OrgType, 'id' | 'createdAt'>>,
  Partial<Omit<OrgType, 'id' | 'createdAt'>>
>('/org-types');
