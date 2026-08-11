'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Pencil,
  Building,
  Phone,
  Globe,
  MapPin,
  Hash,
  FileText,
  Calendar,
  School,
  BookOpen,
  Monitor,
  User,
} from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest } from '@/lib/api'
import type { Tenant as BackendTenant } from '@/lib/types/backend'
import { Spinner } from '@/components/ui/spinner'
import { MultiSelect } from '@/components/ui/multi-select'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { useT } from '@/lib/i18n/locale-provider'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'

interface Tenant {
  id: string
  code: string
  enterpriseName: string
  contact: string
  phone: string
  domain: string
  address: string
  enterpriseCode: string
  description: string
  shortName: string
  province: string
  city: string
  website: string
  contactPhone: string
  educationLevel: string
  educationNature: string
  logoUrl: string
  status: 'active' | 'inactive'
  createdAt: string
}

function mapBackendTenant(t: BackendTenant): Tenant {
  return {
    id: t.id,
    code: t.code,
    enterpriseName: t.name,
    contact: t.contact || '-',
    phone: t.phone || '-',
    domain: t.domain || '-',
    address: t.address || '-',
    enterpriseCode: t.enterpriseCode || '-',
    description: t.description || '-',
    shortName: (t as any).shortName || '-',
    province: (t as any).province || '-',
    city: (t as any).city || '-',
    website: (t as any).website || '-',
    contactPhone: (t as any).contactPhone || '-',
    educationLevel: (t as any).educationLevel || '-',
    educationNature: (t as any).educationNature || '-',
    logoUrl: (t as any).logoUrl || '-',
    status: t.status,
    createdAt: t.createdAt,
  }
}

const CHINA_REGION: Record<string, string[]> = {
  北京: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区', '通州区', '大兴区'],
  上海: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '浦东新区', '闵行区'],
  天津: ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '滨海新区'],
  重庆: ['渝中区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '渝北区'],
  广东: ['广州', '深圳', '珠海', '东莞', '佛山', '中山', '惠州', '汕头'],
  浙江: ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '台州'],
  江苏: ['南京', '苏州', '无锡', '常州', '南通', '徐州', '扬州', '镇江'],
  山东: ['济南', '青岛', '烟台', '潍坊', '临沂', '淄博', '威海', '日照'],
  四川: ['成都', '绵阳', '德阳', '宜宾', '南充', '泸州', '乐山'],
  湖北: ['武汉', '宜昌', '襄阳', '荆州', '黄石', '十堰', '孝感'],
  湖南: ['长沙', '株洲', '湘潭', '衡阳', '岳阳', '常德', '郴州'],
  河南: ['郑州', '洛阳', '开封', '新乡', '南阳', '许昌', '周口'],
  河北: ['石家庄', '唐山', '保定', '邯郸', '廊坊', '沧州', '秦皇岛'],
  福建: ['福州', '厦门', '泉州', '漳州', '莆田', '龙岩', '三明'],
  安徽: ['合肥', '芜湖', '蚌埠', '马鞍山', '安庆', '滁州', '阜阳'],
  陕西: ['西安', '咸阳', '宝鸡', '汉中', '渭南', '延安', '榆林'],
  辽宁: ['沈阳', '大连', '鞍山', '抚顺', '本溪', '锦州', '营口'],
  江西: ['南昌', '九江', '赣州', '景德镇', '萍乡', '新余', '宜春'],
  云南: ['昆明', '曲靖', '玉溪', '大理', '丽江', '保山', '昭通'],
  贵州: ['贵阳', '遵义', '毕节', '六盘水', '安顺', '铜仁'],
  广西: ['南宁', '柳州', '桂林', '北海', '玉林', '梧州', '百色'],
  黑龙江: ['哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '鸡西'],
  吉林: ['长春', '吉林市', '四平', '通化', '延边', '白城'],
  山西: ['太原', '大同', '阳泉', '长治', '临汾', '运城', '晋城'],
  内蒙: ['呼和浩特', '包头', '鄂尔多斯', '赤峰', '通辽', '呼伦贝尔'],
  甘肃: ['兰州', '天水', '白银', '酒泉', '张掖', '武威'],
  新疆: ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '喀什', '伊犁'],
  海南: ['海口', '三亚', '儋州', '琼海', '文昌', '万宁'],
  宁夏: ['银川', '石嘴山', '吴忠', '固原', '中卫'],
  青海: ['西宁', '海东', '格尔木', '德令哈', '玉树'],
  西藏: ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲'],
}
const PROVINCES = Object.keys(CHINA_REGION)

function IconInput({ icon: Icon, ...props }: { icon: any } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input className="pl-9" {...props} />
    </div>
  )
}

