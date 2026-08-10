'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Briefcase, FileWarning, Target, Lightbulb, BookOpen, X, ArrowRight, Map, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useGraphData } from './graph-data-context'
import type { GraphNode } from './types'
import { cn } from '@/lib/utils'
import type { PositionAbilityBinding, AbilityDomain, KnowledgePoint } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'

export type NodeLite = { id: string; type: GraphNode['type']; label: string }

const COURSE_TYPE_LABEL: Record<string, string> = {
  course: '颗粒课',
  material: '课件',
  quiz: '测验',
}

const GRAPH_TYPE_META: Record<
  GraphNode['type'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  position: { label: '岗位', color: '#6366f1', icon: <Briefcase className="size-4" /> },
  domain: { label: '能力领域', color: '#f43f5e', icon: <FileWarning className="size-4" /> },
  unit: { label: '能力点', color: '#10b981', icon: <Target className="size-4" /> },
  knowledge: { label: '知识点', color: '#f59e0b', icon: <Lightbulb className="size-4" /> },
  course: { label: '颗粒课', color: '#06b6d4', icon: <BookOpen className="size-4" /> },
}

function Field({
  label,
  value,
  t,
}: {
  label: string
  value: React.ReactNode
  t: (key: string) => string
}) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex gap-3 py-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{t(label)}</span>
      <span className="flex-1 font-medium break-words">{value}</span>
    </div>
  )
}

