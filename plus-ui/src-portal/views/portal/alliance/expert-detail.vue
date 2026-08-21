<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="!expert" class="loading-wrap"><el-empty description="专家不存在" /></div>
  <AllianceDetailShell
    v-else
    :breadcrumbs="breadcrumbs"
    back-href="/portal/alliance/experts"
    :icon="User"
    :icon-image="expert.avatarUrl ? { src: expert.avatarUrl, alt: expert.name } : undefined"
    icon-gradient="linear-gradient(135deg, #3b82f6, #7c3aed)"
    :title="expert.name"
    :subtitle="subtitle"
    :badges="badges"
    :tabs="tabDefs"
  >
    <template #info>
      <div class="grid-3">
        <SectionCard title="基本信息" class="col-2">
          <div class="info-grid">
            <InfoBlock label="行业" :value="expert.industry" />
            <InfoBlock label="城市" :value="expert.city" />
            <InfoBlock label="从业年限" :value="expert.experienceYears ? `${expert.experienceYears}年` : undefined" />
            <InfoBlock label="学历" :value="expert.education" />
            <InfoBlock label="专家类型" :value="expert.expertType" />
          </div>
          <div v-if="enterpriseName" class="enterprise-block">
            <p class="enterprise-label">归属企业</p>
            <router-link v-if="expert.enterpriseId && enterpriseVisible" :to="`/portal/alliance/enterprises/${expert.enterpriseId}`" class="enterprise-link">
              <el-icon><OfficeBuilding /></el-icon>{{ enterpriseName }} <el-icon><Right /></el-icon>
            </router-link>
            <span v-else class="enterprise-text"><el-icon><OfficeBuilding /></el-icon>{{ enterpriseName }}</span>
          </div>
        </SectionCard>
        <SectionCard v-if="professionalFields.length || specialties.length" title="专业领域与专长" class="self-start">
          <div v-if="professionalFields.length" class="field-group">
            <p class="field-label">专业领域</p>
            <div class="tags"><span v-for="f in professionalFields" :key="f" class="tag">{{ f }}</span></div>
          </div>
          <div v-if="specialties.length" class="field-group">
            <p class="field-label">专长</p>
            <div class="tags"><span v-for="s in specialties" :key="s" class="tag">{{ s }}</span></div>
          </div>
        </SectionCard>
      </div>
    </template>

    <template #introduction>
      <SectionCard title="个人简介" :icon="Trophy">
        <p v-if="expert.introduction" class="prose">{{ expert.introduction }}</p>
        <el-empty v-else description="暂无简介" :image-size="60" />
        <div v-if="expert.workExperience" class="work-exp">
          <h4>工作经历</h4>
          <p class="prose">{{ expert.workExperience }}</p>
        </div>
      </SectionCard>
    </template>

    <template #honors>
      <SectionCard title="资质荣誉">
        <div v-if="honors.length" class="photo-grid">
          <a v-for="(honor, idx) in honors" :key="idx" :href="honor" target="_blank" rel="noreferrer" class="photo-link">
            <img :src="honor" :alt="`资质荣誉 ${idx + 1}`" class="photo-img" />
          </a>
        </div>
        <el-empty v-else description="暂无资质荣誉" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { User, Trophy, OfficeBuilding, Right } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type DetailBadge, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import { allianceLabel, type AllianceExpert } from './shared';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const expert = ref<AllianceExpert | null>(null);
const loading = ref(true);
const enterpriseVisible = ref(true);

const breadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '企业专家列表', href: '/portal/alliance/experts' },
  { label: expert.value?.name || '' },
]);

const subtitle = computed(() =>
  [expert.value?.title, expert.value?.position].filter(Boolean).join(' · ') || undefined,
);

const badges = computed<DetailBadge[]>(() => {
  const list: DetailBadge[] = [];
  if (expert.value?.rating) list.push({ text: allianceLabel('expertRating', expert.value.rating) });
  if (expert.value) list.push({ text: allianceLabel('expertStatus', expert.value.status) });
  return list;
});

const tabDefs = computed<DetailTab[]>(() => [
  { value: 'info', label: '基本信息' },
  { value: 'introduction', label: '个人简介' },
  { value: 'honors', label: '资质荣誉', count: honors.value.length },
]);

const enterpriseName = computed(() => expert.value?.enterpriseName || expert.value?.organization);
const professionalFields = computed(() => expert.value?.professionalFields ?? []);
const specialties = computed(() => expert.value?.specialties ?? []);
const honors = computed(() => expert.value?.attachments ?? []);

async function load() {
  if (!id || !tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const e = await portalRequest<AllianceExpert>(
      `/alliance/public/experts/${id}?tenantId=${tenantId.value}`,
    );
    expert.value = e;
    if (e.enterpriseId) {
      portalRequest(`/alliance/public/enterprises/${e.enterpriseId}?tenantId=${tenantId.value}`)
        .then(() => (enterpriseVisible.value = true))
        .catch(() => (enterpriseVisible.value = false));
    }
  } catch {
    expert.value = null;
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
.self-start { align-self: start; }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.enterprise-block { margin-top: 20px; }
.enterprise-label { font-size: 14px; color: #64748b; margin-bottom: 10px; }
.enterprise-link { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; color: #0f172a; text-decoration: none; transition: color 0.2s; }
.enterprise-link:hover { color: #2563eb; }
.enterprise-text { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; color: #94a3b8; }
.field-group { margin-bottom: 16px; }
.field-label { font-size: 14px; color: #64748b; margin-bottom: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; padding: 4px 12px; border-radius: 9999px; background: #f1f5f9; color: #334155; }
.prose { color: #334155; line-height: 1.8; font-size: 15px; white-space: pre-wrap; }
.work-exp { border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px; }
.work-exp h4 { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
.photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.photo-link { display: block; }
.photo-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: opacity 0.2s; }
.photo-img:hover { opacity: 0.8; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .col-2 { grid-column: auto; } .photo-grid { grid-template-columns: repeat(2, 1fr); } .info-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
