import { describe, expect, it } from 'vitest'
import { buildPositionSceneStats } from './position-scene-stats'
import type { Scenario } from '@/lib/types/scene'

function scenario(overrides: Partial<Scenario>): Scenario {
  return {
    id: 'sc-1',
    name: '场景',
    difficulty: 1,
    version: '1',
    status: 'published',
    creatorId: 'u1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildPositionSceneStats（/job/learn-roads 列表页按岗位统计场景数/任务数）', () => {
  it('空场景列表返回空 map', () => {
    expect(buildPositionSceneStats([]).size).toBe(0)
  })

  it('按 careerPositionId 分组统计场景数', () => {
    const stats = buildPositionSceneStats([
      scenario({ id: 'a', careerPositionId: 'p1' }),
      scenario({ id: 'b', careerPositionId: 'p1' }),
      scenario({ id: 'c', careerPositionId: 'p2' }),
    ])
    expect(stats.get('p1')).toEqual({ sceneCount: 2, taskCount: 0 })
    expect(stats.get('p2')).toEqual({ sceneCount: 1, taskCount: 0 })
  })

  it('任务数为该岗位所有场景 taskCount 之和（服务端实时计数）', () => {
    const stats = buildPositionSceneStats([
      scenario({ id: 'a', careerPositionId: 'p1', taskCount: 3 }),
      scenario({ id: 'b', careerPositionId: 'p1', taskCount: 4 }),
      scenario({ id: 'c', careerPositionId: 'p2', taskCount: 2 }),
    ])
    expect(stats.get('p1')).toEqual({ sceneCount: 2, taskCount: 7 })
    expect(stats.get('p2')).toEqual({ sceneCount: 1, taskCount: 2 })
  })

  it('taskCount 缺失（undefined）按 0 处理', () => {
    const stats = buildPositionSceneStats([
      scenario({ id: 'a', careerPositionId: 'p1' }),
      scenario({ id: 'b', careerPositionId: 'p1', taskCount: 5 }),
    ])
    expect(stats.get('p1')).toEqual({ sceneCount: 2, taskCount: 5 })
  })

  it('未携带 careerPositionId 的孤儿场景不计入任何岗位', () => {
    const stats = buildPositionSceneStats([
      scenario({ id: 'a', careerPositionId: 'p1', taskCount: 2 }),
      scenario({ id: 'b', taskCount: 9 }),
    ])
    expect(stats.get('p1')).toEqual({ sceneCount: 1, taskCount: 2 })
    expect(stats.get(undefined as any)).toBeUndefined()
  })
})
