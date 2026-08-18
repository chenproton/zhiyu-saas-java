<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="!project" class="loading-wrap"><el-empty description="项目不存在" /></div>
  <AllianceDetailShell
    v-else
    :breadcrumbs="breadcrumbs"
    back-href="/portal/alliance/projects"
    :icon="Folder"
    icon-gradient="linear-gradient(135deg, #6366f1, #7c3aed)"
    :cover-image="project.coverImage"
    :title="project.name"
    :subtitle="project.type"
    :badges="badges"
    :stats="stats"
    :tabs="tabDefs"
  >
    <template #info>
      <div class="grid-3">
        <SectionCard title="项目简介" class="col-2">
          <p class="prose">{{ project.description || '-' }}</p>
        </SectionCard>

        <SectionCard title="关联信息" class="self-start">
          <div class="rel-list">
            <div v-if="partners.length" class="rel-block">
              <div class="rel-icon" style="background: linear-gradient(135deg,#3b82f6,#2563eb);"><el-icon color="#fff"><OfficeBuilding /></el-icon></div>
              <div class="rel-body">
                <p class="rel-label">合作主体</p>
                <div class="rel-links">
                  <router-link v-for="p in partners" :key="p.id" :to="`/portal/alliance/enterprises/${p.id}`" class="rel-link">{{ p.name }} <el-icon><Right /></el-icon></router-link>
                </div>
              </div>
            </div>
            <div v-if="agreements.length" class="rel-block">
              <div class="rel-icon" style="background: linear-gradient(135deg,#10b981,#14b8a6);"><el-icon color="#fff"><Document /></el-icon></div>
              <div class="rel-body">
                <p class="rel-label">项目协议</p>
                <p class="rel-value">{{ agreements.length }} 项协议</p>
              </div>
            </div>
            <div v-if="achievements.length" class="rel-block">
              <div class="rel-icon" style="background: linear-gradient(135deg,#8b5cf6,#a855f7);"><el-icon color="#fff"><Trophy /></el-icon></div>
              <div class="rel-body">
                <p class="rel-label">关联成果</p>
                <p class="rel-value">{{ achievements.length }} 项成果</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="项目信息" class="col-3">
          <div class="info-grid-5">
            <InfoBlock label="合作类型" :value="project.type" />
            <InfoBlock label="当前阶段" :value="allianceLabel('projectPhase', project.phase)" />
            <InfoBlock label="关联二级学院" :value="(project.secondaryColleges ?? []).join('、')" />
            <InfoBlock label="开始日期" :value="project.startDate ? formatDate(project.startDate) : '-'" />
            <InfoBlock label="结束日期" :value="project.endDate ? formatDate(project.endDate) : '-'" />
            <InfoBlock label="预算" :value="project.budget" />
            <InfoBlock label="创建时间" :value="formatDate(project.createdAt)" />
            <InfoBlock label="更新时间" :value="formatDate(project.updatedAt)" />
          </div>
          <img v-if="project.coverImage" :src="project.coverImage" :alt="project.name" class="cover-img" />
        </SectionCard>
      </div>
    </template>

    <template #milestones>
      <SectionCard title="项目里程碑">
        <div v-if="milestones.length">
          <div class="progress-header">
            <span>总体进度</span><span>{{ progress }}%</span>
          </div>
          <el-progress :percentage="progress" :stroke-width="8" />
          <div class="timeline">
            <div v-for="m in milestones" :key="m.id" class="tl-item">
              <div class="tl-dot">
                <el-icon v-if="m.isCompleted" color="#10b981" :size="20"><CircleCheckFilled /></el-icon>
                <span v-else class="tl-empty" />
              </div>
              <div class="tl-body">
                <div class="tl-title-row">
                  <div>
                    <p class="tl-name">{{ m.name }}</p>
                    <p v-if="m.description" class="tl-desc">{{ m.description }}</p>
                  </div>
                  <el-tag :type="m.isCompleted ? 'success' : 'info'" size="small">{{ m.isCompleted ? '已完成' : '未完成' }}</el-tag>
                </div>
                <div class="tl-dates">
                  <span v-if="m.dueDate"><el-icon><Calendar /></el-icon>计划：{{ formatDate(m.dueDate) }}</span>
                  <span v-if="m.completedDate" class="done-date"><el-icon><CircleCheckFilled /></el-icon>完成：{{ formatDate(m.completedDate) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无里程碑数据" :image-size="60" />
      </SectionCard>
    </template>

    <template #agreements>
      <SectionCard title="项目协议">
        <div v-if="agreements.length" class="agreement-list">
          <div v-for="a in agreements" :key="a.id" class="agreement-row">
            <div class="agreement-head">
              <div class="agreement-name-row"><el-icon color="#10b981"><Document /></el-icon><p class="agreement-name">{{ a.name }}</p></div>
              <div class="agreement-tags">
                <el-tag v-if="a.type" type="info" size="small">{{ a.type }}</el-tag>
                <el-tag type="info" size="small">{{ allianceLabel('agreementStatus', a.status) }}</el-tag>
              </div>
            </div>
            <p v-if="a.startDate || a.endDate" class="agreement-date">{{ a.startDate || '-' }} 至 {{ a.endDate || '-' }}</p>
          </div>
        </div>
        <el-empty v-else description="暂无项目协议" :image-size="60" />
      </SectionCard>
    </template>

    <template #achievements>
      <SectionCard title="关联成果">
        <div v-if="achievements.length" class="grid-3">
          <AchievementCard v-for="a in achievements" :key="a.id" :achievement="a" />
        </div>
        <el-empty v-else description="暂无关联成果" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Folder, OfficeBuilding, Document, Trophy, Right, Calendar, CircleCheckFilled, Aim } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type DetailBadge, type DetailStat, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import AchievementCard from './components/AchievementCard.vue';
import {
  allianceLabel,
  fetchAllPages,
  formatDate,
  type AllianceAchievement,
  type AllianceEnterprise,
  type AllianceProject,
  type AllianceProjectMilestone,
  type AlliancePublicAgreement,
} from './shared';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const project = ref<AllianceProject | null>(null);
const partners = ref<AllianceEnterprise[]>([]);
const agreements = ref<AlliancePublicAgreement[]>([]);
const achievements = ref<AllianceAchievement[]>([]);
const milestones = ref<AllianceProjectMilestone[]>([]);
const loading = ref(true);

const progress = computed(() => {
  if (!milestones.value.length) return 0;
  const done = milestones.value.filter((m) => m.isCompleted).length;
  return Math.round((done / milestones.value.length) * 100);
});

const breadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '合作项目列表', href: '/portal/alliance/projects' },
  { label: project.value?.name || '' },
]);

