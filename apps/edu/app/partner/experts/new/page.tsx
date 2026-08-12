'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, KeyRound } from 'lucide-react'
import { partnerExpertApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import {
  PartnerExpertForm,
  emptyPartnerExpertForm,
  type PartnerExpertFormState,
} from '../_components/expert-form'

export default function PartnerExpertNewPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const { isAdmin, loading: authLoading } = usePartnerAuth()
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState<PartnerExpertFormState>({
    ...emptyPartnerExpertForm,
    isPublic: true,
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // 写操作仅 enterprise_admin
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/partner/experts')
  }, [authLoading, isAdmin, router])

  const handleSave = async () => {
    if (!item.name) {
      toast({ title: t('请填写姓名'), variant: 'destructive' })
      return
    }
    if (!username || !password) {
      toast({ title: t('请填写专家登录用户名和密码'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = await partnerExpertApi.create({ ...item, username, password })
      // 保存成功后回到专家列表页；登录账号信息随 toast 提示转交
      toast({
        title: t('专家已创建'),
        description: t('用户名：{username} ｜ 初始密码：{pwd}，请转交专家本人', {
          username: data.username,
          pwd: data.initialPassword,
        }),
      })
      router.push('/partner/experts')
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('返回')}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{t('新建专家')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <PartnerExpertForm item={item} onChange={setItem} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{t('专家登录账号')}</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  '创建专家将自动生成企业服务台登录账号，专家登录后可维护自己的档案并参与学校授权的共建资源',
                )}
              </p>
              <div className="space-y-1.5">
                <Label>
                  {t('用户名')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder={t('设置登录用户名（同一账号可加入多个企业）')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t('初始密码')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  placeholder={t('至少 8 位，包含字母和数字')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('创建')}
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
