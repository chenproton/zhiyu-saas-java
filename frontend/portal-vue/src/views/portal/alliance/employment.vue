<template>
  <PublicListShell
    title="人才与岗位供需服务大厅"
    subtitle="浏览已发布的就业项目，查看项目岗位并在线投递"
    :icon="Briefcase"
    :tabs="tabs"
    :active-tab="tab"
    :keyword="keyword"
    placeholder="搜索项目名称、简介或发起单位..."
    :loading="loading"
    @update:active-tab="tab = $event"
    @update:keyword="keyword = $event"
  >
    <div v-if="error" class="empty">
      <el-icon :size="48" class="empty-icon"><Warning /></el-icon>
      <div class="empty-title">加载失败</div>
      <el-button type="primary" size="small" @click="load">重试</el-button>
    </div>
    <div v-else-if="filtered.length === 0" class="empty">
      <el-icon :size="48" class="empty-icon"><Briefcase /></el-icon>
      <div class="empty-title">暂无就业项目</div>
      <div class="empty-hint">发布后的就业项目会展示在这里</div>
    </div>
    <div v-else class="grid-3">
      <router-link v-for="item in filtered" :key="item.id" :to="`/portal/alliance/employment/${item.id}`" class="ecard">
        <div class="ecard-cover">
          <img v-if="item.coverImage" :src="item.coverImage" :alt="item.name" class="cover-img" />
          <GradientPlaceholder v-else :seed="item.name" :label="item.name" class="cover-img" />
          <div class="cover-overlay" />
          <div class="cover-badges">
            <span class="b-type">{{ typeLabel(item) }}</span>
            <span class="b-phase" :style="{ background: phaseBg(item) }">{{ phaseLabel(item) }}</span>
          </div>
        </div>
        <div class="ecard-body">
          <h4 class="ecard-title">{{ item.name }}</h4>
          <p class="ecard-desc">{{ item.description || '暂无项目简介' }}</p>
          <p class="ecard-org">发起单位：{{ item.organizer || '-' }}</p>
          <div class="ecard-date">
            {{ item.startDate ?? '-' }}{{ item.endDate ? ` 至 ${item.endDate}` : '' }}
          </div>
        </div>
      </router-link>
    </div>
  </PublicListShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Briefcase, Warning } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import PublicListShell from './components/PublicListShell.vue';
import GradientPlaceholder from './components/GradientPlaceholder.vue';
import {
  deriveEmploymentProjectPhase,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  fetchAllPages,
  type EmploymentProject,
} from './shared';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<EmploymentProject[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const tab = ref('all');
const keyword = ref('');

const TYPE_TABS = [
  { value: 'all', label: '全部' },
  { value: 'spring', label: '春招' },
  { value: 'autumn', label: '秋招' },
  { value: 'directed', label: '定向' },
  { value: 'order', label: '订单班' },
];

const tabs = computed(() =>
  TYPE_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? items.value.length : items.value.filter((i) => i.type === t.value).length,
  })),
);

const filtered = computed(() => {
  let list = items.value;
  if (tab.value !== 'all') list = list.filter((i) => i.type === tab.value);
  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        (i.organizer ?? '').toLowerCase().includes(q),
    );
  }
  return list;
});

function typeLabel(item: EmploymentProject) {
  return EMPLOYMENT_PROJECT_TYPE_LABELS[item.type] ?? item.type;
}
function phaseLabel(item: EmploymentProject) {
  return EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(item)];
}
function phaseBg(item: EmploymentProject) {
  const p = deriveEmploymentProjectPhase(item);
  if (p === 'ongoing') return '#10b981';
  if (p === 'preparing') return '#f59e0b';
  return '#64748b';
}

async function load() {
  if (!tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const list = await fetchAllPages((page, pageSize) =>
      portalRequest<{ items: EmploymentProject[] }>(
        `/alliance/public/employment-projects?tenantId=${tenantId.value}&limit=${pageSize}&offset=${page * pageSize}`,
      ),
    );
    items.value = list;
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
    items.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.ecard {
  display: flex; flex-direction: column; background: #fff; border: 1px solid #e7e5e4;
  border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; text-decoration: none; color: inherit; height: 100%;
}
.ecard:hover { transform: translateY(-8px); box-shadow: 0 20px 48px rgba(0,0,0,0.1); border-color: rgba(64,158,255,0.3); }
.ecard-cover { position: relative; aspect-ratio: 16 / 9; overflow: hidden; }
.cover-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.ecard:hover .cover-img { transform: scale(1.05); }
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent, transparent); }
.cover-badges { position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
.b-type { background: rgba(255,255,255,0.92); color: #1e293b; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.b-phase { color: #fff; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.ecard-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.ecard-title { font-weight: 600; color: #0f172a; font-size: 14px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.ecard:hover .ecard-title { color: #409eff; }
.ecard-desc { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 12px; min-height: 2.6em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ecard-org { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ecard-date { margin-top: auto; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; padding-top: 12px; }
.empty { text-align: center; padding: 80px 0; color: #94a3b8; background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.empty-icon { margin: 0 auto 16px; opacity: 0.3; }
.empty-title { font-size: 15px; font-weight: 500; color: #475569; }
.empty-hint { font-size: 13px; margin-top: 4px; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .grid-3 { grid-template-columns: 1fr; } }
</style>
