'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Footer } from '@/components/portal/footer'

const features = [
  { label: '以产业需求为牵引', active: true },
  { label: '以学生能力为中心', active: true },
  { label: '以场景实践为载体', active: true },
  { label: '以跨专业融合为特征', active: true },
  { label: '以数智技术为支撑', active: true },
]

const platforms = [
  {
    category: 'scene',
    items: [
      {
        id: 'alliance',
        icon: 'users',
        color: 'bg-red-50 text-red-500 border border-red-100',
        title: '产教融合与就业服务平台',
        desc: '共建校企合作生态，打造具有行业影响力的人才培养品牌。',
      },
      {
        id: 'ai',
        icon: 'sparkles',
        color: 'bg-indigo-50 text-indigo-500 border border-indigo-100',
        title: 'AI 智能服务中心',
        desc: '融合前沿AI技术，为教学设计、资源建设、学习辅导、评价分析提供伴随式智能服务。',
      },
      {
        id: 'ability',
        icon: 'check-circle',
        color: 'bg-emerald-50 text-emerald-500 border border-emerald-100',
        title: 'COFA测评中心',
        desc: '基于统一评价标准，实现对实践过程与结果的精准量化评估与技能认证。',
      },
    ],
  },
  {
    category: 'resource',
    items: [
      {
        id: 'career',
        icon: 'briefcase',
        color: 'bg-purple-50 text-purple-500 border border-purple-100',
        title: '产业岗位学习平台',
        desc: '清晰呈现岗位能力图谱，为学生提供目标清晰、路径可视的职业生涯导航。',
      },
      {
        id: 'scene',
        icon: 'layers',
        color: 'bg-cyan-50 text-cyan-500 border border-cyan-100',
        title: '产业应用场景学习实践平台',
        desc: '还原真实工作场景，让学生在解决实际问题中习得技能，培养做中学的实践本领。',
      },
      {
        id: 'course',
        icon: 'book',
        color: 'bg-amber-50 text-amber-500 border border-amber-100',
        title: '数字课程服务平台',
        desc: '以颗粒课资源支撑体系课程，实现按需学习与查漏补缺的知识高效获取。',
      },
    ],
  },
  {
    category: 'operate',
    items: [
      {
        id: 'resource',
        icon: 'share',
        color: 'bg-blue-50 text-blue-500 border border-blue-100',
        title: '教学资产共享中心',
        desc: '沉淀校本智力资产，构建共建共享、持续进化的场景化数智教学资源生态。',
      },
      {
        id: 'affairs',
        icon: 'calendar',
        color: 'bg-teal-50 text-teal-500 border border-teal-100',
        title: '教务管理服务平台',
        desc: '统筹人培标准、排课，保障教学秩序顺畅运行',
      },
      {
        id: 'mall',
        icon: 'shopping-cart',
        color: 'bg-pink-50 text-pink-500 border border-pink-100',
        title: '产教资源中心',
        desc: '汇聚精品教学资源，链接企业与院校，促进教育智力资产流转共享。',
      },
    ],
  },
  {
    category: 'innovation',
    items: [
      {
        id: 'opc',
        icon: 'rocket',
        color: 'bg-orange-50 text-orange-500 border border-orange-100',
        title: 'OPC 专区',
        desc: '依托一人公司培育模式，赋能学生灵活就业、轻量化创业，拓宽职业发展赛道。',
      },
      {
        id: 'decision',
        icon: 'bar-chart',
        color: 'bg-sky-50 text-sky-500 border border-sky-100',
        title: '数智决策中心',
        desc: '整合办学多维数据，可视化研判办学态势，赋能院校科学治理、高效决策。',
      },
      {
        id: 'research',
        icon: 'graduation-cap',
        color: 'bg-violet-50 text-violet-500 border border-violet-100',
        title: '教科研服务中心',
        desc: '统筹教科研业务与成果资源，助力教师专业成长，赋能教改提质与成果转化。',
      },
    ],
  },
]

