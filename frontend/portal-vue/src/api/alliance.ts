import { createCrudApi } from './http';
import type {
  AllianceProject,
  AllianceAgreement,
  AllianceAchievement,
  AllianceBrand
} from '@/types/alliance';

type ProjectCreate = Partial<Omit<AllianceProject, 'id' | 'createdAt' | 'updatedAt'>>;
type ProjectUpdate = Partial<Omit<AllianceProject, 'id' | 'createdAt' | 'updatedAt'>>;

export const allianceProjectApi = createCrudApi<AllianceProject, ProjectCreate, ProjectUpdate>(
  '/alliance/projects'
);

export const allianceAgreementApi = createCrudApi<
  AllianceAgreement,
  Partial<Omit<AllianceAgreement, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<AllianceAgreement, 'id' | 'createdAt' | 'updatedAt'>>
>('/alliance/agreements');

export const allianceAchievementApi = createCrudApi<
  AllianceAchievement,
  Partial<Omit<AllianceAchievement, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<AllianceAchievement, 'id' | 'createdAt' | 'updatedAt'>>
>('/alliance/achievements');

export const allianceBrandApi = createCrudApi<
  AllianceBrand,
  Partial<Omit<AllianceBrand, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<AllianceBrand, 'id' | 'createdAt' | 'updatedAt'>>
>('/alliance/brands');
