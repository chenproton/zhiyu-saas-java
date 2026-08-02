'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAchievementApi, portalRequest } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { Plus, Trash2 } from 'lucide-react'
import type { AllianceAchievement } from '@/lib/types'

interface RelatedRef {
  id: string
  name: string
}

export default function AllianceAchievementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [achievement, setAchievement] = useState<AllianceAchievement | null>(null)
  const [positions, setPositions] = useState<RelatedRef[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pickDialog, setPickDialog] = useState<{
    open: boolean
    kind: 'positions' | 'scenes' | 'courses'
    selected?: string
  }>({ open: false, kind: 'positions' })

  const loadData = () => {
    if (!tenantId || !id) return
    Promise.all([
      allianceAchievementApi.get(id),
      portalRequest<{ items: RelatedRef[] }>('/career/positions?limit=1000').catch(() => ({
        items: [],
      })),
      allianceAchievementApi.list({ limit: 1000 }),
    ])
      .then(([a, pos, ach]) => {
        setAchievement(a)
        setPositions(pos.items || [])
        setAchievements(ach.items || [])
      })
      .catch((e) => toast({ title: '加载失败', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [tenantId, id]) // eslint-disable-line

  const saveRelated = async (
    key: 'relatedPositions' | 'relatedScenes' | 'relatedCourses',
    items: RelatedRef[],
  ) => {
    if (!achievement) return
    setSaving(true)
    try {
      const updated = { ...achievement, [key]: items } as AllianceAchievement
      await allianceAchievementApi.update(id, updated)
      setAchievement(updated)
      toast({ title: '已保存' })
    } catch (e: any) {
      toast({ title: '保存失败', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const currentItems = (): RelatedRef[] => {
    const key =
      pickDialog.kind === 'positions'
        ? 'relatedPositions'
        : pickDialog.kind === 'scenes'
          ? 'relatedScenes'
          : 'relatedCourses'
    return (achievement?.[key] as any) || []
  }

  const optionsFor = (kind: 'positions' | 'scenes' | 'courses'): RelatedRef[] => {
    if (kind === 'positions') return positions
    const source = achievements.filter((a) => a.type === kind)
    return source.map((a) => ({ id: a.id, name: a.title }))
  }

  const addItem = async () => {
    const opt = optionsFor(pickDialog.kind).find((o) => o.id === pickDialog.selected)
    if (!opt) return
    const key =
      pickDialog.kind === 'positions'
        ? 'relatedPositions'
        : pickDialog.kind === 'scenes'
          ? 'relatedScenes'
          : 'relatedCourses'
    const items = currentItems()
    if (items.some((x) => x.id === opt.id)) {
      setPickDialog({ open: false, kind: pickDialog.kind })
      return
    }
    await saveRelated(key, [...items, opt])
    setPickDialog({ open: false, kind: pickDialog.kind })
  }

  const removeItem = async (
    key: 'relatedPositions' | 'relatedScenes' | 'relatedCourses',
    refId: string,
  ) => {
    const items = ((achievement?.[key] as any) || []).filter((x: RelatedRef) => x.id !== refId)
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

  const renderRelated = (
    key: 'relatedPositions' | 'relatedScenes' | 'relatedCourses',
    kind: 'positions' | 'scenes' | 'courses',
    label: string,
  ) => {
    const items: RelatedRef[] = (achievement?.[key] as any) || []
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setPickDialog({ open: true, kind })}
            disabled={optionsFor(kind).length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加{label}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">暂无关联{label}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((ref) => (
              <div
                key={ref.id}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm bg-muted/20"
              >
                <span>{ref.name}</span>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => removeItem(key, ref.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const tabs = [
    {
      key: 'info',
      label: '基本信息',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>基础信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">成果类型：</span>
                {allianceLabel('achievementType', achievement?.type)}
              </p>
              <p>
                <span className="text-muted-foreground">成果日期：</span>
                {achievement?.achievementDate || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">状态：</span>
                {allianceLabel('achievementStatus', achievement?.status)}
              </p>
              <p>
                <span className="text-muted-foreground">前台展示：</span>
                {achievement?.isPublic ? '是' : '否'}
              </p>
              <p>
                <span className="text-muted-foreground">浏览量：</span>
                {achievement?.viewCount || 0}
              </p>
              <p>
                <span className="text-muted-foreground">创建人：</span>
                {achievement?.createdBy || '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>引用来源</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">引用理由：</span>
                {achievement?.citationReason || '-'}
              </p>
              {achievement?.ownerPersons && (achievement.ownerPersons as any[])?.length > 0 && (
                <p>
                  <span className="text-muted-foreground">成果归属人：</span>
                  {(achievement.ownerPersons as any[]).map((p: any) => (
                    <Badge key={p} variant="secondary" className="mr-1">
                      {p.name || p}
                    </Badge>
                  ))}
                </p>
              )}
              {achievement?.coBuilders && (achievement.coBuilders as any[])?.length > 0 && (
                <p>
                  <span className="text-muted-foreground">成果共建人：</span>
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
                <CardTitle>成果封面</CardTitle>
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
                <CardTitle>成果简介</CardTitle>
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
      label: '成果佐证材料',
      badge: (achievement?.attachments || []).length,
      content: (
        <div className="space-y-2">
          {(achievement?.attachments || []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">暂无佐证材料</p>
          ) : (
            (achievement?.attachments || []).map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <span className="text-muted-foreground">📄</span>
                <span>{typeof f === 'string' ? f : (f as any)?.name || '附件'}</span>
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'positions',
      label: '关联职业岗位',
      badge: ((achievement as any)?.relatedPositions || []).length,
      content: renderRelated('relatedPositions', 'positions', '岗位'),
    },
    {
      key: 'scenes',
      label: '关联实践场景',
      badge: ((achievement as any)?.relatedScenes || []).length,
      content: renderRelated('relatedScenes', 'scenes', '场景'),
    },
    {
      key: 'courses',
      label: '关联数字课程',
      badge: ((achievement as any)?.relatedCourses || []).length,
      content: renderRelated('relatedCourses', 'courses', '课程'),
    },
  ]

  const pickLabel =
    pickDialog.kind === 'positions' ? '岗位' : pickDialog.kind === 'scenes' ? '场景' : '课程'
  const pickOptions = optionsFor(pickDialog.kind)

  return (
    <>
      <AllianceDetailShell
        title={achievement?.title || ''}
        subtitle={`${allianceLabel('achievementType', achievement?.type)}成果`}
        statusBadge={
          achievement ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
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
            <DialogTitle>添加关联{pickLabel}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {pickOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPickDialog({ ...pickDialog, selected: opt.id })}
                className={`w-full text-left px-3 py-2 rounded border text-sm hover:bg-muted/40 ${pickDialog.selected === opt.id ? 'border-primary bg-primary/5' : ''}`}
              >
                {opt.name}
              </button>
            ))}
            {pickOptions.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">暂无可选{pickLabel}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPickDialog({ open: false, kind: pickDialog.kind })}
            >
              取消
            </Button>
            <Button onClick={addItem} disabled={saving || !pickDialog.selected}>
              {saving ? '保存中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
