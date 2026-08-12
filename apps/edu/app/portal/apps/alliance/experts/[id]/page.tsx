'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Copy, UserCheck, UserX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceExpertApi, allianceEnterpriseApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceExpert, AllianceEnterprise, AllianceMentorOption } from '@/lib/types'

export default function AllianceExpertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [expert, setExpert] = useState<AllianceExpert | null>(null)
  const [enterprise, setEnterprise] = useState<AllianceEnterprise | null>(null)
  const [loading, setLoading] = useState(true)
  // 共建导师（影子账号）启用状态：null 表示未加载/不在 mentor-options 中
  const [mentorOption, setMentorOption] = useState<AllianceMentorOption | null>(null)
  const [mentorPending, setMentorPending] = useState(false)
  const [initialPassword, setInitialPassword] = useState<string | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false)

  const loadMentorOption = useCallback(() => {
    if (!id) return
    allianceExpertApi
      .mentorOptions()
      .then((options) =>
        setMentorOption((options.items || []).find((o) => o.expertId === id) || null),
      )
      .catch(() => setMentorOption(null))
  }, [id])

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([allianceExpertApi.get(id), allianceEnterpriseApi.list({ limit: 200 })])
      .then(([e, ents]) => {
        setExpert(e)
        setEnterprise((ents.items || []).find((x) => x.id === e.enterpriseId) || null)
      })
      .catch((err) =>
        toast({ title: t('加载失败'), description: err.message, variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
    loadMentorOption()
  }, [tenantId, id, toast, t, loadMentorOption])

  const handleEnableMentor = async () => {
    if (!id || mentorPending) return
    setMentorPending(true)
    try {
      const res = await allianceExpertApi.mentorLink(id)
      if (res.initialPassword) {
        setPasswordCopied(false)
        setInitialPassword(res.initialPassword)
      } else {
        toast({ title: t('已启用为共建导师') })
      }
      loadMentorOption()
    } catch (err: any) {
      toast({ title: t('启用失败'), description: err.message, variant: 'destructive' })
    } finally {
      setMentorPending(false)
    }
  }

  const handleDisableMentor = async () => {
    if (!id || mentorPending) return
    setMentorPending(true)
    try {
      await allianceExpertApi.unlinkMentor(id)
      toast({ title: t('已停用共建导师') })
      setDisableConfirmOpen(false)
      loadMentorOption()
    } catch (err: any) {
      toast({ title: t('停用失败'), description: err.message, variant: 'destructive' })
    } finally {
      setMentorPending(false)
    }
  }

  const copyInitialPassword = async () => {
    if (!initialPassword) return
    try {
      await navigator.clipboard.writeText(initialPassword)
      setPasswordCopied(true)
    } catch {
      toast({ title: t('复制失败，请手动复制'), variant: 'destructive' })
    }
  }

  if (!expert && !loading) {
    return (
      <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/experts" />
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
                <span className="text-muted-foreground">{t('性别：')}</span>
                {expert?.gender === 'male' ? t('男') : expert?.gender === 'female' ? t('女') : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('年龄：')}</span>
                {expert?.age ? t('{age}岁', { age: expert.age }) : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('所在城市：')}</span>
                {expert?.city || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('从业年限：')}</span>
                {expert?.experienceYears ? t('{years}年', { years: expert.experienceYears }) : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('教育背景：')}</span>
                {expert?.education || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('行业方向：')}</span>
                {expert?.industry || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('前台展示：')}</span>
                {expert?.isPublic ? t('是') : t('否')}
              </p>
              <p>
                <span className="text-muted-foreground">{t('共建导师：')}</span>
                {mentorOption?.enabled ? t('已启用') : t('未启用')}
              </p>
              <p>
                <span className="text-muted-foreground">{t('创建人：')}</span>
                {expert?.createdBy || '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('所属机构')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('来源：')}</span>
                {expert?.partnerSource === 'cooperation'
                  ? t('合作企业')
                  : expert?.partnerSource === 'third-party'
                    ? t('第三方机构')
                    : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('所属机构：')}</span>
                {expert?.organization || enterprise?.name || '-'}
              </p>
              {enterprise && (
                <p>
                  <span className="text-muted-foreground">{t('关联企业：')}</span>
                  <a
                    href={`/portal/apps/alliance/enterprises/${enterprise.id}`}
                    className="text-primary hover:underline"
                  >
                    {enterprise.name}
                  </a>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">{t('关联二级学院：')}</span>
                {((expert as any)?.secondaryColleges || []).join('、') || '-'}
              </p>
            </CardContent>
          </Card>
          {expert?.avatarUrl && (
            <Card>
              <CardHeader>
                <CardTitle>{t('头像')}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={expert.avatarUrl}
                  alt={expert.name}
                  className="w-24 h-32 object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          )}
          {(expert as any)?.specialties?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('擅长领域')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {((expert as any).specialties || []).map((s: string) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {expert?.introduction && (
            <Card>
              <CardHeader>
                <CardTitle>{t('专家简介')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{expert.introduction}</p>
              </CardContent>
            </Card>
          )}
          {expert?.workExperience && (
            <Card>
              <CardHeader>
                <CardTitle>{t('从业经历')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{expert.workExperience}</p>
              </CardContent>
            </Card>
          )}
          {(expert as any)?.attachments?.length > 0 && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('资质荣誉')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {((expert as any).attachments || []).map((a: string, i: number) => (
                    <a key={i} href={a} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a}
                        alt={t('资质荣誉 {idx}', { idx: i + 1 })}
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-100 shadow-sm hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <AllianceDetailShell
        title={expert?.name || ''}
        subtitle={[expert?.title, expert?.position].filter(Boolean).join(' · ')}
        statusBadge={
          expert ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary">
              {allianceLabel('expertStatus', expert.status)}
            </span>
          ) : undefined
        }
        backHref="/portal/apps/alliance/experts"
        tabs={tabs}
        defaultTab="info"
        loading={loading}
        actions={
          mentorOption?.enabled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={mentorPending}
              onClick={() => setDisableConfirmOpen(true)}
            >
              <UserX className="h-4 w-4 mr-1" />
              {t('停用共建导师')}
            </Button>
          ) : (
            <Button size="sm" disabled={mentorPending} onClick={handleEnableMentor}>
              <UserCheck className="h-4 w-4 mr-1" />
              {t('启用为共建导师')}
            </Button>
          )
        }
      />

      {/* 首次启用返回初始密码：展示并提示转告导师修改密码 */}
      <Dialog
        open={!!initialPassword}
        onOpenChange={(open) => {
          if (!open) setInitialPassword(null)
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('已启用为共建导师')}</DialogTitle>
            <DialogDescription>
              {t('已为其创建共建导师账号，请将初始密码转告导师，并提醒导师登录后及时修改密码。')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
            <code className="flex-1 text-sm font-mono select-all">{initialPassword}</code>
            <Button variant="outline" size="sm" onClick={copyInitialPassword}>
              {passwordCopied ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              {passwordCopied ? t('已复制') : t('复制')}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setInitialPassword(null)}>{t('知道了')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={disableConfirmOpen}
        onOpenChange={setDisableConfirmOpen}
        title={t('停用共建导师')}
        description={t('停用后该导师将无法登录参与共建，确认停用？')}
        confirmText={t('停用')}
        variant="destructive"
        pending={mentorPending}
        onConfirm={handleDisableMentor}
      />
    </>
  )
}
