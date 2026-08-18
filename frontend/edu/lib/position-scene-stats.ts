import type { Scenario } from '@/lib/types/scene'

export interface PositionSceneStats {
  sceneCount: number
  taskCount: number
}

/**
 * 按岗位（careerPositionId）统计关联场景数与任务总数。
 *
 * 供 /job/learn-roads 列表页「场景数/任务数」列使用：统计口径为
 * 「该岗位所有关联场景数量 + 这些场景下所有任务数量加总」的实时数据，
 * 而非学习路径 steps 快照（steps 是保存时缓存，场景/任务增删后不更新，
 * 且无学习路径的岗位会错误显示 0）。见
 * docs/spec/05-prototype-interaction.md §2.6 与 docs/系统功能清单.md。
 *
 * 场景的 taskCount 由服务端场景列表接口返回（scenario_tasks 实时计数）；
 * 未携带 careerPositionId 的孤儿场景不计入任何岗位。
 */
export function buildPositionSceneStats(
  scenarios: Scenario[],
): Map<string, PositionSceneStats> {
  const stats = new Map<string, PositionSceneStats>()
  for (const s of scenarios) {
    if (!s.careerPositionId) continue
    const cur = stats.get(s.careerPositionId) ?? { sceneCount: 0, taskCount: 0 }
    cur.sceneCount += 1
    cur.taskCount += s.taskCount ?? 0
    stats.set(s.careerPositionId, cur)
  }
  return stats
}
