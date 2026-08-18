<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="!brand" class="loading-wrap"><el-empty description="品牌不存在" /></div>

  <!-- 岗位品牌 -->
  <AllianceDetailShell
    v-else-if="isJob"
    :breadcrumbs="jobBreadcrumbs"
    back-href="/portal/alliance/brands?type=job"
    :icon="Briefcase"
    :icon-image="brand.positionCoverImage ? { src: brand.positionCoverImage, alt: jobName } : undefined"
    icon-gradient="linear-gradient(135deg, #10b981, #0d9488)"
    :title="jobName"
    subtitle="岗位品牌"
    :badges="jobBadges"
    :stats="jobStats"
    :tabs="jobTabs"
  >
    <template #info>
      <div class="grid-3">
        <div class="col-2 stack">
          <SectionCard title="岗位简介" :icon="Document">
            <img v-if="brand.positionCoverImage" :src="brand.positionCoverImage" :alt="jobName" class="cover-img" />
            <p v-if="brand.positionDescription || brand.description" class="prose">{{ brand.positionDescription || brand.description }}</p>
            <el-empty v-else description="暂无岗位简介" :image-size="60" />
          </SectionCard>
        </div>
        <div class="stack">
          <SectionCard title="岗位信息" :icon="Briefcase">
            <div class="info-stack">
              <InfoBlock label="岗位类型" :value="jobTypeLabel" />
              <InfoBlock label="薪资范围" :value="brand.salaryMin == null && brand.salaryMax == null ? undefined : (salaryText ?? undefined)" />
              <InfoBlock label="面向行业" :value="brand.industryName" />
              <div class="majors-block">
                <p class="majors-label">适用专业</p>
                <div v-if="jobMajors.length" class="tags"><span v-for="m in jobMajors" :key="m" class="tag">{{ m }}</span></div>
                <p v-else class="majors-none">-</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </template>

    <template #duties>
      <SectionCard title="工作职责" :icon="List">
        <div v-if="responsibilities.length" class="duty-list">
          <div v-for="(r, idx) in responsibilities" :key="r.id" class="duty-row">
            <span class="duty-idx">{{ idx + 1 }}</span>
            <div>
              <p class="duty-name">{{ r.name }}</p>
              <p v-if="r.description" class="duty-desc">{{ r.description }}</p>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无工作职责" :image-size="60" />
      </SectionCard>
    </template>

    <template #requirements>
      <SectionCard title="任职要求" :icon="Aim">
        <div v-if="jobRequirements.length" class="req-list">
          <div v-for="(req, idx) in jobRequirements" :key="idx" class="req-row">
            <span class="req-dot" />
            <p class="prose">{{ req }}</p>
          </div>
        </div>
        <el-empty v-else description="暂无任职要求" :image-size="60" />
      </SectionCard>
    </template>

    <template #careerPath>
      <SectionCard title="发展路径" :icon="TrendCharts">
        <p v-if="brand.positionCareerPath" class="prose">{{ brand.positionCareerPath }}</p>
        <el-empty v-else description="暂无发展路径" :image-size="60" />
      </SectionCard>
    </template>

    <template #certs>
      <SectionCard title="相关证书">
        <CertCards :certificates="certificates" />
      </SectionCard>
    </template>
  </AllianceDetailShell>

  <!-- 师资品牌 -->
  <AllianceDetailShell
    v-else-if="isTeacher && person"
    :breadcrumbs="teacherBreadcrumbs"
    back-href="/portal/alliance/brands?type=teacher"
    :icon="User"
    :icon-image="person.avatarUrl ? { src: person.avatarUrl, alt: person.name } : undefined"
    icon-gradient="linear-gradient(135deg, #3b82f6, #7c3aed)"
    :title="person.name"
    :subtitle="teacherSubtitle"
    :badges="teacherBadges"
    :tabs="teacherTabs"
  >
    <template #info>
      <div class="grid-3">
        <SectionCard title="基本信息" class="col-2">
          <div class="info-grid-3">
            <InfoBlock label="行业" :value="person.industry" />
            <InfoBlock label="城市" :value="person.city" />
            <InfoBlock label="从业年限" :value="person.experienceYears ? `${person.experienceYears}年` : undefined" />
            <InfoBlock label="学历" :value="person.education" />
            <InfoBlock label="性别" :value="person.gender ? (person.gender === 'male' ? '男' : '女') : undefined" />
            <InfoBlock label="类型" :value="personTypeLabel" />
          </div>
          <div v-if="person.organization" class="org-block">
            <p class="org-label">{{ brand.expertId ? '归属机构' : '归属院系' }}</p>
            <span class="org-value"><el-icon><OfficeBuilding /></el-icon>{{ person.organization }}</span>
          </div>
        </SectionCard>
        <SectionCard v-if="person.professionalFields.length || person.specialties.length" title="专业领域与专长" class="self-start">
          <div v-if="person.professionalFields.length" class="field-group">
            <p class="field-label">专业领域</p>
            <div class="tags"><span v-for="f in person.professionalFields" :key="f" class="tag">{{ f }}</span></div>
          </div>
          <div v-if="person.specialties.length" class="field-group">
            <p class="field-label">专长</p>
            <div class="tags"><span v-for="s in person.specialties" :key="s" class="tag">{{ s }}</span></div>
          </div>
        </SectionCard>
      </div>
    </template>

    <template #introduction>
      <SectionCard title="个人简介" :icon="Trophy">
        <p v-if="person.introduction" class="prose">{{ person.introduction }}</p>
        <el-empty v-else description="暂无简介" :image-size="60" />
        <div v-if="person.workExperience" class="work-exp">
          <h4>工作经历</h4>
          <p class="prose">{{ person.workExperience }}</p>
        </div>
      </SectionCard>
    </template>

    <template #honors>
      <SectionCard title="资质荣誉">
        <div v-if="honors.length" class="grid-4">
          <a v-for="(honor, idx) in honors" :key="idx" :href="honor" target="_blank" rel="noreferrer" class="honor-link">
            <img :src="honor" :alt="`资质荣誉 ${idx + 1}`" class="honor-img" />
          </a>
        </div>
        <el-empty v-else description="暂无资质荣誉" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>

  <!-- 雇主品牌 / 专业品牌 / 其它 -->
  <AllianceDetailShell
    v-else
    :breadcrumbs="commonBreadcrumbs"
    back-href="/portal/alliance/brands"
    :icon="OfficeBuilding"
    :icon-image="enterpriseLogo ? { src: enterpriseLogo, alt: brand.name } : undefined"
    icon-gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
    :cover-image="enterpriseCover"
    :title="brand.name"
    :subtitle="commonSubtitle"
    :badges="commonBadges"
    :stats="commonStats"
    :tabs="commonTabs"
  >
    <template #info>
      <!-- 专业品牌介绍 -->
      <div v-if="isMajor" class="grid-3">
        <SectionCard title="品牌介绍" class="col-3">
          <img v-if="brand.coverImage" :src="brand.coverImage" :alt="brand.name" class="cover-wide" />
          <p v-if="brand.description" class="prose">{{ brand.description }}</p>
          <el-empty v-else description="暂无品牌介绍" :image-size="60" />
        </SectionCard>
      </div>
      <!-- 雇主品牌介绍 -->
      <div v-else-if="isEmployer" class="grid-3">
        <SectionCard title="企业简介" class="col-2">
          <p class="prose">{{ enterprise.description || '-' }}</p>
          <div class="other-info">
            <h4>其他信息</h4>
            <div class="info-grid-3">
              <InfoBlock label="统一社会信用代码" :value="enterprise.creditCode" />
              <InfoBlock v-if="isIndependent" label="企业类型" :value="independentEnterpriseType" />
              <InfoBlock label="成立年份" :value="enterprise.establishedYear" />
              <InfoBlock label="企业规模（人数）" :value="enterprise.employeeCount ? `${enterprise.employeeCount.toLocaleString()} 人` : undefined" />
              <InfoBlock label="所在地区" :value="enterprise.region" />
              <InfoBlock label="详细地址" :value="enterprise.address" />
            </div>
          </div>
        </SectionCard>
        <SectionCard title="联系信息" class="self-start">
          <div class="contact-list">
            <div v-if="enterprise.contactPerson" class="contact-row"><el-icon><User /></el-icon><span>联系人：{{ enterprise.contactPerson }}</span></div>
            <div v-if="enterprise.contactPhone" class="contact-row"><el-icon><Phone /></el-icon><span>{{ enterprise.contactPhone }}</span></div>
            <div v-if="enterprise.contactEmail" class="contact-row"><el-icon><Message /></el-icon><span>{{ enterprise.contactEmail }}</span></div>
            <div v-if="enterprise.address" class="contact-row"><el-icon><Location /></el-icon><span>{{ enterprise.address }}</span></div>
            <p v-if="!enterprise.contactPerson && !enterprise.contactPhone && !enterprise.contactEmail && !enterprise.address" class="contact-none">暂无联系信息</p>
          </div>
        </SectionCard>
        <SectionCard v-if="brand.description" title="品牌介绍" :icon="Document" class="col-3">
          <p class="prose">{{ brand.description }}</p>
        </SectionCard>
        <SectionCard v-if="(enterprise.businessLicensePhotos ?? []).length" title="营业执照" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.businessLicensePhotos!" :alt="brand.name" />
        </SectionCard>
        <SectionCard v-if="(enterprise.intellectualPropertyPhotos ?? []).length" title="知识产权" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.intellectualPropertyPhotos!" :alt="brand.name" />
        </SectionCard>
        <SectionCard v-if="(enterprise.qualificationPhotos ?? []).length" title="企业荣誉资质" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.qualificationPhotos!" :alt="brand.name" />
        </SectionCard>
        <SectionCard v-if="(enterprise.coverPhotos ?? []).length" title="企业展示封面" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.coverPhotos!" :alt="brand.name" />
        </SectionCard>
      </div>
      <!-- 通用品牌介绍 -->
      <div v-else class="grid-3">
        <SectionCard title="品牌介绍" class="col-3">
          <img v-if="brand.coverImage" :src="brand.coverImage" :alt="brand.name" class="cover-wide" />
          <p v-if="brand.description" class="prose">{{ brand.description }}</p>
          <el-empty v-else description="暂无品牌介绍" :image-size="60" />
        </SectionCard>
      </div>
    </template>

    <!-- 雇主品牌关联岗位 -->
    <template #positions>
      <SectionCard title="关联岗位">
        <div v-if="positions.length" class="grid-4">
          <RelatedObjectCard v-for="p in positions" :key="p.id" :item="{ id: jobBrandOfPosition(p)?.id || p.id, name: p.name }" :kind="jobBrandOfPosition(p) ? 'brands' : 'positions'">
            <div class="pos-foot">
              <span class="pos-salary">{{ salaryTextOf(p) }}</span>
              <span class="pos-type">{{ p.positionType === 'teaching' ? '教学岗位' : p.positionType === 'enterprise' ? '企业岗位' : '-' }}</span>
            </div>
            <div v-if="(p.majorNames ?? []).length" class="pos-majors">
              <span v-for="m in (p.majorNames ?? []).slice(0, 3)" :key="m" class="pos-major">{{ m }}</span>
              <span v-if="(p.majorNames ?? []).length > 3" class="pos-more">+{{ (p.majorNames ?? []).length - 3 }}</span>
            </div>
          </RelatedObjectCard>
        </div>
        <el-empty v-else description="暂未关联岗位" :image-size="60" />
      </SectionCard>
    </template>

    <!-- 雇主品牌已招聘学生 -->
    <template #students>
      <SectionCard title="已招聘学生">
        <div v-if="hiredStudents.length" class="students-list">
          <div v-for="[jobId, students] in studentsByJob" :key="jobId" class="student-group">
            <h4 class="student-job"><el-icon><Briefcase /></el-icon>{{ positionNameOf(jobId) || '未分配岗位' }}</h4>
            <div class="student-chips">
              <span v-for="s in students" :key="s.studentId" class="student-chip">
                <span class="student-name">{{ s.name }}</span>
                <span class="student-major">{{ s.majorName || '未设置专业' }}</span>
              </span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂未关联学生" :image-size="60" />
      </SectionCard>
    </template>

    <!-- 专业品牌关联内容 -->
    <template #directions>
      <SectionCard title="专业就业方向">
        <div v-if="majorData && majorData.directions.length" class="grid-4">
          <RelatedObjectCard v-for="d in majorData.directions" v-show="publicJobBrandIds.has(d.id)" :key="d.id" :item="d" kind="brands" />
          <div v-for="d in majorData.directions" v-show="!publicJobBrandIds.has(d.id)" :key="'x-' + d.id" class="grey-card">
            <el-icon :size="32"><Briefcase /></el-icon>
            <p class="grey-name">{{ d.name }}</p>
            <span class="grey-badge">岗位品牌暂未对外展示</span>
          </div>
        </div>
        <el-empty v-else description="暂未配置就业方向" :image-size="60" />
      </SectionCard>
    </template>

    <template #enterprises>
      <SectionCard title="专业合作企业">
        <div v-if="majorData && majorData.enterprises.length" class="grid-4">
          <template v-for="e in majorData.enterprises" :key="e.id">
            <RelatedObjectCard v-if="employerBrandIds.has(e.id)" :item="e" kind="brands" />
            <RelatedObjectCard v-else-if="publicEnterpriseIds.has(e.id)" :item="e" kind="enterprises" />
            <div v-else class="grey-card">
              <el-icon :size="32"><OfficeBuilding /></el-icon>
              <p class="grey-name">{{ e.name }}</p>
              <span class="grey-badge">企业暂未对外展示</span>
            </div>
          </template>
        </div>
        <el-empty v-else description="暂未关联合作企业" :image-size="60" />
      </SectionCard>
    </template>

    <template #achievements>
      <SectionCard title="专业合作成果">
        <div v-if="majorData && majorData.achievements.length" class="grid-4">
          <RelatedObjectCard v-for="a in majorData.achievements" v-show="publicAchievementIds.has(a.id)" :key="a.id" :item="a" kind="achievements" />
          <div v-for="a in majorData.achievements" v-show="!publicAchievementIds.has(a.id)" :key="'x-' + a.id" class="grey-card">
            <el-icon :size="32"><Trophy /></el-icon>
            <p class="grey-name">{{ a.name }}</p>
            <span class="grey-badge">成果暂未对外展示</span>
          </div>
        </div>
        <el-empty v-else description="暂未关联合作成果" :image-size="60" />
      </SectionCard>
    </template>

    <template #courses>
      <SectionCard title="专业特色课程">
        <div v-if="majorData && majorData.courses.length" class="grid-4">
          <RelatedObjectCard v-for="c in majorData.courses" :key="c.id" :item="c" kind="courses" />
        </div>
        <el-empty v-else description="暂未关联特色课程" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Briefcase, User, Document, List, Aim, TrendCharts, Trophy, Picture, OfficeBuilding, Phone, Message, Location, Calendar, Reading } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type DetailBadge, type DetailStat, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import PhotoGrid from './components/PhotoGrid.vue';
