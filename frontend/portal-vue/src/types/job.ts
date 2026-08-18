import type { ContentStatus } from './content-status';

export type PositionType = 'enterprise' | 'teaching';

export const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  enterprise: '企业岗位',
  teaching: '教学岗位'
};

export interface CareerPosition {
  id: string;
  code?: string;
  batchId?: string;
  name: string;
  shortName?: string;
  industryId?: string;
  majorIds: string[];
  majorNames?: string[];
  positionType: PositionType;
  salaryMin?: number;
  salaryMax?: number;
  coverImage?: string;
  description?: string;
  requirements: string[];
  careerPath?: string;
  version: string;
  status: ContentStatus;
  sourceType?: 'school' | 'enterprise';
  sourceEnterpriseId?: string;
  createdBy: string;
  createdByName?: string;
  collaborators: string[];
  collaboratorNames?: string[];
  favoriteCount?: number;
  viewCount?: number;
  abilityCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionResponsibility {
  id: string;
  careerPositionId: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface PositionCertificate {
  id: string;
  careerPositionId: string;
  certificateLibraryId: string;
  name: string;
  url?: string;
  description?: string;
  imageUrl?: string;
}

export interface AbilityPoint {
  id: string;
  name: string;
  code?: string;
  description?: string;
  attributes: string[];
  isPublic: boolean;
  creatorId?: string;
  createdAt: string;
}

export interface PositionAbilityBinding {
  id: string;
  careerPositionId: string;
  responsibilityId: string;
  abilityPointId: string;
  abilityName?: string;
  source: 'public' | 'custom';
  domain?: string;
  requiredLevel: string;
  rubricDescription?: string;
  attributes: string[];
  weight: number;
}

export interface AbilityDomain {
  id: string;
  careerPositionId: string;
  name: string;
  description?: string;
  bindingIds: string[];
  sortOrder: number;
}

export interface JobBatch {
  id: string;
  tenantId?: string;
  name: string;
  code?: string;
  orgNodeId?: string;
  majorId?: string;
  majorName?: string;
  workflowId?: string;
  status: 'open' | 'closed';
  positionCount: number;
  publishedCount: number;
  pendingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateLibraryItem {
  id: string;
  tenantId: string;
  name: string;
  url?: string;
  description?: string;
  imageUrl?: string;
  creatorId?: string;
  createdAt: string;
}

export interface PositionRecommendation {
  id: string;
  majorId?: string;
  majorName?: string;
  careerPositionId: string;
  positionType: string;
  reason?: string;
  sortOrder: number;
  isEnabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearnRoadStep {
  name: string;
  description?: string;
  scenarioId?: string;
  resourceIds?: string[];
  tasks?: { id: string; name: string }[];
}

export interface LearnRoad {
  id: string;
  name: string;
  description?: string;
  positionIds: string[];
  steps?: LearnRoadStep[];
  createdAt: string;
  updatedAt: string;
}
