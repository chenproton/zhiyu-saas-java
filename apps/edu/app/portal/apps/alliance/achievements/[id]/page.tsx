'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAchievementApi, courseApi, portalRequest, scenarioApi } from '@/lib/api'
import { useToast, EmptyState, FormDialogFooter } from '@zhiyu/ui'
import { allianceLabel, type AllianceRelatedRef } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { SearchInput } from '@/components/shared/search-input'
import {
  RelatedObjectCard,
  normalizeRelatedRefs,
} from '@/components/alliance/related-object-card'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceAchievement, CareerPosition } from '@/lib/types'

type RelatedKind = 'positions' | 'scenes' | 'courses'
type RelatedKey = 'relatedPositions' | 'relatedScenes' | 'relatedCourses'

const KIND_TO_KEY: Record<RelatedKind, RelatedKey> = {
  positions: 'relatedPositions',
  scenes: 'relatedScenes',
  courses: 'relatedCourses',
}

const KIND_TO_LABEL: Record<RelatedKind, string> = {
  positions: '岗位',
  scenes: '场景',
  courses: '课程',
}

function toRelatedRef(item: { id: string; name: string; code?: string; coverImage?: string }) {
  return { id: item.id, name: item.name, code: item.code, coverImage: item.coverImage }
}

async function searchRelated(kind: RelatedKind, keyword: string): Promise<AllianceRelatedRef[]> {
  const q = keyword.trim()
  if (kind === 'positions') {
    const res = await portalRequest<{ items: CareerPosition[] }>(
      `/job/positions?search=${encodeURIComponent(q)}&limit=20`,
    )
    return (res.items || []).map(toRelatedRef)
  }
  if (kind === 'scenes') {
    const res = await scenarioApi.list({ search: q, limit: 20 })
    return (res.items || []).map(toRelatedRef)
  }
  const res = await courseApi.list({ type: 'system', search: q, limit: 20 } as any)
  return (res.items || []).map(toRelatedRef)
}

