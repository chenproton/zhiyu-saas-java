<template>
  <div class="my-resources">
    <el-card shadow="never" class="summary-card">
      <div class="summary">
        <div class="count">{{ currentCount }}</div>
        <div class="label">{{ currentLabel }} · 共 {{ currentCount }} 项</div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="card-title">我的资源</span>
      </template>
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="知识点库" name="knowledge" />
        <el-tab-pane label="能力点库" name="ability" />
        <el-tab-pane label="证书库" name="certificates" />
        <el-tab-pane v-for="kind in resourceKinds" :key="kind" :label="resourceTypeLabels[kind]" :name="'resource:' + kind" />
        <el-tab-pane label="现场问答题库" name="questions" />
      </el-tabs>

      <el-table v-loading="currentLoading" :data="currentItems" stripe>
        <el-table-column
          v-for="col in currentColumns"
          :key="col.label"
          :label="col.label"
          :prop="col.prop"
          :formatter="col.formatter"
          show-overflow-tooltip
        />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { knowledgeApi } from '@/api/lesson';
import { abilityApi, certificateLibraryApi } from '@/api/job';
import { onSiteQuestionLibraryApi, resourceLibraryApi } from '@/api/library';
import { RESOURCE_TYPE_LABELS, type ResourceKind } from '@/types/library';
import type { KnowledgePoint } from '@/types/lesson';
import type { AbilityPoint, CertificateLibraryItem } from '@/types/job';
import type { OnSiteQuestionLibraryItem, ResourceLibraryItem } from '@/types/library';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const userId = computed(() => auth.user?.id || '');

const resourceKinds = Object.keys(RESOURCE_TYPE_LABELS) as ResourceKind[];
const resourceTypeLabels = RESOURCE_TYPE_LABELS;

const activeTab = ref('knowledge');
const knowledgeItems = ref<KnowledgePoint[]>([]);
const abilityItems = ref<AbilityPoint[]>([]);
const certificateItems = ref<CertificateLibraryItem[]>([]);
const questionItems = ref<OnSiteQuestionLibraryItem[]>([]);
const resourceItemsMap = reactive<Record<string, ResourceLibraryItem[]>>({});
const loading = reactive<Record<string, boolean>>({});
const loaded = reactive<Record<string, boolean>>({});

interface Column {
  label: string;
  prop?: string;
  formatter?: (row: unknown) => string;
}

const knowledgeColumns: Column[] = [
  { label: '名称', prop: 'name' },
  { label: '编码', prop: 'code' },
  { label: '描述', prop: 'description' }
];
const abilityColumns: Column[] = [
  { label: '名称', prop: 'name' },
  { label: '分类', formatter: (row) => (row as AbilityPoint).attributes?.join('、') || '-' },
  { label: '描述', prop: 'description' }
];
const certificateColumns: Column[] = [
  { label: '名称', prop: 'name' },
  { label: '描述', prop: 'description' },
  { label: '链接', prop: 'url' }
];
const resourceColumns: Column[] = [
  { label: '名称', prop: 'name' },
  { label: '描述', prop: 'description' }
];
const questionColumns: Column[] = [
  { label: '题目', prop: 'questionText' },
  { label: '题型', prop: 'questionType' },
  { label: '分值', prop: 'score' }
];

const currentItems = computed<unknown[]>(() => {
  if (activeTab.value === 'knowledge') return knowledgeItems.value;
  if (activeTab.value === 'ability') return abilityItems.value;
  if (activeTab.value === 'certificates') return certificateItems.value;
  if (activeTab.value === 'questions') return questionItems.value;
  const kind = activeTab.value.replace('resource:', '') as ResourceKind;
  return resourceItemsMap[kind] || [];
});
const currentColumns = computed<Column[]>(() => {
  if (activeTab.value === 'knowledge') return knowledgeColumns;
  if (activeTab.value === 'ability') return abilityColumns;
  if (activeTab.value === 'certificates') return certificateColumns;
  if (activeTab.value === 'questions') return questionColumns;
  return resourceColumns;
});
const currentLoading = computed(() => loading[activeTab.value] || false);
const currentCount = computed(() => currentItems.value.length);
const currentLabel = computed(() => {
  if (activeTab.value === 'knowledge') return '知识点库';
  if (activeTab.value === 'ability') return '能力点库';
  if (activeTab.value === 'certificates') return '证书库';
  if (activeTab.value === 'questions') return '现场问答题库';
  return resourceTypeLabels[activeTab.value.replace('resource:', '') as ResourceKind];
});