export default function AllianceSchoolPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { colleges: secondaryCollegeOptions } = useSecondaryColleges(tenantId)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const t = useT()
  const cities = useMemo(
    () => (formData.province ? CHINA_REGION[formData.province] || [] : []),
    [formData.province],
  )

  const loadTenantToForm = (t: Tenant) => {
    setFormData({
      name: t.enterpriseName,
      shortName: t.shortName === '-' ? '' : t.shortName,
      // 不在 CHINA_REGION 时留空：回填默认"北京/东城区"会在未修改保存时覆盖原地区
      province: PROVINCES.includes(t.province) ? t.province : '',
      city: t.city !== '-' && t.city && CHINA_REGION[t.province]?.includes(t.city) ? t.city : '',
      contact: t.contact === '-' ? '' : t.contact,
      phone: t.phone === '-' ? '' : t.phone,
      contactPhone: t.contactPhone === '-' ? '' : t.contactPhone,
      domain: t.domain === '-' ? '' : t.domain,
      address: t.address === '-' ? '' : t.address,
      website: t.website === '-' ? '' : t.website,
      enterpriseCode: t.enterpriseCode === '-' ? '' : t.enterpriseCode,
      description: t.description === '-' ? '' : t.description,
      educationLevel: t.educationLevel === '-' ? '' : t.educationLevel,
      educationNature: t.educationNature === '-' ? '' : t.educationNature,
      logoUrl: t.logoUrl === '-' ? '' : t.logoUrl,
      secondaryColleges: (t as any).secondaryColleges || [],
    })
  }

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      const t = mapBackendTenant(res)
      setTenant(t)
      loadTenantToForm(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('加载失败'))
    } finally {
      setLoading(false)
    }
  }, [tenantId, t])

  useEffect(() => {
    if (authLoading) return
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await fetchTenant()
    })()
  }, [fetchTenant, authLoading])

  const handleUpdate = async () => {
    if (!formData.name || !tenant) {
      setError(t('请填写学校名称'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalRequest(`/tenants/${tenant.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name,
          logoUrl: formData.logoUrl || null,
          contact: formData.contact || null,
          phone: formData.phone || formData.contactPhone || null,
          domain: formData.domain || null,
          address: formData.address || null,
          enterpriseCode: formData.enterpriseCode || null,
          description: formData.description || null,
          shortName: formData.shortName || null,
          province: formData.province || null,
          city: formData.city || null,
          website: formData.website
            ? formData.website.startsWith('http')
              ? formData.website
              : 'https://' + formData.website
            : null,
          contactPhone: formData.contactPhone || formData.phone || null,
          educationLevel: formData.educationLevel || null,
          educationNature: formData.educationNature || null,
          secondaryColleges: (formData as any).secondaryColleges || [],
        }),
      })
      setIsEditDialogOpen(false)
      toast({ title: t('已保存') })
      await fetchTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('保存失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const setF = (key: string, value: string) => {
    if (key === 'province' && value !== formData.province)
      setFormData((prev) => ({ ...prev, province: value, city: '' }))
    else setFormData((prev) => ({ ...prev, [key]: value }))
  }

  if (authLoading || loading)
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        {t('加载中...')}
      </div>
    )

  return (
    <div className="min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('学校信息管理')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('配置学校基本信息，与租户信息同步')}
          </p>
        </div>
        {tenant && (
          <Button
            size="sm"
            onClick={() => {
              loadTenantToForm(tenant)
              setIsEditDialogOpen(true)
            }}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {t('编辑')}
          </Button>
        )}
      </div>
      {tenant && (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {tenant.logoUrl && tenant.logoUrl !== '-' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logoUrl}
                  alt={tenant.enterpriseName}
                  className="w-10 h-10 rounded-lg object-cover border border-gray-100 bg-white"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold">{tenant.enterpriseName}</h2>
                <p className="text-sm text-muted-foreground">
                  {tenant.educationLevel !== '-' ? tenant.educationLevel : ''}{' '}
                  {tenant.educationNature !== '-' ? `/ ${tenant.educationNature}` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <F
              icon={Phone}
              label={t('联系人')}
              v={`${tenant.contact} / ${tenant.contactPhone !== '-' ? tenant.contactPhone : tenant.phone}`}
            />
            <F icon={School} label={t('学校简称')} v={tenant.shortName} />
            <F icon={BookOpen} label={t('办学层次')} v={tenant.educationLevel} />
            <F icon={MapPin} label={t('省份/城市')} v={`${tenant.province} ${tenant.city}`} />
            <F icon={Globe} label={t('官网')} v={tenant.website} />
            <F icon={Globe} label={t('绑定域名')} v={tenant.domain} />
            <F icon={MapPin} label={t('学校地址')} v={tenant.address} />
            <F icon={Hash} label={t('学校代码')} v={tenant.enterpriseCode} />
            <F icon={Calendar} label={t('创建时间')} v={tenant.createdAt} />
          </div>
          {tenant.description && tenant.description !== '-' && (
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('学校简介')}</p>
                  <p className="text-sm mt-1 leading-relaxed">{tenant.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('编辑学校信息')}</DialogTitle>
            <DialogDescription>{t('修改学校基本信息，保存后与租户信息同步更新')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4 overflow-y-auto flex-1 min-h-0">
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                {t('基础信息')}
              </Label>
              <div className="space-y-4">
                <SingleImageUpload
                  label={t('学校 Logo')}
                  value={formData.logoUrl || ''}
                  onChange={(v) => setF('logoUrl', v)}
                />
                <FormFieldRow label={t('学校名称')} required>
                  <IconInput
                    icon={Building}
                    value={formData.name || ''}
                    onChange={(e) => setF('name', e.target.value)}
                  />
                </FormFieldRow>
                <FormFieldGrid>
                  <FormFieldRow label={t('学校代码')}>
                    <IconInput
                      icon={Hash}
                      value={formData.enterpriseCode || ''}
                      onChange={(e) => setF('enterpriseCode', e.target.value)}
                    />
                  </FormFieldRow>
                  <FormFieldRow label={t('学校简称')}>
                    <IconInput
                      icon={School}
                      value={formData.shortName || ''}
                      onChange={(e) => setF('shortName', e.target.value)}
                    />
                  </FormFieldRow>
                </FormFieldGrid>
                <FormFieldGrid>
                  <FormFieldRow label={t('办学层次')}>
                    <Select
                      value={formData.educationLevel || ''}
                      onValueChange={(v) => setF('educationLevel', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('请选择')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="普通本科院校">{t('普通本科院校')}</SelectItem>
                        <SelectItem value="职业本科院校">{t('职业本科院校')}</SelectItem>
                        <SelectItem value="高职院校">{t('高职院校')}</SelectItem>
                        <SelectItem value="中等专业学校">{t('中等专业学校')}</SelectItem>
                        <SelectItem value="职业高中">{t('职业高中')}</SelectItem>
                        <SelectItem value="技工学校">{t('技工学校')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                  <FormFieldRow label={t('办学性质')}>
                    <Select
                      value={formData.educationNature || ''}
                      onValueChange={(v) => setF('educationNature', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('请选择')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="公办">{t('公办')}</SelectItem>
                        <SelectItem value="民办">{t('民办')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                </FormFieldGrid>
                <FormFieldGrid>
                  <FormFieldRow label={t('省份')}>
                    <Select
                      value={formData.province || ''}
                      onValueChange={(v) => setF('province', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('请选择省份')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                  <FormFieldRow label={t('城市')}>
                    <Select
                      value={formData.city || ''}
                      onValueChange={(v) => setF('city', v)}
                      disabled={!formData.province}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={formData.province ? t('请选择城市') : t('请先选省份')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormFieldRow>
                </FormFieldGrid>
                <FormFieldRow label={t('学校简介')}>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setF('description', e.target.value)}
                    rows={3}
                  />
                </FormFieldRow>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                {t('联系信息')}
              </Label>
              <div className="space-y-4">
                <FormFieldGrid>
                  <FormFieldRow label={t('联系人')}>
                    <IconInput
                      icon={User}
                      value={formData.contact || ''}
                      onChange={(e) => setF('contact', e.target.value)}
                    />
                  </FormFieldRow>
                  <FormFieldRow label={t('联系电话')}>
                    <IconInput
                      icon={Phone}
                      value={formData.contactPhone || formData.phone || ''}
                      onChange={(e) => {
                        setF('phone', e.target.value)
                        setF('contactPhone', e.target.value)
                      }}
                    />
                  </FormFieldRow>
                </FormFieldGrid>
                <FormFieldRow label={t('学校地址')}>
                  <IconInput
                    icon={MapPin}
                    value={formData.address || ''}
                    onChange={(e) => setF('address', e.target.value)}
                  />
                </FormFieldRow>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                {t('二级学院')}
              </Label>
              <div className="space-y-4">
                <MultiSelect
                  options={secondaryCollegeOptions}
                  value={(formData as any).secondaryColleges || []}
                  onChange={(v) => setF('secondaryColleges' as any, v as any)}
                  placeholder={t('选择或维护二级学院（多选）')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('二级学院将作为企业/项目/成果/专家表单的归属学院选项')}
                </p>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                {t('网络信息')}
              </Label>
              <div className="space-y-4">
                <FormFieldGrid>
                  <FormFieldRow label={t('官网')}>
                    <IconInput
                      icon={Globe}
                      value={formData.website || ''}
                      onChange={(e) =>
                        setF(
                          'website',
                          e.target.value
                            ? e.target.value.startsWith('http')
                              ? e.target.value
                              : 'https://' + e.target.value
                            : '',
                        )
                      }
                      placeholder="https://www.example.edu.cn"
                    />
                  </FormFieldRow>
                  <FormFieldRow label={t('绑定域名')}>
                    <IconInput
                      icon={Monitor}
                      value={formData.domain || ''}
                      onChange={(e) => setF('domain', e.target.value)}
                    />
                  </FormFieldRow>
                </FormFieldGrid>
              </div>
            </div>
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive mt-2">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={submitting}
            >
              {t('取消')}
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function F({ icon: Icon, label, v }: { icon: any; label: string; v: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{v === '- -' ? '-' : v}</p>
      </div>
    </div>
  )
}
