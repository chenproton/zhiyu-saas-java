import { describe, expect, it } from 'vitest'
import { orderScenariosByLearnRoad } from './learn-road-order'
import type { LearnRoad } from '@/lib/types'
import type { Scenario } from '@/lib/types/scene'

// 最小场景对象：仅测试排序所需字段
function scene(id: string, name: string): Scenario {
  return { id, name, difficulty: 1, version: 'v1', status: 'published' } as Scenario
}

const sA = scene('a', '场景A')
const sB = scene('b', '场景B')
const sC = scene('c', '场景C')

function road(overrides: Partial<LearnRoad> = {}): LearnRoad {
  return {
    id: 'r1',
    name: '学习路径',
    positionIds: ['p1'],
    steps: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('orderScenariosByLearnRoad（landing 实践场景 tab 与 learn 页共用排序）', () => {
  it('无场景时返回空数组', () => {
    expect(orderScenariosByLearnRoad([road()], [])).toEqual([])
  })

  it('无关联学习路径时保持原顺序', () => {
    expect(orderScenariosByLearnRoad([], [sA, sB, sC])).toEqual([sA, sB, sC])
  })

  it('学习路径无 steps 时保持原顺序', () => {
    expect(orderScenariosByLearnRoad([road({ steps: [] })], [sA, sB, sC])).toEqual([sA, sB, sC])
  })

  it('按 steps 的 scenarioId 顺序重排场景', () => {
    const roads = [road({ steps: [{ name: '第一步', scenarioId: 'c' }, { name: '第二步', scenarioId: 'a' }, { name: '第三步', scenarioId: 'b' }] })]
    expect(orderScenariosByLearnRoad(roads, [sA, sB, sC])).toEqual([sC, sA, sB])
  })

  it('未出现在 steps 中的场景追加在末尾并保持原相对顺序', () => {
    const roads = [road({ steps: [{ name: '第一步', scenarioId: 'b' }] })]
    expect(orderScenariosByLearnRoad(roads, [sA, sB, sC])).toEqual([sB, sA, sC])
  })

  it('steps 未配置 scenarioId 时按步骤名兜底匹配场景名（兼容旧数据）', () => {
    const roads = [road({ steps: [{ name: '场景C' }, { name: '场景A' }] })]
    expect(orderScenariosByLearnRoad(roads, [sA, sB, sC])).toEqual([sC, sA, sB])
  })

  it('同一场景在多个步骤重复出现时只保留首次位置', () => {
    const roads = [road({ steps: [{ name: '一', scenarioId: 'a' }, { name: '二', scenarioId: 'a' }] })]
    expect(orderScenariosByLearnRoad(roads, [sA, sB])).toEqual([sA, sB])
  })

  it('steps 中的 scenarioId 不在场景列表时跳过，仅名称兜底命中才纳入', () => {
    const roads = [road({ steps: [{ name: '不存在', scenarioId: 'x' }] })]
    expect(orderScenariosByLearnRoad(roads, [sA, sB])).toEqual([sA, sB])
  })

  it('多条路径时取第一条（roads[0]）', () => {
    const roads = [
      road({ steps: [{ name: '一', scenarioId: 'b' }] }),
      road({ id: 'r2', positionIds: ['p1'], steps: [{ name: '一', scenarioId: 'a' }] }),
    ]
    expect(orderScenariosByLearnRoad(roads, [sA, sB])).toEqual([sB, sA])
  })
})
