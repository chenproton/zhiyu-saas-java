'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  Sparkles,
  Plus,
  X,
  Loader2,
  Award,
  ExternalLink,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'
import { industryApi, majorApi } from '@/lib/api'
import type { Position, PositionResponsibility } from '@/lib/types/job-source'

interface StepBasicInfoProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  aiMode?: boolean
  variant?: 'default' | 'create'
}

// 常用证书库（保留在组件内部，不引用 mock 文件）
const MOCK_CERTIFICATES = [
  { id: 'cert-1', name: '软件设计师', url: 'https://www.ruankao.org.cn', description: '国家软件设计师资格认证' },
  { id: 'cert-2', name: '系统架构设计师', url: 'https://www.ruankao.org.cn', description: '国家系统架构设计师资格认证' },
  { id: 'cert-3', name: 'PMP', url: 'https://www.pmi.org', description: '项目管理专业人士资格认证' },
  { id: 'cert-4', name: 'AWS 云从业者', url: 'https://aws.amazon.com/certification', description: 'AWS 云计算基础认证' },
  { id: 'cert-5', name: 'CKA', url: 'https://www.cncf.io', description: 'Kubernetes 管理员认证' },
  { id: 'cert-6', name: '数据库系统工程师', url: 'https://www.ruankao.org.cn', description: '国家数据库系统工程师资格认证' },
]

interface Certificate {
  id: string
  name: string
  url: string
  description: string
  image?: string
}

type AiSuggestionField = 'description' | 'responsibilities' | 'requirements' | 'careerPath'

