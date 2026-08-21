<template>
  <PublicListShell
    title="合作项目"
    subtitle="查看全部校企合作项目，按项目阶段筛选"
    :icon="Folder"
    :tabs="tabs"
    :active-tab="tab"
    :keyword="keyword"
    placeholder="搜索项目名称或描述..."
    :loading="loading"
    @update:active-tab="tab = $event"
    @update:keyword="keyword = $event"
  >
    <div v-if="filtered.length === 0" class="empty">
      <el-icon :size="48" class="empty-icon"><Folder /></el-icon>
      <div class="empty-title">暂无合作项目</div>
      <div class="empty-hint">发布后的合作项目会展示在这里</div>
    </div>
    <div v-else class="grid-3">
      <ProjectCard v-for="item in filtered" :key="item.id" :project="item" />
    </div>
  </PublicListShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Folder } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import PublicListShell from './components/PublicListShell.vue';
import ProjectCard from './components/ProjectCard.vue';
import { fetchAllPages, type AllianceProject } from './shared';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<AllianceProject[]>([]);
const loading = ref(true);
const tab = ref('all');
const keyword = ref('');

const PHASE_TABS = [
  { value: 'initiation', label: '启动' },
  { value: 'execution', label: '执行中' },
  { value: 'acceptance', label: '验收' },
  { value: 'closure', label: '已完成' },
];

const tabs = computed(() => [
  { value: 'all', label: '全部项目', count: items.value.length },
  ...PHASE_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: items.value.filter((i) => i.phase === t.value).length,
  })),
]);

const filtered = computed(() => {
  let list = items.value;
  if (tab.value !== 'all') list = list.filter((i) => i.phase === tab.value);
  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();
    list = list.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
    );
  }
  return list;
});

async function load() {
  if (!tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const list = await fetchAllPages((page, pageSize) =>
      portalRequest<{ items: AllianceProject[] }>(
        `/alliance/public/projects?tenantId=${tenantId.value}&limit=${pageSize}&offset=${page * pageSize}`,
      ),
    );
    items.value = list;
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.empty { text-align: center; padding: 80px 0; color: #94a3b8; background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.empty-icon { margin: 0 auto 16px; opacity: 0.3; }
.empty-title { font-size: 15px; font-weight: 500; color: #475569; }
.empty-hint { font-size: 13px; margin-top: 4px; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .grid-3 { grid-template-columns: 1fr; } }
</style>
