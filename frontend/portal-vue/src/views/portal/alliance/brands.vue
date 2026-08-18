<template>
  <PublicListShell
    title="品牌展示"
    subtitle="查看学校六大品牌模块建设成果，按品牌分类筛选"
    :icon="MagicStick"
    :tabs="tabs"
    :active-tab="tab"
    :keyword="keyword"
    placeholder="搜索品牌名称、描述或标签..."
    :loading="loading"
    :grid-class-name="loading ? 'grid-3' : gridClassName"
    @update:active-tab="onTabChange"
    @update:keyword="keyword = $event"
  >
    <div v-if="filtered.length === 0" class="empty">
      <el-icon :size="48" class="empty-icon"><MagicStick /></el-icon>
      <div class="empty-title">暂无品牌</div>
      <div class="empty-hint">发布后的品牌成果会展示在这里</div>
    </div>
    <div v-else :class="gridClassName">
      <BrandCards v-for="item in filtered" :key="item.id" :brand="item" :variant="item.brandType" />
    </div>
  </PublicListShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { MagicStick } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import PublicListShell from './components/PublicListShell.vue';
import BrandCards from './components/BrandCards.vue';
import { allianceLabel, brandTags, type AlliancePublicBrand } from './shared';

const auth = useAuthStore();
const route = useRoute();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const BRAND_TYPES = ['talent', 'employer', 'job', 'major', 'teacher', 'culture'];

const items = ref<AlliancePublicBrand[]>([]);
const loading = ref(true);
const keyword = ref('');

function initialTab(): string {
  const type = route.query.type;
  return typeof type === 'string' && BRAND_TYPES.includes(type) ? type : 'talent';
}
const tab = ref(initialTab());

const tabs = computed(() =>
  BRAND_TYPES.map((type) => ({
    value: type,
    label: allianceLabel('brandType', type),
    count: items.value.filter((i) => i.brandType === type).length,
  })),
);

const filtered = computed(() => {
  let list = items.value.filter((i) => i.brandType === tab.value);
  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        (i.positionName ?? '').toLowerCase().includes(q) ||
        (i.enterpriseName ?? '').toLowerCase().includes(q) ||
        brandTags(i).some((t) => t.toLowerCase().includes(q)),
    );
  }
  return list;
});

const gridClassName = computed(() => {
  switch (tab.value) {
    case 'talent':
      return 'grid-2';
    case 'employer':
    case 'job':
      return 'row-container';
    case 'teacher':
      return 'grid-6';
    default:
      return 'grid-3';
  }
});

function onTabChange(value: string) {
  tab.value = value;
}

async function load() {
  if (!tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await portalRequest<{ items: AlliancePublicBrand[] }>(
      `/alliance/public/brands?tenantId=${tenantId.value}`,
    );
    items.value = res.items || [];
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.grid-6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
.row-container { border-radius: 16px; border: 1px solid #e7e5e4; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden; }
.row-container > :deep(*) { border-bottom: 1px solid #f1f5f9; }
.row-container > :deep(*:last-child) { border-bottom: none; }
.empty { text-align: center; padding: 80px 0; color: #94a3b8; background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.empty-icon { margin: 0 auto 16px; opacity: 0.3; }
.empty-title { font-size: 15px; font-weight: 500; color: #475569; }
.empty-hint { font-size: 13px; margin-top: 4px; }
@media (max-width: 992px) { .grid-3, .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-6 { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px) { .grid-3, .grid-2, .grid-6 { grid-template-columns: 1fr; } }
</style>