import RelatedObjectCard from './components/RelatedObjectCard.vue';
import CertCards from './components/CertCards.vue';
import {
  allianceLabel,
  employerBrandOf,
  fetchAllPages,
  formatSalaryRange,
  normalizeRelatedRefs,
  type AllianceAchievement,
  type AllianceEnterprise,
  type AlliancePublicBrand,
  type AllianceRelatedRef,
  type EmployerEnterprise,
} from './shared';

interface PositionSnapshot {
  id: string;
  name: string;
  positionType?: string;
  salaryMin?: number;
  salaryMax?: number;
  majorNames?: string[];
}
interface HiredStudent {
  studentId: string;
  name: string;
  studentNo?: string;
  jobId: string;
  jobName?: string;
  majorName?: string;
}

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const brand = ref<AlliancePublicBrand | null>(null);
const loading = ref(true);
const jobBrands = ref<AlliancePublicBrand[]>([]);
const employerBrands = ref<AlliancePublicBrand[]>([]);
const publicEnterprises = ref<AllianceEnterprise[]>([]);
const publicJobBrands = ref<AlliancePublicBrand[]>([]);
const publicAchievements = ref<AllianceAchievement[]>([]);

const isEmployer = computed(() => brand.value?.brandType === 'employer');
const isIndependent = computed(() => isEmployer.value && !brand.value?.enterpriseId);
const isJob = computed(() => brand.value?.brandType === 'job');
const isMajor = computed(() => brand.value?.brandType === 'major');
const isTeacher = computed(() => brand.value?.brandType === 'teacher');

