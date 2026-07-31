"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Loader2, Pencil, Building, Phone, Globe, MapPin, Hash, FileText, Calendar, School, BookOpen, Monitor, User } from "lucide-react"
import { useToast } from "@zhiyu/ui"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import type { Tenant as BackendTenant } from "@/lib/types/backend"
import { Spinner } from "@/components/ui/spinner"

interface Tenant {
  id: string; code: string; enterpriseName: string
  contact: string; phone: string
  domain: string; address: string; enterpriseCode: string; description: string
  shortName: string; schoolType: string; province: string; city: string
  website: string; contactPhone: string
  educationLevel: string; educationNature: string
  status: "active" | "inactive"; createdAt: string
}

function mapBackendTenant(t: BackendTenant): Tenant {
  return {
    id: t.id, code: t.code, enterpriseName: t.name,
    contact: t.contact || "-", phone: t.phone || "-",
    domain: t.domain || "-", address: t.address || "-",
    enterpriseCode: t.enterpriseCode || "-", description: t.description || "-",
    shortName: (t as any).shortName || "-", schoolType: (t as any).schoolType || "-",
    province: (t as any).province || "-", city: (t as any).city || "-",
    website: (t as any).website || "-", contactPhone: (t as any).contactPhone || "-",
    educationLevel: (t as any).educationLevel || "-", educationNature: (t as any).educationNature || "-",
    status: t.status, createdAt: t.createdAt,
  }
}

const CHINA_REGION: Record<string, string[]> = {
  "北京": ["东城区","西城区","朝阳区","海淀区","丰台区","石景山区","通州区","大兴区"],
  "上海": ["黄浦区","徐汇区","长宁区","静安区","普陀区","浦东新区","闵行区"],
  "天津": ["和平区","河东区","河西区","南开区","河北区","红桥区","滨海新区"],
  "重庆": ["渝中区","江北区","沙坪坝区","九龙坡区","南岸区","渝北区"],
  "广东": ["广州","深圳","珠海","东莞","佛山","中山","惠州","汕头"],
  "浙江": ["杭州","宁波","温州","嘉兴","湖州","绍兴","金华","台州"],
  "江苏": ["南京","苏州","无锡","常州","南通","徐州","扬州","镇江"],
  "山东": ["济南","青岛","烟台","潍坊","临沂","淄博","威海","日照"],
  "四川": ["成都","绵阳","德阳","宜宾","南充","泸州","乐山"],
  "湖北": ["武汉","宜昌","襄阳","荆州","黄石","十堰","孝感"],
  "湖南": ["长沙","株洲","湘潭","衡阳","岳阳","常德","郴州"],
  "河南": ["郑州","洛阳","开封","新乡","南阳","许昌","周口"],
  "河北": ["石家庄","唐山","保定","邯郸","廊坊","沧州","秦皇岛"],
  "福建": ["福州","厦门","泉州","漳州","莆田","龙岩","三明"],
  "安徽": ["合肥","芜湖","蚌埠","马鞍山","安庆","滁州","阜阳"],
  "陕西": ["西安","咸阳","宝鸡","汉中","渭南","延安","榆林"],
  "辽宁": ["沈阳","大连","鞍山","抚顺","本溪","锦州","营口"],
  "江西": ["南昌","九江","赣州","景德镇","萍乡","新余","宜春"],
  "云南": ["昆明","曲靖","玉溪","大理","丽江","保山","昭通"],
  "贵州": ["贵阳","遵义","毕节","六盘水","安顺","铜仁"],
  "广西": ["南宁","柳州","桂林","北海","玉林","梧州","百色"],
  "黑龙江": ["哈尔滨","齐齐哈尔","牡丹江","佳木斯","大庆","鸡西"],
  "吉林": ["长春","吉林市","四平","通化","延边","白城"],
  "山西": ["太原","大同","阳泉","长治","临汾","运城","晋城"],
  "内蒙": ["呼和浩特","包头","鄂尔多斯","赤峰","通辽","呼伦贝尔"],
  "甘肃": ["兰州","天水","白银","酒泉","张掖","武威"],
  "新疆": ["乌鲁木齐","克拉玛依","吐鲁番","哈密","喀什","伊犁"],
  "海南": ["海口","三亚","儋州","琼海","文昌","万宁"],
  "宁夏": ["银川","石嘴山","吴忠","固原","中卫"],
  "青海": ["西宁","海东","格尔木","德令哈","玉树"],
  "西藏": ["拉萨","日喀则","昌都","林芝","山南","那曲"],
}
const PROVINCES = Object.keys(CHINA_REGION)

