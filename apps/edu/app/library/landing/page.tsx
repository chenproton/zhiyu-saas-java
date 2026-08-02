'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Eye,
  Search,
  Sparkles,
  RotateCcw,
  Flame,
  Filter,
  Calendar,
  Building2,
  Tag,
  Clock,
  X,
  ExternalLink,
  GraduationCap,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  resourceLibraryApi,
  knowledgeApi,
  abilityApi,
  certificateLibraryApi,
  onSiteQuestionLibraryApi,
} from '@/lib/api'
import type { ResourceLibraryItem } from '@/lib/types/library'
import { formatSize } from '@/lib/resource-type-constants'

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: '#1e293b',
          position: 'relative',
          paddingLeft: 12,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 4,
            height: 20,
            background: 'linear-gradient(180deg, #2563eb, #3b82f6)',
            borderRadius: 2,
          }}
        />
        {title}
      </h2>
      {subtitle && <span style={{ color: '#94a3b8', fontSize: 13 }}>{subtitle}</span>}
    </div>
  )
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  document: '文档资源',
  spreadsheet: '表格资源',
  image: '图片资源',
  link: '链接资源',
  audio: '音频资源',
  video: '视频资源',
  archive: '压缩包资源',
  venue: '场地资源',
  facility: '设施设备资源',
  software: '软件资源',
  other: '其他资源',
}

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬',
  document: '📄',
  spreadsheet: '📊',
  image: '🖼️',
  link: '🔗',
  audio: '🎵',
  archive: '📦',
  venue: '📍',
  facility: '🔧',
  software: '💻',
  other: '📦',
}

const TYPE_GRADIENTS: Record<string, string> = {
  video: 'linear-gradient(135deg, #dbeafe, #93c5fd)',
  document: 'linear-gradient(135deg, #ffedd5, #fdba74)',
  spreadsheet: 'linear-gradient(135deg, #dcfce7, #86efac)',
  image: 'linear-gradient(135deg, #f3e8ff, #d8b4fe)',
  link: 'linear-gradient(135deg, #ecfeff, #67e8f9)',
  audio: 'linear-gradient(135deg, #fce7f3, #f9a8d4)',
  venue: 'linear-gradient(135deg, #fee2e2, #fca5a5)',
  facility: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
  software: 'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
  archive: 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
  other: 'linear-gradient(135deg, #e7e5e4, #a8a29e)',
}

const TYPE_COLORS: Record<string, string> = {
  video: '#3b82f6',
  document: '#f97316',
  spreadsheet: '#22c55e',
  image: '#a855f7',
  link: '#06b6d4',
  audio: '#ec4899',
  venue: '#ef4444',
  facility: '#64748b',
  software: '#6366f1',
  archive: '#14b8a6',
  other: '#78716c',
}

const ALL_TYPES = [
  'video',
  'document',
  'spreadsheet',
  'image',
  'link',
  'audio',
  'venue',
  'facility',
  'software',
  'archive',
  'other',
]

const TIME_RANGES = [
  { value: 'all', label: '全部时间' },
  { value: 'week', label: '近一周' },
  { value: 'month', label: '近一月' },
  { value: 'year', label: '近一年' },
]