// 后端列表接口上限 maxPageSize=200，分页全量拉取避免静默截断（对齐 React fetchAllPages）
async function fetchAllPages<T>(
  fn: (limit: number, offset: number) => Promise<{ items: T[]; total?: number }>
): Promise<T[]> {
  const PAGE = 200;
  const all: T[] = [];
  for (let p = 0; p < 1000; p++) {
    const res = await fn(PAGE, p * PAGE);
    const its = res.items || [];
    all.push(...its);
    if (its.length < PAGE) break;
  }
  return all;
}

async function loadKnowledge() {
  if (loaded.knowledge) return;
  loading.knowledge = true;
  try {
    knowledgeItems.value = await fetchAllPages((limit, offset) =>
      knowledgeApi.list({ creatorId: userId.value, limit, offset })
    );
    loaded.knowledge = true;
  } catch {
    ElMessage.error('加载知识点失败');
  } finally {
    loading.knowledge = false;
  }
}
async function loadAbility() {
  if (loaded.ability) return;
  loading.ability = true;
  try {
    abilityItems.value = await fetchAllPages((limit, offset) =>
      abilityApi.list({ creatorId: userId.value, limit, offset })
    );
    loaded.ability = true;
  } catch {
    ElMessage.error('加载能力点失败');
  } finally {
    loading.ability = false;
  }
}
async function loadCertificates() {
  if (loaded.certificates) return;
  loading.certificates = true;
  try {
    certificateItems.value = await fetchAllPages((limit, offset) =>
      certificateLibraryApi.list({ creatorId: userId.value, limit, offset })
    );
    loaded.certificates = true;
  } catch {
    ElMessage.error('加载证书失败');
  } finally {
    loading.certificates = false;
  }
}
async function loadQuestions() {
  if (loaded.questions) return;
  loading.questions = true;
  try {
    questionItems.value = await fetchAllPages((limit, offset) =>
      onSiteQuestionLibraryApi.list({ creatorId: userId.value, limit, offset })
    );
    loaded.questions = true;
  } catch {
    ElMessage.error('加载问答题失败');
  } finally {
    loading.questions = false;
  }
}
async function loadResourceKind(kind: ResourceKind) {
  const key = 'resource:' + kind;
  if (loaded[key]) return;
  loading[key] = true;
  try {
    resourceItemsMap[kind] = await fetchAllPages((limit, offset) =>
      resourceLibraryApi.list({ uploadedBy: userId.value, resourceType: kind, limit, offset })
    );
    loaded[key] = true;
  } catch {
    ElMessage.error('加载资源失败');
  } finally {
    loading[key] = false;
  }
}

function onTabChange(name: string | number) {
  const n = String(name);
  if (n === 'knowledge') loadKnowledge();
  else if (n === 'ability') loadAbility();
  else if (n === 'certificates') loadCertificates();
  else if (n === 'questions') loadQuestions();
  else if (n.startsWith('resource:')) loadResourceKind(n.replace('resource:', '') as ResourceKind);
}

onMounted(loadKnowledge);
</script>

<style scoped>
.my-resources { padding: 16px; }
.summary-card { margin-bottom: 16px; }
.summary { display: flex; align-items: center; gap: 12px; }
.count { font-size: 28px; font-weight: 700; color: #409eff; }
.label { color: #909399; font-size: 13px; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
