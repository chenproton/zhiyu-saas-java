'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, KeyRound } from 'lucide-react'
import { partnerExpertApi } from '@/lib/api'
import { useToast, LoadingView } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { FormPageShell } from '@/components/shared/form-page-shell'
import {
  PartnerExpertForm,
  PartnerExpertSettingsCard,
  emptyPartnerExpertForm,
  type PartnerExpertFormState,
} from '../../_components/expert-form'

export default function PartnerExpertEditPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { isAdmin, loading: authLoading } = usePartnerAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState<PartnerExpertFormState>(emptyPartnerExpertForm)
  const [newPassword, setNewPassword] = useState('')

  // 写操作仅 enterprise_admin
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace(`/partner/experts/${id}`)
  }, [authLoading, isAdmin, router, id])

  useEffect(() => {
    if (authLoading || !isAdmin || !id) return
    partnerExpertApi
      .get(id)
      .then((expert) =>
        setItem({
          name: expert.name || '',
          gender: expert.gender || 'male',
          age: expert.age,
          city: expert.city || '',
          title: expert.title || '',
          position: expert.position || '',
          experienceYears: expert.experienceYears,
          education: expert.education || '',
          industry: expert.industry || '',
          specialties: expert.specialties || [],
          introduction: expert.introduction || '',
          workExperience: expert.workExperience || '',
          avatarUrl: expert.avatarUrl || '',
          coverImage: expert.coverImage || '',
          attachments: expert.attachments || [],
          status: expert.status || 'active',
          isPublic: expert.isPublic || false,
        }),
      )
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [authLoading, isAdmin, id, toast, t])

  const handleSave = async () => {
    if (!item.name) {
      toast({ title: t('请填写姓名'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await partnerExpertApi.update(id, { ...item, password: newPassword || undefined })
      toast({ title: t('专家已更新') })
      router.push(`/partner/experts/${id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return <LoadingView />

  return (
    <FormPageShell title={t('编辑专家')} sidebar={<div className="space-y-6">
          <PartnerExpertSettingsCard item={item} onChange={setItem} />
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{t('重置登录密码')}</h2>
              </div>
              <div className="space-y-1.5">
                <Label>{t('新密码（选填）')}</Label>
                <Input
                  type="password"
                  placeholder={t('至少 8 位，包含字母和数字')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('保存')}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>
                {t('取消')}
              </Button>
            </CardContent>
          </Card>
        </div>
      }>
          <PartnerExpertForm item={item} onChange={setItem} />    </FormPageShell>
  )
}
