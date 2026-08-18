<template>
  <div class="admin-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ isKb ? '知识库管理' : '智能体管理' }}</h2>
        <p class="page-sub">{{ isKb ? '查看本租户全部待审核/已发布/已驳回知识库，可前往体验或下架' : '查看本租户全部待审核/已发布/已驳回智能体，可前往体验或下架' }}</p>
      </div>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-radio-group v-model="status" @change="onFilter">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="pending">待审核</el-radio-button>
          <el-radio-button value="published">已发布</el-radio-button>
          <el-radio-button value="rejected">已驳回</el-radio-button>
        </el-radio-group>
        <span class="total">共 {{ total }} 条</span>
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" prop="name" min-width="200" show-overflow-tooltip />
        <el-table-column v-if="isKb" label="类型" width="110">
          <template #default="{ row }">{{ row.kbType ? kbTypeLabels[row.kbType] || row.kbType : '-' }}</template>
        </el-table-column>
        <el-table-column label="创建者" prop="ownerName" width="120">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="浏览量" prop="viewCount" width="90" />
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">{{ fmt(row.updatedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="goUse(row)">前往使用</el-button>
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
import { aiCenterAdminApi } from '@/api/ai';
import { AI_KB_TYPE_LABELS } from '@/types/ai';

const route = useRoute();
const router = useRouter();
const PAGE_SIZE = 20;
const kbTypeLabels = AI_KB_TYPE_LABELS as Record<string, string>;

const type = computed<'kb' | 'agent'>(() => (route.meta.aiAdminType as 'kb' | 'agent') || 'agent');
const isKb = computed(() => type.value === 'kb');

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
function fmt(d?: string) {
  return d ? new Date(d).toLocaleString() : '-';
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

function onFilter() {
  page.value = 1;
  load();
}
function onPage(p: number) {
  page.value = p;
  load();
}
function goUse(row: any) {
  if (isKb.value) {
    ElMessage.info('知识库详情页待迁移');
  } else {
    router.push('/ai/chat');
  }
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
.admin-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.filter-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.total { color: #909399; font-size: 13px; }
.pager { margin-top: 12px; justify-content: flex-end; }
</style>
