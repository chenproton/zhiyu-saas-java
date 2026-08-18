'use client'

import { Link } from 'react-router'
import { Briefcase, Layers, BookOpen, Building2, Trophy, Sparkles } from 'lucide-react'
import type { AllianceRelatedRef } from '@zhiyu/shared-types'
import { coverGradientFor } from '@/lib/cover-gradients'
import { useT } from '@/lib/i18n/locale-provider'

export type RelatedKind = 'positions' | 'scenes' | 'courses' | 'brands' | 'enterprises' | 'achievements'

const kindMeta: Record<RelatedKind, { href: (id: string) => string; icon: React.ElementType }> = {
  positions: { href: (id) => `/job/landing/${id}`, icon: Briefcase },
  scenes: { href: (id) => `/scene/landing/${id}`, icon: Layers },
  courses: { href: (id) => `/lesson/landing/${id}`, icon: BookOpen },
  brands: { href: (id) => `/portal/alliance/brands/${id}`, icon: Sparkles },
  enterprises: { href: (id) => `/portal/alliance/enterprises/${id}`, icon: Building2 },
  achievements: { href: (id) => `/portal/alliance/achievements/${id}`, icon: Trophy },
}

/** 兼容历史数据（纯字符串 id/名称），统一为快照对象 */
export function normalizeRelatedRefs(
  refs: (AllianceRelatedRef | string)[] | undefined | null,
): AllianceRelatedRef[] {
  return (refs || []).map((ref) =>
    typeof ref === 'string' ? { id: ref, name: ref } : { ...ref },
  )
}

/** 成果关联对象卡片（岗位/场景/课程），样式对齐 /job/landing 对象卡片，点击跳转对应详情页 */
export function RelatedObjectCard({
  item,
  kind,
  children,
}: {
  item: AllianceRelatedRef
  kind: RelatedKind
  children?: React.ReactNode
}) {
  const t = useT()
  const meta = kindMeta[kind]
  const Icon = meta.icon
  const coverStyle = item.coverImage
    ? { backgroundImage: `url('${item.coverImage}')` }
    : { background: coverGradientFor(item.id) }
  const codeLabel =
    kind === 'positions'
      ? t('岗位编码')
      : kind === 'scenes'
        ? t('场景编码')
        : kind === 'courses'
          ? t('课程编码')
          : undefined

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.1)] hover:border-primary/30 flex flex-col">
      <Link to={meta.href(item.id)} className="block">
        <div
          className="h-28 relative bg-cover bg-center flex flex-col justify-end p-3"
          style={coverStyle}
        >
          {!item.coverImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Icon className="w-8 h-8 text-white/85 drop-shadow-md" strokeWidth={1.5} />
            </div>
          )}
          <div className="relative z-10">
            <div className="text-sm font-bold leading-snug line-clamp-2 text-white text-shadow-md group-hover:text-white/90 transition-colors">
              {item.name}
            </div>
            {item.code && (
              <div className="text-[11px] text-white/85 text-shadow-sm truncate">
                {codeLabel}：{item.code}
              </div>
            )}
          </div>
        </div>
      </Link>
      {children}
    </div>
  )
}
