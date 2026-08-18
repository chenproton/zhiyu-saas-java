<template>
  <div class="square-page">
    <div class="page-header">
      <h2 class="page-title">AI 广场</h2>
      <p class="page-sub">租户内已发布的智能体与知识库</p>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="智能体大厅" name="agents" />
        <el-tab-pane label="知识库大厅" name="kbs" />
      </el-tabs>

      <!-- 搜索 + 排序 -->
      <div class="filter-bar">
        <el-input v-model="qInput" :placeholder="activeTab === 'agents' ? '搜索智能体' : '搜索知识库'" clearable style="max-width: 260px" @keyup.enter="applySearch" />
        <el-button @click="applySearch">搜索</el-button>
        <el-select v-model="sort" style="width: 130px" @change="loadData">
          <el-option v-for="o in sortOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>

      <!-- 分类筛选 -->
      <div class="filter-rows">
        <div class="filter-row">
          <span class="filter-label">院系</span>
          <el-select v-model="departmentId" clearable placeholder="全部" style="width: 150px" @change="loadData">
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </div>
        <div class="filter-row">
          <span class="filter-label">专业</span>
          <el-select v-model="majorId" clearable placeholder="全部" style="width: 150px" @change="loadData">
            <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </div>
        <div v-if="activeTab === 'kbs'" class="filter-row">
          <span class="filter-label">类型</span>
          <el-select v-model="kbType" clearable placeholder="全部" style="width: 150px" @change="loadData">
            <el-option v-for="(label, key) in kbTypeLabels" :key="key" :label="label" :value="key" />
          </el-select>
        </div>
        <div class="filter-row">
          <span class="filter-label">时间</span>
          <el-select v-model="updated" clearable placeholder="全部" style="width: 150px" @change="loadData">
            <el-option label="最近一周" value="7d" />
            <el-option label="最近一月" value="30d" />
            <el-option label="最近半年" value="180d" />
          </el-select>
        </div>
      </div>

      <!-- 标签 chips（知识库） -->
      <div v-if="activeTab === 'kbs' && tagOptions.length" class="tag-row">
        <el-tag
          v-for="t in tagOptions"
          :key="t"
          :effect="tag === t ? 'dark' : 'plain'"
          class="tag-chip"
          @click="selectTag(t)"
        >{{ t }}</el-tag>
      </div>

      <!-- 卡片网格 -->
      <div v-loading="loading" class="card-grid">
        <el-empty v-if="!loading && items.length === 0" :description="activeTab === 'agents' ? '还没有已发布的智能体' : '还没有已发布的知识库'" />
        <el-card v-for="item in items" :key="item.id" shadow="hover" class="hall-card">
          <div class="card-head">
            <div class="card-avatar">{{ (item.name || '?').charAt(0) }}</div>
            <div class="card-title-wrap">
              <div class="card-title">{{ item.name }}</div>
              <div class="card-owner">{{ item.ownerName || '-' }}</div>
            </div>
          </div>
          <div class="card-desc">{{ item.description || '-' }}</div>
          <div class="card-tags" v-if="item.tags && item.tags.length">
            <el-tag v-for="t in item.tags" :key="t" size="small" type="info" class="card-tag">{{ t }}</el-tag>
          </div>
          <div class="card-foot">
            <span v-if="activeTab === 'agents'">热度 {{ item.chatCount ?? 0 }}</span>
            <span v-else>提问 {{ item.askCount ?? 0 }} · 资源 {{ item.docCount ?? 0 }}</span>
            <span>浏览 {{ item.viewCount ?? 0 }}</span>
            <el-button size="small" type="primary" @click="openItem(item)">立即体验</el-button>
          </div>
        </el-card>
      </div>

      <!-- 分页 -->
      <el-pagination
        v-if="total > pageSize"
        class="pager"
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPage"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { aiCenterSquareApi } from '@/api/ai';
import { majorApi, organizationApi } from '@/api/system';
import { AI_KB_TYPE_LABELS } from '@/types/ai';
import type { AIAgent, AIKnowledgeBase } from '@/types/ai';

const router = useRouter();
const PAGE_SIZE = 12;
const kbTypeLabels = AI_KB_TYPE_LABELS as Record<string, string>;

