<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="error" class="loading-wrap">
    <el-empty :description="error" />
    <div class="retry-wrap"><el-button type="primary" @click="load">重试</el-button></div>
  </div>
  <div v-else-if="!achievement" class="loading-wrap"><el-empty description="成果不存在" /></div>
  <AllianceDetailShell
    v-else
    :breadcrumbs="breadcrumbs"
    back-href="/portal/alliance/achievements"
    :icon="Trophy"
    icon-gradient="linear-gradient(135deg, #8b5cf6, #9333ea)"
    :title="achievement.title"
    :subtitle="typeLabel"
    :badges="badges"
    :tabs="tabDefs"
  >
    <template #info>
      <div class="grid-3">
        <div class="col-2 stack">
          <SectionCard title="成果简介">
            <p class="prose">{{ achievement.description || '-' }}</p>
          </SectionCard>
          <SectionCard v-if="achievement.citationReason" title="引用原因 / 核心亮点" :icon="Medal">
            <p class="prose">{{ achievement.citationReason }}</p>
          </SectionCard>
          <SectionCard v-if="achievement.coverImage" title="成果封面" :icon="Picture">
            <img :src="achievement.coverImage" alt="成果封面" class="cover-img" />
          </SectionCard>
          <SectionCard v-if="ownerPersons.length || coBuilders.length" title="人员信息" :icon="User">
            <div v-if="ownerPersons.length" class="person-group">
              <p class="person-label">成果归属人</p>
              <div class="tags"><span v-for="p in ownerPersons" :key="p" class="tag">{{ p }}</span></div>
            </div>
            <div v-if="coBuilders.length" class="person-group">
              <p class="person-label">成果共建人</p>
              <div class="tags"><span v-for="p in coBuilders" :key="p" class="tag">{{ p }}</span></div>
            </div>
          </SectionCard>
        </div>

        <div class="stack">
          <SectionCard title="关联信息">
            <div class="rel-list">
              <div v-for="p in partners" :key="p.id" class="rel-row">
                <div class="rel-icon" style="background:#eff6ff;color:#2563eb;"><el-icon><OfficeBuilding /></el-icon></div>
                <div class="rel-body">
                  <p class="rel-label">合作企业</p>
                  <router-link :to="`/portal/alliance/enterprises/${p.id}`" class="rel-link">{{ p.name }} <el-icon><Right /></el-icon></router-link>
                </div>
              </div>
              <div v-if="relatedProject" class="rel-row">
                <div class="rel-icon" style="background:#ede9fe;color:#7c3aed;"><el-icon><Folder /></el-icon></div>
                <div class="rel-body">
                  <p class="rel-label">归属项目</p>
                  <router-link :to="`/portal/alliance/projects/${relatedProject.id}`" class="rel-link">{{ relatedProject.name }} <el-icon><Right /></el-icon></router-link>
                </div>
              </div>
              <p v-if="!partners.length && !relatedProject" class="rel-none">暂无关联信息</p>
            </div>
          </SectionCard>

          <SectionCard title="成果信息" :icon="Calendar">
            <div class="info-stack">
              <InfoBlock label="成果类型" :value="typeLabel" />
              <InfoBlock label="关联二级学院" :value="(achievement.secondaryColleges ?? []).join('、')" />
              <InfoBlock label="发布日期" :value="achievement.achievementDate || '-'" />
              <InfoBlock label="创建时间" :value="formatDate(achievement.createdAt)" />
              <InfoBlock label="更新时间" :value="formatDate(achievement.updatedAt)" />
            </div>
          </SectionCard>
        </div>
      </div>
    </template>

    <template #attachments>
      <SectionCard title="成果佐证材料">
        <div v-if="attachments.length" class="grid-4">
          <img v-for="(file, idx) in attachments" :key="idx" :src="file" :alt="`佐证材料 ${idx + 1}`" class="attach-img" />
        </div>
        <el-empty v-else description="暂无佐证材料" :image-size="60" />
      </SectionCard>
    </template>

    <template #scenes>
      <SectionCard title="关联实践场景">
        <div v-if="scenes.length" class="grid-4">
          <RelatedObjectCard v-for="s in scenes" :key="s.id" :item="s" kind="scenes" />
        </div>
        <el-empty v-else description="暂无关联场景" :image-size="60" />
      </SectionCard>
    </template>

    <template #courses>
      <SectionCard title="关联数字课程">
        <div v-if="courses.length" class="grid-4">
          <RelatedObjectCard v-for="c in courses" :key="c.id" :item="c" kind="courses" />
        </div>
        <el-empty v-else description="暂无关联课程" :image-size="60" />
      </SectionCard>
    </template>

    <template #positions>
      <SectionCard title="关联职业岗位">
        <div v-if="positions.length" class="grid-4">
          <RelatedObjectCard v-for="p in positions" :key="p.id" :item="p" kind="positions" />
        </div>
        <el-empty v-else description="暂无关联岗位" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Trophy, Medal, Picture, User, OfficeBuilding, Folder, Right, Calendar } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type DetailBadge, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import RelatedObjectCard from './components/RelatedObjectCard.vue';