export default function AllianceAchievementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [achievement, setAchievement] = useState<AllianceAchievement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pickDialog, setPickDialog] = useState<{
    open: boolean
    kind: RelatedKind
  }>({ open: false, kind: 'positions' })
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<AllianceRelatedRef[]>([])
  const [selected, setSelected] = useState<string>('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const loadData = () => {
    if (!tenantId || !id) return
    allianceAchievementApi
      .get(id)
      .then((a) => setAchievement(a))
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [tenantId, id]) // eslint-disable-line

  const saveRelated = async (key: RelatedKey, items: AllianceRelatedRef[]) => {
    if (!achievement) return
    setSaving(true)
    try {
      const updated = { ...achievement, [key]: items } as AllianceAchievement
      await allianceAchievementApi.update(id, updated)
      setAchievement(updated)
      toast({ title: t('已保存') })
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const currentItems = (): AllianceRelatedRef[] => {
    const key = KIND_TO_KEY[pickDialog.kind]
    return normalizeRelatedRefs((achievement?.[key] as any) || [])
  }

  const runSearch = (kind: RelatedKind, kw: string) => {
    setSearching(true)
    searchRelated(kind, kw)
      .then((items) => {
        const linked = new Set(currentItems().map((x) => x.id))
        setResults(items.filter((x) => !linked.has(x.id)))
        setSelected('')
      })
      .catch(() => {
        setResults([])
        toast({ title: t('搜索失败'), variant: 'destructive' })
      })
      .finally(() => setSearching(false))
  }

  const openPicker = (kind: RelatedKind) => {
    setPickDialog({ open: true, kind })
    setKeyword('')
    setResults([])
    setSelected('')
    runSearch(kind, '')
  }

  const onKeywordChange = (v: string) => {
    setKeyword(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(pickDialog.kind, v), 300)
  }

  const addItem = async () => {
    const opt = results.find((o) => o.id === selected)
    if (!opt) return
    const key = KIND_TO_KEY[pickDialog.kind]
    await saveRelated(key, [...currentItems(), opt])
    setPickDialog({ open: false, kind: pickDialog.kind })
  }

  const removeItem = async (key: RelatedKey, refId: string) => {
    const items = normalizeRelatedRefs((achievement?.[key] as any) || []).filter(
      (x: AllianceRelatedRef) => x.id !== refId,
    )
    await saveRelated(key, items)
  }

  if (!achievement && !loading) {
    return (
      <AllianceDetailShell
        title=""
        tabs={[]}
        notFound
        backHref="/portal/apps/alliance/achievements"
      />
    )
  }

  const renderRelated = (key: RelatedKey, kind: RelatedKind, label: string) => {
    const items = normalizeRelatedRefs((achievement?.[key] as any) || [])
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openPicker(kind)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('添加{label}', { label })}
          </Button>
        </div>
        {items.length === 0 ? (
          <EmptyState title={t('暂无关联{label}', { label })} className="py-8" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((ref) => (
              <RelatedObjectCard key={ref.id} item={ref} kind={kind}>
                <button
                  className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                  title={t('取消关联')}
                  onClick={() => removeItem(key, ref.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </RelatedObjectCard>
            ))}
          </div>
        )}
      </div>
    )
  }

  const tabs = [
    {
      key: 'info',
      label: t('基本信息'),
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基础信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('成果类型：')}</span>
                {allianceLabel('achievementType', achievement?.type)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('成果日期：')}</span>
                {achievement?.achievementDate || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('状态：')}</span>
                {allianceLabel('achievementStatus', achievement?.status)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('前台展示：')}</span>
                {achievement?.isPublic ? t('是') : t('否')}
              </p>
              <p>
                <span className="text-muted-foreground">{t('创建人：')}</span>
                {achievement?.createdBy || '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('引用来源')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('引用理由：')}</span>
                {achievement?.citationReason || '-'}
              </p>
              {achievement?.ownerPersons && (achievement.ownerPersons as any[])?.length > 0 && (
                <p>
                  <span className="text-muted-foreground">{t('成果归属人：')}</span>
                  {(achievement.ownerPersons as any[]).map((p: any) => (
                    <Badge key={p} variant="secondary" className="mr-1">
                      {p.name || p}
                    </Badge>
                  ))}
                </p>
              )}
              {achievement?.coBuilders && (achievement.coBuilders as any[])?.length > 0 && (
                <p>
                  <span className="text-muted-foreground">{t('成果共建人：')}</span>
                  {(achievement.coBuilders as any[]).map((p: any) => (
                    <Badge key={p} variant="secondary" className="mr-1">
                      {p.name || p}
                    </Badge>
                  ))}
                </p>
              )}
            </CardContent>
          </Card>
          {achievement?.coverImage && (
            <Card>
              <CardHeader>
                <CardTitle>{t('成果封面')}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={achievement.coverImage}
                  alt={achievement.title}
                  className="w-full max-h-48 object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          )}
          {achievement?.description && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('成果简介')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{achievement.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'attachments',
      label: t('成果佐证材料'),
      badge: (achievement?.attachments || []).length,
      content: (
        <div className="space-y-2">
          {(achievement?.attachments || []).length === 0 ? (
            <EmptyState title={t('暂无佐证材料')} className="py-8" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(achievement?.attachments || []).map((f, i) => {
                const src = typeof f === 'string' ? f : (f as any)?.url || (f as any)?.name
                return (
                  <a key={i} href={src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={t('佐证材料 {idx}', { idx: i + 1 })}
                      className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-100 shadow-sm hover:opacity-80 transition-opacity"
                    />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'positions',
      label: t('关联职业岗位'),
      badge: normalizeRelatedRefs((achievement as any)?.relatedPositions || []).length,
      content: renderRelated('relatedPositions', 'positions', t('岗位')),
    },
    {
      key: 'scenes',
      label: t('关联实践场景'),
      badge: normalizeRelatedRefs((achievement as any)?.relatedScenes || []).length,
      content: renderRelated('relatedScenes', 'scenes', t('场景')),
    },
    {
      key: 'courses',
      label: t('关联数字课程'),
      badge: normalizeRelatedRefs((achievement as any)?.relatedCourses || []).length,
      content: renderRelated('relatedCourses', 'courses', t('课程')),
    },
  ]

  const pickLabel = t(KIND_TO_LABEL[pickDialog.kind])

  return (
    <>
      <AllianceDetailShell
        title={achievement?.title || ''}
        subtitle={t('{type}成果', {
          type: allianceLabel('achievementType', achievement?.type),
        })}
        statusBadge={
          achievement ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary">
              {allianceLabel('achievementStatus', achievement.status)}
            </span>
          ) : undefined
        }
        backHref="/portal/apps/alliance/achievements"
        editHref={`/portal/apps/alliance/achievements/${id}/edit`}
        tabs={tabs}
        defaultTab="info"
        loading={loading}
      />

      <Dialog
        open={pickDialog.open}
        onOpenChange={(o) => !o && setPickDialog({ open: false, kind: pickDialog.kind })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('添加关联{pickLabel}', { pickLabel })}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addItem()
            }}
            className="grid gap-4"
          >
            <SearchInput
              iconClassName="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              inputClassName="pl-8"
              placeholder={t('搜索{pickLabel}名称或编码', { pickLabel })}
              value={keyword}
              onChange={onKeywordChange}
              autoFocus
            />
          <div className="max-h-[45vh] overflow-y-auto space-y-1">
            {searching ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('搜索中...')}
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                title={t('暂无可选{pickLabel}', { pickLabel })}
                className="py-6"
              />
            ) : (
              results.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelected(selected === opt.id ? '' : opt.id)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm hover:bg-muted/40 ${selected === opt.id ? 'border-primary bg-primary/5' : ''}`}
                >
                  <span className="font-medium">{opt.name}</span>
                  {opt.code && (
                    <span className="ml-2 text-xs text-muted-foreground">{opt.code}</span>
                  )}
                </button>
              ))
            )}
          </div>
          <FormDialogFooter
            onCancel={() => setPickDialog({ open: false, kind: pickDialog.kind })}
            confirmText={t('添加')}
            loading={saving}
            confirmDisabled={!selected}
          />
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
