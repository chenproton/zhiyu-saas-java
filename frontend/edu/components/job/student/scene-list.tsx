'use client'

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, Play, Expand, Shrink, Layers, Clock, Target, BookOpen } from 'lucide-react'
import { EmptyState } from '@zhiyu/ui'
import type { Scenario, ScenarioTask } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface SceneListProps {
  scenarios?: Scenario[]
  tasks?: ScenarioTask[]
}

const SCENE_ICONS = [BookOpen, Target, Layers, Clock, Play]
const SCENE_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-violet-600',
  'bg-teal-500',
  'bg-pink-500',
]

export function SceneList({ scenarios = [], tasks = [] }: SceneListProps) {
  const t = useT()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true })

  const taskMap = useMemo(() => {
    const map = new Map<string, ScenarioTask[]>()
    tasks.forEach((t) => {
      const list = map.get(t.scenarioId) || []
      list.push(t)
      map.set(t.scenarioId, list)
    })
    return map
  }, [tasks])

  const totalHours = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    [tasks],
  )

  const toggle = (idx: number) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const expandAll = () => setExpanded(scenarios.reduce((acc, _, i) => ({ ...acc, [i]: true }), {}))
  const collapseAll = () => setExpanded({})

  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-12 h-12 opacity-40" />}
        title={t('暂无关联实践场景')}
        className="py-12 bg-white rounded-2xl border border-[#e7e5e4]"
        titleClassName="text-[#94a3b8]"
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <span className="text-sm text-[#64748b]">
          {t('共关联 {s} 个实践场景，{t} 个任务，合计 {h} 课时', {
            s: scenarios.length,
            t: tasks.length,
            h: totalHours,
          })}
        </span>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-xs border border-[#e7e5e4] rounded-md bg-white text-[#475569] hover:bg-[#f8fafc] flex items-center gap-1"
            onClick={expandAll}
          >
            <Expand className="w-3 h-3" /> {t('全部展开')}
          </button>
          <button
            className="px-3 py-1.5 text-xs border border-[#e7e5e4] rounded-md bg-white text-[#475569] hover:bg-[#f8fafc] flex items-center gap-1"
            onClick={collapseAll}
          >
            <Shrink className="w-3 h-3" /> {t('全部收起')}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {scenarios.map((scene, idx) => {
          const sceneTasks = taskMap.get(scene.id) || []
          const hours = sceneTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
          const Icon = SCENE_ICONS[idx % SCENE_ICONS.length]
          const color = SCENE_COLORS[idx % SCENE_COLORS.length]

          return (
            <div
              key={scene.id}
              className="bg-white rounded-xl border border-[#f5f5f4] overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#f8fafc] transition-colors"
                onClick={() => toggle(idx)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center text-white`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[15px] font-medium text-[#1f2937]">{scene.name}</div>
                    <div className="text-xs text-[#64748b]">
                      {t('{n}个任务 · {h}课时', { n: sceneTasks.length, h: hours })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                    onClick={() => navigate(`/scene/landing/${scene.id}`)}
                  >
                    <Play className="w-3 h-3" /> {t('去学习')}
                  </button>
                  <ChevronDown
                    className={`w-5 h-5 text-[#94a3b8] transition-transform ${expanded[idx] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {expanded[idx] && (
                <div className="px-4 pb-4">
                  {sceneTasks.length === 0 && (
                    <div className="text-xs text-[#94a3b8] py-3 border-t border-[#f5f5f4]">
                      {t('暂无任务')}
                    </div>
                  )}
                  {sceneTasks.map((task, ti) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between py-3 border-t border-[#f5f5f4]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/5 text-primary flex items-center justify-center text-xs font-bold">
                          {ti + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#1f2937]">{task.name}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                              {task.taskType === 'assessment' ? t('测评任务') : t('训练任务')}
                            </span>
                            {task.abilityPointNames?.slice(0, 7).map((name) => (
                              <span
                                key={name}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]"
                              >
                                {name}
                              </span>
                            ))}
                            {task.abilityPointNames && task.abilityPointNames.length > 7 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                                +{task.abilityPointNames.length - 7}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-[#94a3b8]">
                        {t('{n}课时', { n: task.estimatedHours })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
