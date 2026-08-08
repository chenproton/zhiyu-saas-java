'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { partnerExpertApi } from '@/lib/api'
import { useToast, LoadingView } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
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
      await partnerExpertApi.update(id, item)
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('返回')}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{t('编辑专家')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <PartnerExpertForm item={item} onChange={setItem} />
        </div>

        <div className="space-y-6">
          <PartnerExpertSettingsCard item={item} onChange={setItem} />
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
      </div>
    </div>
  )
}