const enterprise = computed<EmployerEnterprise>(() =>
  brand.value && isEmployer.value ? employerBrandOf(brand.value) : {},
);
const enterpriseLogo = computed(() => enterprise.value?.logoUrl);
const enterpriseCover = computed(() => enterprise.value?.coverImage);

async function load() {
  if (!id) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const tenantParam = tenantId.value ? `tenantId=${tenantId.value}` : '';
  const brandUrl = (extra: string) => `/alliance/public/brands?${extra}${tenantParam ? `&${tenantParam}` : ''}`;
  try {
    const b = await portalRequest<AlliancePublicBrand>(
      `/alliance/public/brands/${id}${tenantParam ? '?' + tenantParam : ''}`,
    );
    brand.value = b;
    if (b.brandType === 'employer') {
      try {
        jobBrands.value = await fetchAllPages((page, pageSize) =>
          portalRequest<{ items: AlliancePublicBrand[] }>(
            `${brandUrl('brandType=job')}&limit=${pageSize}&offset=${page * pageSize}`,
          ),
        );
      } catch {
        jobBrands.value = [];
      }
    }
    if (b.brandType === 'major') {
      try {
        const [eb, jb, ach, ent] = await Promise.all([
          fetchAllPages((page, pageSize) =>
            portalRequest<{ items: AlliancePublicBrand[] }>(
              `${brandUrl('brandType=employer')}&limit=${pageSize}&offset=${page * pageSize}`,
            ),
          ),
          fetchAllPages((page, pageSize) =>
            portalRequest<{ items: AlliancePublicBrand[] }>(
              `${brandUrl('brandType=job')}&limit=${pageSize}&offset=${page * pageSize}`,
            ),
          ),
          fetchAllPages((page, pageSize) =>
            portalRequest<{ items: AllianceAchievement[] }>(
              `/alliance/public/achievements?sort=latest${tenantParam ? `&${tenantParam}` : ''}&limit=${pageSize}&offset=${page * pageSize}`,
            ),
          ),
          tenantParam
            ? fetchAllPages((page, pageSize) =>
                portalRequest<{ items: AllianceEnterprise[] }>(
                  `/alliance/public/enterprises?${tenantParam}&limit=${pageSize}&offset=${page * pageSize}`,
                ),
              )
            : Promise.resolve([] as AllianceEnterprise[]),
        ]);
        employerBrands.value = eb;
        publicJobBrands.value = jb;
        publicAchievements.value = ach;
        publicEnterprises.value = ent;
      } catch {
        employerBrands.value = [];
        publicJobBrands.value = [];
        publicAchievements.value = [];
        publicEnterprises.value = [];
      }
    }
  } catch {
    brand.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ===== 岗位品牌 =====
const jobName = computed(() => brand.value?.positionName || brand.value?.name || '');
const jobTypeLabel = computed(() =>
  brand.value?.positionType === 'teaching' ? '教学岗位' : brand.value?.positionType === 'enterprise' ? '企业岗位' : undefined,
);
const salaryText = computed(() => (brand.value ? formatSalaryRange(brand.value) : null));
const responsibilities = computed(() => (isJob.value ? brand.value?.responsibilities ?? [] : []));
const certificates = computed(() => (isJob.value ? brand.value?.certificates ?? [] : []));
const jobRequirements = computed(() => (isJob.value ? brand.value?.positionRequirements ?? [] : []));
const jobMajors = computed(() => (isJob.value ? brand.value?.majorNames ?? [] : []));

const jobBreadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '品牌列表', href: '/portal/alliance/brands?type=job' },
  { label: jobName.value },
]);
const jobBadges = computed<DetailBadge[]>(() => {
  const list: DetailBadge[] = [];
  if (jobTypeLabel.value) list.push({ text: jobTypeLabel.value });
  if (brand.value?.industryName) list.push({ text: brand.value.industryName });
  return list;
});
const jobStats = computed<DetailStat[]>(() => [
  { label: '薪资范围', value: salaryText.value ?? '-', icon: TrendCharts, gradient: 'linear-gradient(135deg,#f59e0b,#f97316)' },
  { label: '适用专业', value: jobMajors.value.length, icon: Reading, gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { label: '工作职责', value: responsibilities.value.length, icon: List, gradient: 'linear-gradient(135deg,#10b981,#14b8a6)' },
  { label: '相关证书', value: certificates.value.length, icon: Trophy, gradient: 'linear-gradient(135deg,#8b5cf6,#a855f7)' },
]);
const jobTabs = computed<DetailTab[]>(() => [
  { value: 'info', label: '基本信息' },
  { value: 'duties', label: '工作职责', count: responsibilities.value.length },
  { value: 'requirements', label: '任职要求', count: jobRequirements.value.length },
  { value: 'careerPath', label: '发展路径' },
  { value: 'certs', label: '相关证书', count: certificates.value.length },
]);

// ===== 师资品牌 =====
const person = computed(() => {
  const b = brand.value;
  if (!b || !isTeacher.value) return null;
  return {
    name: b.personName || b.name,
    avatarUrl: b.personAvatar,
    title: b.personTitle,
    position: b.personPosition,
    organization: b.personOrganization,
    industry: b.personIndustry,
    experienceYears: b.personExperienceYears,
    education: b.personEducation,
    introduction: b.personIntroduction,
    workExperience: b.personWorkExperience,
    city: b.personCity,
    gender: b.personGender,
    professionalFields: Array.isArray(b.personProfessionalFields) ? b.personProfessionalFields : [],
    specialties: Array.isArray(b.personSpecialties) ? b.personSpecialties : [],
    attachments: Array.isArray(b.personAttachments) ? b.personAttachments : [],
  };
});
const honors = computed(() => person.value?.attachments ?? []);
const personTypeLabel = computed(() => (brand.value?.expertId ? '企业专家' : '校本教师'));
const teacherSubtitle = computed(() =>
  [person.value?.title, person.value?.position].filter(Boolean).join(' · ') || undefined,
);
const teacherBreadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '品牌列表', href: '/portal/alliance/brands?type=teacher' },
  { label: person.value?.name || '' },
]);
const teacherBadges = computed<DetailBadge[]>(() => {
  const list: DetailBadge[] = [];
  if (person.value?.attachments && brand.value?.personRating) list.push({ text: allianceLabel('expertRating', brand.value.personRating) });
  list.push({ text: personTypeLabel.value });
  return list;
});
const teacherTabs = computed<DetailTab[]>(() => [
  { value: 'info', label: '基本信息' },
  { value: 'introduction', label: '个人简介' },
  { value: 'honors', label: '资质荣誉', count: honors.value.length },
]);

