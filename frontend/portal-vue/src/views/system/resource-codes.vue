<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">资源编码管理</h1>
        <p class="page-desc">查看系统资源类型编码</p>
      </div>
    </div>

    <el-input
      v-model="searchTerm"
      placeholder="搜索编码名称或代码..."
      clearable
      style="max-width: 320px; margin-bottom: 16px"
    />

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 16px">
      <template #default>
        <el-button size="small" text type="primary" @click="loadItems">重试</el-button>
      </template>
    </el-alert>

    <el-alert
      type="info"
      :closable="false"
      title="仅可通过租户 License 导入资源编码，不支持手动新增、编辑或删除"
      style="margin-bottom: 16px"
    />

    <el-card shadow="never">
      <el-table v-loading="loading" :data="filteredCodes" stripe :empty-text="loading ? '加载中...' : '暂无资源编码'">
        <el-table-column label="编码" min-width="140">
          <template #default="{ row }"><span class="cell-mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column label="名称" min-width="160">
          <template #default="{ row }"><span class="cell-strong">{{ row.name }}</span></template>
        </el-table-column>
        <el-table-column label="说明" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag type="info">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">{{ row.createdAt }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { portalRequest, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';

interface ResourceCode {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  type: 'public' | 'custom';
  createdAt: string;
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const codes = ref<ResourceCode[]>([]);
const loading = ref(true);
const error = ref('');
const searchTerm = ref('');

const filteredCodes = computed<ResourceCode[]>(() => {
  const keyword = searchTerm.value.trim();
  if (!keyword) return codes.value;
  return codes.value.filter((c) => c.name.includes(keyword) || c.code.includes(keyword));
});

function typeLabel(type?: string): string {
  if (type === 'public') return '公共编码';
  if (type === 'custom') return '自定义编码';
  return type || '公共编码';
}

async function loadItems() {
  if (!tenantId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await portalRequest<ListResponse<ResourceCode>>(
      `/resource-codes${buildQuery({ tenantId: tenantId.value, limit: 1000 })}`
    );
    codes.value = res.items;
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.page-desc { color: #909399; font-size: 13px; margin: 4px 0 0; }
.cell-strong { font-weight: 500; }
.cell-mono { font-family: monospace; font-size: 13px; }
</style>