export function StepBasicInfo({ position, onUpdate, aiMode = false, variant = 'default' }: StepBasicInfoProps) {
  const isCreate = variant === 'create'
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [aiNotice, setAiNotice] = useState<string | null>(null)



  // 加载真实行业/专业数据
  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    Promise.all([
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 }),
    ])
      .then(([indRes, majorRes]) => {
        if (cancelled) return
        setIndustries((indRes.items || []).filter((i) => i.enabled).map((i) => ({ id: i.id, name: i.name })))
        setMajors((majorRes.items || []).filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name })))
      })
      .catch(() => {
        if (cancelled) return
        setIndustries([])
        setMajors([])
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 证书相关状态
  const [isCertDialogOpen, setIsCertDialogOpen] = useState(false)
  const [isNewCertDialogOpen, setIsNewCertDialogOpen] = useState(false)
  const [certSearchQuery, setCertSearchQuery] = useState('')
  const [selectedCertIds, setSelectedCertIds] = useState<string[]>([])

  // 同步已选证书状态，防止异步加载/重新进入编辑页后选择框与保存数据不一致
  useEffect(() => {
    setSelectedCertIds(position.certificates?.map((c) => c.id) || [])
  }, [position.certificates])

  const openCertDialog = () => {
    setSelectedCertIds(position.certificates?.map((c) => c.id) || [])
    setIsCertDialogOpen(true)
  }

  const [newCert, setNewCert] = useState<Omit<Certificate, 'id'>>({
    name: '',
    url: '',
    description: '',
    image: '',
  })

  const handleAIGenerate = async (field: AiSuggestionField, _direction?: string) => {
    setIsGenerating(field)
    setAiNotice('AI 生成服务暂未接入，请手动填写')
    await new Promise((resolve) => setTimeout(resolve, 300))
    setIsGenerating(null)
  }

  const addResponsibility = () => {
    const newItem: PositionResponsibility = {
      id: `resp-${Date.now()}`,
      name: '',
      description: '',
    }
    onUpdate({ responsibilities: [...position.responsibilities, newItem] })
  }

  const removeResponsibility = (index: number) => {
    onUpdate({ responsibilities: position.responsibilities.filter((_, i) => i !== index) })
  }

  const addRequirement = () => {
    onUpdate({ requirements: [...position.requirements, ''] })
  }

  const removeRequirement = (index: number) => {
    onUpdate({ requirements: position.requirements.filter((_, i) => i !== index) })
  }

  const handleSelectCertificate = (certId: string, checked: boolean) => {
    if (checked) {
      setSelectedCertIds([...selectedCertIds, certId])
    } else {
      setSelectedCertIds(selectedCertIds.filter((id) => id !== certId))
    }
  }

  const filteredCertificates = useMemo(() => {
    if (!certSearchQuery.trim()) return MOCK_CERTIFICATES
    const q = certSearchQuery.trim().toLowerCase()
    return MOCK_CERTIFICATES.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
    )
  }, [certSearchQuery])

  const handleConfirmCertificates = () => {
    const selectedCerts = MOCK_CERTIFICATES.filter((c) => selectedCertIds.includes(c.id))
    const existingCustomCerts =
      position.certificates?.filter((c) => !MOCK_CERTIFICATES.some((mc) => mc.id === c.id)) || []
    onUpdate({ certificates: [...selectedCerts, ...existingCustomCerts] })
    setIsCertDialogOpen(false)
  }

  const handleAddNewCertificate = () => {
    if (!newCert.name) return
    const cert: Certificate = {
      id: `cert-custom-${Date.now()}`,
      ...newCert,
    }
    onUpdate({ certificates: [...(position.certificates || []), cert] })
    setNewCert({ name: '', url: '', description: '', image: '' })
    setIsNewCertDialogOpen(false)
  }

  const handleRemoveCertificate = (certId: string) => {
    onUpdate({ certificates: position.certificates?.filter((c) => c.id !== certId) || [] })
    setSelectedCertIds(selectedCertIds.filter((id) => id !== certId))
  }

  const renderAIButton = (field: AiSuggestionField, label: string) => {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAIGenerate(field)}
        disabled={isGenerating !== null}
      >
        {isGenerating === field ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Merged Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Row 1: Name + Short Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">岗位名称</Label>
              <Input
                id="name"
                value={position.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="例如：Java 后端开发工程师"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shortName">岗位简称</Label>
              <Input
                id="shortName"
                value={position.shortName}
                onChange={(e) => onUpdate({ shortName: e.target.value })}
                placeholder="例如：Java开发"
              />
            </div>
          </div>

          {/* Row 2: Industry + Major + Position Type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">面向行业</Label>
              <MultiSelect
                options={industries.map((i) => ({ label: i.name, value: i.id }))}
                value={position.industry ? [position.industry] : []}
                onChange={(values) => onUpdate({ industry: values[values.length - 1] || '' })}
                placeholder={optionsLoading ? '加载中...' : '选择行业'}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="major">适用专业</Label>
              <MultiSelect
                options={majors.map((m) => ({ label: m.name, value: m.id }))}
                value={position.majors}
                onChange={(values) => onUpdate({ majors: values })}
                placeholder={optionsLoading ? '加载中...' : '选择专业'}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="positionType">岗位类型</Label>
              <Select
                value={position.positionType}
                onValueChange={(v) => onUpdate({ positionType: v as Position['positionType'] })}
              >
                <SelectTrigger id="positionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enterprise">企业岗位</SelectItem>
                  <SelectItem value="teaching">教学岗位</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Salary Range */}
          <div className="grid gap-2">
            <Label>薪资范围（元/月）</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Input
                  type="number"
                  value={position.salaryRange[0]}
                  onChange={(e) =>
                    onUpdate({
                      salaryRange: [Number(e.target.value), position.salaryRange[1]],
                    })
                  }
                  placeholder="最低"
                  className={`${isCreate ? 'w-40' : 'w-32'} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
              </div>
              <span className="text-muted-foreground">-</span>
              <div className="relative">
                <Input
                  type="number"
                  value={position.salaryRange[1]}
                  onChange={(e) =>
                    onUpdate({
                      salaryRange: [position.salaryRange[0], Number(e.target.value)],
                    })
                  }
                  placeholder="最高"
                  className={`${isCreate ? 'w-40' : 'w-32'} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">岗位背景介绍</Label>
              {aiMode && renderAIButton('description', 'AI 生成')}
            </div>
            <Textarea
              id="description"
              value={position.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="描述该岗位的主要工作内容和特点..."
              rows={isCreate ? 6 : 4}
            />
          </div>
        </CardContent>
      </Card>

      {aiNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Responsibilities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">工作职责</CardTitle>
          {aiMode && renderAIButton('responsibilities', 'AI 生成')}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {position.responsibilities.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-center">
                {!isCreate && (
                  <Badge variant="outline" className="w-full justify-center">
                    {index + 1}
                  </Badge>
                )}
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const next = position.responsibilities.map((r, i) =>
                      i === index ? { ...r, name: e.target.value } : r
                    )
                    onUpdate({ responsibilities: next })
                  }}
                  className="text-sm h-8"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeResponsibility(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-center">
              {!isCreate && <span />}
              <Button
                variant="outline"
                className="h-8 border-dashed"
                onClick={addResponsibility}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加工作职责
              </Button>
              <span />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">任职要求</CardTitle>
          {aiMode && renderAIButton('requirements', 'AI 生成')}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {position.requirements.map((item, index) => (
              <div key={index} className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-center">
                {!isCreate && (
                  <Badge variant="outline" className="w-full justify-center">
                    {index + 1}
                  </Badge>
                )}
                <Input
                  value={item}
                  onChange={(e) => {
                    const next = position.requirements.map((r, i) =>
                      i === index ? e.target.value : r
                    )
                    onUpdate({ requirements: next })
                  }}
                  className="text-sm h-8"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRequirement(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-center">
              {!isCreate && <span />}
              <Button
                variant="outline"
                className="h-8 border-dashed"
                onClick={addRequirement}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加任职要求
              </Button>
              <span />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Career Path */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">发展路径</CardTitle>
          {aiMode && renderAIButton('careerPath', 'AI 生成')}
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={position.careerPath}
            onChange={(e) => onUpdate({ careerPath: e.target.value })}
            placeholder="请描述该岗位的职业发展路径，如横向发展和纵向晋升方向..."
            rows={6}
          />
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">相关证书</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openCertDialog}>
              从证书库选择
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsNewCertDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增证书
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!position.certificates || position.certificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>暂无相关证书</p>
            </div>
          ) : (
            <div className="space-y-3">
              {position.certificates.map((cert) => (
                <div key={cert.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cert.name}</span>
                      {cert.url && (
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {cert.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{cert.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveCertificate(cert.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 从证书库选择证书对话框 */}
      <Dialog open={isCertDialogOpen} onOpenChange={setIsCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>从证书库选择证书</DialogTitle>
            <DialogDescription>选择与该岗位相关的职业资格证书</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Input
              placeholder="搜索证书名称或描述..."
              value={certSearchQuery}
              onChange={(e) => setCertSearchQuery(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredCertificates.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleSelectCertificate(cert.id, !selectedCertIds.includes(cert.id))}
                >
                  <Checkbox
                    checked={selectedCertIds.includes(cert.id)}
                    onCheckedChange={(checked) => handleSelectCertificate(cert.id, !!checked)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{cert.name}</div>
                    <div className="text-sm text-muted-foreground">{cert.description}</div>
                  </div>
                </div>
              ))}
              {filteredCertificates.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">未找到匹配证书</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCertDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCertificates}>确认选择</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增证书对话框 */}
      <Dialog open={isNewCertDialogOpen} onOpenChange={setIsNewCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增证书</DialogTitle>
            <DialogDescription>添加一个新的职业资格证书</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>证书名称</Label>
              <Input
                value={newCert.name}
                onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                placeholder="例如：AWS 云从业者认证"
              />
            </div>
            <div className="grid gap-2">
              <Label>相关网址</Label>
              <Input
                value={newCert.url}
                onChange={(e) => setNewCert({ ...newCert, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label>证书介绍</Label>
              <Textarea
                value={newCert.description}
                onChange={(e) => setNewCert({ ...newCert, description: e.target.value })}
                placeholder="简要描述该证书..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>证书图片</Label>
              <div
                className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-background text-muted-foreground transition-colors hover:bg-accent"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      const url = URL.createObjectURL(file)
                      setNewCert({ ...newCert, image: url })
                    }
                  }
                  input.click()
                }}
              >
                {newCert.image ? (
                  <img
                    src={newCert.image}
                    alt="证书预览"
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <ImageIcon className="mb-2 h-6 w-6" />
                    <span className="text-xs">点击上传证书图片</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCertDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddNewCertificate} disabled={!newCert.name}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