function Section({
  title,
  count,
  children,
  t,
}: {
  title: string
  count?: number
  children: React.ReactNode
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-[#5b76e8] to-[#8c6ff0]" />
        {t(title)}
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-muted-foreground">
            {t('{n} 项', { n: count })}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Chips({
  items,
  empty,
  onNavigate,
  t,
}: {
  items: NodeLite[]
  empty: string
  onNavigate?: (node: NodeLite) => void
  t: (key: string) => string
}) {
  if (items.length === 0)
    return <span className="text-xs text-muted-foreground">{t(empty)}</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const color = GRAPH_TYPE_META[it.type].color
        return (
          <button
            key={`${it.type}-${it.id}`}
            type="button"
            disabled={!onNavigate}
            onClick={() => onNavigate?.(it)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              onNavigate ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
            )}
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function bindingBelongsToDomain(b: PositionAbilityBinding, d: AbilityDomain): boolean {
  if (d.bindingIds && d.bindingIds.length > 0) return d.bindingIds.includes(b.id)
  return (b.domain || '综合能力') === d.name
}

export function GraphNodeDetail({
  node,
  onNavigate,
}: {
  node: Pick<GraphNode, 'id' | 'type' | 'label'>
  onNavigate?: (node: NodeLite) => void
}) {
  const t = useT()
  const {
    position,
    domains,
    units,
    bindings,
    tasks,
    knowledgePoints,
    courses,
    mode,
    scenario,
  } = useGraphData()

  if (mode === 'scene') {
    // 场景图谱语义：场景 → 任务（domain）→ 知识点 → 颗粒课
    if (node.type === 'position') {
      const relatedTaskItems: NodeLite[] = (tasks ?? []).map((task) => ({
        id: task.id,
        type: 'domain',
        label: task.name || task.code || t('任务'),
      }))
      return (
        <div className="space-y-4">
          <div className="divide-y">
            <Field label={t('场景名称')} value={scenario?.name} t={t} />
          </div>
          <Section title={t('下级任务')} count={relatedTaskItems.length} t={t}>
            <Chips
              items={relatedTaskItems}
              empty={t('暂无关联任务')}
              onNavigate={onNavigate}
              t={t}
            />
          </Section>
        </div>
      )
    }

    if (node.type === 'domain') {
      const task = tasks?.find((task) => task.id === node.id)
      const relatedKnowledgeItems: NodeLite[] = (task?.knowledgePointIds || [])
        .map((kid) => knowledgePoints?.get(kid))
        .filter((kp): kp is KnowledgePoint => Boolean(kp))
        .map((kp) => ({ id: kp.id, type: 'knowledge', label: kp.name || kp.code || t('知识点') }))
      const parentSceneItems: NodeLite[] = scenario
        ? [{ id: scenario.id, type: 'position', label: scenario.name || t('场景') }]
        : []
      return (
        <div className="space-y-4">
          <div className="divide-y">
            <Field label={t('任务名称')} value={task?.name} t={t} />
            <Field label={t('任务编码')} value={task?.code} t={t} />
          </div>
          <Section title={t('所属场景')} count={parentSceneItems.length} t={t}>
            <Chips
              items={parentSceneItems}
              empty={t('暂无关联场景')}
              onNavigate={onNavigate}
              t={t}
            />
          </Section>
          <Section title={t('下级知识点')} count={relatedKnowledgeItems.length} t={t}>
            <Chips
              items={relatedKnowledgeItems}
              empty={t('暂无关联知识点')}
              onNavigate={onNavigate}
              t={t}
            />
          </Section>
        </div>
      )
    }

    if (node.type === 'knowledge') {
      const relatedTaskItems: NodeLite[] = (tasks ?? [])
        .filter((task) => (task.knowledgePointIds || []).includes(node.id))
        .map((task) => ({
          id: task.id,
          type: 'domain',
          label: task.name || task.code || t('任务'),
        }))
      const relatedCourseItems: NodeLite[] = []
      ;(knowledgePoints?.get(node.id)?.granularLessonIds || []).forEach((cid) => {
        const course = courses?.get(cid)
        if (!course) return
        relatedCourseItems.push({ id: cid, type: 'course', label: course.name })
      })
      return (
        <div className="space-y-4">
          <Section title={t('上级任务')} count={relatedTaskItems.length} t={t}>
            <Chips
              items={relatedTaskItems}
              empty={t('暂无关联任务')}
              onNavigate={onNavigate}
              t={t}
            />
          </Section>
          <Section title={t('下级颗粒课')} count={relatedCourseItems.length} t={t}>
            <Chips
              items={relatedCourseItems}
              empty={t('暂无关联颗粒课')}
              onNavigate={onNavigate}
              t={t}
            />
          </Section>
        </div>
      )
    }

    if (node.type === 'course') {
      const relatedKnowledgeItems: NodeLite[] = []
      knowledgePoints?.forEach((kp) => {
        if (!(kp.granularLessonIds || []).includes(node.id)) return
        relatedKnowledgeItems.push({ id: kp.id, type: 'knowledge', label: kp.name })
      })
      return (
        <div className="space-y-4">
          <Link
            href={`/lesson/landing/${node.id}`}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#06b6d4] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#06b6d4]/90"
          >
            {t('进入课程详情')}
            <ArrowRight className="size-4" />
          </Link>
          <Section title={t('上级知识点')} count={relatedKnowledgeItems.length} t={t}>
            <Chips
              items={relatedKnowledgeItems}
              empty={t('暂无关联知识点')}
              onNavigate={onNavigate}
              t={t}
            />
          </Section>
        </div>
      )
    }

    return null
  }

  if (node.type === 'position') {
    const relatedDomainItems: NodeLite[] = (domains ?? []).map((d) => ({
      id: d.id,
      type: 'domain',
      label: d.name,
    }))

    const unitIdSet = new Set<string>()
    const relatedUnitItems: NodeLite[] = []
    bindings?.forEach((b) => {
      if (unitIdSet.has(b.abilityPointId)) return
      unitIdSet.add(b.abilityPointId)
      const abilityPoint = units?.find((u) => u.id === b.abilityPointId)
      relatedUnitItems.push({
        id: b.abilityPointId,
        type: 'unit',
        label: abilityPoint?.name || b.domain || t('未命名能力'),
      })
    })

    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label={t('岗位名称')} value={position?.name} t={t} />
        </div>
        <Section title={t('关联能力领域')} count={relatedDomainItems.length} t={t}>
          <Chips items={relatedDomainItems} empty={t('暂无关联能力领域')} onNavigate={onNavigate} t={t} />
        </Section>
        <Section title={t('关联能力点')} count={relatedUnitItems.length} t={t}>
          <Chips items={relatedUnitItems} empty={t('暂无关联能力点')} onNavigate={onNavigate} t={t} />
        </Section>
      </div>
    )
  }

  if (node.type === 'domain') {
    const dom = domains?.find((d) => d.id === node.id)
    const unitIdSet = new Set<string>()
    const relatedUnitItems: NodeLite[] = []
    bindings?.forEach((b) => {
      if (!dom || !bindingBelongsToDomain(b, dom)) return
      if (unitIdSet.has(b.abilityPointId)) return
      unitIdSet.add(b.abilityPointId)
      const abilityPoint = units?.find((u) => u.id === b.abilityPointId)
      relatedUnitItems.push({
        id: b.abilityPointId,
        type: 'unit',
        label: abilityPoint?.name || b.domain || t('未命名能力'),
      })
    })
    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label={t('领域名称')} value={dom?.name} t={t} />
          <Field label={t('所属岗位')} value={position?.name} t={t} />
          {dom?.description && (
            <Section title={t('领域说明')} t={t}>
              <p className="text-sm leading-relaxed text-muted-foreground">{dom.description}</p>
            </Section>
          )}
        </div>
        <Section title={t('关联能力点')} count={relatedUnitItems.length} t={t}>
          <Chips items={relatedUnitItems} empty={t('暂无关联能力点')} onNavigate={onNavigate} t={t} />
        </Section>
      </div>
    )
  }

  if (node.type === 'unit') {
    const unit = units?.find((u) => u.id === node.id)
    const relatedDomainItems: NodeLite[] = []
    const domainIdSet = new Set<string>()
    domains?.forEach((d) => {
      const belongs = bindings?.some(
        (b) => b.abilityPointId === node.id && bindingBelongsToDomain(b, d),
      )
      if (belongs && !domainIdSet.has(d.id)) {
        domainIdSet.add(d.id)
        relatedDomainItems.push({ id: d.id, type: 'domain', label: d.name })
      }
    })

    // 关联知识点：出现该能力点的任务所绑定的知识点
    const knowledgeIdSet = new Set<string>()
    const relatedKnowledgeItems: NodeLite[] = []
    tasks?.forEach((t) => {
      if (!(t.abilityPointIds || []).includes(node.id)) return
      ;(t.knowledgePointIds || []).forEach((kid) => {
        if (knowledgeIdSet.has(kid)) return
        const kp = knowledgePoints?.get(kid)
        if (!kp) return
        knowledgeIdSet.add(kid)
        relatedKnowledgeItems.push({ id: kid, type: 'knowledge', label: kp.name })
      })
    })

    // 推荐颗粒课：关联知识点绑定的颗粒课
    const courseIdSet = new Set<string>()
    const relatedCourseItems: NodeLite[] = []
    relatedKnowledgeItems.forEach((k) => {
      ;(knowledgePoints?.get(k.id)?.granularLessonIds || []).forEach((cid) => {
        if (courseIdSet.has(cid)) return
        const course = courses?.get(cid)
        if (!course) return
        courseIdSet.add(cid)
        relatedCourseItems.push({ id: cid, type: 'course', label: course.name })
      })
    })

    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label={t('能力点编码')} value={unit?.code} t={t} />
        </div>
        {unit?.description && (
          <Section title={t('能力说明')} t={t}>
            <p className="text-sm leading-relaxed text-muted-foreground">{unit.description}</p>
          </Section>
        )}
        <Section title={t('关联能力领域')} count={relatedDomainItems.length} t={t}>
          <Chips items={relatedDomainItems} empty={t('暂无关联能力领域')} onNavigate={onNavigate} t={t} />
        </Section>
        <Section title={t('关联知识点')} count={relatedKnowledgeItems.length} t={t}>
          <Chips items={relatedKnowledgeItems} empty={t('暂无关联知识点')} onNavigate={onNavigate} t={t} />
        </Section>
        <Section title={t('推荐颗粒课')} count={relatedCourseItems.length} t={t}>
          <Chips items={relatedCourseItems} empty={t('暂无关联颗粒课')} onNavigate={onNavigate} t={t} />
        </Section>
      </div>
    )
  }

  if (node.type === 'knowledge') {
    // 关联能力点：出现该知识点的任务所关联的能力点
    const unitIdSet = new Set<string>()
    const relatedUnitItems: NodeLite[] = []
    tasks?.forEach((t) => {
      if (!(t.knowledgePointIds || []).includes(node.id)) return
      ;(t.abilityPointIds || []).forEach((aid) => {
        if (unitIdSet.has(aid)) return
        const unit = units?.find((u) => u.id === aid)
        if (!unit) return
        unitIdSet.add(aid)
        relatedUnitItems.push({ id: aid, type: 'unit', label: unit.name })
      })
    })

    // 关联颗粒课：知识点绑定的颗粒课
    const relatedCourseItems: NodeLite[] = []
    ;(knowledgePoints?.get(node.id)?.granularLessonIds || []).forEach((cid) => {
      const course = courses?.get(cid)
      if (!course) return
      relatedCourseItems.push({ id: cid, type: 'course', label: course.name })
    })

    return (
      <div className="space-y-4">
        <Section title={t('关联能力点')} count={relatedUnitItems.length} t={t}>
          <Chips items={relatedUnitItems} empty={t('暂无关联能力点')} onNavigate={onNavigate} t={t} />
        </Section>
        <Section title={t('关联颗粒课')} count={relatedCourseItems.length} t={t}>
          <Chips items={relatedCourseItems} empty={t('暂无关联颗粒课')} onNavigate={onNavigate} t={t} />
        </Section>
      </div>
    )
  }

  if (node.type === 'course') {
    // 关联知识点：绑定了该颗粒课的知识点
    const relatedKnowledgeItems: NodeLite[] = []
    knowledgePoints?.forEach((kp) => {
      if (!(kp.granularLessonIds || []).includes(node.id)) return
      relatedKnowledgeItems.push({ id: kp.id, type: 'knowledge', label: kp.name })
    })
    return (
      <div className="space-y-4">
        <Link
          href={`/lesson/landing/${node.id}`}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#06b6d4] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#06b6d4]/90"
        >
          {t('进入课程详情')}
          <ArrowRight className="size-4" />
        </Link>
        <div className="divide-y">
          <Field label={t('资源类型')} value={t(COURSE_TYPE_LABEL[node.type])} t={t} />
        </div>
        <Section title={t('关联知识点')} count={relatedKnowledgeItems.length} t={t}>
          <Chips items={relatedKnowledgeItems} empty={t('暂无关联知识点')} onNavigate={onNavigate} t={t} />
        </Section>
      </div>
    )
  }

  return null
}

const MAX_DRAWERS = 3
const DRAWER_W = 380
const DRAWER_GAP = 12

export function GraphDetailStack({
  rootNode,
  onClose,
}: {
  rootNode: NodeLite | null
  onClose: () => void
}) {
  const t = useT()
  const { mode } = useGraphData()
  const [stack, setStack] = useState<NodeLite[]>([])

  useEffect(() => {
    queueMicrotask(() => {
      if (rootNode) setStack([rootNode])
      else setStack([])
    })
  }, [rootNode])

  if (!rootNode || stack.length === 0) return null

  const navigateFrom = (index: number, n: NodeLite) =>
    setStack((prev) => {
      const next = [...prev.slice(0, index + 1), n]
      return next.length > MAX_DRAWERS ? next.slice(next.length - MAX_DRAWERS) : next
    })
  const closeFrom = (index: number) =>
    setStack((prev) => {
      const next = prev.slice(0, index)
      if (next.length === 0) onClose()
      return next
    })

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {stack.map((node, i) => {
        const depth = stack.length - 1 - i
        const meta =
          mode === 'scene'
            ? {
                color: GRAPH_TYPE_META[node.type].color,
                icon:
                  node.type === 'position' ? (
                    <Map className="size-4" />
                  ) : node.type === 'domain' ? (
                    <ClipboardList className="size-4" />
                  ) : (
                    GRAPH_TYPE_META[node.type].icon
                  ),
                label:
                  node.type === 'position'
                    ? t('场景')
                    : node.type === 'domain'
                      ? t('任务')
                      : GRAPH_TYPE_META[node.type].label,
              }
            : GRAPH_TYPE_META[node.type]
        return (
          <div
            key={`${node.type}-${node.id}-${i}`}
            className="pointer-events-auto absolute inset-y-0 right-0 flex w-[380px] max-w-[92vw] flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${-depth * (DRAWER_W + DRAWER_GAP)}px)`,
              zIndex: 51 + i,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{node.label}</div>
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {t(meta.label)}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeFrom(i)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                title={t('关闭')}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <GraphNodeDetail node={node} onNavigate={(n) => navigateFrom(i, n)} />
            </div>
            <div className="border-t px-4 py-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {t('层级 {n} / {total}', { n: i + 1, total: stack.length })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
