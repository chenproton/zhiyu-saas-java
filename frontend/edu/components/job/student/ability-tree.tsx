'use client'

import { useMemo, useState } from 'react'
import { Layers, Sparkles, Target } from 'lucide-react'
import { EmptyState } from '@zhiyu/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PositionAbilityBinding, AbilityPoint, AbilityDomain } from '@/lib/types/job'
import { AbilityPointCard } from './ability-point-card'
import { useT } from '@/lib/i18n/locale-provider'

const ATTRIBUTE_COLORS: Record<string, [string, string]> = {
  知识: ['#3b82f6', '#60a5fa'],
  素养: ['#f59e0b', '#fbbf24'],
  技能: ['#10b981', '#34d399'],
}

interface AbilityTreeProps {
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  abilityDomains?: AbilityDomain[]
}

export function AbilityTree({ bindings, abilityPoints, abilityDomains }: AbilityTreeProps) {
  const t = useT()
  const [selectedAbility, setSelectedAbility] = useState<{
    binding: PositionAbilityBinding
    abilityPoint?: AbilityPoint
  } | null>(null)

  const abilityMap = useMemo(() => {
    const map: Record<string, AbilityPoint> = {}
    abilityPoints.forEach((a) => {
      map[a.id] = a
    })
    return map
  }, [abilityPoints])

  const groupedByDomain = useMemo(() => {
    const groups = new Map<string, PositionAbilityBinding[]>()

    if (abilityDomains && abilityDomains.length > 0) {
      abilityDomains.forEach((d) => groups.set(d.name, []))
      bindings.forEach((b) => {
        const domain =
          abilityDomains.find((d) => (d.bindingIds || []).includes(b.id))?.name || b.domain || t('其他')
        const list = groups.get(domain) || []
        list.push(b)
        groups.set(domain, list)
      })
    } else {
      bindings.forEach((b) => {
        const domain = b.domain || t('综合能力')
        const list = groups.get(domain) || []
        list.push(b)
        groups.set(domain, list)
      })
    }

    return Array.from(groups.entries())
      .map(([domain, items]) => ({ domain, items }))
      .filter((g) => g.items.length > 0)
  }, [bindings, abilityDomains, t])

  if (groupedByDomain.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-12 h-12 opacity-40" />}
        title={t('暂无能力模型数据')}
        className="py-12 bg-white rounded-2xl border border-[#e7e5e4]"
        titleClassName="text-[#94a3b8]"
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/10">
        <div className="flex items-center gap-2 text-primary font-bold mb-2">
          <Sparkles className="w-5 h-5" />
          {t('能力模型说明')}
        </div>
        <p className="text-sm text-[#475569]">
          {t('本岗位基于真实企业岗位标准，拆解为若干能力领域，每个领域下关联对应的能力点与胜任等级，帮助学生明确学习目标。')}
        </p>
      </div>

      <div className="text-sm text-[#64748b] mb-2">
        {t('共 {d} 个能力领域，{b} 个能力点', {
          d: groupedByDomain.length,
          b: bindings.length,
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedByDomain.map(({ domain, items }) => (
          <div key={domain} className="border border-[#f5f5f4] rounded-xl overflow-hidden bg-white">
            <div className="bg-primary/5 px-4 py-3 font-medium text-primary flex items-center gap-2 text-sm">
              <Target className="w-4 h-4" />
              {domain}
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto">
              {items.map((ab) => {
                const info = abilityMap[ab.abilityPointId]
                return (
                  <div
                    key={ab.id}
                    className="flex items-start justify-between py-2 px-2 border-b border-[#f5f5f5] last:border-b-0 rounded hover:bg-primary/5 cursor-pointer transition-colors gap-2"
                    onClick={() => setSelectedAbility({ binding: ab, abilityPoint: info })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedAbility({ binding: ab, abilityPoint: info })
                      }
                    }}
                  >
                    <div className="flex flex-col min-w-0 gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-[#1f2937] truncate">
                          {info?.name || ab.abilityName || ab.domain || t('未命名能力')}
                        </span>
                        {(info?.attributes?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 min-w-0 max-w-full">
                            {info.attributes.map((attr) => {
                              const colors = ATTRIBUTE_COLORS[attr] || ['#64748b', '#94a3b8']
                              return (
                                <span
                                  key={attr}
                                  className="text-[10px] px-1.5 py-0.5 rounded border text-white"
                                  style={{
                                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                                    borderColor: colors[0],
                                  }}
                                >
                                  {attr}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      {info?.code && (
                        <span className="text-[10px] text-[#94a3b8] truncate font-mono">
                          {t('编码：{code}', { code: info.code })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedAbility && (
      <Dialog open onOpenChange={(open) => !open && setSelectedAbility(null)}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('能力点详情')}</DialogTitle>
          </DialogHeader>
          <AbilityPointCard
            binding={selectedAbility.binding}
            abilityPoint={selectedAbility.abilityPoint}
          />
        </DialogContent>
      </Dialog>
      )}
    </div>
  )
}