function getIcon(name: string): ReactNode {
  const icons: Record<string, ReactNode> = {
    users: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    briefcase: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    layers: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
        />
      </svg>
    ),
    'check-circle': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    book: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
    sparkles: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
    ),
    share: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
    ),
    'shopping-cart': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    'file-text': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    calendar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    'bar-chart': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    'graduation-cap': (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 14l9-5-9-5-9 5 9 5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
        />
      </svg>
    ),
    rocket: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 2c0 0-7 4-7 11v3l-2 2h18l-2-2v-3c0-7-7-11-7-11z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 14a2 2 0 100-4 2 2 0 000 4z"
        />
      </svg>
    ),
  }
  return icons[name] || icons.book
}

/* ─── Bento layout: explicit 4-column grid placement ─── */
type CardVariant = 'big' | 'tall' | 'wide' | 'small'

interface CardLayout {
  id: string
  col: string
  row: string
  variant: CardVariant
}

const BENTO_LAYOUT: CardLayout[] = [
  { id: 'alliance', col: '1', row: '1', variant: 'small' },
  { id: 'career', col: '2', row: '1', variant: 'small' },
  { id: 'scene', col: '3', row: '1', variant: 'small' },
  { id: 'ability', col: '4', row: '1', variant: 'small' },
  { id: 'ai', col: '1', row: '1', variant: 'small' },
  { id: 'course', col: '2', row: '1', variant: 'small' },
  { id: 'resource', col: '3', row: '1', variant: 'small' },
  { id: 'mall', col: '4', row: '1', variant: 'small' },
  { id: 'affairs', col: '1', row: '1', variant: 'small' },
  { id: 'research', col: '2', row: '1', variant: 'small' },
  { id: 'decision', col: '3', row: '1', variant: 'small' },
  { id: 'opc', col: '4', row: '1', variant: 'small' },
]

const SECTIONS: { title: string; layouts: CardLayout[] }[] = [
  { title: '产教协同育人生态', layouts: BENTO_LAYOUT.slice(0, 4) },
  { title: '教学资源保障生态', layouts: BENTO_LAYOUT.slice(4, 8) },
  { title: '教学治理服务生态', layouts: BENTO_LAYOUT.slice(8) },
]

/* ─── helpers ─── */
function getFlatItems() {
  return platforms.flatMap((g) => g.items)
}

function findByLabel(
  items: { id: string; icon: string; color: string; title: string; desc: string }[],
  id: string,
) {
  return items.find((i) => i.id === id)
}

// Bento 显式摆放仅在 lg+ 生效，移动端/平板按流式网格自然排列
const COL_START_CLASS: Record<string, string> = {
  '1': 'lg:col-start-1',
  '2': 'lg:col-start-2',
  '3': 'lg:col-start-3',
  '4': 'lg:col-start-4',
}

const ROW_START_CLASS: Record<string, string> = {
  '1': 'lg:row-start-1',
  '2': 'lg:row-start-2',
}

const INTERNAL_ROUTES: Record<string, string> = {
  career: '/job/landing',
  scene: '/scene/landing',
  ability: '/evaluation/landing',
  course: '/lesson/landing',
  resource: '/library/landing',
  affairs: '/affairs/programs',
  alliance: '/portal/alliance/landing',
}

/* ─── Components ─── */

