<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="error" class="loading-wrap">
    <el-empty :description="error" />
    <div class="retry-wrap"><el-button type="primary" @click="load">重试</el-button></div>
  </div>
  <div v-else-if="!enterprise" class="loading-wrap"><el-empty description="企业不存在" /></div>
  <AllianceDetailShell
    v-else
    :breadcrumbs="breadcrumbs"
    back-href="/portal/alliance/enterprises"
    :icon="OfficeBuilding"
    :icon-image="enterprise.logoUrl ? { src: enterprise.logoUrl, alt: enterprise.name } : undefined"
    icon-gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
    :cover-image="enterprise.coverImage"
    :title="enterprise.name"
    :subtitle="subtitle"
    :badges="badges"
    :stats="stats"
    :tabs="tabDefs"
  >
    <template #info>
      <div class="grid-3">
        <SectionCard title="企业简介" class="col-2">
          <p class="prose">{{ enterprise.description || '-' }}</p>
          <div class="other-info">
            <h4>其他信息</h4>
            <div class="info-grid-3">
              <InfoBlock label="统一社会信用代码" :value="enterprise.unifiedSocialCreditCode" />
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

        <SectionCard v-if="(enterprise.intellectualPropertyPhotos ?? []).length" title="知识产权" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.intellectualPropertyPhotos!" :alt="enterprise.name" />
        </SectionCard>
        <SectionCard v-if="(enterprise.qualificationPhotos ?? []).length" title="企业荣誉资质" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.qualificationPhotos!" :alt="enterprise.name" />
        </SectionCard>
        <SectionCard v-if="(enterprise.coverPhotos ?? []).length" title="企业展示封面" :icon="Picture" class="col-3">
          <PhotoGrid :photos="enterprise.coverPhotos!" :alt="enterprise.name" />
        </SectionCard>
      </div>
    </template>

    <template #experts>
      <SectionCard title="专家团队">
        <div v-if="experts.length" class="grid-4">
          <ExpertCard v-for="e in experts" :key="e.id" :expert="e" />
        </div>
        <el-empty v-else description="暂无专家" :image-size="60" />
      </SectionCard>
    </template>

    <template #projects>
      <SectionCard title="合作项目">
        <div v-if="projects.length" class="grid-3">
          <ProjectCard v-for="p in projects" :key="p.id" :project="p" />
        </div>
        <el-empty v-else description="暂无合作项目" :image-size="60" />
      </SectionCard>
    </template>

    <template #agreements>
      <SectionCard title="合作协议">
        <div v-if="agreements.length" class="agreement-list">
          <div v-for="a in agreements" :key="a.id" class="agreement-row">
            <div>
              <p class="agreement-name">{{ a.name }}</p>
              <p class="agreement-meta">{{ a.type }} · 有效期至 {{ a.endDate || '-' }}</p>
            </div>
            <el-tag type="info">{{ allianceLabel('agreementStatus', a.status) }}</el-tag>
          </div>
        </div>
        <el-empty v-else description="暂无合作协议" :image-size="60" />
      </SectionCard>
    </template>

    <template #achievements>
      <SectionCard title="合作成果">
        <div v-if="achievements.length" class="grid-3">
          <AchievementCard v-for="a in achievements" :key="a.id" :achievement="a" />
        </div>
        <el-empty v-else description="暂无合作成果" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { OfficeBuilding, User, Phone, Message, Location, Picture, Document, Trophy, Star, Calendar } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type DetailBadge, type DetailStat, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import PhotoGrid from './components/PhotoGrid.vue';
import ExpertCard from './components/ExpertCard.vue';
import ProjectCard from './components/ProjectCard.vue';
import AchievementCard from './components/AchievementCard.vue';
import {
  allianceLabel,
  fetchAllPages,
  type AllianceAchievement,
  type AllianceEnterprise,
  type AllianceExpert,
  type AllianceProject,
  type AlliancePublicAgreement,
} from './shared';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const enterprise = ref<AllianceEnterprise | null>(null);
const experts = ref<AllianceExpert[]>([]);
const projects = ref<AllianceProject[]>([]);
const achievements = ref<AllianceAchievement[]>([]);
const agreements = ref<AlliancePublicAgreement[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const breadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '合作企业列表', href: '/portal/alliance/enterprises' },
  { label: enterprise.value?.name || '' },
]);

