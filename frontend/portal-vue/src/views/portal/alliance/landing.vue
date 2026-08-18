<template>
  <div v-if="loading" class="landing-loading"><el-skeleton :rows="12" animated /></div>
  <div v-else class="landing">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-flex">
          <div class="hero-left">
            <div class="hero-badge"><el-icon><MagicStick /></el-icon>产教融合 · 协同育人 · 互利共赢</div>
            <h1 class="hero-title">搭建产教融合桥梁<br /><span class="hero-sub">共育产业英才</span></h1>
            <p class="hero-desc">坚持以产业需求为牵引，面向职业岗位能力要求，依托真实实践场景，推动企业用人标准、教学培养目标与人才测评体系协同贯通。</p>
            <el-button class="hero-cta" round @click="scrollToResults">查看产教融合成果 <el-icon><Right /></el-icon></el-button>
          </div>
          <div class="hero-right">
            <div class="school-card">
              <div class="school-head">
                <img v-if="schoolInfo?.logoUrl" :src="schoolInfo.logoUrl" :alt="schoolInfo.name" class="school-logo" />
                <div v-else class="school-logo-ph">{{ schoolInfo?.name?.slice(0, 1) || '校' }}</div>
                <div class="school-head-text">
                  <h3 class="school-name">{{ schoolInfo?.name || '校企合作联盟' }}</h3>
                  <p class="school-sub">{{ schoolInfo?.shortName || '产教融合 · 协同育人 · 互利共赢' }}</p>
                </div>
              </div>
              <div v-if="schoolBadges.length" class="school-badges">
                <span v-for="b in schoolBadges" :key="b" class="school-badge">{{ b }}</span>
              </div>
              <div class="school-meta">
                <a v-if="schoolInfo?.website" :href="schoolInfo.website" target="_blank" rel="noopener noreferrer" class="school-meta-item"><el-icon><Link /></el-icon>{{ schoolInfo.website.replace(/^https?:\/\//, '') }}</a>
                <p v-if="schoolInfo?.address" class="school-meta-item"><el-icon><Location /></el-icon>{{ schoolInfo.address }}</p>
                <p v-if="collegeCount" class="school-meta-item"><el-icon><School /></el-icon>{{ collegeCount }} 个二级学院</p>
              </div>
              <div v-if="hasScaleData" class="school-scale">
                <div class="scale-item"><p class="scale-v">{{ formatNum(scale.studentCount) }}</p><p class="scale-l">在校生</p></div>
                <div class="scale-item"><p class="scale-v">{{ scale.teacherCount ?? '—' }}</p><p class="scale-l">教师</p></div>
                <div class="scale-item"><p class="scale-v">{{ scale.majorCount ?? collegeCount }}</p><p class="scale-l">{{ scale.majorCount ? '专业' : '二级学院' }}</p></div>
              </div>
              <p v-if="schoolInfo?.description" class="school-desc">{{ schoolInfo.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 统计条 -->
    <div v-if="statsList.length" class="stats-wrap">
      <div class="stats-bar">
        <div v-for="s in statsList" :key="s.label" class="stat-item">
          <div class="stat-icon" :style="{ background: s.gradient }"><el-icon :size="22"><component :is="s.icon" /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ s.value > 0 ? `${s.value}+` : '0' }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <main class="landing-main" ref="resultsRef">
      <!-- 产教融合成果库 -->
      <section class="section">
        <SectionHeading eyebrow="精选 · FEATURED" title="产教融合成果库" subtitle="多元主体协同，以产业需求为牵引，以学生能力为中心，以场景实践为载体，以跨专业融合为特征" />

        <div class="block">
          <SubHeading title="合作企业" href="/portal/alliance/enterprises" />
          <div v-if="!enterprises.length" class="empty-box">暂无合作企业</div>
          <div v-else class="grid-3">
            <EnterpriseCard v-for="e in enterprises" :key="e.id" :enterprise="e" />
          </div>
        </div>

        <div class="block">
          <SubHeading title="合作项目" href="/portal/alliance/projects" />
          <div v-if="!projects.length" class="empty-box">暂无合作项目</div>
          <div v-else class="grid-4">
            <ProjectCard v-for="p in projects" :key="p.id" :project="p" />
          </div>
        </div>

        <div class="block">
          <SubHeading title="合作成果" href="/portal/alliance/achievements" />
          <div v-if="!achievements.length" class="empty-box">暂无合作成果</div>
          <div v-else class="grid-4">
            <AchievementCard v-for="a in achievements" :key="a.id" :achievement="a" />
          </div>
        </div>

        <div class="block">
          <SubHeading title="专家资源" href="/portal/alliance/experts" />
          <div v-if="!experts.length" class="empty-box">暂无专家资源</div>
          <div v-else class="grid-6">
            <ExpertCard v-for="e in experts" :key="e.id" :expert="e" />
          </div>
        </div>
      </section>

      <!-- 产教品牌库 -->
      <section class="section brand-section">
        <SectionHeading eyebrow="品牌 · BRANDS" title="产教品牌库" subtitle="人才培养、校企合作、专业建设等各领域品牌成果" />

        <div class="brand-cats">
          <router-link v-for="cat in BRAND_CATEGORIES" :key="cat.id" :to="cat.href" class="brand-cat">
            <div class="brand-cat-icon"><el-icon :size="18"><component :is="cat.icon" /></el-icon></div>
            <div class="brand-cat-text">
              <span class="brand-cat-title">{{ cat.title }}</span>
              <span class="brand-cat-count">{{ brandCountByType[cat.id] ?? 0 }} 个品牌</span>
            </div>
          </router-link>
        </div>

        <div v-if="!hasAnyBrand" class="empty-box">暂无品牌内容</div>
        <template v-else>
          <!-- 人才品牌 -->
          <div v-if="talentBrands.length || talentRanking.length" class="brand-block">
            <SubHeading title="人才品牌" href="/portal/alliance/brands?type=talent" />
            <div v-if="talentRanking.length" class="ranking-grid">
              <div v-for="g in talentRanking" :key="g.majorId" class="ranking-card">
                <div class="ranking-head">
                  <div class="ranking-icon"><el-icon><Medal /></el-icon></div>
                  <span class="ranking-major">{{ g.majorName }}</span>
                  <span v-if="g.students.length" class="ranking-top">TOP {{ Math.min(g.students.length, 5) }}</span>
                </div>
                <div class="ranking-body">
                  <div v-for="(s, idx) in g.students.slice(0, 5)" :key="s.studentId" class="ranking-row" :class="{ first: idx === 0 }">
                    <span class="rank-idx" :class="`rank-${idx + 1}`">{{ idx + 1 }}</span>
                    <div class="rank-person">
                      <p class="rank-name">{{ s.name }}</p>
                      <p class="rank-class">{{ s.className || '-' }}</p>
                    </div>
                    <div class="rank-score">
                      <p class="rank-score-v">{{ s.avgAbilityCognitionScore == null ? '-' : s.avgAbilityCognitionScore.toFixed(1) }}</p>
                      <p class="rank-score-l">能力认证得分</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="talentBrands.length">
              <div class="case-head"><span class="case-bar" /><h4>就业案例</h4><span class="case-hint">左右滑动查看更多</span></div>
              <div class="talent-scroll">
                <div v-for="b in talentBrands" :key="b.id" class="talent-slide">
                  <BrandCards :brand="b" variant="talent" />
                </div>
              </div>
            </div>
          </div>

          <!-- 雇主品牌 + 岗位品牌 -->
          <div v-if="employerBrands.length || jobBrands.length" class="brand-block">
            <div class="two-col">
              <div v-if="employerBrands.length">
                <SubHeading title="雇主品牌" href="/portal/alliance/brands?type=employer" />
                <div class="row-container">
                  <BrandCards v-for="b in employerBrands" :key="b.id" :brand="b" variant="employer" />
                </div>
              </div>
              <div v-if="jobBrands.length">
                <SubHeading title="岗位品牌" href="/portal/alliance/brands?type=job" />
                <div class="row-container">
                  <BrandCards v-for="b in jobBrands" :key="b.id" :brand="b" variant="job" />
                </div>
              </div>
            </div>
          </div>

          <!-- 专业品牌 -->
          <div v-if="majorBrands.length" class="brand-block">
            <SubHeading title="专业品牌" href="/portal/alliance/brands?type=major" />
            <div class="grid-3">
              <BrandCards v-for="b in majorBrands" :key="b.id" :brand="b" variant="major" />
            </div>
          </div>

          <!-- 师资品牌 -->
          <div v-if="teacherBrands.length" class="brand-block">
            <SubHeading title="师资品牌" href="/portal/alliance/brands?type=teacher" />
            <div class="grid-6">
              <BrandCards v-for="b in teacherBrands" :key="b.id" :brand="b" variant="teacher" />
            </div>
          </div>

          <!-- 文化品牌 -->
          <div v-if="cultureBrands.length" class="brand-block">
            <SubHeading title="文化品牌" href="/portal/alliance/brands?type=culture" />
            <div class="grid-3">
              <BrandCards v-for="b in cultureBrands" :key="b.id" :brand="b" variant="culture" />
            </div>
          </div>
        </template>
      </section>

      <!-- 人才与岗位供需服务大厅 -->
      <section class="section">
        <div class="employment-panel">
          <SectionHeading eyebrow="就业 · EMPLOYMENT" title="人才与岗位供需服务大厅" subtitle="校企合作就业项目，汇聚优质岗位资源" />
          <div class="emp-stats">
            <div v-for="s in employmentStatsList" :key="s.label" class="emp-stat">
              <div class="emp-stat-icon" :style="{ background: s.gradient }"><el-icon :size="20"><component :is="s.icon" /></el-icon></div>
              <p class="emp-stat-value">{{ s.value }}</p>
              <p class="emp-stat-label">{{ s.label }}</p>
            </div>
          </div>
          <div v-if="!employmentProjects.length" class="empty-box">暂无就业项目</div>
          <div v-else class="grid-3">
            <router-link v-for="p in employmentProjects.slice(0, 6)" :key="p.id" :to="`/portal/alliance/employment/${p.id}`" class="emp-card">
              <div class="emp-card-cover">
                <img v-if="p.coverImage" :src="p.coverImage" :alt="p.name" class="cover-img" />
                <GradientPlaceholder v-else :seed="p.name" :label="p.name" class="cover-img" />
                <div class="cover-overlay" />
                <div class="emp-cover-badges">
                  <span class="emp-phase" :style="{ background: employmentPhaseBg(p) }">{{ employmentPhaseLabel(p) }}</span>
                  <span class="emp-type">{{ employmentTypeLabel(p) }}</span>
                </div>
                <div class="emp-cover-title">{{ p.name }}</div>
              </div>
              <div class="emp-card-body">
                <p class="emp-card-desc">{{ p.description || '面向本校学生提供优质就业岗位与实习机会' }}</p>
                <div class="emp-card-meta">
                  <span>{{ p.startDate ?? '-' }}{{ p.endDate ? ` ~ ${p.endDate}` : '' }}</span>
                  <span>{{ p.jobCount ?? 0 }} 个在招岗位</span>
                </div>
                <div class="emp-card-footer">
                  <el-icon><OfficeBuilding /></el-icon>
                  <span>{{ employmentPartners(p) }}</span>
                </div>
              </div>
            </router-link>
          </div>
          <div class="emp-cta">
            <el-button type="primary" round class="emp-cta-btn" @click="$router.push('/portal/alliance/employment')">查看全部岗位</el-button>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta">
        <div class="cta-badge"><el-icon><MagicStick /></el-icon>共建生态</div>
        <h2 class="cta-title">加入产教融合生态</h2>
        <p class="cta-desc">无论您是企业、学校还是行业专家，都可以在这里找到合作机会，共同推动人才培养与产业升级。</p>
        <el-button type="primary" round class="cta-btn" @click="$router.push('/partner')">企业/专家服务台</el-button>
      </section>
    </main>

    <footer class="landing-footer">知与 SaaS · 产教融合联盟</footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { MagicStick, Right, Link, Location, School, Folder, User, Trophy, Briefcase, Medal, OfficeBuilding, CircleCheck, Aim } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import GradientPlaceholder from './components/GradientPlaceholder.vue';
import EnterpriseCard from './components/EnterpriseCard.vue';
import ProjectCard from './components/ProjectCard.vue';
import AchievementCard from './components/AchievementCard.vue';
import ExpertCard from './components/ExpertCard.vue';
import BrandCards from './components/BrandCards.vue';
import SectionHeading from './components/SectionHeading.vue';
import SubHeading from './components/SubHeading.vue';
import {
  deriveEmploymentProjectPhase,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  type AllianceAchievement,
  type AllianceEnterprise,
  type AllianceExpert,
  type AllianceProject,
  type AlliancePublicBrand,
  type AlliancePublicStats,
  type EmploymentProject,
  type TalentRankMajorGroup,
  type TenantSchool,
} from './shared';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const schoolInfo = ref<TenantSchool | null>(null);
const stats = ref<AlliancePublicStats | null>(null);
const enterprises = ref<AllianceEnterprise[]>([]);
const projects = ref<AllianceProject[]>([]);
const experts = ref<AllianceExpert[]>([]);
const achievements = ref<AllianceAchievement[]>([]);
const brands = ref<AlliancePublicBrand[]>([]);
const talentRanking = ref<TalentRankMajorGroup[]>([]);
const employmentProjects = ref<EmploymentProject[]>([]);
const loading = ref(true);
const resultsRef = ref<HTMLElement | null>(null);

const BRAND_CATEGORIES = [
  { id: 'talent', title: '人才品牌', icon: User, href: '/portal/alliance/brands?type=talent' },
  { id: 'employer', title: '雇主品牌', icon: OfficeBuilding, href: '/portal/alliance/brands?type=employer' },
  { id: 'job', title: '岗位品牌', icon: Briefcase, href: '/portal/alliance/brands?type=job' },
  { id: 'major', title: '专业品牌', icon: School, href: '/portal/alliance/brands?type=major' },
  { id: 'teacher', title: '师资品牌', icon: User, href: '/portal/alliance/brands?type=teacher' },
  { id: 'culture', title: '文化品牌', icon: Trophy, href: '/portal/alliance/brands?type=culture' },
];

const STAT_GRADIENTS = [
  'linear-gradient(135deg,#409eff,rgba(64,158,255,0.8))',
  'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))',
  'linear-gradient(135deg,rgba(64,158,255,0.8),rgba(64,158,255,0.6))',
  'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))',
];

const statsList = computed(() => {
  if (!stats.value) return [];
  const items = [
    { label: '合作企业', value: stats.value.enterpriseCount, icon: OfficeBuilding },
    { label: '合作项目', value: stats.value.projectCount, icon: Folder },
    { label: '企业专家', value: stats.value.expertCount, icon: User },
    { label: '合作成果', value: stats.value.achievementCount, icon: Trophy },
  ];
  return items.map((s, idx) => ({ ...s, gradient: STAT_GRADIENTS[idx % STAT_GRADIENTS.length] }));
});

const scale = computed(() => schoolInfo.value?.scaleData ?? {});
const collegeCount = computed(() => schoolInfo.value?.secondaryColleges?.length ?? 0);
const hasScaleData = computed(
  () =>
    scale.value.studentCount != null ||
    scale.value.teacherCount != null ||
    scale.value.majorCount != null ||
    collegeCount.value > 0,
);
const schoolBadges = computed(() => {
  const s = schoolInfo.value;
  if (!s) return [];
  return [s.educationLevel, s.educationNature, [s.province, s.city].filter(Boolean).join(' ')].filter(Boolean) as string[];
});

const featuredBrandsByType = computed(() => {
  const featured = brands.value.filter((b) => b.isFeatured || b.isPublic);
  const limit: Record<string, number> = { talent: 5, employer: 3, job: 4, major: 3, teacher: 6, culture: 6 };
  const byType: Record<string, AlliancePublicBrand[]> = {};
  for (const cat of BRAND_CATEGORIES) {
    byType[cat.id] = featured.filter((b) => b.brandType === cat.id).slice(0, limit[cat.id] ?? 3);
  }
  return byType;
});

const talentBrands = computed(() => featuredBrandsByType.value['talent'] ?? []);
const employerBrands = computed(() => featuredBrandsByType.value['employer'] ?? []);
const jobBrands = computed(() => featuredBrandsByType.value['job'] ?? []);
const majorBrands = computed(() => featuredBrandsByType.value['major'] ?? []);
const teacherBrands = computed(() => featuredBrandsByType.value['teacher'] ?? []);
const cultureBrands = computed(() => featuredBrandsByType.value['culture'] ?? []);

const hasAnyBrand = computed(
  () =>
    talentBrands.value.length ||
    employerBrands.value.length ||
    jobBrands.value.length ||
    majorBrands.value.length ||
    teacherBrands.value.length ||
    cultureBrands.value.length ||
    talentRanking.value.length,
);

const brandCountByType = computed(() => {
  const counts: Record<string, number> = {};
  brands.value.forEach((b) => {
    counts[b.brandType] = (counts[b.brandType] ?? 0) + 1;
  });
  return counts;
});

const employmentStats = computed(() => {
  const list = employmentProjects.value;
  return {
    total: list.length,
    ongoing: list.filter((p) => deriveEmploymentProjectPhase(p) === 'ongoing').length,
    jobCount: list.reduce((sum, p) => sum + (p.jobCount ?? 0), 0),
    enterpriseCount: new Set(list.flatMap((p) => p.enterpriseIds ?? [])).size,
  };
});

const employmentStatsList = computed(() => [
  { label: '发布场次', value: employmentStats.value.total, icon: Briefcase, gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)' },
  { label: '进行中', value: employmentStats.value.ongoing, icon: CircleCheck, gradient: 'linear-gradient(135deg,#10b981,#059669)' },
  { label: '在招岗位', value: employmentStats.value.jobCount, icon: Aim, gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  { label: '合作企业', value: employmentStats.value.enterpriseCount, icon: OfficeBuilding, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
]);

function formatNum(v?: number) {
  return v != null ? v.toLocaleString() : '—';
}
function scrollToResults() {
  resultsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function employmentPhaseLabel(p: EmploymentProject) {
  return EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(p)];
}
function employmentPhaseBg(p: EmploymentProject) {
  const phase = deriveEmploymentProjectPhase(p);
  return phase === 'ongoing' ? '#10b981' : phase === 'preparing' ? '#f59e0b' : '#64748b';
}
function employmentTypeLabel(p: EmploymentProject) {
  return EMPLOYMENT_PROJECT_TYPE_LABELS[p.type] ?? p.type;
}
function employmentPartners(p: EmploymentProject) {
  const names = (p.enterpriseIds ?? [])
    .map((eid) => enterprises.value.find((e) => e.id === eid)?.name)
    .filter(Boolean) as string[];
  if (names.length > 0) {
    return names.slice(0, 2).join('、') + (names.length > 2 ? ` 等${names.length}家` : '');
  }
  return p.organizer || '校企联合';
}

async function load() {
  if (!tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const q = `?tenantId=${tenantId.value}`;
  try {
    const [school, statsRes, ents, projs, exps, achs, brandsRes, rank, emp] = await Promise.all([
      portalRequest<TenantSchool>(`/tenants/${tenantId.value}`).catch(() => null),
      portalRequest<AlliancePublicStats>(`/alliance/public/stats${q}`).catch(() => null),
      portalRequest<{ items: AllianceEnterprise[] }>(`/alliance/public/enterprises${q}`).catch(() => ({ items: [] })),
      portalRequest<{ items: AllianceProject[] }>(`/alliance/public/projects${q}`).catch(() => ({ items: [] })),
      portalRequest<{ items: AllianceExpert[] }>(`/alliance/public/experts${q}`).catch(() => ({ items: [] })),
      portalRequest<{ items: AllianceAchievement[] }>(`/alliance/public/achievements?sort=latest&tenantId=${tenantId.value}`).catch(() => ({ items: [] })),
      portalRequest<{ items: AlliancePublicBrand[] }>(`/alliance/public/brands${q}`).catch(() => ({ items: [] })),
      portalRequest<{ items: TalentRankMajorGroup[] }>(`/alliance/public/brands/talent-ranking?tenantId=${tenantId.value}`).catch(() => ({ items: [] })),
      portalRequest<{ items: EmploymentProject[] }>(`/alliance/public/employment-projects?tenantId=${tenantId.value}&limit=100`).catch(() => ({ items: [] })),
    ]);
    schoolInfo.value = school;
    stats.value = statsRes;
    enterprises.value = (ents?.items ?? []).slice(0, 6);
    projects.value = (projs?.items ?? []).slice(0, 8);
    experts.value = (exps?.items ?? []).slice(0, 6);
    achievements.value = (achs?.items ?? []).slice(0, 8);
    brands.value = brandsRes?.items ?? [];
    talentRanking.value = rank?.items ?? [];
    employmentProjects.value = emp?.items ?? [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.landing-loading { max-width: 1400px; margin: 0 auto; padding: 24px; }
.landing { min-height: 100vh; background: #f5f7fa; }
.hero { position: relative; padding-top: 64px; overflow: hidden; background: linear-gradient(135deg, #409eff, #2f7fd6, #1f66b3); }
.hero-inner { position: relative; z-index: 10; max-width: 1400px; margin: 0 auto; padding: 0 24px 48px; }
.hero-flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; flex-wrap: wrap; }
.hero-left { flex: 1; min-width: 0; padding-top: 16px; }
.hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); color: #fff; padding: 6px 14px; border-radius: 9999px; font-size: 13px; border: 1px solid rgba(255,255,255,0.25); margin-bottom: 20px; }
.hero-title { font-size: 48px; font-weight: 700; color: #fff; line-height: 1.2; margin-bottom: 20px; }
.hero-sub { color: rgba(255,255,255,0.8); }
.hero-desc { font-size: 16px; color: rgba(255,255,255,0.85); margin-bottom: 28px; max-width: 640px; line-height: 1.8; }
.hero-cta { background: #fff; color: #409eff; font-weight: 600; }
.hero-right { width: 460px; flex-shrink: 0; align-self: stretch; padding-top: 16px; }
.school-card { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px; backdrop-filter: blur(12px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.school-head { display: flex; align-items: center; gap: 14px; }
.school-logo { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 4px 10px rgba(0,0,0,0.2); background: #fff; flex-shrink: 0; }
.school-logo-ph { width: 48px; height: 48px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 18px; flex-shrink: 0; }
.school-head-text { flex: 1; min-width: 0; }
.school-name { font-weight: 600; color: #fff; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.school-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.school-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
.school-badge { font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); border-radius: 9999px; padding: 4px 10px; }
.school-meta { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.school-meta-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: rgba(255,255,255,0.8); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.school-scale { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 20px; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); }
.scale-item { text-align: center; min-width: 0; }
.scale-v { font-size: 20px; font-weight: 700; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scale-l { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.school-desc { font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 16px; line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.stats-wrap { max-width: 1400px; margin: -40px auto 0; padding: 0 24px; position: relative; z-index: 20; }
.stats-bar { background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 12px 40px rgba(0,0,0,0.08); padding: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-item { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 12px; transition: transform 0.2s, box-shadow 0.2s; }
.stat-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #f8fafc; }
.stat-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
.stat-value { font-size: 28px; font-weight: 700; color: #0f172a; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat-label { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
.landing-main { max-width: 1400px; margin: 0 auto; padding: 24px; width: 100%; }
.section { padding: 40px 0; }
.section.brand-section { padding-top: 56px; }
.block { margin-bottom: 80px; }
.brand-block { margin-bottom: 48px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.grid-6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
.empty-box { text-align: center; padding: 80px 0; color: #94a3b8; background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-size: 15px; font-weight: 500; }
.brand-cats { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-bottom: 64px; }
.brand-cat { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-radius: 16px; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.3s; text-decoration: none; color: inherit; }
.brand-cat:hover { box-shadow: 0 10px 20px rgba(64,158,255,0.1); border-color: rgba(64,158,255,0.3); background: rgba(64,158,255,0.05); transform: translateY(-2px); }
.brand-cat-icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, rgba(64,158,255,0.1), rgba(64,158,255,0.05)); display: flex; align-items: center; justify-content: center; color: #409eff; }
.brand-cat-text { display: flex; flex-direction: column; }
.brand-cat-title { font-weight: 500; color: #334155; }
.brand-cat-count { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.ranking-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px; }
.ranking-card { border-radius: 16px; border: 1px solid #e7e5e4; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden; }
.ranking-head { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f1f5f9; background: linear-gradient(to right, rgba(64,158,255,0.05), transparent); padding: 14px 20px; }
.ranking-icon { width: 28px; height: 28px; border-radius: 10px; background: linear-gradient(135deg, #409eff, rgba(64,158,255,0.7)); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.ranking-major { font-size: 14px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ranking-top { margin-left: auto; flex-shrink: 0; font-size: 11px; font-weight: 500; color: #94a3b8; }
.ranking-body { }
.ranking-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #f8fafc; }
.ranking-row.first { background: rgba(255,251,235,0.5); }
.rank-idx { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff; }
.rank-2 { background: linear-gradient(135deg, #cbd5e1, #94a3b8); color: #fff; }
.rank-3 { background: linear-gradient(135deg, #fdba74, #fb923c); color: #fff; }
.rank-idx:not(.rank-1):not(.rank-2):not(.rank-3) { background: #f1f5f9; color: #64748b; }
.rank-person { min-width: 0; flex: 1; }
.rank-name { font-size: 14px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-class { font-size: 11px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-score { flex-shrink: 0; text-align: right; }
.rank-score-v { font-size: 14px; font-weight: 700; color: #409eff; }
.rank-score-l { font-size: 10px; color: #94a3b8; margin-top: 2px; }
.case-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.case-bar { width: 16px; height: 4px; border-radius: 9999px; background: linear-gradient(to bottom, rgba(64,158,255,0.8), rgba(64,158,255,0.6)); }
.case-head h4 { font-size: 14px; font-weight: 600; color: #334155; }
.case-hint { font-size: 12px; color: #94a3b8; }
.talent-scroll { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 12px; }
.talent-slide { min-width: 380px; max-width: 440px; }
.two-col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; }
.two-col:has(> :only-child) { grid-template-columns: 1fr; }
.row-container { border-radius: 16px; border: 1px solid #e7e5e4; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden; }
.row-container > :deep(*) { border-bottom: 1px solid #f1f5f9; }
.row-container > :deep(*:last-child) { border-bottom: none; }
.employment-panel { border-radius: 24px; background: linear-gradient(180deg, rgba(64,158,255,0.05), rgba(238,242,255,0.4), rgba(245,243,255,0.4)); padding: 40px 24px; }
.emp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 48px; }
.emp-stat { background: rgba(255,255,255,0.8); border: 1px solid #f1f5f9; border-radius: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 20px; text-align: center; }
.emp-stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; margin: 0 auto 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.12); }
.emp-stat-value { font-size: 24px; font-weight: 700; color: #0f172a; }
.emp-stat-label { font-size: 14px; color: #64748b; margin-top: 4px; font-weight: 500; }
.emp-card { display: flex; flex-direction: column; background: #fff; border: 1px solid #f1f5f9; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.3s, box-shadow 0.3s; text-decoration: none; color: inherit; height: 100%; }
.emp-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
.emp-card-cover { position: relative; height: 176px; overflow: hidden; }
.cover-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.emp-card:hover .cover-img { transform: scale(1.05); }
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent); }
.emp-cover-badges { position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
.emp-phase { color: #fff; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; }
.emp-type { background: rgba(255,255,255,0.9); color: #1e293b; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; }
.emp-cover-title { position: absolute; bottom: 12px; left: 16px; right: 16px; font-weight: 600; color: #fff; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emp-card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.emp-card-desc { font-size: 12px; color: #475569; line-height: 1.6; margin-bottom: 12px; min-height: 2rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.emp-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 12px; color: #64748b; margin-bottom: 8px; }
.emp-card-footer { margin-top: auto; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; padding-top: 10px; border-top: 1px solid #f1f5f9; }
.emp-card-footer span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emp-cta { margin-top: 48px; text-align: center; }
.emp-cta-btn { background: linear-gradient(90deg, #2563eb, #4f46e5); border: none; font-weight: 600; padding: 12px 28px; }
.cta { position: relative; padding: 64px 24px; text-align: center; overflow: hidden; }
.cta-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; background: #fff; border: 1px solid rgba(64,158,255,0.1); color: #409eff; font-size: 12px; font-weight: 500; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.cta-title { font-size: 36px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
.cta-desc { font-size: 16px; color: #64748b; margin-bottom: 40px; max-width: 640px; margin-left: auto; margin-right: auto; line-height: 1.8; }
.cta-btn { background: linear-gradient(90deg, #409eff, rgba(64,158,255,0.8)); border: none; font-weight: 600; padding: 12px 32px; }
.landing-footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; border-top: 1px solid #eef2f7; }
@media (max-width: 992px) {
  .hero-flex { flex-direction: column; }
  .hero-right { width: 100%; }
  .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-6 { grid-template-columns: repeat(3, 1fr); }
  .stats-bar { grid-template-columns: repeat(2, 1fr); }
  .emp-stats { grid-template-columns: repeat(2, 1fr); }
  .ranking-grid { grid-template-columns: 1fr; }
  .two-col { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .hero-title { font-size: 30px; }
  .grid-3, .grid-4, .grid-6 { grid-template-columns: 1fr; }
}
</style>