// ===== 专业品牌 =====
const majorData = computed(() => {
  const b = brand.value;
  if (!isMajor.value || !b?.data) return null;
  const d = b.data;
  return {
    directions: normalizeRelatedRefs(d?.employmentDirections),
    enterprises: normalizeRelatedRefs(d?.cooperationEnterprises),
    achievements: normalizeRelatedRefs(d?.cooperationAchievements),
    courses: normalizeRelatedRefs(d?.featuredCourses),
  };
});

const employerBrandIds = computed(() => {
  const ids = new Set<string>();
  for (const eb of employerBrands.value) if (!eb.enterpriseId) ids.add(eb.id);
  return ids;
});
const publicEnterpriseIds = computed(() => {
  const ids = new Set<string>();
  for (const e of publicEnterprises.value) ids.add(e.id);
  return ids;
});
const publicJobBrandIds = computed(() => {
  const ids = new Set<string>();
  for (const jb of publicJobBrands.value) ids.add(jb.id);
  return ids;
});
const publicAchievementIds = computed(() => {
  const ids = new Set<string>();
  for (const a of publicAchievements.value) ids.add(a.id);
  return ids;
});

// ===== 雇主品牌 / 其它 =====
const positions = computed<PositionSnapshot[]>(() =>
  isEmployer.value ? (brand.value?.data?.positions ?? []) : [],
);
const hiredStudents = computed<HiredStudent[]>(() =>
  isEmployer.value ? (brand.value?.data?.hiredStudents ?? []) : [],
);

