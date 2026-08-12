'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Briefcase, Calendar, Eye } from 'lucide-react'
import { allianceLabel } from '@zhiyu/shared-types'
import type {
  AllianceEnterprise,
  AllianceProject,
  AllianceAchievement,
  AllianceExpert,
  AllianceBrand,
} from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

export function GradientPlaceholder({
  className,
  seed,
  label,
}: {
  className?: string
  seed?: string
  /** 传入时居中显示首字（半透明大字），字号由 className 中的 text-* 控制 */
  label?: string
}) {
  const gradients = [
    'from-primary to-primary/80',
    'from-primary/80 to-primary/60',
    'from-slate-500 to-slate-700',
    'from-primary/90 to-primary/70',
    'from-primary to-primary/70',
    'from-primary/80 to-primary/70',
  ]
  const grad = gradients[(seed?.length ?? 0) % gradients.length]
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${grad} ${className ?? ''}`}>
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
      {label && (
        <span className="absolute inset-0 flex items-center justify-center font-bold text-white/40 select-none">
          {label.slice(0, 1)}
        </span>
      )}
    </div>
  )
}

export function getInitials(name?: string | null) {
  if (!name) return '-'
  return name.slice(0, 2)
}

export function EnterpriseCard({ enterprise }: { enterprise: AllianceEnterprise }) {
  const t = useT()
  const img = enterprise.coverImage
  return (
    <Link href={`/portal/alliance/enterprises/${enterprise.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-800">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={enterprise.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={enterprise.industry}
              label={enterprise.name}
              className="w-full h-full text-5xl group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl border-2 border-white/80 shadow-md bg-white shrink-0">
                {enterprise.logoUrl && (
                  <AvatarImage src={enterprise.logoUrl} className="object-cover" />
                )}
                <AvatarFallback className="rounded-xl bg-white text-slate-800 font-bold text-sm">
                  {getInitials(enterprise.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-white text-base leading-tight drop-shadow-md truncate">
                  {enterprise.name}
                </h4>
                <p className="text-white/85 text-xs truncate">
                  {[enterprise.industry, enterprise.region].filter(Boolean).join(' · ') ||
                    t('合作企业')}
                </p>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-5 flex-1 flex flex-col">
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4 min-h-[2.6em]">
            {enterprise.description || t('暂无企业简介')}
          </p>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-3.5 border-t border-slate-100">
            <div className="text-center min-w-0">
              <p className="text-base font-bold text-slate-800 leading-tight">
                {enterprise.projectCount ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('合作项目')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-base font-bold text-slate-800 leading-tight">
                {enterprise.agreementCount ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('合作协议')}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-base font-bold text-slate-800 leading-tight">
                {enterprise.achievementCount ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('合作成果')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ProjectCard({ project }: { project: AllianceProject }) {
  const t = useT()
  const progress = project.progress ?? 0
  return (
    <Link href={`/portal/alliance/projects/${project.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[16/10] overflow-hidden">
          {project.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverImage}
              alt={project.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={project.name}
              label={project.name}
              className="w-full h-full text-4xl group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('projectPhase', project.phase)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-3 min-h-[2.6em]">
            {project.description || t('暂无项目描述')}
          </p>
          <div className="mt-auto space-y-2.5">
            {project.startDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {project.startDate}
                  {project.endDate ? t(' 至 {date}', { date: project.endDate }) : ''}
                </span>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>{t('项目进度')}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function AchievementCard({ achievement }: { achievement: AllianceAchievement }) {
  const t = useT()
  return (
    <Link href={`/portal/alliance/achievements/${achievement.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[16/10] overflow-hidden">
          {achievement.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={achievement.coverImage}
              alt={achievement.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={achievement.title}
              label={achievement.title}
              className="w-full h-full text-4xl group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/50 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('achievementType', achievement.type)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
            {achievement.title}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-3 min-h-[2.6em]">
            {achievement.description || t('暂无成果描述')}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ExpertCard({ expert }: { expert: AllianceExpert }) {
  const t = useT()
  return (
    <Link href={`/portal/alliance/experts/${expert.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white text-center h-full flex flex-col p-0 gap-0">
        <div className="h-16 relative">
          <GradientPlaceholder seed={expert.industry} className="w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <Avatar className="h-14 w-14 ring-[3px] ring-white shadow-md">
              {expert.avatarUrl && <AvatarImage src={expert.avatarUrl} />}
              <AvatarFallback className="text-base font-semibold bg-slate-100 text-slate-800">
                {getInitials(expert.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <CardContent className="pt-9 pb-4 px-3.5 flex-1 flex flex-col text-left">
          <h4 className="font-semibold text-slate-900 text-center text-sm truncate">
            {expert.name}
          </h4>
          <p className="text-xs text-slate-500 text-center truncate mt-0.5">
            {[expert.title, expert.position].filter(Boolean).join(' · ') || t('企业专家')}
          </p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between gap-2 min-w-0">
              <span className="text-slate-400 shrink-0">{t('企业')}</span>
              <span className="text-right truncate min-w-0">
                {expert.organization || expert.enterpriseName || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2 min-w-0">
              <span className="text-slate-400 shrink-0">{t('行业')}</span>
              <span className="text-right truncate min-w-0">{expert.industry || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 shrink-0">{t('经验')}</span>
              <span className="text-right">
                {expert.experienceYears ? t('{years} 年', { years: expert.experienceYears }) : '—'}
              </span>
            </div>
          </div>
          {expert.specialties && expert.specialties.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1 justify-center">
                {expert.specialties.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function BrandCard({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[16/10] overflow-hidden">
          {brand.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.coverImage}
              alt={brand.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={brand.name}
              label={brand.name}
              className="w-full h-full text-4xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {allianceLabel('brandType', brand.brandType)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {brand.name}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-2.5 min-h-[2.6em]">
            {brand.description || t('暂无品牌描述')}
          </p>
          {brand.data?.tags && Array.isArray(brand.data.tags) && brand.data.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1">
              {(brand.data.tags as string[]).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* 品牌库差异化展示卡（landing 产教品牌库区：六类品牌同时铺开，样式互不相同） */
/* ------------------------------------------------------------------ */

function brandTags(brand: AllianceBrand): string[] {
  return Array.isArray(brand.data?.tags) ? (brand.data.tags as string[]) : []
}

function BrandViewCount({ count }: { count?: number }) {
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
      <Eye className="h-3.5 w-3.5" />
      {count ?? 0}
    </span>
  )
}

/** 人才品牌：横版旗舰卡（左封面右文案，双列大图） */
export function TalentBrandCard({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  const tags = brandTags(brand)
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full p-0 gap-0">
        <div className="flex flex-col sm:flex-row h-full">
          <div className="relative sm:w-[42%] aspect-[16/9] sm:aspect-auto overflow-hidden shrink-0">
            {brand.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.coverImage}
                alt={brand.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="absolute inset-0">
                <GradientPlaceholder
                  seed={brand.name}
                  label={brand.name}
                  className="w-full h-full text-4xl group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/10" />
          </div>
          <CardContent className="flex-1 p-5 flex flex-col justify-center min-w-0">
            <h4 className="font-semibold text-slate-900 text-base group-hover:text-primary transition-colors line-clamp-1">
              {brand.name}
            </h4>
            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mt-2">
              {brand.description || t('暂无品牌描述')}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/10 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <BrandViewCount count={brand.viewCount} />
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  )
}

/** 雇主品牌：横向列表行（左侧小图 + 名称/简介，行式堆叠） */
export function EmployerBrandRow({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  const tags = brandTags(brand)
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30 rounded-2xl overflow-hidden bg-white p-0 gap-0">
        <div className="flex h-28">
          <div className="w-28 relative overflow-hidden shrink-0">
            {brand.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.coverImage}
                alt={brand.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <GradientPlaceholder
                seed={brand.name}
                label={brand.name}
                className="w-full h-full text-2xl"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
          </div>
          <CardContent className="flex-1 p-4 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">
                {brand.name}
              </h4>
              <BrandViewCount count={brand.viewCount} />
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
              {brand.description || t('暂无品牌描述')}
            </p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </Link>
  )
}

/** 岗位品牌：紧凑无图文本卡（图标 + 标题 + 标签，强调信息密度） */
export function JobBrandCard({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  const tags = brandTags(brand)
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30 rounded-2xl bg-white h-full p-0 gap-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            <BrandViewCount count={brand.viewCount} />
          </div>
          <h4 className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">
            {brand.name}
          </h4>
          <p className="text-xs text-slate-500 line-clamp-1 mt-1">
            {brand.description || t('暂无品牌描述')}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

/** 专业品牌：高图覆盖卡（名称/标签叠在封面渐变遮罩上） */
export function MajorBrandCard({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  const tags = brandTags(brand)
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[4/3] overflow-hidden">
          {brand.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.coverImage}
              alt={brand.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={brand.name}
              label={brand.name}
              className="w-full h-full text-5xl group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h4 className="font-semibold text-white text-base drop-shadow-md line-clamp-1">
              {brand.name}
            </h4>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/25 backdrop-blur-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
            {brand.description || t('暂无品牌描述')}
          </p>
          <div className="mt-auto pt-3">
            <BrandViewCount count={brand.viewCount} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/** 师资品牌：头像交叠卡（顶部色带 + 圆形首字头像半叠 + 居中排版） */
export function TeacherBrandCard({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="h-14 relative shrink-0">
          {brand.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.coverImage} alt={brand.name} className="w-full h-full object-cover" />
          ) : (
            <GradientPlaceholder seed={brand.name} className="w-full h-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
            <Avatar className="h-12 w-12 ring-[3px] ring-white shadow-md">
              <AvatarFallback className="text-base font-semibold bg-white text-slate-800">
                {getInitials(brand.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <CardContent className="pt-8 pb-4 px-3.5 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-center text-sm truncate group-hover:text-primary transition-colors">
            {brand.name}
          </h4>
          <p className="text-xs text-slate-500 text-center line-clamp-2 mt-1.5 leading-relaxed">
            {brand.description || t('暂无品牌描述')}
          </p>
          <div className="mt-auto pt-3 flex justify-center">
            <BrandViewCount count={brand.viewCount} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/** 文化品牌：杂志卡（扁图 + 标题 + 简介 + 底栏标签） */
export function CultureBrandCard({ brand }: { brand: AllianceBrand }) {
  const t = useT()
  const tags = brandTags(brand)
  return (
    <Link href={`/portal/alliance/brands/${brand.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[16/9] overflow-hidden">
          {brand.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.coverImage}
              alt={brand.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <GradientPlaceholder
              seed={brand.name}
              label={brand.name}
              className="w-full h-full text-4xl group-hover:scale-105 transition-transform duration-500"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/40 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {t('文化品牌')}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm group-hover:text-primary transition-colors line-clamp-1">
            {brand.name}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mt-1.5">
            {brand.description || t('暂无品牌描述')}
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3">
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 min-w-0">
                {tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span />
            )}
            <BrandViewCount count={brand.viewCount} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
