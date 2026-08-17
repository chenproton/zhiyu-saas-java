import type { LearnRoad } from '@/lib/types'
import type { Scenario } from '@/lib/types/scene'

/**
 * 按学习路径（/job/learn-roads）对实践场景排序。
 *
 * 岗位落地页「实践场景」tab 与学习页（/job/landing/[id]/learn）共用本函数，
 * 保证两页场景排列顺序一致、统一受 /job/learn-roads 管理（见
 * docs/spec/05-prototype-interaction.md §2.6 与 docs/系统功能清单.md 职业岗位学习平台）。
 *
 * 规则：
 *   1. 取该岗位关联的第一条学习路径（roads[0]）；
 *   2. 按 road.steps 顺序优先以 step.scenarioId 匹配场景，旧数据无 scenarioId 时
 *      按步骤名兜底匹配场景名；
 *   3. 未出现在 steps 中的场景追加在末尾，保持原相对顺序。
 *
 * 无关联学习路径 / 无 steps / 未匹配时返回原顺序；场景为空返回 []。
 */
export function orderScenariosByLearnRoad(roads: LearnRoad[], scenarios: Scenario[]): Scenario[] {
  if (!scenarios.length) return []
  const road = roads[0]
  if (!road?.steps?.length) return scenarios

  const scenarioMap = new Map(scenarios.map((s) => [s.id, s]))
  const usedIds = new Set<string>()
  const result: Scenario[] = []

  for (const step of road.steps) {
    if (step.scenarioId && scenarioMap.has(step.scenarioId) && !usedIds.has(step.scenarioId)) {
      const sc = scenarioMap.get(step.scenarioId)!
      result.push(sc)
      usedIds.add(sc.id)
      continue
    }
    // 兼容旧数据：按名称匹配
    const matched = scenarios.find((s) => s.name === step.name && !usedIds.has(s.id))
    if (matched) {
      result.push(matched)
      usedIds.add(matched.id)
    }
  }

  for (const sc of scenarios) {
    if (!usedIds.has(sc.id)) result.push(sc)
  }
  return result
}