function buildKkFileViewUrl(fileUrl: string): string {
  if (typeof window === 'undefined') return ''
  const origin = `${window.location.protocol}//${window.location.host}`
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`
}

export default function LibraryLandingPage() {
  const [resources, setResources] = useState<ResourceLibraryItem[]>([])
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [abilityCount, setAbilityCount] = useState(0)
  const [certCount, setCertCount] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('全部')
  const [timeFilter, setTimeFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('全部')
  const [majorFilter, setMajorFilter] = useState('全部')
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewResource, setPreviewResource] = useState<ResourceLibraryItem | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [resRes, kRes, aRes, cRes, qRes] = await Promise.allSettled([
          resourceLibraryApi.list({ limit: 500 }),
          knowledgeApi.list({ limit: 1 }),
          abilityApi.list({ limit: 1 }),
          certificateLibraryApi.list({ limit: 1 }),
          onSiteQuestionLibraryApi.list({ limit: 1 }),
        ])
        if (resRes.status === 'fulfilled') setResources(resRes.value.items)
        if (kRes.status === 'fulfilled') setKnowledgeCount(kRes.value.total)
        if (aRes.status === 'fulfilled') setAbilityCount(aRes.value.total)
        if (cRes.status === 'fulfilled') setCertCount(cRes.value.total)
        if (qRes.status === 'fulfilled') setQuestionCount(qRes.value.total)
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const r of resources) {
      stats[r.resourceType] = (stats[r.resourceType] || 0) + 1
    }
    stats['total'] = resources.length
    return stats
  }, [resources])

  // Extract unique org names and major names for filters
  const orgNames = useMemo(() => {
    const set = new Set<string>()
    for (const r of resources) {
      if (r.uploaderOrgName) set.add(r.uploaderOrgName)
    }
    return Array.from(set).sort()
  }, [resources])

  const majorNames = useMemo(() => {
    const set = new Set<string>()
    if (orgFilter === '全部') {
      for (const r of resources) {
        if (r.uploaderMajorName) set.add(r.uploaderMajorName)
      }
    } else {
      for (const r of resources) {
        if (r.uploaderOrgName === orgFilter && r.uploaderMajorName) set.add(r.uploaderMajorName)
      }
    }
    return Array.from(set).sort()
  }, [resources, orgFilter])

  const [now] = useState(() => Date.now())

  const filteredResources = useMemo(() => {
    let list = resources
    if (typeFilter !== '全部') list = list.filter((r) => r.resourceType === typeFilter)
    if (timeFilter !== 'all') {
      const ms =
        timeFilter === 'week'
          ? 7 * 86400000
          : timeFilter === 'month'
            ? 30 * 86400000
            : 365 * 86400000
      list = list.filter((r) => now - new Date(r.createdAt).getTime() < ms)
    }
    if (orgFilter !== '全部') list = list.filter((r) => r.uploaderOrgName === orgFilter)
    if (majorFilter !== '全部') list = list.filter((r) => r.uploaderMajorName === majorFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q),
      )
    }
    if (sortBy === 'popular') {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }
    return list
  }, [resources, typeFilter, search, timeFilter, orgFilter, majorFilter, sortBy, now])

  const totalCount = resources.length + knowledgeCount + abilityCount + certCount + questionCount

  const handleCardClick = (resource: ResourceLibraryItem) => {
    if (resource.url) {
      setPreviewResource(resource)
      setPreviewOpen(true)
    }
  }

  const kkFileViewUrl = useMemo(() => {
    if (!previewResource?.url) return ''
    return buildKkFileViewUrl(previewResource.url)
  }, [previewResource])

  const hasFilters =
    timeFilter !== 'all' ||
    search ||
    typeFilter !== '全部' ||
    orgFilter !== '全部' ||
    majorFilter !== '全部'

  return (
    <div>
      {/* ═══ Hero Banner ═══ */}
      <div
        style={{
          color: '#fff',
          padding: '60px 20px 50px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 340,
          background: 'linear-gradient(160deg, #0c1929 0%, #152238 35%, #1a3a5c 65%, #0f2847 100%)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(59,130,246,0.12), transparent 45%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.1), transparent 45%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 }}>
            教学资产共享中心
          </h1>
          <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 28 }}>
            汇聚视频、文档、软件、场地等教学资源，为教师提供一站式资源共享服务
          </p>
          <div
            style={{
              background: '#fff',
              borderRadius: 50,
              padding: '5px 5px 5px 24px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              marginBottom: 28,
            }}
          >
            <Search
              style={{ width: 18, height: 18, color: '#94a3b8', marginRight: 10, flexShrink: 0 }}
            />
            <input
              type="text"
              placeholder="搜索视频、文档、软件、场地等教学资源..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 14,
                padding: '12px 0',
                color: '#333',
                background: 'transparent',
              }}
            />
            <button
              onClick={() =>
                document.getElementById('resource-list')?.scrollIntoView({ behavior: 'smooth' })
              }
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                border: 'none',
                padding: '11px 32px',
                borderRadius: 50,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              搜索
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48 }}>
            {[
              { num: totalCount, label: '资源总量' },
              { num: resources.length, label: '教学资源' },
              { num: knowledgeCount + abilityCount, label: '知识/能力点' },
              { num: certCount + questionCount, label: '证书/题库' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 'bold', lineHeight: 1.2 }}>{s.num}</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0', background: '#f7f8fc' }}
      >
        {/* ── 数据看板 ── */}
        <section style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#1e293b',
                  position: 'relative',
                  paddingLeft: 12,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 4,
                    height: 20,
                    background: 'linear-gradient(180deg, #2563eb, #3b82f6)',
                    borderRadius: 2,
                  }}
                />
                数据看板
              </h2>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>点击分类可快速筛选</span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            {ALL_TYPES.map((type) => {
              const count = typeStats[type] || 0
              const active = typeFilter === type
              return (
                <button
                  key={type}
                  onClick={() => {
                    setTypeFilter(active ? '全部' : type)
                    document.getElementById('resource-list')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  style={{
                    background: TYPE_GRADIENTS[type] || TYPE_GRADIENTS.other,
                    border: active
                      ? `2px solid ${TYPE_COLORS[type] || TYPE_COLORS.other}`
                      : '2px solid transparent',
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = `0 6px 18px ${TYPE_COLORS[type]}22`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ color: TYPE_COLORS[type] || TYPE_COLORS.other }}>
                      {TYPE_EMOJI[type] || '📦'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: TYPE_COLORS[type] || TYPE_COLORS.other,
                      lineHeight: 1,
                      textAlign: 'center' as const,
                    }}
                  >
                    {count}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#64748b',
                      marginTop: 4,
                      textAlign: 'center' as const,
                    }}
                  >
                    {RESOURCE_TYPE_LABELS[type] || '其他'}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── 筛选条件 ── */}
        <section style={{ marginBottom: 50 }}>
          <SectionHeader title="筛选条件" />
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px dashed #f1f5f9',
                fontSize: 13,
              }}
            >
              <span
                style={{
                  color: '#94a3b8',
                  width: 80,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Tag style={{ width: 14, height: 14 }} />
                分类：
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { value: '全部' as const, label: '全部' },
                  ...ALL_TYPES.map((t) => ({
                    value: t,
                    label: `${TYPE_EMOJI[t] || '📦'} ${RESOURCE_TYPE_LABELS[t] || '其他'}`,
                  })),
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setTypeFilter(item.value)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      cursor: 'pointer',
                      border: 'none',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                      background: typeFilter === item.value ? '#2563eb' : '#f1f5f9',
                      color: typeFilter === item.value ? '#fff' : '#64748b',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      if (typeFilter !== item.value) e.currentTarget.style.background = '#e2e8f0'
                    }}
                    onMouseLeave={(e) => {
                      if (typeFilter !== item.value) e.currentTarget.style.background = '#f1f5f9'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px dashed #f1f5f9',
                fontSize: 13,
              }}
            >
              <span
                style={{
                  color: '#94a3b8',
                  width: 80,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Calendar style={{ width: 14, height: 14 }} />
                上传时间：
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TIME_RANGES.map((range) => (
                  <span
                    key={range.value}
                    onClick={() => setTimeFilter(range.value)}
                    style={{
                      padding: '4px 14px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: timeFilter === range.value ? '#2563eb' : '#64748b',
                      background: timeFilter === range.value ? '#eff6ff' : 'transparent',
                      fontWeight: timeFilter === range.value ? 500 : 400,
                      transition: 'all 0.3s',
                    }}
                  >
                    {range.label}
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px dashed #f1f5f9',
                fontSize: 13,
              }}
            >
              <span
                style={{
                  color: '#94a3b8',
                  width: 80,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Building2 style={{ width: 14, height: 14 }} />
                院系筛选：
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['全部', ...orgNames].map((name) => (
                  <span
                    key={name}
                    onClick={() => {
                      setOrgFilter(name)
                      setMajorFilter('全部')
                    }}
                    style={{
                      padding: '4px 14px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: orgFilter === name ? '#2563eb' : '#64748b',
                      background: orgFilter === name ? '#eff6ff' : 'transparent',
                      fontWeight: orgFilter === name ? 500 : 400,
                      transition: 'all 0.3s',
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', fontSize: 13 }}>
              <span
                style={{
                  color: '#94a3b8',
                  width: 80,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <GraduationCap style={{ width: 14, height: 14 }} />
                专业筛选：
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['全部', ...majorNames].map((name) => (
                  <span
                    key={name}
                    onClick={() => (orgFilter === '全部' ? null : setMajorFilter(name))}
                    style={{
                      padding: '4px 14px',
                      borderRadius: 4,
                      cursor: orgFilter === '全部' ? 'not-allowed' : 'pointer',
                      color: majorFilter === name ? '#2563eb' : '#64748b',
                      background: majorFilter === name ? '#eff6ff' : 'transparent',
                      fontWeight: majorFilter === name ? 500 : 400,
                      opacity: orgFilter === '全部' ? 0.4 : 1,
                      transition: 'all 0.3s',
                    }}
                  >
                    {name}
                  </span>
                ))}
                {orgFilter === '全部' && majorNames.length === 0 && (
                  <span style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                    请先选择院系
                  </span>
                )}
              </div>
            </div>
            {hasFilters && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  已筛选到 <strong style={{ color: '#2563eb' }}>{filteredResources.length}</strong>{' '}
                  个资源
                </span>
                <button
                  onClick={() => {
                    setSearch('')
                    setTypeFilter('全部')
                    setTimeFilter('all')
                    setOrgFilter('全部')
                    setMajorFilter('全部')
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1'
                    e.currentTarget.style.color = '#334155'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0'
                    e.currentTarget.style.color = '#64748b'
                  }}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  重置筛选
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── 资源列表 ── */}
        <section id="resource-list" style={{ marginBottom: 50 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#1e293b',
                position: 'relative',
                paddingLeft: 12,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 4,
                  height: 20,
                  background: 'linear-gradient(180deg, #2563eb, #3b82f6)',
                  borderRadius: 2,
                }}
              />
              公共资源库
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setSortBy('newest')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: 'none',
                    fontWeight: 500,
                    background: sortBy === 'newest' ? '#2563eb' : '#f1f5f9',
                    color: sortBy === 'newest' ? '#fff' : '#64748b',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles style={{ width: 13, height: 13 }} />
                  最新
                </button>
                <button
                  onClick={() => setSortBy('popular')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: 'none',
                    fontWeight: 500,
                    background: sortBy === 'popular' ? '#2563eb' : '#f1f5f9',
                    color: sortBy === 'popular' ? '#fff' : '#64748b',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Flame style={{ width: 13, height: 13 }} />
                  热门
                </button>
              </div>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>
                共 {filteredResources.length} 个资源
              </span>
            </div>
          </div>
          {filteredResources.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 60,
                color: '#94a3b8',
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <Filter style={{ width: 32, height: 32, margin: '0 auto 12', opacity: 0.4 }} />
              <div>{loading ? '加载中...' : '暂无符合条件的资源'}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {filteredResources.map((resource) => {
                const color = TYPE_COLORS[resource.resourceType] || '#78716c'
                const hasPreview = !!resource.url
                return (
                  <button
                    key={resource.id}
                    onClick={() => handleCardClick(resource)}
                    disabled={!hasPreview}
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'all 0.25s',
                      cursor: hasPreview ? 'pointer' : 'default',
                      border: `1px solid ${color}20`,
                      textAlign: 'left' as const,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      opacity: hasPreview ? 1 : 0.85,
                    }}
                    onMouseEnter={(e) => {
                      if (hasPreview) {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = `0 14px 28px ${color}18`
                        e.currentTarget.style.borderColor = color
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                      e.currentTarget.style.borderColor = `${color}20`
                    }}
                  >
                    <div
                      style={{
                        height: 4,
                        background: `linear-gradient(90deg, ${color}, ${color}88)`,
                      }}
                    />
                    <div style={{ padding: 18 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: TYPE_GRADIENTS[resource.resourceType] || '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            flexShrink: 0,
                            boxShadow: `0 4px 12px ${color}20`,
                          }}
                        >
                          {TYPE_EMOJI[resource.resourceType] || '📦'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: '#1e293b',
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical' as any,
                            }}
                          >
                            {resource.name}
                          </h3>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color,
                          background: `${color}12`,
                          padding: '3px 10px',
                          borderRadius: 6,
                          display: 'inline-block',
                          marginBottom: 8,
                        }}
                      >
                        {RESOURCE_TYPE_LABELS[resource.resourceType] || resource.resourceType}
                      </span>

                      {(resource.uploaderOrgName || resource.uploaderMajorName) && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 6,
                            fontSize: 11,
                            color: '#94a3b8',
                          }}
                        >
                          {resource.uploaderOrgName && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Building2 style={{ width: 11, height: 11 }} />
                              {resource.uploaderOrgName}
                            </span>
                          )}
                          {resource.uploaderMajorName && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <GraduationCap style={{ width: 11, height: 11 }} />
                              {resource.uploaderMajorName}
                            </span>
                          )}
                        </div>
                      )}

                      {resource.description && (
                        <p
                          style={{
                            fontSize: 12,
                            color: '#94a3b8',
                            lineHeight: 1.6,
                            marginBottom: 10,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as any,
                          }}
                        >
                          {resource.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 'auto',
                          paddingTop: 10,
                          borderTop: '1px solid #f8fafc',
                          fontSize: 11,
                          color: '#cbd5e1',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock style={{ width: 12, height: 12 }} />
                          {new Date(resource.createdAt).toLocaleDateString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </span>
                        {resource.fileSize != null && <span>{formatSize(resource.fileSize)}</span>}
                        {hasPreview && (
                          <span
                            style={{
                              color,
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            预览 <Eye style={{ width: 12, height: 12 }} />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* ═══ kkFileView Preview Dialog ═══ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          style={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            height: '90vh',
            padding: 0,
            overflow: 'hidden',
            borderRadius: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  fontSize: 20,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: TYPE_GRADIENTS[previewResource?.resourceType || 'other'] || '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {TYPE_EMOJI[previewResource?.resourceType || 'other'] || '📦'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                  {previewResource?.name}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {previewResource && RESOURCE_TYPE_LABELS[previewResource.resourceType]}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {previewResource?.url && (
                <a
                  href={previewResource.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: '#eff6ff',
                  }}
                >
                  <ExternalLink style={{ width: 14, height: 14 }} />
                  新窗口打开
                </a>
              )}
              <button
                onClick={() => setPreviewOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 4,
                }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>
          {kkFileViewUrl && (
            <iframe
              src={kkFileViewUrl}
              style={{ width: '100%', height: 'calc(100% - 64px)', border: 'none' }}
              title="资源预览"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Footer ═══ */}
      <footer style={{ background: '#141a2e', width: '100%' }}>
        <div
          style={{ height: 3, background: 'linear-gradient(90deg, #8b5cf6, #818cf8, #22d3ee)' }}
        />
        <div style={{ padding: '48px 5% 32px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>
                  场景化数智教学服务平台
                </h3>
                <p style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8, margin: 0 }}>
                  专注职业教育数字化
                </p>
                <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 8 }}>版本：V3.2.1</div>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>
                  教学资源
                </h3>
                <p style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8, margin: 0 }}>
                  岗位标准、实践场景、企业导师
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>
                  技术支持
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>
                    服务热线：400-888-8888
                  </li>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>
                    邮箱：support@example.com
                  </li>
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 12px 0' }}>
                  校内支持
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>
                    授权院校：XX职业技术学院
                  </li>
                  <li style={{ fontSize: 13, color: '#a8b3cf', lineHeight: 1.8 }}>
                    校内管理员：张老师
                  </li>
                </ul>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #29324a', margin: '40px 0 24px' }} />
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 12,
                color: '#6b7a99',
              }}
            >
              <div>
                <a href="#" style={{ color: '#6b7a99', textDecoration: 'none' }}>
                  隐私政策
                </a>
                <span style={{ color: '#29324a' }}>&nbsp;|&nbsp;</span>
                <a href="#" style={{ color: '#6b7a99', textDecoration: 'none' }}>
                  用户协议
                </a>
              </div>
              <div style={{ textAlign: 'right' }}>
                版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜
                京ICP备2025105397号-1
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