const subtitle = computed(() =>
  enterprise.value?.industry
    ? [enterprise.value.industry, enterprise.value.region].filter(Boolean).join(' · ')
    : undefined,
);

const badges = computed<DetailBadge[]>(() => {
  const e = enterprise.value;
  if (!e) return [];
  const list: DetailBadge[] = [];
  if (e.industry) list.push({ text: e.industry });
  if (e.region) list.push({ text: e.region });
  if (e.establishedYear) list.push({ text: `${e.establishedYear} 年成立` });
  if (e.employeeCount) list.push({ text: `${e.employeeCount} 人` });
  return list;
});

const stats = computed<DetailStat[]>(() => [
  { label: '合作协议', value: agreements.value.length, icon: Document, gradient: 'linear-gradient(135deg,#409eff,rgba(64,158,255,0.8))' },
  { label: '合作项目', value: projects.value.length, icon: Trophy, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
  { label: '合作成果', value: achievements.value.length, icon: Star, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.8),rgba(64,158,255,0.6))' },
  { label: '成立年份', value: enterprise.value?.establishedYear || '-', icon: Calendar, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
]);

const tabDefs = computed<DetailTab[]>(() => [
  { value: 'info', label: '基本信息' },
  { value: 'experts', label: '专家团队', count: experts.value.length },
  { value: 'projects', label: '合作项目', count: projects.value.length },
  { value: 'agreements', label: '合作协议', count: agreements.value.length },
  { value: 'achievements', label: '合作成果', count: achievements.value.length },
]);

async function load() {
  if (!id || !tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const q = `?tenantId=${tenantId.value}`;
    const [ent, expList, projList, achList, agrList] = await Promise.all([
      portalRequest<AllianceEnterprise>(`/alliance/public/enterprises/${id}${q}`),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceExpert[] }>(
          `/alliance/public/experts${q}&includeNonPublic=true&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceProject[] }>(
          `/alliance/public/projects${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceAchievement[] }>(
          `/alliance/public/achievements${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AlliancePublicAgreement[] }>(
          `/alliance/public/agreements${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
    ]);
    enterprise.value = ent;
    experts.value = expList.filter((e) => e.enterpriseId === id);
    const enterpriseProjects = projList.filter((p) => (p.enterpriseIds ?? []).includes(id));
    const projectIds = enterpriseProjects.map((p) => p.id);
    projects.value = enterpriseProjects;
    achievements.value = achList.filter(
      (a) =>
        (a.enterpriseIds ?? []).includes(id) ||
        (a.projectIds ?? []).some((pid) => projectIds.includes(pid)),
    );
    agreements.value = agrList.filter(
      (a) =>
        (a.enterpriseIds ?? []).includes(id) ||
        (a.projectIds ?? []).some((pid) => projectIds.includes(pid)),
    );
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.loading-wrap { max-width: 1280px; margin: 0 auto; padding: 24px; }
.retry-wrap { text-align: center; margin-top: 12px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.self-start { align-self: start; }
.prose { color: #334155; line-height: 1.8; white-space: pre-wrap; }
.other-info { border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px; }
.other-info h4 { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
.info-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.contact-list { display: flex; flex-direction: column; gap: 12px; }
.contact-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: #f8fafc; color: #334155; font-size: 14px; word-break: break-all; }
.contact-none { font-size: 14px; color: #94a3b8; }
.agreement-list { display: flex; flex-direction: column; gap: 16px; }
.agreement-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px; background: #f8fafc; border-radius: 16px; }
.agreement-name { font-weight: 600; color: #0f172a; }
.agreement-meta { font-size: 14px; color: #64748b; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .grid-4 { grid-template-columns: repeat(2, 1fr); } .col-2, .col-3 { grid-column: auto; } .info-grid-3 { grid-template-columns: repeat(2, 1fr); } }
</style>
