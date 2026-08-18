<template>
  <div class="admin-page">
    <div class="page-header">
      <div class="header-icon"><el-icon><component :is="Icon" /></el-icon></div>
      <div>
        <h2>{{ isKb ? '知识库管理' : '智能体管理' }}</h2>
        <p>{{ isKb ? '查看本租户全部待审核/已发布/已驳回知识库，可前往体验或下架' : '查看本租户全部待审核/已发布/已驳回智能体，可前往体验或下架' }}</p>
      </div>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-button
          v-for="s in STATUS_OPTIONS"
          :key="s || 'all'"
          size="small"
          :type="status === s ? 'primary' : 'default'"
          :plain="status !== s"
          round
          @click="onStatus(s)"
        >{{ s === '' ? '全部' : statusLabel(s) }}</el-button>
        <span class="total">共 {{ total }} 条</span>
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" prop="name" min-width="200" show-overflow-tooltip />
        <el-table-column v-if="isKb" label="类型" width="120">
          <template #default="{ row }">{{ row.kbType ? AI_KB_TYPE_LABELS[row.kbType as AIKBType] || row.kbType : '-' }}</template>
        </el-table-column>
        <el-table-column label="创建者" width="120">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="浏览量" width="90">
          <template #default="{ row }">{{ row.viewCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goUse(row)">前往使用</el-button>
            <el-button v-if="row.status === 'published'" size="small" @click="confirmTakedown(row)">下架</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="totalPages > 1"
        class="pager"
        layout="prev, pager, next"
        :total="total"
        :page-size="PAGE_SIZE"
        :current-page="page"
        @current-change="onPage"
      />
    </el-card>

    <el-dialog v-model="takedownDialog" title="确认下架" width="460px">
      <p>下架后将从 AI 广场移除并回到私有状态，确定下架「{{ takedownTarget?.name }}」吗？</p>
      <template #footer>
        <el-button @click="takedownDialog = false">取消</el-button>
        <el-button type="danger" :loading="acting" @click="handleTakedown">确认下架</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Collection, Cpu } from '@element-plus/icons-vue';
import { aiCenterAdminApi } from '@/api/ai';
import type { AIKBType } from '@/types/ai';
import { AI_KB_TYPE_LABELS, formatDateTime } from './ai-api';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ['', 'pending', 'published', 'rejected'] as const;

const route = useRoute();
const router = useRouter();

const type = computed<'kb' | 'agent'>(() => (route.meta.aiAdminType as 'kb' | 'agent') || 'agent');
const isKb = computed(() => type.value === 'kb');
const Icon = computed(() => (isKb.value ? Collection : Cpu));

const status = ref('');
const page = ref(1);
const total = ref(0);
const items = ref<any[]>([]);
const loading = ref(true);
const takedownDialog = ref(false);
const takedownTarget = ref<any>(null);
const acting = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

function statusLabel(s: string) {
  if (s === 'pending') return '待审核';
  if (s === 'published') return '已发布';
  if (s === 'rejected') return '已驳回';
  return s;
}
function statusType(s: string) {
  if (s === 'published') return 'success';
  if (s === 'rejected') return 'danger';
  return 'warning';
}

async function load() {
  loading.value = true;
  try {
    const res = await aiCenterAdminApi.reviews({
      type: type.value,
      status: status.value || undefined,
      page: page.value,
      pageSize: PAGE_SIZE
    });
    items.value = res.items || [];
    total.value = res.total || 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onStatus(s: string) {
  status.value = s;
  page.value = 1;
  load();
}
function onPage(p: number) {
  page.value = p;
  load();
}
function goUse(row: any) {
  router.push(isKb.value ? `/portal/apps/ai/kb/${row.id}` : `/portal/apps/ai/agents/${row.id}`);
}
function confirmTakedown(row: any) {
  takedownTarget.value = row;
  takedownDialog.value = true;
}
async function handleTakedown() {
  if (!takedownTarget.value) return;
  acting.value = true;
  try {
    await aiCenterAdminApi.reviewAction(type.value, takedownTarget.value.id, 'takedown');
    ElMessage.success('已下架');
    takedownDialog.value = false;
    takedownTarget.value = null;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-page {
  max-width: 1152px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.page-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.page-header p {
  color: #909399;
  font-size: 12px;
  margin: 4px 0 0;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.total {
  margin-left: auto;
  color: #909399;
  font-size: 13px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
