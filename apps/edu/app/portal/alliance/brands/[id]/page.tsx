'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AllianceDetailShell,
  DetailInfoBlock,
  DetailSectionCard,
  type DetailStat,
} from '@/components/alliance/alliance-detail-shell'
import { ContactRow, PhotoGrid } from '@/components/alliance/enterprise-detail-view'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, Briefcase, Users, Calendar, Image as ImageIcon, FileText, Trophy, BookOpen } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { EmployerBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView, EmptyState } from '@zhiyu/ui'

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

/** 独立雇主企业资料（data.enterpriseInfo），字段与企业详情展示对齐 */
interface EnterpriseInfo {
  name?: string
  creditCode?: string
  unifiedSocialCreditCode?: string
  enterpriseType?: string
  industry?: string
  region?: string
  establishedYear?: number
  employeeCount?: number
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  description?: string
  logo?: string
  logoUrl?: string
  coverImage?: string
  coverPhotos?: string[]
  businessLicensePhotos?: string[]
  qualificationPhotos?: string[]
  intellectualPropertyPhotos?: string[]
  secondaryColleges?: string[]
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

  const isEmployer = brand?.brandType === 'employer'
  const isIndependent = isEmployer && !brand?.enterpriseId

  /** 企业资料归一化（与企业详情展示字段一致） */
  const enterprise = useMemo(() => {
    if (!brand || !isEmployer) return null
    if (!isIndependent) {
      return {
        name: brand.enterpriseName ?? brand.name,
        logoUrl: brand.enterpriseLogo,
        industry: brand.enterpriseIndustry,
        region: brand.enterpriseRegion,
        unifiedSocialCreditCode: brand.enterpriseCreditCode,
        contactPerson: brand.enterpriseContactPerson,
        contactPhone: brand.enterpriseContactPhone,
        contactEmail: brand.enterpriseContactEmail,
        address: brand.enterpriseAddress,
        description: brand.enterpriseDescription,
      }
    }
    const info = (brand.data?.enterpriseInfo ?? {}) as EnterpriseInfo
    return {
      name: info.name ?? brand.name,
      logoUrl: info.logoUrl ?? info.logo,
      coverImage: info.coverImage,
      enterpriseType: info.enterpriseType,
      industry: info.industry,
      region: info.region,
      establishedYear: info.establishedYear,
      employeeCount: info.employeeCount,
      unifiedSocialCreditCode: info.unifiedSocialCreditCode ?? info.creditCode,
      contactPerson: info.contactPerson,
      contactPhone: info.contactPhone,
      contactEmail: info.contactEmail,
      address: info.address,
      description: info.description,
      coverPhotos: info.coverPhotos ?? [],
      businessLicensePhotos: info.businessLicensePhotos ?? [],
      qualificationPhotos: info.qualificationPhotos ?? [],
      intellectualPropertyPhotos: info.intellectualPropertyPhotos ?? [],
      secondaryColleges: info.secondaryColleges ?? [],
    }
  }, [brand, isEmployer, isIndependent])

  // 专业品牌：关联内容（专业就业方向/合作企业/合作成果/特色课程）存于 data
  const isMajor = brand?.brandType === 'major'
  const majorData = useMemo(() => {
    if (!isMajor || !brand?.data) return null
    const d = brand.data as Record<string, any>
    return {
      directions: (d.employmentDirections ?? []) as { id: string; name: string }[],
      enterprises: (d.cooperationEnterprises ?? []) as { id: string; name: string }[],
      achievements: (d.cooperationAchievements ?? []) as { id: string; name: string }[],
      courses: (d.featuredCourses ?? []) as { id: string; name: string }[],
    }
  }, [isMajor, brand?.data])