import {
  allianceLabel,
  fetchAllPages,
  formatDate,
  normalizeRelatedRefs,
  type AllianceAchievement,
  type AllianceEnterprise,
  type AllianceProject,
} from './shared';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const achievement = ref<AllianceAchievement | null>(null);
const partners = ref<AllianceEnterprise[]>([]);
const relatedProject = ref<AllianceProject | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const typeLabel = computed(() => allianceLabel('achievementType', achievement.value?.type));

const breadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '合作成果列表', href: '/portal/alliance/achievements' },
  { label: achievement.value?.title || '' },
]);

const badges = computed<DetailBadge[]>(() => {
  if (!achievement.value) return [];
  return [
    { text: typeLabel.value },
    { text: achievement.value.achievementDate ? formatDate(achievement.value.achievementDate) : '-' },
  ];
});

const attachments = computed(() => achievement.value?.attachments ?? []);
const scenes = computed(() => normalizeRelatedRefs(achievement.value?.relatedScenes));
const courses = computed(() => normalizeRelatedRefs(achievement.value?.relatedCourses));
const positions = computed(() => normalizeRelatedRefs(achievement.value?.relatedPositions));
const ownerPersons = computed(() => achievement.value?.ownerPersons ?? []);
const coBuilders = computed(() => achievement.value?.coBuilders ?? []);

const tabDefs = computed<DetailTab[]>(() => [
  { value: 'info', label: '基本信息' },
  { value: 'attachments', label: '成果佐证材料', count: attachments.value.length },
  { value: 'scenes', label: '关联实践场景', count: scenes.value.length },
  { value: 'courses', label: '关联数字课程', count: courses.value.length },
  { value: 'positions', label: '关联职业岗位', count: positions.value.length },
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
    const [a, ents, projs] = await Promise.all([
      portalRequest<AllianceAchievement>(`/alliance/public/achievements/${id}${q}`),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceEnterprise[] }>(
          `/alliance/public/enterprises${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceProject[] }>(
          `/alliance/public/projects${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
    ]);
    achievement.value = a;
    const entIds = a.enterpriseIds ?? [];
    partners.value = ents.filter((e) => entIds.includes(e.id));
    const pid = (a.projectIds ?? [])[0];
    relatedProject.value = projs.find((p) => p.id === pid) ?? null;
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
.stack { display: flex; flex-direction: column; gap: 24px; }
.prose { color: #334155; line-height: 1.8; font-size: 15px; white-space: pre-wrap; }
.cover-img { width: 100%; max-width: 448px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; }
.person-group { margin-bottom: 20px; }
.person-label { font-size: 14px; color: #64748b; margin-bottom: 10px; }
.tags { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { font-size: 12px; padding: 4px 12px; border-radius: 8px; background: #f1f5f9; color: #334155; }
.rel-list { display: flex; flex-direction: column; gap: 12px; }
.rel-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #f1f5f9; }
.rel-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rel-body { min-width: 0; }
.rel-label { font-size: 12px; color: #94a3b8; margin-bottom: 2px; }
.rel-link { display: inline-flex; align-items: center; gap: 2px; font-weight: 500; color: #0f172a; text-decoration: none; font-size: 14px; transition: color 0.2s; }
.rel-link:hover { color: #10b981; }
.rel-none { font-size: 14px; color: #94a3b8; }
.info-stack { display: flex; flex-direction: column; gap: 12px; }
.attach-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .grid-4 { grid-template-columns: repeat(2, 1fr); } .col-2 { grid-column: auto; } }
</style>
