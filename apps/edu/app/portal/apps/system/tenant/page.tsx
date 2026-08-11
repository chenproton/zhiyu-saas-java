'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
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
  Shield,
  School,
  BookOpen,
  Monitor,
  User,
  Sparkles,
  Zap,
  Coins,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useToast } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest, getAIConfig, saveAIConfig, deleteAIConfig, getAIUsage } from '@/lib/api'
import type { AIConfigView, AIUsageStats } from '@/lib/api'
import type { Tenant as BackendTenant } from '@/lib/types/backend'
import { Spinner } from '@/components/ui/spinner'
import { SchoolAdminManager } from './_components/school-admin-manager'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { useT } from '@/lib/i18n/locale-provider'

interface Tenant {
  id: string
  code: string
  enterpriseName: string
  contact: string
  phone: string
  adminCount: number
  domain: string
  address: string
  enterpriseCode: string
  description: string
  shortName: string
  schoolType: string
  province: string
  city: string
  website: string
  contactPhone: string
  educationLevel: string
  educationNature: string
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
    adminCount: (t.adminIds || []).length,
    domain: t.domain || '-',
    address: t.address || '-',
    enterpriseCode: t.enterpriseCode || '-',
    description: t.description || '-',
    shortName: (t as any).shortName || '-',
    schoolType: (t as any).schoolType || '-',
    province: (t as any).province || '-',
    city: (t as any).city || '-',
    website: (t as any).website || '-',
    contactPhone: (t as any).contactPhone || '-',
    educationLevel: (t as any).educationLevel || '-',
    educationNature: (t as any).educationNature || '-',
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

export default function TenantPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIConfigView | null>(null)
  const [aiUsage, setAIUsage] = useState<AIUsageStats | null>(null)
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false)
  const [aiForm, setAiForm] = useState({ baseUrl: '', apiKey: '', model: '' })
  const [aiSubmitting, setAISubmitting] = useState(false)
  const [aiDeleteConfirm, setAIDeleteConfirm] = useState(false)
  const { toast } = useToast()
  const t = useT()

  const cities = useMemo(
    () => (formData.province ? CHINA_REGION[formData.province] || [] : []),
    [formData.province],
  )

  // 每日 token 消耗柱形图数据（X 轴展示 MM-DD）
  const aiUsageChartData = useMemo(
    () => (aiUsage?.daily || []).map((d) => ({ label: d.date.slice(5), tokens: d.tokens })),
    [aiUsage],
  )

  const loadTenantToForm = (ten: Tenant) => {
    // 省份/城市不在字典键集合（如「内蒙古」vs「内蒙」）时不作兜底回退，
    // 置空让用户显式选择，防止保存时把真实值改写为兜底默认值
    const knownProvince = PROVINCES.includes(ten.province)
    setFormData({
      name: ten.enterpriseName,
      shortName: ten.shortName === '-' ? '' : ten.shortName,
      province: knownProvince ? ten.province : '',
      city:
        knownProvince && ten.city !== '-' && ten.city
          ? ten.city
          : '',
      contact: ten.contact === '-' ? '' : ten.contact,
      phone: ten.phone === '-' ? '' : ten.phone,
      contactPhone: ten.contactPhone === '-' ? '' : ten.contactPhone,
      domain: ten.domain === '-' ? '' : ten.domain,
      address: ten.address === '-' ? '' : ten.address,
      website: ten.website === '-' ? '' : ten.website,
      enterpriseCode: ten.enterpriseCode === '-' ? '' : ten.enterpriseCode,
      description: ten.description === '-' ? '' : ten.description,
      educationLevel: ten.educationLevel === '-' ? '' : ten.educationLevel,
      educationNature: ten.educationNature === '-' ? '' : ten.educationNature,
    })
  }

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      const ten = mapBackendTenant(res)
      setTenant(ten)
      loadTenantToForm(ten)
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

  const fetchAIConfig = useCallback(async () => {
    if (!tenantId) return
    try {
      const view = await getAIConfig()
      setAiConfig(view)
      if (view.configured) {
        try {
          setAIUsage(await getAIUsage())
        } catch {
          // 用量统计读取失败不阻塞页面，看板隐藏
          setAIUsage(null)
        }
      } else {
        setAIUsage(null)
      }
    } catch {
      // 配置读取失败不阻塞主页面，展示为未配置
      setAiConfig(null)
      setAIUsage(null)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading) return
    ;(async () => {
      await fetchAIConfig()
    })()
  }, [fetchAIConfig, authLoading])

  const openAIDialog = () => {
    setAiForm({
      baseUrl: aiConfig?.baseUrl || '',
      apiKey: '',
      model: aiConfig?.model || '',
    })
    setIsAIDialogOpen(true)
  }

  const handleAISave = async () => {
    if (!aiForm.baseUrl || !aiForm.model) {
      toast({ title: t('请填写 Base URL 与模型'), variant: 'destructive' })
      return
    }
    setAISubmitting(true)
    try {
      await saveAIConfig({
        baseUrl: aiForm.baseUrl,
        model: aiForm.model,
        ...(aiForm.apiKey ? { apiKey: aiForm.apiKey } : {}),
      })
      setIsAIDialogOpen(false)
      toast({ title: t('保存成功') })
      await fetchAIConfig()
    } catch (err) {
      toast({
        title: t('保存失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setAISubmitting(false)
    }
  }

  const handleAIDelete = async () => {
    setAISubmitting(true)
    try {
      await deleteAIConfig()
      setAIDeleteConfirm(false)
      setIsAIDialogOpen(false)
      toast({ title: t('已清除 AI 配置') })
      await fetchAIConfig()
    } catch (err) {
      toast({
        title: t('清除失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setAISubmitting(false)
    }
  }

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
          contact: formData.contact || null,
          phone: formData.phone || formData.contactPhone || null,
          domain: formData.domain || null,
          address: formData.address || null,
          enterpriseCode: formData.enterpriseCode || null,
          description: formData.description || null,
          shortName: formData.shortName || null,
          // 省份/城市未选择（原值不在字典键集合）时不提交，保留后端原值
          ...(formData.province
            ? { province: formData.province, city: formData.city || null }
            : {}),
          website: formData.website
            ? formData.website.startsWith('http')
              ? formData.website
              : 'https://' + formData.website
            : null,
          contactPhone: formData.contactPhone || formData.phone || null,
          educationLevel: formData.educationLevel || null,
          educationNature: formData.educationNature || null,
        }),
      })
      setIsEditDialogOpen(false)
      toast({ title: t('保存成功') })
      await fetchTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('更新失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const setF = (key: string, value: string) => {
    if (key === 'province' && value !== formData.province)
      setFormData((prev) => ({ ...prev, province: value, city: '' }))
    else setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleWebsiteChange = (v: string) =>
    setF('website', v ? (v.startsWith('http') ? v : 'https://' + v) : v)
  const adminFetcher = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => portalRequest<T>(path, options),
    [],
  )

  if (authLoading || loading)
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        {t('加载中...')}
      </div>
    )

  return (
    <PortalCrudPage
      title={t('租户信息管理')}
      description={t('查看和编辑当前租户及学校信息')}
      entityLabel={t('租户')}
      items={[]}
      loading={false}
      error={error}
      onRetry={fetchTenant}
      colSpan={1}
      search={false}
      hideImport
      hideCreate
      headerActions={
        tenant && (
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
        )
      }
      body={
        tenant && (
          <div>
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{tenant.enterpriseName}</h2>
                    <p className="text-sm text-muted-foreground font-mono">{tenant.code}</p>
                  </div>
                  <StatusBadge
                    status={tenant.status}
                    label={t(tenant.status === 'active' ? '启用' : '停用')}
                    className="ml-auto"
                  />
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
                <F icon={Shield} label={t('管理员')} v={t('{n}人', { n: tenant.adminCount })} />
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
            <div className="mt-6 rounded-lg border border-gray-100 bg-white shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{t('AI 服务配置')}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t('接入租户自有 OpenAI 兼容服务，token 成本租户自负')}
                    </p>
                  </div>
                  <StatusBadge
                    status={aiConfig?.configured ? 'active' : 'inactive'}
                    label={t(aiConfig?.configured ? '已配置' : '未配置')}
                    className="ml-auto"
                  />
                  <Button size="sm" variant="outline" onClick={openAIDialog}>
                    <Pencil className="h-4 w-4 mr-1" />
                    {t('配置')}
                  </Button>
                </div>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <F icon={Globe} label={t('Base URL')} v={aiConfig?.baseUrl || '-'} />
                <F icon={Sparkles} label={t('模型')} v={aiConfig?.model || '-'} />
                <F icon={Shield} label={t('API Key')} v={aiConfig?.apiKeyMasked || '-'} />
              </div>
              {aiConfig?.configured && aiUsage && (
                <div className="px-6 py-5 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="rounded-lg border border-gray-100 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('总 API 请求次数')}</p>
                        <p className="text-2xl font-semibold mt-0.5">
                          {aiUsage.totalRequests.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-100 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Coins className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('总 Token 消耗')}</p>
                        <p className="text-2xl font-semibold mt-0.5">
                          {aiUsage.totalTokens.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium mb-3">{t('每日 Token 消耗（近 30 天）')}</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiUsageChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: any) => [Number(value).toLocaleString(), t('Token 消耗')]}
                        />
                        <Bar dataKey="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
            {tenantId && (
              <div className="mt-6">
                <SchoolAdminManager fetcher={adminFetcher} />
              </div>
            )}
          </div>
        )
      }
    >
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('编辑信息')}</DialogTitle>
            <DialogDescription>{t('修改租户与学校信息')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4 overflow-y-auto flex-1 min-h-0">
            <FormFieldGrid cols={2}>
              <FormFieldRow label={t('租户标识')}>
                <Input disabled className="bg-muted font-mono" value={tenant?.code || ''} />
              </FormFieldRow>
              <FormFieldRow label={t('状态')}>
                <Input
                  disabled
                  className="bg-muted"
                  value={t(tenant?.status === 'active' ? '启用' : '停用')}
                />
              </FormFieldRow>
            </FormFieldGrid>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                {t('基础信息')}
              </Label>
              <div className="space-y-4">
                <FormFieldRow label={t('学校名称')} required>
                  <IconInput
                    icon={Building}
                    value={formData.name || ''}
                    onChange={(e) => setF('name', e.target.value)}
                  />
                </FormFieldRow>
                <FormFieldGrid cols={2}>
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
                <FormFieldGrid cols={2}>
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
                <FormFieldGrid cols={2}>
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
                          placeholder={t(formData.province ? '请选择城市' : '请先选省份')}
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
                <FormFieldGrid cols={2}>
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
                {t('网络信息')}
              </Label>
              <div className="space-y-4">
                <FormFieldGrid cols={2}>
                  <FormFieldRow label={t('官网')}>
                    <IconInput
                      icon={Globe}
                      value={formData.website || ''}
                      onChange={(e) => handleWebsiteChange(e.target.value)}
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
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('AI 服务配置')}</DialogTitle>
            <DialogDescription>
              {t('填写 OpenAI 兼容服务的接入信息，API Key 将加密存储')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <FormFieldRow label={t('Base URL')} required>
              <Input
                value={aiForm.baseUrl}
                onChange={(e) => setAiForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
              />
            </FormFieldRow>
            <FormFieldRow label={t('API Key')} required={!aiConfig?.configured}>
              <Input
                type="password"
                value={aiForm.apiKey}
                onChange={(e) => setAiForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder={aiConfig?.configured ? t('留空则不修改') : 'sk-...'}
              />
            </FormFieldRow>
            <FormFieldRow label={t('模型')} required>
              <Input
                value={aiForm.model}
                onChange={(e) => setAiForm((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
            </FormFieldRow>
          </div>
          <DialogFooter>
            {aiConfig?.configured && (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => setAIDeleteConfirm(true)}
                disabled={aiSubmitting}
              >
                {t('清除配置')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsAIDialogOpen(false)} disabled={aiSubmitting}>
              {t('取消')}
            </Button>
            <Button onClick={handleAISave} disabled={aiSubmitting}>
              {aiSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={aiDeleteConfirm}
        onOpenChange={setAIDeleteConfirm}
        title={t('确认清除')}
        description={t('确定清除当前租户的 AI 服务配置吗？清除后租户内所有 AI 功能将不可用。')}
        confirmText={t('清除')}
        variant="destructive"
        onConfirm={handleAIDelete}
      />
    </PortalCrudPage>
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
