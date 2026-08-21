<template>
  <div class="landing">
    <div class="landing-header">
      <h2>{{ title }}</h2>
      <el-input v-model="keyword" placeholder="搜索..." clearable style="max-width: 320px" @input="onSearch" @clear="onSearch" />
    </div>

    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="item in items" :key="item.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="item-card" @click="openDetail(item)">
          <div class="item-name">{{ item[nameField] || '-' }}</div>
          <div v-if="subtitleField" class="item-desc">{{ item[subtitleField] || '暂无描述' }}</div>
          <div class="item-meta">
            <el-tag v-if="item.status" size="small">{{ contentStatusLabel(item.status) }}</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-empty v-if="!loading && !items.length" description="暂无内容" />

    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next, total"
      class="pagination"
      @current-change="loadItems"
    />

    <el-drawer v-model="drawer" :title="detail?.[nameField]" size="480px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item v-for="f in detailFields" :key="f.key" :label="f.label">
            {{ detail[f.key] ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { contentStatusLabel } from '@/types/content-status';

interface ListApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[]; total?: number }>;
  get?: (id: string) => Promise<any>;
}

const props = defineProps<{
  title: string;
  api: ListApi;
  nameField?: string;
  subtitleField?: string;
  detailFields?: { key: string; label: string }[];
}>();

const nameField = props.nameField || 'name';
const subtitleField = props.subtitleField || 'description';
const detailFields = props.detailFields || [];

const PAGE_SIZE = 20;
const items = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const drawer = ref(false);
const detail = ref<any | null>(null);

async function loadItems() {
  loading.value = true;
  try {
    const res = await props.api.list({
      ...(keyword.value ? { keyword: keyword.value } : {}),
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
    });
    items.value = res.items;
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function onSearch() {
  page.value = 1;
  loadItems();
}
async function openDetail(item: any) {
  drawer.value = true;
  detail.value = item;
  if (props.api.get) {
    try {
      detail.value = await props.api.get(item.id);
    } catch {
      /* 保留列表数据 */
    }
  }
}
onMounted(loadItems);
</script>

<style scoped>
.landing { padding: 8px; }
.landing-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.item-card { cursor: pointer; margin-bottom: 16px; }
.item-name { font-size: 16px; font-weight: 600; }
.item-desc { font-size: 13px; color: #606266; margin: 4px 0; height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.item-meta { margin-top: 8px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
