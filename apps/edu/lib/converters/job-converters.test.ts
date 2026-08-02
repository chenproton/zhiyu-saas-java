import { describe, it, expect } from 'vitest'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  convertApiRecommendationToLocal,
  convertApiResponsibilityToLocal,
  convertApiCertificateToLocal,
  convertApiAbilityBindingToLocal,
  convertApiAbilityDomainToLocal,
  positionToCreateRequest,
} from './job-converters'
import type {
  CareerPosition,
  JobBatch,
  PositionRecommendation,
  PositionAbilityBinding,
} from '@/lib/types/job'

describe('convertCareerPositionToPosition', () => {
  const cp: CareerPosition = {
    id: 'p1',
    name: '智能制造工程师',
    majorIds: ['m1'],
    positionType: 'enterprise',
    requirements: [],
    version: 'v1',
    status: 'published',
    createdBy: 'u1',
    collaborators: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }

  it('基础字段与默认值映射', () => {
    const p = convertCareerPositionToPosition(cp)
    expect(p.id).toBe('p1')
    expect(p.code).toBe('')
    expect(p.batchId).toBe('')
    expect(p.industry).toBe('')
    expect(p.majors).toEqual(['m1'])
    expect(p.salaryRange).toEqual([0, 0])
    expect(p.certificates).toEqual([])
    expect(p.favoriteCount).toBe(0)
  })

  it('无 shortName 时超长名称截断为 10 字', () => {
    const long = { ...cp, name: '智能制造工程与管理一体化工程师' }
    expect(convertCareerPositionToPosition(long).shortName).toBe('智能制造工程与管理一')
    expect(convertCareerPositionToPosition(cp).shortName).toBe('智能制造工程师')
  })

  it('salaryMin/salaryMax 映射为 salaryRange', () => {
    const p = convertCareerPositionToPosition({ ...cp, salaryMin: 8000, salaryMax: 15000 })
    expect(p.salaryRange).toEqual([8000, 15000])
  })
})

describe('convertJobBatchToBatch', () => {
  it('字段映射与默认值', () => {
    const jb: JobBatch = {
      id: 'b1',
      name: '2026 春招',
      orgNodeId: 'node1',
      majorId: 'm1',
      majorName: '智能制造',
      status: 'open',
      positionCount: 0,
      publishedCount: 0,
      pendingCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const b = convertJobBatchToBatch(jb)
    expect(b.department).toBe('node1')
    expect(b.major).toBe('智能制造')
    expect(b.workflowId).toBe('')
    expect(b.positionCount).toBe(0)
  })
})

describe('convertApiRecommendationToLocal', () => {
  it('majorName 缺省为空串', () => {
    const rec: PositionRecommendation = {
      id: 'r1',
      careerPositionId: 'p1',
      positionType: 'enterprise',
      sortOrder: 1,
      isEnabled: true,
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const r = convertApiRecommendationToLocal(rec)
    expect(r.major).toBe('')
    expect(r.positionId).toBe('p1')
    expect(r.order).toBe(1)
  })
})

describe('convertApiResponsibilityToLocal', () => {
  it('description 缺省为空串', () => {
    const r = convertApiResponsibilityToLocal({
      id: 'x1',
      careerPositionId: 'p1',
      name: '设备调试',
      sortOrder: 1,
    })
    expect(r.description).toBe('')
  })
})

describe('convertApiCertificateToLocal', () => {
  it('libraryId 与 url/image 映射', () => {
    const c = convertApiCertificateToLocal({
      id: 'c1',
      careerPositionId: 'p1',
      certificateLibraryId: 'lib1',
      name: '焊工证',
      imageUrl: '/img.png',
    })
    expect(c.libraryId).toBe('lib1')
    expect(c.url).toBe('')
    expect(c.image).toBe('/img.png')
  })
})

describe('convertApiAbilityBindingToLocal', () => {
  it('public 来源回填 publicAbilityId，名称类别留空待调用方补全', () => {
    const b: PositionAbilityBinding = {
      id: 'b1',
      careerPositionId: 'p1',
      responsibilityId: 'x1',
      source: 'public',
      abilityPointId: 'ap1',
      requiredLevel: '3',
      attributes: [],
      weight: 1,
    }
    const r = convertApiAbilityBindingToLocal(b)
    expect(r.publicAbilityId).toBe('ap1')
    expect(r.name).toBe('')
    expect(r.category).toBe('')
    expect(r.level).toBe('3')
    expect(r.description).toBe('')
  })

  it('非 public 来源不填 publicAbilityId', () => {
    const b: PositionAbilityBinding = {
      id: 'b2',
      careerPositionId: 'p1',
      responsibilityId: 'x1',
      source: 'custom',
      abilityPointId: 'ap2',
      requiredLevel: '2',
      attributes: [],
      weight: 1,
    }
    const r = convertApiAbilityBindingToLocal(b)
    expect(r.publicAbilityId).toBeUndefined()
  })
})

describe('convertApiAbilityDomainToLocal', () => {
  it('bindingIds 缺省为空数组', () => {
    const d = convertApiAbilityDomainToLocal({
      id: 'd1',
      careerPositionId: 'p1',
      name: '专业能力',
      bindingIds: [],
      sortOrder: 1,
    })
    expect(d.bindingIds).toEqual([])
    expect(d.description).toBe('')
  })
})

describe('positionToCreateRequest', () => {
  it('反向映射并清理空值', () => {
    const p = convertCareerPositionToPosition({
      id: 'p1',
      name: '智能制造工程师',
      shortName: '智造',
      industryId: 'i1',
      majorIds: ['m1'],
      positionType: 'enterprise',
      salaryMin: 8000,
      salaryMax: 15000,
      requirements: ['r1'],
      version: 'v1',
      status: 'draft',
      createdBy: 'u1',
      collaborators: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    const req = positionToCreateRequest({
      ...p,
      batchId: 'b1',
      industry: 'i1',
      salaryRange: [8000, 15000],
    })
    expect(req.batchId).toBe('b1')
    expect(req.industryId).toBe('i1')
    expect(req.salaryMin).toBe(8000)
    expect(req.salaryMax).toBe(15000)
    expect(req.shortName).toBe('智造')
  })

  it('空 batchId 转为 undefined，salaryRange 原样透传', () => {
    const base = convertCareerPositionToPosition({
      id: 'p1',
      name: '测试',
      majorIds: [],
      positionType: 'teaching',
      requirements: [],
      version: 'v1',
      status: 'draft',
      createdBy: 'u1',
      collaborators: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    const req = positionToCreateRequest(base)
    expect(req.batchId).toBeUndefined()
    expect(req.salaryMin).toBe(0)
    expect(req.salaryMax).toBe(0)
  })
})