const studentsByJob = computed<[string, HiredStudent[]][]>(() => {
  const map = new Map<string, HiredStudent[]>();
  for (const s of hiredStudents.value) {
    const key = s.jobId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()];
});

const jobBrandByPosition = computed(() => {
  const map = new Map<string, AlliancePublicBrand>();
  for (const jb of jobBrands.value) if (jb.positionId) map.set(jb.positionId, jb);
  return map;
});

function jobBrandOfPosition(p: PositionSnapshot) {
  return jobBrandByPosition.value.get(p.id);
}
function salaryTextOf(p: PositionSnapshot) {
  return formatSalaryRange(p) ?? '-';
}
function positionNameOf(jobId: string) {
  return positions.value.find((p) => p.id === jobId)?.name;
}

const independentEnterpriseType = computed(() => {
  const t = (brand.value?.data?.enterpriseInfo as any)?.enterpriseType;
  return t ? allianceLabel('enterpriseType', t) : undefined;
});

const commonSubtitle = computed(() => {
  if (isEmployer.value) {
    return `${allianceLabel('brandType', brand.value!.brandType)} · ${isIndependent.value ? '独立雇主企业' : '合作企业'}`;
  }
  return brand.value ? allianceLabel('brandType', brand.value.brandType) : '';
});

const commonBadges = computed<DetailBadge[]>(() => {
  const list: DetailBadge[] = [];
  if (isIndependent.value) {
    const t = independentEnterpriseType.value;
    if (t) list.push({ text: t });
  }
  if (enterprise.value?.industry) list.push({ text: enterprise.value.industry });
  if (enterprise.value?.region) list.push({ text: enterprise.value.region });
  if (enterprise.value?.establishedYear) list.push({ text: `${enterprise.value.establishedYear} 年成立` });
  if (enterprise.value?.employeeCount) list.push({ text: `${enterprise.value.employeeCount} 人` });
  return list;
});

