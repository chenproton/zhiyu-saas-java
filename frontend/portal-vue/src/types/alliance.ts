export interface AllianceProject {
  id: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  phase: string;
  publishStatus: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  coverImage?: string;
  enterpriseIds?: string[];
  agreementIds?: string[];
  secondaryColleges?: string[];
  isPublic: boolean;
  progress?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceAgreement {
  id: string;
  tenantId: string;
  name: string;
  type?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  enterpriseIds?: string[];
  projectIds?: string[];
  attachments?: string[];
  isPublic?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceAchievement {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  description?: string;
  achievementDate?: string;
  coverImage?: string;
  attachments?: string[];
  citationReason?: string;
  images?: string[];
  ownerPersons?: string[];
  enterpriseIds?: string[];
  projectIds?: string[];
  status: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AllianceBrand {
  id: string;
  tenantId: string;
  brandType: string;
  name: string;
  status: string;
  isPublic: boolean;
  isFeatured: boolean;
  coverImage?: string;
  description?: string;
  data: Record<string, unknown>;
  studentId?: string;
  enterpriseId?: string;
  positionId?: string;
  majorId?: string;
  teacherId?: string;
  expertId?: string;
  sortOrder: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}