function GradientTile({
  item,
  variant,
  gridColumn,
  gridRow,
}: {
  item: NonNullable<ReturnType<typeof findByLabel>>
  variant: CardVariant
  gridColumn: string
  gridRow: string
}) {
  const isBig = variant === 'big'
  const effectiveUrl = INTERNAL_ROUTES[item.id] || ''
  const isLocked = !effectiveUrl
  const isRelative = effectiveUrl.startsWith('/')
  const isExternal = /^https?:\/\//i.test(effectiveUrl)

  let Wrapper: React.ElementType = 'div'
  const wrapperProps: { href?: string; target?: string; rel?: string } = {}
  if (effectiveUrl) {
    if (isRelative) {
      Wrapper = Link
      wrapperProps.href = effectiveUrl
    } else if (isExternal) {
      Wrapper = 'a'
      wrapperProps.href = effectiveUrl
      wrapperProps.target = '_blank'
      wrapperProps.rel = 'noopener noreferrer'
    }
  }

  const iconH = isBig ? 'w-16 h-16 text-2xl mb-5' : 'w-[46px] h-[46px] text-xl mb-3.5'
  const placementClass = `${COL_START_CLASS[gridColumn] || ''} ${ROW_START_CLASS[gridRow] || ''}`

  return (
    <Wrapper
      {...wrapperProps}
      className={`group rounded-2xl p-4 sm:p-6 relative overflow-hidden flex border flex-col ${placementClass} ${
        isLocked
          ? 'border-dashed border-[#d7dce6] bg-[#fafbfc]'
          : 'cursor-pointer bg-white border-[#e8ecf3] shadow-[0_0_30px] shadow-primary/10 hover:-translate-y-2 hover:border-primary/25 hover:shadow-[0_10px_32px] hover:shadow-primary/15 transition-all duration-[400ms]'
      }`}
    >
      {isLocked && (
        <div
          className="absolute top-3 right-3 flex flex-col items-center gap-0.5"
          style={{ zIndex: 5 }}
        >
          <svg
            className="w-4 h-4 text-[#8590a6]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[9px] font-medium text-[#8590a6] whitespace-nowrap">暂未开放</span>
        </div>
      )}

      <div
        className={`rounded-2xl flex items-center justify-center relative transition-all duration-[400ms] group-hover:scale-110 shrink-0 shadow-sm ${iconH} ${item.color}`}
        style={{ zIndex: 2 }}
      >
        {getIcon(item.icon)}
      </div>

      {/* shared title + desc — identical across all variants */}
      <div className="relative" style={{ zIndex: 2 }}>
        <h4 className="text-base sm:text-lg font-bold leading-tight mb-1 text-[#333]">
          {item.title}
        </h4>
        <p className="text-xs leading-relaxed text-[#666] line-clamp-2">{item.desc}</p>
      </div>

      {!isLocked && (
        <div
          className="absolute bottom-3 right-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ zIndex: 2 }}
        >
          进入
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
          </svg>
        </div>
      )}
    </Wrapper>
  )
}

/* ─── Section label ─── */
function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-[18px] mt-5">
      <h3 className="text-lg font-bold text-[#333] flex items-center gap-2.5">
        <span className="w-1 h-[18px] rounded-sm bg-primary inline-block" />
        {title}
      </h3>
      <span className="flex-1 h-px bg-[#e9edf4]" />
    </div>
  )
}

/* ─── Page ─── */
export default function PortalHomePage() {
  const items = getFlatItems()

  return (
    <div className="min-h-screen relative">
      {/* Background: plain light neutral base */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -2,
          background: `
            radial-gradient(circle at 50% -10%, color-mix(in srgb, var(--primary) 6%, transparent), transparent 45%),
            #f7f9fc
          `,
        }}
      />

      {/* Hero */}
      <section className="relative pt-8 pb-6 text-center px-4 sm:px-10">
        <div className="relative max-w-3xl mx-auto" style={{ zIndex: 2 }}>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#333] tracking-wide leading-tight mb-3">
            <span className="text-primary">场景化数智</span>
            教学服务体系
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
            {features.map((f, i) => (
              <span key={i} className="relative text-xs sm:text-sm text-[#666] px-2 sm:px-4">
                {f.label}
                {i < features.length - 1 && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#c5cede]" />
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-[1312px] mx-auto px-4 sm:px-10 relative" style={{ zIndex: 2 }}>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <SectionLabel title={section.title} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-[18px]">
              {section.layouts.map((layout) => {
                const item = findByLabel(items, layout.id)
                if (!item) return null
                return (
                  <GradientTile
                    key={layout.id}
                    item={item}
                    variant={layout.variant}
                    gridColumn={layout.col}
                    gridRow={layout.row}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Geometric decorations at page bottom */}
      <div className="relative h-40 pointer-events-none" aria-hidden="true">
        <div className="absolute -right-16 -bottom-24 w-64 h-64 rounded-full border border-primary/10" />
        <div className="absolute -right-4 -bottom-12 w-36 h-36 rounded-full border border-primary/10" />
        <div
          className="absolute -left-24 -bottom-32 w-80 h-80 border border-primary/[0.07] rounded-2xl"
          style={{ transform: 'rotate(45deg)' }}
        />
        <div className="absolute left-16 bottom-14 w-3 h-3 rounded-full bg-primary/10" />
        <div className="absolute right-24 bottom-8 w-2 h-2 rounded-full bg-primary/10" />
      </div>

      <Footer />
    </div>
  )
}