const commonStats = computed<DetailStat[]>(() =>
  isEmployer.value
    ? [
        { label: '关联岗位', value: positions.value.length, icon: Briefcase, gradient: 'linear-gradient(135deg,#409eff,rgba(64,158,255,0.8))' },
        { label: '已招聘学生', value: hiredStudents.value.length, icon: User, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
        { label: '成立年份', value: enterprise.value?.establishedYear || '-', icon: Calendar, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
      ]
    : [],
);

const commonBreadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '品牌列表', href: '/portal/alliance/brands' },
  { label: brand.value?.name || '' },
]);

const commonTabs = computed<DetailTab[]>(() => {
  const list: DetailTab[] = [{ value: 'info', label: '基本信息' }];
  if (isEmployer.value) {
    list.push({ value: 'positions', label: '关联岗位', count: positions.value.length });
    list.push({ value: 'students', label: '已招聘学生', count: hiredStudents.value.length });
  }
  if (isMajor.value && majorData.value) {
    list.push({ value: 'directions', label: '专业就业方向', count: majorData.value.directions.length });
    list.push({ value: 'enterprises', label: '专业合作企业', count: majorData.value.enterprises.length });
    list.push({ value: 'achievements', label: '专业合作成果', count: majorData.value.achievements.length });
    list.push({ value: 'courses', label: '专业特色课程', count: majorData.value.courses.length });
  }
  return list;
});
</script>

