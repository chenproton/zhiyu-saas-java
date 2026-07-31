import { portalRequest, buildQuery } from "../api-helpers"
import type {
  AllianceSchoolInfo,
  AllianceEnterprise,
  AllianceEnterpriseAgreement,
  AllianceProject,
  AllianceProjectMilestone,
  AllianceAchievement,
  AllianceExpert,
  AllianceAgreement,
  AlliancePermission,
  AllianceDictionary,
  AllianceBrand,
  AllianceBrandTopic,
  AlliancePublicStats,
  AllianceListResponse,
} from "../types/alliance"

export const allianceApi = {
  schoolInfo: {
    get: () => portalRequest<AllianceSchoolInfo>("/alliance/school-info"),
    update: (data: Partial<AllianceSchoolInfo>) =>
      portalRequest<AllianceSchoolInfo>("/alliance/school-info", { method: "PUT", body: JSON.stringify(data) }),
  },

  enterprises: {
    list: (params?: { search?: string; status?: string; rating?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceEnterprise>>(`/alliance/enterprises${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
    create: (data: Partial<AllianceEnterprise>) =>
      portalRequest<AllianceEnterprise>("/alliance/enterprises", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceEnterprise>) =>
      portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/enterprises/${id}`, { method: "DELETE" }),
  },

  enterpriseAgreements: {
    list: (enterpriseId: string) =>
      portalRequest<AllianceListResponse<AllianceEnterpriseAgreement>>(`/alliance/enterprises/${enterpriseId}/agreements`),
    create: (enterpriseId: string, data: Partial<AllianceEnterpriseAgreement>) =>
      portalRequest<AllianceEnterpriseAgreement>(`/alliance/enterprises/${enterpriseId}/agreements`, { method: "POST", body: JSON.stringify(data) }),
    update: (enterpriseId: string, id: string, data: Partial<AllianceEnterpriseAgreement>) =>
      portalRequest<AllianceEnterpriseAgreement>(`/alliance/enterprises/${enterpriseId}/agreements/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (enterpriseId: string, id: string) =>
      portalRequest<{ id: string }>(`/alliance/enterprises/${enterpriseId}/agreements/${id}`, { method: "DELETE" }),
  },

  projects: {
    list: (params?: { search?: string; phase?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceProject>>(`/alliance/projects${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceProject>(`/alliance/projects/${id}`),
    create: (data: Partial<AllianceProject>) =>
      portalRequest<AllianceProject>("/alliance/projects", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceProject>) =>
      portalRequest<AllianceProject>(`/alliance/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/projects/${id}`, { method: "DELETE" }),
  },

  milestones: {
    list: (projectId: string) =>
      portalRequest<AllianceListResponse<AllianceProjectMilestone>>(`/alliance/projects/${projectId}/milestones`),
    create: (projectId: string, data: Partial<AllianceProjectMilestone>) =>
      portalRequest<{ id: string }>(`/alliance/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(data) }),
    update: (projectId: string, id: string, data: Partial<AllianceProjectMilestone>) =>
      portalRequest<{ id: string }>(`/alliance/projects/${projectId}/milestones/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (projectId: string, id: string) =>
      portalRequest<{ id: string }>(`/alliance/projects/${projectId}/milestones/${id}`, { method: "DELETE" }),
  },

  achievements: {
    list: (params?: { search?: string; type?: string; status?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceAchievement>>(`/alliance/achievements${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceAchievement>(`/alliance/achievements/${id}`),
    create: (data: Partial<AllianceAchievement>) =>
      portalRequest<AllianceAchievement>("/alliance/achievements", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceAchievement>) =>
      portalRequest<AllianceAchievement>(`/alliance/achievements/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/achievements/${id}`, { method: "DELETE" }),
  },

  experts: {
    list: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceExpert>>(`/alliance/experts${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceExpert>(`/alliance/experts/${id}`),
    create: (data: Partial<AllianceExpert>) =>
      portalRequest<AllianceExpert>("/alliance/experts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceExpert>) =>
      portalRequest<AllianceExpert>(`/alliance/experts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/experts/${id}`, { method: "DELETE" }),
  },

  agreements: {
    list: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceAgreement>>(`/alliance/agreements${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceAgreement>(`/alliance/agreements/${id}`),
    create: (data: Partial<AllianceAgreement>) =>
      portalRequest<AllianceAgreement>("/alliance/agreements", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceAgreement>) =>
      portalRequest<AllianceAgreement>(`/alliance/agreements/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/agreements/${id}`, { method: "DELETE" }),
  },

  permissions: {
    list: (params?: { search?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AlliancePermission>>(`/alliance/permissions${buildQuery(params || {})}`),
    create: (data: Partial<AlliancePermission>) =>
      portalRequest<{ id: string }>("/alliance/permissions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AlliancePermission>) =>
      portalRequest<{ id: string }>(`/alliance/permissions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/permissions/${id}`, { method: "DELETE" }),
  },

  dictionaries: {
    list: (dictType: string) =>
      portalRequest<AllianceListResponse<AllianceDictionary>>(`/alliance/dictionaries/${dictType}`),
    create: (dictType: string, data: { code: string; name: string; sortOrder?: number }) =>
      portalRequest<{ id: string }>(`/alliance/dictionaries/${dictType}`, { method: "POST", body: JSON.stringify(data) }),
    update: (dictType: string, id: string, data: { name: string; sortOrder?: number }) =>
      portalRequest<{ id: string }>(`/alliance/dictionaries/${dictType}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (dictType: string, id: string) =>
      portalRequest<{ id: string }>(`/alliance/dictionaries/${dictType}/${id}`, { method: "DELETE" }),
  },

  brands: {
    list: (params?: { brandType?: string; status?: string; search?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceBrand>>(`/alliance/brands${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceBrand>(`/alliance/brands/${id}`),
    create: (data: Partial<AllianceBrand>) =>
      portalRequest<AllianceBrand>("/alliance/brands", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceBrand>) =>
      portalRequest<AllianceBrand>(`/alliance/brands/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/brands/${id}`, { method: "DELETE" }),
  },

  brandTopics: {
    list: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
      portalRequest<AllianceListResponse<AllianceBrandTopic>>(`/alliance/brand-topics${buildQuery(params || {})}`),
    get: (id: string) => portalRequest<AllianceBrandTopic>(`/alliance/brand-topics/${id}`),
    create: (data: Partial<AllianceBrandTopic>) =>
      portalRequest<AllianceBrandTopic>("/alliance/brand-topics", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AllianceBrandTopic>) =>
      portalRequest<AllianceBrandTopic>(`/alliance/brand-topics/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      portalRequest<{ id: string }>(`/alliance/brand-topics/${id}`, { method: "DELETE" }),
  },

  public: {
    stats: () => portalRequest<AlliancePublicStats>("/alliance/public/stats"),
    schoolInfo: (tenantId: string) => portalRequest<AllianceSchoolInfo>(`/alliance/public/school-info?tenantId=${tenantId}`),
    enterprises: () => portalRequest<AllianceListResponse<AllianceEnterprise>>("/alliance/public/enterprises"),
    enterprise: (id: string) => portalRequest<AllianceEnterprise>(`/alliance/public/enterprises/${id}`),
    projects: () => portalRequest<AllianceListResponse<AllianceProject>>("/alliance/public/projects"),
    project: (id: string) => portalRequest<AllianceProject>(`/alliance/public/projects/${id}`),
    achievements: () => portalRequest<AllianceListResponse<AllianceAchievement>>("/alliance/public/achievements"),
    achievement: (id: string) => portalRequest<AllianceAchievement>(`/alliance/public/achievements/${id}`),
    experts: () => portalRequest<AllianceListResponse<AllianceExpert>>("/alliance/public/experts"),
    expert: (id: string) => portalRequest<AllianceExpert>(`/alliance/public/experts/${id}`),
    brands: (brandType?: string) =>
      portalRequest<AllianceListResponse<AllianceBrand>>(`/alliance/public/brands${brandType ? `?brandType=${brandType}` : ""}`),
    brand: (id: string) => portalRequest<AllianceBrand>(`/alliance/public/brands/${id}`),
    brandTopics: () => portalRequest<AllianceListResponse<AllianceBrandTopic>>("/alliance/public/brand-topics"),
    brandTopic: (id: string) => portalRequest<AllianceBrandTopic>(`/alliance/public/brand-topics/${id}`),
  },
}
