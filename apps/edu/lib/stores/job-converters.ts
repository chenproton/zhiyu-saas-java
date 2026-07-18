import type {
  Batch,
  Position,
  PositionType,
  Workflow,
  ApprovalRecord,
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
import type {
  Workflow as ApiWorkflow,
  ApprovalRecord as ApiApprovalRecord,
} from '@/lib/types/backend'
import type { AbilityPoint } from '@/lib/types/job'

export function convertApiWorkflowToLocal(w: ApiWorkflow): Workflow {
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    steps: (w.steps || []).map((s, index) => ({
      name: s.name || '',
      order: index,
      approverIds: s.approverIds || [],
      approvalMode: s.approvalMode || 'any',
    })),
    majorIds: w.majorIds || [],
    createdAt: w.createdAt,
  }
}

export function convertCareerPositionToPosition(cp: CareerPosition): Position {
  return {
    id: cp.id,
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

export function convertApiApprovalToLocal(
  ar: ApiApprovalRecord,
  positionMap: Map<string, CareerPosition>
): ApprovalRecord {
  const position = positionMap.get(ar.targetId)
  const history = (ar.history || []).map((h, idx) => ({
    id: h.stepId || `hist-${ar.id}-${idx}`,
    stepId: h.stepId || String(idx),
    stepName: h.stepName || `第 ${idx + 1} 步`,
    reviewerId: h.reviewerId || '',
    reviewerName: h.reviewerName || h.reviewerId || '',
    status: (h.status as ApprovalRecord['status']) || 'approved',
    comment: h.comment || '',
    createdAt: h.createdAt || ar.updatedAt,
  }))
  return {
    id: ar.id,
    positionId: ar.targetId,
    positionName: position?.name || ar.targetId,
    workflowId: ar.workflowId || '',
    currentStepIndex: ar.currentStepIdx ?? 0,
    status: ar.status,
    submittedBy: ar.submitterId || '',
    submittedByName: ar.submitterId || '',
    history,
    createdAt: ar.createdAt,
    updatedAt: ar.updatedAt,
  }
}

export function convertApiRecommendationToLocal(rec: ApiPositionRecommendation): PositionRecommendation {
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
    isPublic: a.isPublic ?? false,
    createdAt: a.createdAt,
  }
}

export function positionToCreateRequest(data: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>): Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    batchId: data.batchId || undefined,
    name: data.name,
    shortName: data.shortName || undefined,
    industryId: data.industry || undefined,
    majorIds: data.majors,
    positionType: data.positionType,
    salaryMin: data.salaryRange?.[0],
    salaryMax: data.salaryRange?.[1],
    coverImage: data.coverImage,
    description: data.description,
    requirements: data.requirements,
    careerPath: data.careerPath,
    version: data.version,
    status: data.status,
    createdBy: data.createdBy,
    collaborators: data.collaborators,
  }
}

export function positionToUpdateRequest(data: Partial<Position>): Partial<Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>> {
  const req: Partial<Omit<CareerPosition, 'id' | 'createdAt' | 'updatedAt'>> = {}
  if (data.batchId !== undefined) req.batchId = data.batchId || undefined
  if (data.name !== undefined) req.name = data.name
  if (data.shortName !== undefined) req.shortName = data.shortName
  if (data.industry !== undefined) req.industryId = data.industry || undefined
  if (data.majors !== undefined) req.majorIds = data.majors
  if (data.positionType !== undefined) req.positionType = data.positionType
  if (data.salaryRange !== undefined) {
    req.salaryMin = data.salaryRange[0]
    req.salaryMax = data.salaryRange[1]
  }
  if (data.coverImage !== undefined) req.coverImage = data.coverImage
  if (data.description !== undefined) req.description = data.description
  if (data.requirements !== undefined) req.requirements = data.requirements
  if (data.careerPath !== undefined) req.careerPath = data.careerPath
  if (data.version !== undefined) req.version = data.version
  if (data.status !== undefined) req.status = data.status
  if (data.createdBy !== undefined) req.createdBy = data.createdBy
  if (data.collaborators !== undefined) req.collaborators = data.collaborators
  return req
}

export function convertApiResponsibilityToLocal(r: ApiPositionResponsibility): PositionResponsibility {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
  }
}

export function convertLocalResponsibilityToApi(r: PositionResponsibility): Omit<ApiPositionResponsibility, 'id'> {
  return {
    careerPositionId: '', // filled by caller
    name: r.name,
    description: r.description || undefined,
    sortOrder: 0,
  }
}

export function convertApiCertificateToLocal(c: ApiPositionCertificate): PositionCertificate {
  return {
    id: c.id,
    name: c.name,
    url: c.url ?? '',
    description: c.description ?? '',
    image: c.imageUrl ?? '',
  }
}

export function convertLocalCertificateToApi(c: PositionCertificate): Omit<ApiPositionCertificate, 'id'> {
  return {
    careerPositionId: '', // filled by caller
    name: c.name,
    url: c.url || undefined,
    description: c.description || undefined,
    imageUrl: c.image || undefined,
  }
}

export function convertApiAbilityBindingToLocal(b: ApiPositionAbilityBinding): PositionAbilityBinding {
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

export function convertLocalAbilityBindingToApi(b: PositionAbilityBinding): Omit<ApiPositionAbilityBinding, 'id'> {
  return {
    careerPositionId: '', // filled by caller
    responsibilityId: b.responsibilityId,
    abilityPointId: b.abilityPointId || b.publicAbilityId || '',
    source: b.source,
    domain: b.domain || undefined,
    requiredLevel: b.level,
    rubricDescription: b.rubricDescription || undefined,
    attributes: b.attributes || [],
    weight: 0,
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

export function convertLocalAbilityDomainToApi(d: AbilityDomain): Omit<ApiAbilityDomain, 'id'> {
  return {
    careerPositionId: '', // filled by caller
    name: d.name,
    description: d.description || undefined,
    bindingIds: d.bindingIds,
    sortOrder: 0,
  }
}