<style scoped>
.loading-wrap { max-width: 1280px; margin: 0 auto; padding: 24px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.self-start { align-self: start; }
.stack { display: flex; flex-direction: column; gap: 24px; }
.prose { color: #334155; line-height: 1.8; white-space: pre-wrap; }
.cover-img { width: 100%; aspect-ratio: 16 / 9; max-height: 288px; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; margin-bottom: 20px; }
.cover-wide { width: 100%; max-height: 256px; object-fit: cover; border-radius: 16px; margin-bottom: 24px; }
.info-stack { display: flex; flex-direction: column; gap: 12px; }
.majors-block { margin-top: 4px; }
.majors-label { font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
.majors-none { font-size: 14px; color: #94a3b8; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; padding: 4px 12px; border-radius: 9999px; background: #f1f5f9; color: #334155; }
.duty-list { display: flex; flex-direction: column; gap: 16px; }
.duty-row { display: flex; gap: 16px; border-radius: 16px; background: #f8fafc; padding: 20px; }
.duty-idx { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #409eff, rgba(64,158,255,0.7)); color: #fff; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.duty-name { font-weight: 600; color: #0f172a; }
.duty-desc { font-size: 14px; color: #475569; line-height: 1.6; margin-top: 6px; white-space: pre-wrap; }
.req-list { display: flex; flex-direction: column; gap: 12px; }
.req-row { display: flex; align-items: flex-start; gap: 12px; }
.req-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(64,158,255,0.6); margin-top: 8px; flex-shrink: 0; }
.req-row .prose { line-height: 1.7; font-size: 15px; }
.info-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.org-block { margin-top: 20px; }
.org-label { font-size: 14px; color: #64748b; margin-bottom: 10px; }
.org-value { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; color: #0f172a; }
.field-group { margin-bottom: 16px; }
.field-label { font-size: 14px; color: #64748b; margin-bottom: 8px; }
.honor-link { display: block; }
.honor-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: opacity 0.2s; }
.honor-img:hover { opacity: 0.8; }
.work-exp { border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px; }
.work-exp h4 { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
.other-info { border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px; }
.other-info h4 { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
.contact-list { display: flex; flex-direction: column; gap: 12px; }
.contact-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: #f8fafc; color: #334155; font-size: 14px; word-break: break-all; }
.contact-none { font-size: 14px; color: #94a3b8; }
.pos-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 14px 10px; border-top: 1px solid #f8fafc; }
.pos-salary { font-size: 14px; font-weight: 700; color: #409eff; }
.pos-type { font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: #f1f5f9; color: #475569; font-weight: 500; }
.pos-majors { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 14px 12px; }
.pos-major { font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; font-weight: 500; }
.pos-more { font-size: 10px; color: #94a3b8; }
.students-list { display: flex; flex-direction: column; gap: 16px; }
.student-group { }
.student-job { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
.student-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.student-chip { display: inline-flex; align-items: center; gap: 8px; border-radius: 9999px; border: 1px solid #f1f5f9; background: #f8fafc; padding: 6px 12px; font-size: 14px; }
.student-name { font-weight: 500; }
.student-major { font-size: 12px; color: #94a3b8; }
.grey-card { position: relative; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px dashed #e2e8f0; display: flex; flex-direction: column; }
.grey-card .el-icon { margin: 32px auto 0; color: #cbd5e1; }
.grey-name { padding: 0 14px; font-size: 14px; font-weight: 700; color: #94a3b8; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 12px; }
.grey-badge { margin: 6px 14px 14px; display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; font-weight: 500; width: fit-content; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .grid-4 { grid-template-columns: repeat(2, 1fr); } .col-2, .col-3 { grid-column: auto; } .info-grid-3 { grid-template-columns: repeat(2, 1fr); } }
</style>