export default function AllianceSchoolPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const cities = useMemo(() => formData.province ? (CHINA_REGION[formData.province] || []) : [], [formData.province])

  const loadTenantToForm = (t: Tenant) => {
    setFormData({
      name: t.enterpriseName, shortName: t.shortName === "-" ? "" : t.shortName,
      schoolType: t.schoolType === "-" ? "" : t.schoolType,
      province: PROVINCES.includes(t.province) ? t.province : "",
      city: t.city === "-" ? "" : t.city,
      educationLevel: t.educationLevel === "-" ? "" : t.educationLevel,
      educationNature: t.educationNature === "-" ? "" : t.educationNature,
      contact: t.contact === "-" ? "" : t.contact, phone: t.phone === "-" ? "" : t.phone,
      contactPhone: t.contactPhone === "-" ? "" : t.contactPhone,
      domain: t.domain === "-" ? "" : t.domain, address: t.address === "-" ? "" : t.address,
      website: t.website === "-" ? "" : t.website,
      enterpriseCode: t.enterpriseCode === "-" ? "" : t.enterpriseCode,
      description: t.description === "-" ? "" : t.description,
    })
  }

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return
    setLoading(true); setError(null)
    try {
      const res = await portalRequest<BackendTenant>(`/tenants/${tenantId}`)
      const t = mapBackendTenant(res); setTenant(t); loadTenantToForm(t)
    } catch (err) { setError(err instanceof Error ? err.message : "加载失败") }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading) return; fetchTenant() }, [fetchTenant, authLoading])

  const handleUpdate = async () => {
    if (!formData.name || !tenant) { setError("请填写学校名称"); return }
    setSubmitting(true); setError(null)
    try {
      await portalRequest(`/tenants/${tenant.id}`, { method: "PUT", body: JSON.stringify({
        name: formData.name, contact: formData.contact || null, phone: formData.phone || formData.contactPhone || null,
        domain: formData.domain || null, address: formData.address || null,
        enterpriseCode: formData.enterpriseCode || null, description: formData.description || null,
        shortName: formData.shortName || null, schoolType: formData.schoolType || null,
        province: formData.province || null, city: formData.city || null,
        website: formData.website ? (formData.website.startsWith("http") ? formData.website : "https://" + formData.website) : null,
        contactPhone: formData.contactPhone || formData.phone || null,
        educationLevel: formData.educationLevel || null,
        educationNature: formData.educationNature || null,
      })})
      setIsEditDialogOpen(false); toast({ title: "已保存" }); await fetchTenant()
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败") }
    finally { setSubmitting(false) }
  }

  const setF = (key: string, value: string) => {
    if (key === "province" && value !== formData.province) setFormData(prev => ({ ...prev, province: value, city: "" }))
    else setFormData(prev => ({ ...prev, [key]: value }))
  }

  if (authLoading || loading) return <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Spinner className="h-5 w-5" />加载中...</div>

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">学校信息管理</h1><p className="mt-1 text-sm text-muted-foreground">配置学校基本信息，数据与租户信息同步</p></div>
        {tenant && <Button size="sm" onClick={() => { loadTenantToForm(tenant); setIsEditDialogOpen(true) }}><Pencil className="h-4 w-4 mr-1" />编辑</Button>}
      </div>
      {tenant && (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building className="w-5 h-5 text-primary" /></div>
              <div><h2 className="text-lg font-semibold">{tenant.enterpriseName}</h2><p className="text-sm text-muted-foreground">{tenant.schoolType !== "-" ? tenant.schoolType : ""} {tenant.shortName !== "-" ? `(${tenant.shortName})` : ""}</p></div>
            </div>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field icon={Phone} label="联系人" value={`${tenant.contact} / ${tenant.contactPhone !== "-" ? tenant.contactPhone : tenant.phone}`} />
            <Field icon={School} label="学校简称" value={tenant.shortName} />
            <Field icon={BookOpen} label="办学层次" value={tenant.educationLevel} />
            <Field icon={School} label="办学性质" value={tenant.educationNature} />
            <Field icon={MapPin} label="省份/城市" value={`${tenant.province} ${tenant.city}`} />
            <Field icon={Globe} label="官网" value={tenant.website} />
            <Field icon={Globe} label="绑定域名" value={tenant.domain} />
            <Field icon={MapPin} label="学校地址" value={tenant.address} />
            <Field icon={Hash} label="学校代码" value={tenant.enterpriseCode} />
            <Field icon={Calendar} label="创建时间" value={tenant.createdAt} />
          </div>
          {tenant.description && tenant.description !== "-" && (
            <div className="px-6 py-4 border-t border-gray-100"><div className="flex items-start gap-3"><FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground">学校简介</p><p className="text-sm mt-1 leading-relaxed">{tenant.description}</p></div></div></div>
          )}
        </div>
      )}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>编辑学校信息</DialogTitle><DialogDescription>修改学校基本信息，保存后与租户信息同步更新</DialogDescription></DialogHeader>
          <div className="grid gap-5 py-4 overflow-y-auto flex-1 min-h-0">
            <Separator />
            <div><Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">基础信息</Label>
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>学校名称 <span className="text-destructive">*</span></Label><Input value={formData.name || ""} onChange={(e) => setF("name", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>学校简称</Label><Input value={formData.shortName || ""} onChange={(e) => setF("shortName", e.target.value)} /></div>
                <div className="grid gap-2"><Label>办学层次</Label>
                  <Select value={formData.educationLevel || ""} onValueChange={(v) => setF("educationLevel", v)}>
                    <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="普通本科院校">普通本科院校</SelectItem>
                      <SelectItem value="职业本科院校">职业本科院校</SelectItem>
                      <SelectItem value="高职院校">高职院校</SelectItem>
                      <SelectItem value="中等专业学校">中等专业学校</SelectItem>
                      <SelectItem value="职业高中">职业高中</SelectItem>
                      <SelectItem value="技工学校">技工学校</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>办学性质</Label>
                  <Select value={formData.educationNature || ""} onValueChange={(v) => setF("educationNature", v)}>
                    <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="公办">公办</SelectItem>
                      <SelectItem value="民办">民办</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>省份</Label>
                  <Select value={formData.province || ""} onValueChange={(v) => setF("province", v)}>
                    <SelectTrigger><SelectValue placeholder="请选择省份" /></SelectTrigger>
                    <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>城市</Label>
                  <Select value={formData.city || ""} onValueChange={(v) => setF("city", v)} disabled={!formData.province}>
                    <SelectTrigger><SelectValue placeholder={formData.province ? "请选择城市" : "请先选省份"} /></SelectTrigger>
                    <SelectContent>{cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>学校代码</Label><Input value={formData.enterpriseCode || ""} onChange={(e) => setF("enterpriseCode", e.target.value)} /></div>
                <div className="grid gap-2"><Label>学校简介</Label><Input value={formData.description || ""} onChange={(e) => setF("description", e.target.value)} /></div>
              </div>
            </div></div>
            <Separator />
            <div><Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">联系信息</Label>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>联系人</Label><Input value={formData.contact || ""} onChange={(e) => setF("contact", e.target.value)} /></div>
                <div className="grid gap-2"><Label>联系电话</Label><Input value={formData.contactPhone || formData.phone || ""} onChange={(e) => { setF("phone", e.target.value); setF("contactPhone", e.target.value) }} /></div>
              </div>
              <div className="grid gap-2"><Label>学校地址</Label><Input value={formData.address || ""} onChange={(e) => setF("address", e.target.value)} /></div>
            </div></div>
            <Separator />
            <div><Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">网络信息</Label>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>官网</Label><Input value={formData.website || ""} onChange={(e) => setF("website", e.target.value.startsWith("http") ? e.target.value : "https://" + e.target.value)} placeholder="https://www.example.edu.cn" /></div>
                <div className="grid gap-2"><Label>绑定域名</Label><Input value={formData.domain || ""} onChange={(e) => setF("domain", e.target.value)} /></div>
              </div>
            </div></div>
          </div>
          {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive mt-2">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleUpdate} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm">{value === "- -" ? "-" : value}</p></div>
    </div>
  )
}
