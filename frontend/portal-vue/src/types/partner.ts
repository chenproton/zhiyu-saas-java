export interface AllianceExpert {
  id: string;
  tenantId: string;
  name: string;
  gender?: string;
  age?: number;
  title?: string;
  position?: string;
  expertType?: string;
  industry?: string;
  professionalFields?: string[];
  specialties?: string[];
  experienceYears?: number;
  education?: string;
  introduction?: string;
  workExperience?: string;
  city?: string;
  avatarUrl?: string;
  coverImage?: string;
  partnerSource?: string;
  positionDirection?: string;
  photos?: string[];
  attachments?: string[];
  enterpriseId?: string;
  enterpriseName?: string;
  organization?: string;
  userId?: string;
  rating?: string;
}

export interface PartnerExpert extends AllianceExpert {
  userId?: string;
}

import type { CareerPosition } from './job';
import type { Scenario } from './scene';

export interface CoBuildPosition extends CareerPosition {
  schoolTenantId: string;
  schoolName?: string;
}

export interface CoBuildScenario extends Scenario {
  schoolTenantId: string;
  schoolName?: string;
}

export interface PartnerEnterprise {
  id: string;
  tenantId: string;
  name: string;
  unifiedSocialCreditCode?: string;
  industry?: string;
  region?: string;
  description?: string;
  logoUrl?: string;
  coverImage?: string;
  cooperationTypes?: string[];
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  establishedYear?: number;
  employeeCount?: number;
  businessLicensePhotos?: string[];
  qualificationPhotos?: string[];
  intellectualPropertyPhotos?: string[];
  coverPhotos?: string[];
  enablePublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerDashboard {
  expertCount: number;
  schoolCount: number;
  memberCount: number;
  publicExpertCount?: number;
  coBuildPositionCount?: number;
  coBuildScenarioCount?: number;
  monthlySchoolCounts?: { month: string; count: number }[];
  monthlyNewCounts?: { month: string; experts: number; positions: number; scenarios: number }[];
  contentMonthlyCounts?: { month: string; projects: number; agreements: number; achievements: number }[];
}

export interface EmploymentProject {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  organizer?: string;
  description?: string;
  coverImage?: string;
  startDate?: string;
  endDate?: string;
  publishStatus: string;
  enterpriseIds?: string[];
  jobCount: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentJob {
  id: string;
  tenantId: string;
  enterpriseId: string;
  projectId?: string;
  title: string;
  jobType: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  headcount?: number;
  education?: string;
  suitableMajors?: string[];
  description?: string;
  responsibilities?: string;
  requirements?: string;
  contactPerson?: string;
  contactPhone?: string;
  deadline?: string;
  status: string;
}

export interface PartnerSchool {
  linkId: string;
  tenantId: string;
  schoolName: string;
  relationType: string;
  status: string;
  rating?: string;
  enterpriseType?: string;
  isPublic: boolean;
  createdAt: string;
}

export type PartnerSchoolStatus = 'active' | 'paused' | 'terminated';

export interface PartnerCooperationProject {
  id: string;
  name: string;
  phase: string;
  isPublic: boolean;
  updatedAt: string;
}

export interface PartnerCooperationAchievement {
  id: string;
  title: string;
  type: string;
  isPublic: boolean;
  updatedAt: string;
}

export interface PartnerCooperationAgreement {
  id: string;
  name: string;
  type: string;
  status: string;
  isPublic: boolean;
  updatedAt: string;
}

export interface PartnerCooperationSchool {
  tenantId: string;
  schoolName: string;
  projects: PartnerCooperationProject[];
  achievements: PartnerCooperationAchievement[];
  agreements: PartnerCooperationAgreement[];
}

export interface PartnerCooperationOverview {
  schools: PartnerCooperationSchool[];
}

export interface PartnerCooperationProjectDetail {
  id: string;
  name: string;
  type?: string;
  description?: string;
  phase: string;
  publishStatus: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  secondaryColleges: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  milestones: {
    id: string;
    name: string;
    description?: string;
    dueDate?: string;
    completedDate?: string;
    isCompleted: boolean;
  }[];
}

export interface PartnerCooperationAchievementDetail {
  id: string;
  title: string;
  type: string;
  description?: string;
  achievementDate?: string;
  citationReason?: string;
  ownerPersons: string[];
  coBuilders: string[];
  secondaryColleges: string[];
  status: string;
  viewCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerCooperationAgreementDetail {
  id: string;
  name: string;
  type?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerMentorTask {
  taskId: string;
  taskName: string;
  stepLabel: string;
  schoolName: string;
  expertName: string;
  assignedCount: number;
  gradedCount: number;
  updatedAt: string;
}