const activeTab = ref<'agents' | 'kbs'>('agents');
const qInput = ref('');
const q = ref('');
const sort = ref('hot');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const majorId = ref('');
const departmentId = ref('');
const kbType = ref('');
const updated = ref('');
const tag = ref('');

const items = ref<any[]>([]);
const majors = ref<{ id: string; name: string }[]>([]);
const departments = ref<{ id: string; name: string }[]>([]);
const loading = ref(false);

const agentSorts = [
  { value: 'hot', label: '最热' },
  { value: 'new', label: '最新' },
  { value: 'views', label: '浏览最多' }
];
const kbSorts = [
  { value: 'hot', label: '综合排序' },
  { value: 'new', label: '最新创建' },
  { value: 'updated', label: '最近更新' },
  { value: 'docs', label: '资源最多' },
  { value: 'views', label: '浏览最多' }
];
const sortOptions = computed(() => (activeTab.value === 'agents' ? agentSorts : kbSorts));
const tagOptions = computed(() => {
  const set = new Set<string>();
  if (tag.value) set.add(tag.value);
  items.value.forEach((i) => ((i as AIKnowledgeBase).tags || []).forEach((t) => set.add(t)));
  return Array.from(set);
});

async function loadData() {
  loading.value = true;
  try {
    if (activeTab.value === 'agents') {
      const res = await aiCenterSquareApi.agents({
        q: q.value || undefined,
        sort: sort.value as any,
        page: page.value,
        pageSize,
        majorId: majorId.value || undefined,
        departmentId: departmentId.value || undefined,
        updated: (updated.value || undefined) as any
      });
      items.value = res.items;
      total.value = res.total || 0;
    } else {
      const res = await aiCenterSquareApi.kbs({
        q: q.value || undefined,
        tag: tag.value || undefined,
        sort: sort.value as any,
        page: page.value,
        pageSize,
        majorId: majorId.value || undefined,
        departmentId: departmentId.value || undefined,
        kbType: (kbType.value || undefined) as any,
        updated: (updated.value || undefined) as any
      });
      items.value = res.items;
      total.value = res.total || 0;
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  q.value = qInput.value.trim();
  page.value = 1;
  loadData();
}
function onTabChange() {
  qInput.value = '';
  q.value = '';
  sort.value = 'hot';
  page.value = 1;
  tag.value = '';
  kbType.value = '';
  loadData();
}
function onPage(p: number) {
  page.value = p;
  loadData();
}
function selectTag(t: string) {
  tag.value = tag.value === t ? '' : t;
  page.value = 1;
  loadData();
}
function openItem(item: AIAgent | AIKnowledgeBase) {
  if (activeTab.value === 'agents') {
    router.push('/ai/chat');
  } else {
    ElMessage.info('知识库详情');
  }
}

async function loadDicts() {
  try {
    const [majorRes, orgRes] = await Promise.all([
      majorApi.list({ limit: 500 }),
      organizationApi.tree()
    ]);
    majors.value = (majorRes.items || []).map((m) => ({ id: m.id, name: m.name }));
    // 部门：取组织树顶层节点作为「院系」筛选项
    const flat: { id: string; name: string }[] = [];
    const walk = (nodes: any[]) => nodes.forEach((n) => { flat.push({ id: n.id, name: n.name }); if (n.children) walk(n.children); });
    walk(orgRes.items || []);
    departments.value = flat.slice(0, 100);
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  loadDicts();
  loadData();
});
</script>

<style scoped>
.square-page { padding: 16px; }
.page-header { margin-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.filter-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.filter-rows { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
.filter-row { display: flex; align-items: center; gap: 8px; }
.filter-label { color: #606266; font-size: 13px; }
.tag-row { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip { cursor: pointer; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; min-height: 120px; }
.hall-card { cursor: pointer; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.card-avatar { width: 40px; height: 40px; border-radius: 50%; background: #ecf5ff; color: #409eff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.card-title { font-weight: 600; }
.card-owner { color: #909399; font-size: 12px; }
.card-desc { color: #606266; font-size: 13px; min-height: 36px; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.card-tag { margin: 0; }
.card-foot { display: flex; align-items: center; gap: 12px; color: #909399; font-size: 12px; }
.card-foot .el-button { margin-left: auto; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
