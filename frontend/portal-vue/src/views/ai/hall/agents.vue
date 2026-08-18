<template>
  <div class="hall-page">
    <div class="hall-header">
      <router-link class="back" to="/portal/apps/ai/landing">
        <el-icon><ArrowLeft /></el-icon>返回首页
      </router-link>
      <div class="header-row">
        <div class="header-icon"><el-icon><Cpu /></el-icon></div>
        <div>
          <h1>智能体大厅</h1>
          <p>租户内已发布的全部智能体，点击「立即体验」开始对话</p>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <LandingFilterRow
        label="院系"
        :items="deptLabels"
        :selected="deptSelectedLabel"
        @update:selected="onDeptSelect"
      />
      <LandingFilterRow
        label="专业"
        :items="majorLabels"
        :selected="majorSelectedLabel"
        @update:selected="onMajorSelect"
      />
      <LandingFilterRow
        label="时间"
        :items="updatedLabels"
        :selected="updatedSelectedLabel"
        :show-border="false"
        @update:selected="onUpdatedSelect"
      />

      <div class="toolbar-bottom">
        <span class="total">共 {{ total }} 个</span>
        <div class="sorts">
          <el-button
            v-for="o in sortOptions"
            :key="o.value"
            size="small"
            :type="sort === o.value ? 'primary' : 'default'"
            :plain="sort !== o.value"
            @click="setQuery({ sort: o.value === 'hot' ? '' : o.value, page: '' })"
          >{{ o.label }}</el-button>
        </div>
        <el-input v-model="qInput" class="search" placeholder="搜索智能体" clearable @keyup.enter="applySearch" @clear="applySearch" />
        <el-button size="small" @click="applySearch">搜索</el-button>
      </div>
    </div>

    <div v-loading="loading" class="content">
      <el-empty v-if="!loading && !agents.length" description="还没有已发布的智能体，去工坊创建第一个吧">
        <el-button type="primary" @click="router.push('/portal/apps/ai/studio/agents/new')">去创建</el-button>
      </el-empty>
      <template v-else>
        <div class="card-grid">
          <AgentHallCard v-for="a in agents" :key="a.id" :agent="a" />
        </div>
        <div v-if="totalPages > 1" class="pager">
          <el-pagination
            layout="prev, pager, next"
            :total="total"
            :page-size="PAGE_SIZE"
            :current-page="page"
            @current-change="(p: number) => setQuery({ page: p > 1 ? String(p) : '' })"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Cpu } from '@element-plus/icons-vue';
import { aiCenterSquareApi } from '@/api/ai';
import type { AIAgent } from '@/types/ai';
import { useClassifyDicts } from '../ai-api';
import AgentHallCard from '../components/AgentHallCard.vue';
import LandingFilterRow from '../../landing/LandingFilterRow.vue';

const PAGE_SIZE = 12;
const SORTS = ['hot', 'new', 'views'] as const;
type AgentSort = (typeof SORTS)[number];

const route = useRoute();
const router = useRouter();
const { majors, departments } = useClassifyDicts();

const agents = ref<AIAgent[]>([]);
const total = ref(0);
const qInput = ref(String(route.query.q || ''));
const loadedKey = ref<string | null>(null);

const appliedQ = computed(() => String(route.query.q || ''));
const sort = computed<AgentSort>(() => {
  const s = route.query.sort;
  return (SORTS as readonly string[]).includes(String(s)) ? (String(s) as AgentSort) : 'hot';
});
const majorId = computed(() => String(route.query.major || ''));
const departmentId = computed(() => String(route.query.dept || ''));
const updated = computed(() => String(route.query.updated || ''));
const page = computed(() => Math.max(1, parseInt(String(route.query.page || '1'), 10) || 1));
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const reqKey = computed(() => `${appliedQ.value}|${sort.value}|${majorId.value}|${departmentId.value}|${updated.value}|${page.value}`);
const loading = computed(() => loadedKey.value !== reqKey.value);

const sortOptions = [
  { value: 'hot', label: '最热' },
  { value: 'new', label: '最新' },
  { value: 'views', label: '浏览最多' }
];
const updatedOptions = [
  { v: '', label: '全部' },
  { v: '7d', label: '最近一周' },
  { v: '30d', label: '最近一月' },
  { v: '180d', label: '最近半年' }
];

const majorLabels = computed(() => ['全部', ...majors.value.map((m) => m.name)]);
const deptLabels = computed(() => ['全部', ...departments.value.map((d) => d.name)]);
const updatedLabels = computed(() => updatedOptions.map((o) => o.label));
const majorSelectedLabel = computed(() => majorId.value ? majors.value.find((m) => m.id === majorId.value)?.name || '全部' : '全部');
const deptSelectedLabel = computed(() => departmentId.value ? departments.value.find((d) => d.id === departmentId.value)?.name || '全部' : '全部');
const updatedSelectedLabel = computed(() => updatedOptions.find((o) => o.v === updated.value)?.label || '全部');

function setQuery(patch: Record<string, string>) {
  const params = new URLSearchParams(route.query as Record<string, string>);
  for (const [k, v] of Object.entries(patch)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  router.replace({ query: Object.fromEntries(params) });
}

async function load() {
  try {
    const res = await aiCenterSquareApi.agents({
      q: appliedQ.value || undefined,
      sort: sort.value,
      page: page.value,
      pageSize: PAGE_SIZE,
      majorId: majorId.value || undefined,
      departmentId: departmentId.value || undefined,
      updated: (updated.value || undefined) as '7d' | '30d' | '180d' | undefined
    });
    agents.value = res.items;
    total.value = res.total;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loadedKey.value = reqKey.value;
  }
}

function applySearch() {
  setQuery({ q: qInput.value.trim(), page: '' });
}
function onDeptSelect(label: string) {
  setQuery({ dept: departments.value.find((d) => d.name === label)?.id || '', page: '' });
}
function onMajorSelect(label: string) {
  setQuery({ major: majors.value.find((m) => m.name === label)?.id || '', page: '' });
}
function onUpdatedSelect(label: string) {
  setQuery({ updated: updatedOptions.find((o) => o.label === label)?.v || '', page: '' });
}

watch(reqKey, load, { immediate: true });
</script>

<style scoped>
.hall-page {
  max-width: 1400px;
  margin: 0 auto;
}
.hall-header {
  background: linear-gradient(135deg, #409eff, #79bbff);
  border-radius: 0 0 16px 16px;
  padding: 24px 28px;
  color: #fff;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  text-decoration: none;
  margin-bottom: 12px;
}
.back:hover {
  color: #fff;
}
.header-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.header-row h1 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.header-row p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin: 4px 0 0;
}
.toolbar {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  padding: 4px 20px;
  margin-top: 16px;
}
.toolbar-bottom {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
}
.total {
  color: #909399;
  font-size: 14px;
}
.sorts {
  display: flex;
  gap: 4px;
}
.search {
  width: 260px;
  margin-left: auto;
}
.content {
  margin-top: 16px;
  min-height: 200px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}
.pager {
  display: flex;
  justify-content: center;
  padding: 20px 0 24px;
}
</style>