const badges = computed<DetailBadge[]>(() => {
  if (!project.value) return [];
  const list: DetailBadge[] = [];
  list.push({ text: allianceLabel('projectPhase', project.value.phase) });
  list.push({
    text: `${project.value.startDate ? formatDate(project.value.startDate) : '-'} ~ ${project.value.endDate ? formatDate(project.value.endDate) : '-'}`,
  });
  return list;
});

const stats = computed<DetailStat[]>(() => [
  { label: '里程碑进度', value: `${progress.value}%`, icon: Aim, gradient: 'linear-gradient(135deg,#409eff,rgba(64,158,255,0.8))' },
  { label: '合作协议', value: agreements.value.length, icon: Document, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
  { label: '关联成果', value: achievements.value.length, icon: Trophy, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.8),rgba(64,158,255,0.6))' },
  { label: '合作主体', value: partners.value.length, icon: OfficeBuilding, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
]);

const tabDefs = computed<DetailTab[]>(() => [
  { value: 'info', label: '项目信息' },
  { value: 'milestones', label: '项目里程碑', count: milestones.value.length },
  { value: 'agreements', label: '项目协议', count: agreements.value.length },
  { value: 'achievements', label: '关联成果', count: achievements.value.length },
]);

async function load() {
  if (!id || !tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const q = `?tenantId=${tenantId.value}`;
    const [p, ents, agrs, achs, msRes] = await Promise.all([
      portalRequest<AllianceProject>(`/alliance/public/projects/${id}${q}`),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceEnterprise[] }>(
          `/alliance/public/enterprises${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AlliancePublicAgreement[] }>(
          `/alliance/public/agreements${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceAchievement[] }>(
          `/alliance/public/achievements${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      portalRequest<{ items: AllianceProjectMilestone[] }>(
        `/alliance/public/projects/${id}/milestones${q}`,
      ),
    ]);
    project.value = p;
    const entIds = p.enterpriseIds ?? [];
    partners.value = ents.filter((e) => entIds.includes(e.id));
    agreements.value = agrs.filter(
      (a) => (a.projectIds ?? []).includes(id) || (p.agreementIds ?? []).includes(a.id),
    );
    achievements.value = achs.filter((a) => (a.projectIds ?? []).includes(id));
    milestones.value = msRes.items ?? [];
  } catch {
    project.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.loading-wrap { max-width: 1280px; margin: 0 auto; padding: 24px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.self-start { align-self: start; }
.prose { color: #334155; line-height: 1.8; white-space: pre-wrap; }
.rel-list { display: flex; flex-direction: column; gap: 12px; }
.rel-block { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 16px; background: #f8fafc; }
.rel-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rel-body { min-width: 0; }
.rel-label { font-size: 12px; color: #94a3b8; }
.rel-value { font-weight: 600; color: #0f172a; }
.rel-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
.rel-link { display: inline-flex; align-items: center; gap: 2px; font-weight: 500; color: #0f172a; text-decoration: none; font-size: 14px; transition: color 0.2s; }
.rel-link:hover { color: #6366f1; }
.info-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
.cover-img { width: 100%; max-height: 288px; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-top: 20px; }
.progress-header { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 8px; }
.timeline { position: relative; margin-top: 24px; padding-left: 4px; }
.tl-item { display: flex; gap: 16px; position: relative; padding-bottom: 24px; }
.tl-dot { flex-shrink: 0; width: 24px; display: flex; justify-content: center; background: #fff; z-index: 1; }
.tl-empty { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #cbd5e1; display: inline-block; }
.tl-body { flex: 1; }
.tl-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.tl-name { font-weight: 600; color: #0f172a; }
.tl-desc { font-size: 14px; color: #64748b; margin-top: 4px; }
.tl-dates { display: flex; align-items: center; gap: 16px; margin-top: 8px; font-size: 14px; color: #94a3b8; }
.tl-dates span { display: inline-flex; align-items: center; gap: 4px; }
.done-date { color: #10b981; }
.agreement-list { display: flex; flex-direction: column; gap: 16px; }
.agreement-row { padding: 20px; background: #f8fafc; border-radius: 16px; }
.agreement-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.agreement-name-row { display: flex; align-items: center; gap: 8px; }
.agreement-name { font-weight: 600; color: #0f172a; font-size: 14px; }
.agreement-tags { display: flex; align-items: center; gap: 8px; }
.agreement-date { font-size: 12px; color: #64748b; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .col-2, .col-3 { grid-column: auto; } .info-grid-5 { grid-template-columns: repeat(2, 1fr); } }
</style>