  const majorTabs = useMemo(() => {
    if (!isMajor || !majorData) return []
    return [
      {
        value: 'directions',
        label: t('专业就业方向'),
        count: majorData.directions.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.directions.length === 0 ? (
                <EmptyState
                  icon={<Briefcase className="h-10 w-10 opacity-50" />}
                  title={t('暂未配置就业方向')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {majorData.directions.map((d) => (
                    <Badge key={d.id} variant="secondary" className="px-3 py-1.5 text-sm">
                      {d.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
      {
        value: 'enterprises',
        label: t('专业合作企业'),
        count: majorData.enterprises.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.enterprises.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-10 w-10 opacity-50" />}
                  title={t('暂未关联合作企业')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {majorData.enterprises.map((e) => (
                    <Badge key={e.id} variant="secondary" className="px-3 py-1.5 text-sm">
                      {e.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
      {
        value: 'achievements',
        label: t('专业合作成果'),
        count: majorData.achievements.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.achievements.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="h-10 w-10 opacity-50" />}
                  title={t('暂未关联合作成果')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {majorData.achievements.map((a) => (
                    <Badge key={a.id} variant="secondary" className="px-3 py-1.5 text-sm">
                      {a.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
      {
        value: 'courses',
        label: t('专业特色课程'),
        count: majorData.courses.length,
        content: (
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              {majorData.courses.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-10 w-10 opacity-50" />}
                  title={t('暂未关联特色课程')}
                  titleClassName="text-slate-500"
                  className="py-16"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {majorData.courses.map((c) => (
                    <Badge key={c.id} variant="secondary" className="px-3 py-1.5 text-sm">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ),
      },
    ]
  }, [isMajor, majorData, t])

  if (loading) return <LoadingView />
  if (!brand) return <EmptyState title={t('品牌不存在')} />

  const positions: PositionSnapshot[] = isEmployer ? (brand.data?.positions ?? []) : []
  const hiredStudents: HiredStudent[] = isEmployer ? (brand.data?.hiredStudents ?? []) : []

  const badges: string[] = []
  if (isIndependent && enterprise?.enterpriseType)
    badges.push(allianceLabel('enterpriseType', enterprise.enterpriseType))
  if (enterprise?.industry) badges.push(enterprise.industry)
  if (enterprise?.region) badges.push(enterprise.region)
  if (enterprise?.establishedYear)
    badges.push(t('{year} 年成立', { year: enterprise.establishedYear }))
  if (enterprise?.employeeCount)
    badges.push(t('{count} 人', { count: enterprise.employeeCount }))

  const stats: DetailStat[] = isEmployer
    ? [
        {
          label: t('关联岗位'),
          value: positions.length,
          icon: Briefcase,
          gradient: 'from-primary to-primary/80',
        },
        {
          label: t('已招聘学生'),
          value: hiredStudents.length,
          icon: Users,
          gradient: 'from-primary/90 to-primary/70',
        },
        {
          label: t('成立年份'),
          value: enterprise?.establishedYear || '-',
          icon: Calendar,
          gradient: 'from-primary/90 to-primary/70',
        },
      ]
    : []

  const studentsByJob = new Map<string, HiredStudent[]>()
  for (const s of hiredStudents) {
    const key = s.jobId
    if (!studentsByJob.has(key)) studentsByJob.set(key, [])
    studentsByJob.get(key)!.push(s)
  }


  const infoTab = isMajor ? (
    <div className="grid lg:grid-cols-3 gap-6">
      <DetailSectionCard title={t('品牌介绍')} className="lg:col-span-3">
        {brand.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.coverImage}
            alt={brand.name}
            className="w-full max-h-64 object-cover rounded-2xl mb-6"
          />
        )}
        {brand.description ? (
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{brand.description}</p>
        ) : (
          <EmptyState
            icon={<FileText className="h-10 w-10 opacity-50" />}
            title={t('暂无品牌介绍')}
            titleClassName="text-slate-500"
            className="py-16"
          />
        )}
      </DetailSectionCard>
    </div>
  ) : isEmployer ? (
    <div className="grid lg:grid-cols-3 gap-6">
      <DetailSectionCard title={t('企业简介')} className="lg:col-span-2">
        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
          {enterprise?.description || '-'}
        </p>
        <div className="border-t pt-6 mt-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('其他信息')}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DetailInfoBlock
              label={t('统一社会信用代码')}
              value={enterprise?.unifiedSocialCreditCode}
            />
            {isIndependent && (
              <DetailInfoBlock
                label={t('企业类型')}
                value={allianceLabel('enterpriseType', enterprise?.enterpriseType)}
              />
            )}
            <DetailInfoBlock label={t('成立年份')} value={enterprise?.establishedYear} />
            <DetailInfoBlock
              label={t('企业规模（人数）')}
              value={
                enterprise?.employeeCount
                  ? `${enterprise.employeeCount.toLocaleString()} 人`
                  : undefined
              }
            />
            <DetailInfoBlock label={t('所在地区')} value={enterprise?.region} />
            <DetailInfoBlock label={t('详细地址')} value={enterprise?.address} />
            {isIndependent && enterprise?.secondaryColleges &&
              enterprise.secondaryColleges.length > 0 && (
                <DetailInfoBlock
                  label={t('关联二级学院')}
                  value={enterprise.secondaryColleges.join('、')}
                />
              )}
          </div>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title={t('联系信息')} className="h-fit self-start">
        <div className="space-y-3">
          {enterprise?.contactPerson && (
            <ContactRow icon={Users} text={`${t('联系人')}：${enterprise.contactPerson}`} />
          )}
          {enterprise?.contactPhone && (
            <ContactRow icon={Building2} text={enterprise.contactPhone} />
          )}
          {enterprise?.contactEmail && (
            <ContactRow icon={Building2} text={enterprise.contactEmail} />
          )}
          {enterprise?.address && <ContactRow icon={Building2} text={enterprise.address} />}
          {!enterprise?.contactPerson &&
            !enterprise?.contactPhone &&
            !enterprise?.contactEmail &&
            !enterprise?.address && <p className="text-sm text-slate-400">{t('暂无联系信息')}</p>}
        </div>
      </DetailSectionCard>

      {brand.description && (
        <DetailSectionCard
          icon={FileText}
          title={t('品牌介绍')}
          className="lg:col-span-3"
        >
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{brand.description}</p>
        </DetailSectionCard>
      )}

      {enterprise?.businessLicensePhotos && enterprise.businessLicensePhotos.length > 0 && (
        <DetailSectionCard icon={ImageIcon} title={t('营业执照')} className="lg:col-span-3">
          <PhotoGrid photos={enterprise.businessLicensePhotos} alt={brand.name} />
        </DetailSectionCard>
      )}

      {enterprise?.intellectualPropertyPhotos &&
        enterprise.intellectualPropertyPhotos.length > 0 && (
          <DetailSectionCard icon={ImageIcon} title={t('知识产权')} className="lg:col-span-3">
            <PhotoGrid photos={enterprise.intellectualPropertyPhotos} alt={brand.name} />
          </DetailSectionCard>
        )}

      {enterprise?.qualificationPhotos && enterprise.qualificationPhotos.length > 0 && (
        <DetailSectionCard icon={ImageIcon} title={t('企业荣誉资质')} className="lg:col-span-3">
          <PhotoGrid photos={enterprise.qualificationPhotos} alt={brand.name} />
        </DetailSectionCard>
      )}

      {enterprise?.coverPhotos && enterprise.coverPhotos.length > 0 && (
        <DetailSectionCard icon={ImageIcon} title={t('企业展示封面')} className="lg:col-span-3">
          <PhotoGrid photos={enterprise.coverPhotos} alt={brand.name} />
        </DetailSectionCard>
      )}
    </div>
  ) : (
    <div className="grid lg:grid-cols-3 gap-6">
      <DetailSectionCard title={t('品牌介绍')} className="lg:col-span-3">
        {brand.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.coverImage}
            alt={brand.name}
            className="w-full max-h-64 object-cover rounded-2xl mb-6"
          />
        )}
        {brand.description ? (
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{brand.description}</p>
        ) : (
          <EmptyState
            icon={<FileText className="h-10 w-10 opacity-50" />}
            title={t('暂无品牌介绍')}
            titleClassName="text-slate-500"
            className="py-16"
          />
        )}
      </DetailSectionCard>
    </div>
  )

  return (
    <AllianceDetailShell
      breadcrumbs={[
        { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
        { label: t('品牌列表'), href: '/portal/alliance/brands' },
        { label: brand.name },
      ]}
      backHref="/portal/alliance/brands"
      icon={Building2}
      iconImage={
        enterprise?.logoUrl ? { src: enterprise.logoUrl, alt: brand.name } : undefined
      }
      iconGradient="from-blue-500 to-blue-600"
      coverImage={enterprise?.coverImage}
      title={brand.name}
      subtitle={
        isEmployer
          ? `${allianceLabel('brandType', brand.brandType)} · ${
              isIndependent ? t('独立雇主企业') : t('合作企业')
            }`
          : allianceLabel('brandType', brand.brandType)
      }
      badges={badges.map((b) => (
        <Badge key={b} variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {b}
        </Badge>
      ))}
      stats={stats}
      tabs={[
        { value: 'info', label: t('基本信息'), content: infoTab },
        ...(isEmployer
          ? [
              {
                value: 'positions',
                label: t('关联岗位'),
                count: positions.length,
                content: (
                  <Card className="border-0 shadow-sm rounded-3xl">
                    <CardContent className="p-6">
                      {positions.length === 0 ? (
                        <EmptyState
                          icon={<Briefcase className="h-10 w-10 opacity-50" />}
                          title={t('暂未关联岗位')}
                          titleClassName="text-slate-500"
                          className="py-16"
                        />
                      ) : (
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
                                      ? t('企业岗位')
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
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                value: 'students',
                label: t('已招聘学生'),
                count: hiredStudents.length,
                content: (
                  <Card className="border-0 shadow-sm rounded-3xl">
                    <CardContent className="p-6">
                      {hiredStudents.length === 0 ? (
                        <EmptyState
                          icon={<Users className="h-10 w-10 opacity-50" />}
                          title={t('暂未关联学生')}
                          titleClassName="text-slate-500"
                          className="py-16"
                        />
                      ) : (
                        <div className="space-y-4">
                          {[...studentsByJob.entries()].map(([jobId, students]) => {
                            const job = positions.find((p) => p.id === jobId)
                            return (
                              <div key={jobId}>
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                                  {job?.name || t('未分配岗位')}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {students.map((s) => (
                                    <span
                                      key={s.studentId}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
                                    >
                                      <span className="font-medium">{s.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {s.studentNo || '-'}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
            ]
          : []),
        ...majorTabs,
      ]}
    />
  )
}
