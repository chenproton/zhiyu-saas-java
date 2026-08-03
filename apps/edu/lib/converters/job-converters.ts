import type {
  Batch,
  Position,
  PositionType,
  PositionRecommendation,
  Ability,
  PositionResponsibility,
  PositionCertificate,
  PositionAbilityBinding,
  AbilityDomain,
} from '@/lib/types/job-source'
import type {
  CareerPosition,
  JobBatch,
  PositionRecommendation as ApiPositionRecommendation,
  PositionResponsibility as ApiPositionResponsibility,
  PositionCertificate as ApiPositionCertificate,
  PositionAbilityBinding as ApiPositionAbilityBinding,
  AbilityDomain as ApiAbilityDomain,
} from '@/lib/types/job'
import type { AbilityPoint } from '@/lib/types/job'

export function convertCareerPositionToPosition(cp: CareerPosition): Position {
  return {
    id: cp.id,
    code: cp.code || '',
    batchId: cp.batchId || '',
    version: cp.version,
    status: cp.status,
    name: cp.name,
    shortName: cp.shortName || (cp.name.length > 10 ? cp.name.slice(0, 10) : cp.name),
    industry: cp.industryId || '',
    majors: cp.majorIds,
    positionType: cp.positionType,
    salaryRange: [cp.salaryMin ?? 0, cp.salaryMax ?? 0] as [number, number],
    coverImage: cp.coverImage,
    certificates: [],
    description: cp.description || '',
    responsibilities: [],
    requirements: cp.requirements,
    careerPath: cp.careerPath || '',
    abilityModel: { nodes: [], edges: [] },
    abilityBindings: [],
    abilityDomains: [],
    competencyConfig: [],
    createdBy: cp.createdBy,
    collaborators: cp.collaborators,
    createdAt: cp.createdAt,
    updatedAt: cp.updatedAt,
    favoriteCount: 0,
  }
}

export function convertJobBatchToBatch(jb: JobBatch): Batch {
  return {
    id: jb.id,
    name: jb.name,
    orgNodeId: jb.orgNodeId,
    department: jb.orgNodeId || '',
    majorId: jb.majorId,
    major: jb.majorName || '',
    workflowId: jb.workflowId || '',
    status: jb.status,
    positionCount: jb.positionCount || 0,
    publishedCount: jb.publishedCount || 0,
    pendingCount: jb.pendingCount || 0,
    createdAt: jb.createdAt,
    updatedAt: jb.updatedAt,
  }
}

export function convertApiRecommendationToLocal(
  rec: ApiPositionRecommendation,
): PositionRecommendation {
  return {
    id: rec.id,
    major: rec.majorName || '',
    positionId: rec.careerPositionId,
    positionType: rec.positionType as PositionType,
    reason: rec.reason ?? undefined,
    order: rec.sortOrder,
    isEnabled: rec.isEnabled,
    createdBy: rec.createdBy,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  }
}

export function convertApiAbilityToLocal(a: AbilityPoint): Ability {
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    description: a.description ?? '',
    attributes: a.attributes || [],
    isPublic: a.isPublic ?? false,
    createdAt: a.createdAt,
  }
}

export function positionToCreateRequest(
  data: Partial<Omit<Position, 'id' | 'createdAt' | 'updatedAt'>>,
): Partial<Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>> {
  return {
    batchId: data.batchId || undefined,
    name: data.name,
    shortName: data.shortName || undefined,
    industryId: data.industry || undefined,
    majorIds: data.majors ?? [],
    positionType: data.positionType,
    salaryMin: data.salaryRange?.[0],
    salaryMax: data.salaryRange?.[1],
    coverImage: data.coverImage,
    description: data.description,
    requirements: data.requirements ?? [],
    careerPath: data.careerPath,
    version: data.version,
    status: data.status,
    createdBy: data.createdBy,
    collaborators: data.collaborators ?? [],
  }
}

export function convertApiResponsibilityToLocal(
  r: ApiPositionResponsibility,
): PositionResponsibility {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
  }
}

export function convertApiCertificateToLocal(c: ApiPositionCertificate): PositionCertificate {
  return {
    id: c.id,
    libraryId: c.certificateLibraryId,
    name: c.name,
    url: c.url ?? '',
    description: c.description ?? '',
    image: c.imageUrl ?? '',
  }
}

export function convertApiAbilityBindingToLocal(
  b: ApiPositionAbilityBinding,
): PositionAbilityBinding {
  return {
    id: b.id,
    responsibilityId: b.responsibilityId,
    source: b.source as PositionAbilityBinding['source'],
    publicAbilityId: b.source === 'public' ? b.abilityPointId : undefined,
    abilityPointId: b.abilityPointId,
    name: '', // filled by caller from ability point map if needed
    category: '',
    level: b.requiredLevel as PositionAbilityBinding['level'],
    rubricDescription: b.rubricDescription ?? '',
    description: b.rubricDescription ?? '',
    attributes: b.attributes || [],
    domain: b.domain ?? '',
  }
}

export function convertApiAbilityDomainToLocal(d: ApiAbilityDomain): AbilityDomain {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? '',
    bindingIds: d.bindingIds || [],
  }
}
