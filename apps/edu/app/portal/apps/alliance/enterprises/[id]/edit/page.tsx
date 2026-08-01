'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { MultiSelect } from '@/components/ui/multi-select'
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import type { AllianceEnterprise } from '@/lib/types'

const SECONDARY_COLLEGES = [
  '智能制造学院',
  '信息技术学院',
  '经济管理学院',
  '艺术设计学院',
  '新能源工程学院',
  '生物医药学院',
  '现代服务学院',
  '国际教育学院',
  '创新创业学院',
  '继续教育学院',
  '基础教育学院',
  '马克思主义学院',
]

export default function AllianceEnterpriseEditPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [item, setItem] = useState<AllianceEnterprise | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`)
      .then((data) => setItem(data))
      .catch((e) => toast({ title: '加载失败', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      await portalRequest(`/alliance/enterprises/${id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      })
      toast({ title: '企业已更新' })
      router.push(`/portal/apps/alliance/enterprises/${id}`)
    } catch (e: any) {
      toast({ title: '保存失败', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!item) return <div className="text-center py-12 text-muted-foreground">企业不存在</div>

  const setField = (field: string, value: any) =>
    setItem({ ...item, [field]: value } as AllianceEnterprise)
  const secondaryColleges: string[] = (item as any).secondaryColleges || []
  const bizPhotos: string[] = (item as any).businessLicensePhotos || []
  const ipPhotos: string[] = (item as any).intellectualPropertyPhotos || []
  const qualPhotos: string[] = (item as any).qualificationPhotos || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <h1 className="text-xl font-bold">编辑合作企业</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>企业名称 *</Label>
                <Input value={item.name || ''} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>统一社会信用代码</Label>
                <Input
                  value={(item as any).unifiedSocialCreditCode || ''}
                  onChange={(e) => setField('unifiedSocialCreditCode', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>企业类型</Label>
                <Select
                  value={item.enterpriseType || 'cooperation'}
                  onValueChange={(v) => setField('enterpriseType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cooperation">合作企业</SelectItem>
                    <SelectItem value="third-party">第三方雇主企业</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>所属行业</Label>
                <Input
                  value={item.industry || ''}
                  onChange={(e) => setField('industry', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>所在地区</Label>
                <Input
                  value={item.region || ''}
                  onChange={(e) => setField('region', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>合作状态</Label>
                <Select
                  value={item.status || 'negotiating'}
                  onValueChange={(v) => setField('status', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="negotiating">洽谈中</SelectItem>
                    <SelectItem value="active">合作中</SelectItem>
                    <SelectItem value="paused">已暂停</SelectItem>
                    <SelectItem value="terminated">已终止</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>合作评级</Label>
                <Select
                  value={item.rating || 'general'}
                  onValueChange={(v) => setField('rating', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strategic">战略合作</SelectItem>
                    <SelectItem value="deep">深度合作</SelectItem>
                    <SelectItem value="general">一般合作</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>成立年份</Label>
                <Input
                  type="number"
                  value={(item as any).establishedYear ?? ''}
                  onChange={(e) =>
                    setField('establishedYear', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>企业规模（人数）</Label>
                <Input
                  type="number"
                  value={(item as any).employeeCount ?? ''}
                  onChange={(e) =>
                    setField('employeeCount', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>企业形象</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SingleImageUpload
                label="企业 Logo"
                value={(item as any).logoUrl || ''}
                onChange={(v) => setField('logoUrl', v)}
              />
              <SingleImageUpload
                label="企业主页封面"
                value={(item as any).coverImage || ''}
                onChange={(v) => setField('coverImage', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>企业证照</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageListUpload
                label="企业营业执照"
                value={bizPhotos}
                onChange={(v) => setField('businessLicensePhotos', v)}
              />
              <ImageListUpload
                label="企业知识产权"
                value={ipPhotos}
                onChange={(v) => setField('intellectualPropertyPhotos', v)}
              />
              <ImageListUpload
                label="企业荣誉资质"
                value={qualPhotos}
                onChange={(v) => setField('qualificationPhotos', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>联系信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>联系人</Label>
                <Input
                  value={item.contactPerson || ''}
                  onChange={(e) => setField('contactPerson', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>联系电话</Label>
                <Input
                  value={item.contactPhone || ''}
                  onChange={(e) => setField('contactPhone', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>联系邮箱</Label>
                <Input
                  value={item.contactEmail || ''}
                  onChange={(e) => setField('contactEmail', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>详细地址</Label>
                <Input
                  value={item.address || ''}
                  onChange={(e) => setField('address', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>企业简介</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.description || ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={5}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>二级学院</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={SECONDARY_COLLEGES}
                value={secondaryColleges}
                onChange={(v) => setField('secondaryColleges', v)}
                placeholder="选择归属学院"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>前台展示</Label>
                <Switch
                  checked={item.isPublic || false}
                  onCheckedChange={(v) => setField('isPublic', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}保存
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>
                取消
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
