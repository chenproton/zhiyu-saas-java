'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Briefcase } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { EmployerBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'

import { useT } from '@/lib/i18n/locale-provider'

interface PositionSnapshot {
  id: string
  name: string
  positionType?: string
  salaryMin?: number
  salaryMax?: number
  majorNames?: string[]
}

interface HiredStudent {
  studentId: string
  name: string
  studentNo?: string
  jobId: string
  jobName?: string
}

function salaryText(p: PositionSnapshot) {
  if (p.salaryMin == null && p.salaryMax == null) return '-'
  if (p.salaryMin == null) return `${p.salaryMax}K`
  if (p.salaryMax == null) return `${p.salaryMin}K`
  return `${p.salaryMin}-${p.salaryMax}K`
}

export default function AlliancePublicBrandDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const [brand, setBrand] = useState<EmployerBrand | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<EmployerBrand>(`/alliance/public/brands/${id}`)
      .then(setBrand)
      .catch((err) => {
        reportError(err, { source: '加载品牌详情' })
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingView />
  if (!brand)
    return <div className="text-center py-12 text-muted-foreground">{t('品牌不存在')}</div>

  if (brand.brandType !== 'employer') {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{brand.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {allianceLabel('brandType', brand.brandType)}
            </p>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <Badge variant="outline">{allianceLabel('brandStatus', brand.status)}</Badge>
            <span className="text-sm text-muted-foreground">
              {t('{count} 次浏览', { count: brand.viewCount })}
            </span>
          </div>
        </div>

        {brand.coverImage && (
          <Image
            src={brand.coverImage}
            alt={brand.name}
            width={1200}
            height={675}
            className="w-full max-h-64 object-cover rounded-xl"
          />
        )}

        {brand.description && (
          <Card>
            <CardHeader>
              <CardTitle>{t('品牌介绍')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{brand.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const isIndependent = !brand.enterpriseId
  const info = (brand.data?.enterpriseInfo ?? {}) as Record<string, any>
  const positions: PositionSnapshot[] = brand.data?.positions ?? []
  const hiredStudents: HiredStudent[] = brand.data?.hiredStudents ?? []
  const enterpriseRows: { label: string; value?: string }[] = isIndependent
    ? [
        { label: t('企业名称'), value: brand.name },
        { label: t('统一社会信用代码'), value: info.creditCode },
        { label: t('所属行业'), value: info.industry },
        { label: t('联系人'), value: info.contactPerson },
        { label: t('联系电话'), value: info.contactPhone },
        { label: t('联系邮箱'), value: info.contactEmail },
        { label: t('企业地址'), value: info.address },
      ]
    : [
        { label: t('统一社会信用代码'), value: brand.enterpriseCreditCode },
        { label: t('所属行业'), value: brand.enterpriseIndustry },
        { label: t('所在地区'), value: brand.enterpriseRegion },
        { label: t('联系人'), value: brand.enterpriseContactPerson },
        { label: t('联系电话'), value: brand.enterpriseContactPhone },
        { label: t('联系邮箱'), value: brand.enterpriseContactEmail },
        { label: t('企业地址'), value: brand.enterpriseAddress },
      ].filter((x) => x.value)
  const enterpriseDesc = isIndependent ? info.description : brand.enterpriseDescription
  const enterpriseLogo = isIndependent ? info.logo : brand.enterpriseLogo

  const studentsByJob = new Map<string, HiredStudent[]>()
  for (const s of hiredStudents) {
    const key = s.jobId
    if (!studentsByJob.has(key)) studentsByJob.set(key, [])
    studentsByJob.get(key)!.push(s)
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-4">
          {enterpriseLogo && (
            <Image
              src={enterpriseLogo}
              alt={brand.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl border object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{brand.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {allianceLabel('brandType', brand.brandType)} ·{' '}
              {isIndependent ? t('独立雇主企业') : t('合作企业')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Badge variant="outline">{allianceLabel('brandStatus', brand.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {t('{count} 次浏览', { count: brand.viewCount })}
          </span>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info" className="rounded-lg">
            {t('基本信息')}
          </TabsTrigger>
          <TabsTrigger value="positions" className="rounded-lg">
            {t('关联岗位 ({count})', { count: positions.length })}
          </TabsTrigger>
          <TabsTrigger value="students" className="rounded-lg">
            {t('已招聘学生 ({count})', { count: hiredStudents.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {brand.coverImage && (
              <Image
                src={brand.coverImage}
                alt={brand.name}
                width={1200}
                height={675}
                className="w-full max-h-64 object-cover rounded-xl"
              />
            )}
            <Card>
              <CardHeader>
                <CardTitle>{t('企业资料')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {enterpriseRows.map((r) => (
                  <p key={r.label}>
                    <span className="text-muted-foreground">{r.label}：</span>
                    {r.value || t('暂无')}
                  </p>
                ))}
                {enterpriseDesc && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-2">
                    {enterpriseDesc}
                  </p>
                )}
              </CardContent>
            </Card>
            {brand.description && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>{t('品牌介绍')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{brand.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          {positions.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center text-sm text-muted-foreground">
              {t('暂未关联岗位')}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('岗位名称')}</TableHead>
                      <TableHead>{t('分类')}</TableHead>
                      <TableHead>{t('薪资范围')}</TableHead>
                      <TableHead>{t('面向专业')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          {p.positionType === 'teaching'
                            ? t('教学岗位')
                            : p.positionType === 'enterprise'
                              ? t('非教学岗位')
                              : '-'}
                        </TableCell>
                        <TableCell>{salaryText(p)}</TableCell>
                        <TableCell className="max-w-56 truncate">
                          {p.majorNames?.join('、') || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          {hiredStudents.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center text-sm text-muted-foreground">
              {t('暂未关联学生')}
            </div>
          ) : (
            <div className="space-y-4">
              {[...studentsByJob.entries()].map(([jobId, students]) => {
                const job = positions.find((p) => p.id === jobId)
                return (
                  <Card key={jobId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        {job?.name || t('未分配岗位')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {students.map((s) => (
                        <span
                          key={s.studentId}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-muted/40 px-3 py-1.5 text-sm"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {s.studentNo || '-'}
                          </span>
                        </span>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BackLink() {
  const t = useT()
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/portal/alliance/brands"
        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> {t('返回列表')}
      </Link>
    </div>
  )
}
