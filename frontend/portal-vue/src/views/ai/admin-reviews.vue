<template>
  <div class="reviews-page">
    <div class="page-header">
      <h2 class="page-title">知识库/智能体审核</h2>
      <p class="page-sub">审核知识库与智能体的上架申请，管控 AI 广场内容</p>
    </div>

    <!-- 概览卡片 -->
    <el-row v-if="overview" :gutter="12" class="stats-row">
      <el-col v-for="c in overviewCards" :key="c.label" :span="3">
        <div class="stat">
          <div class="stat-label">{{ c.label }}</div>
          <div class="stat-value">{{ c.value }}</div>
        </div>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-radio-group v-model="type" @change="onFilter">
          <el-radio-button value="kb">知识库审核</el-radio-button>
          <el-radio-button value="agent">智能体审核</el-radio-button>
        </el-radio-group>
        <el-select v-model="status" style="width: 120px" @change="onFilter">
          <el-option label="待审核" value="pending" />
          <el-option label="已发布" value="published" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column label="提交人" prop="ownerName" width="110">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">{{ fmt(row.updatedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="status === 'rejected'" label="驳回理由" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.reviewComment || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="right">
          <template #default="{ row }">
            <el-button size="small" @click="goUse(row)">前往使用</el-button>
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="confirmApprove(row)">通过</el-button>
              <el-button size="small" type="danger" @click="openComment(row, 'reject')">驳回</el-button>
            </template>
            <el-button v-if="row.status === 'published'" size="small" @click="openComment(row, 'takedown')">下架</el-button>
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

    <!-- 通过确认 -->
    <el-dialog v-model="approveDialog" title="通过审核" width="460px">
      <p>通过后该内容将发布到 AI 广场，租户内全员可见。确认通过？</p>
      <template #footer>
        <el-button @click="approveDialog = false">取消</el-button>
        <el-button type="success" :loading="submitting" @click="doApprove">通过</el-button>
      </template>
    </el-dialog>

    <!-- 驳回/下架（带意见） -->
    <el-dialog v-model="commentDialog" :title="commentAction === 'reject' ? '驳回申请' : '下架内容'" width="480px">
      <p>{{ commentAction === 'reject' ? '驳回后创建者可修改后重新提交审核。' : '下架后该内容将从 AI 广场移除，回到私有状态。' }}</p>
      <p class="target-name">{{ commentTarget?.name }}</p>
      <el-input
        v-model="comment"
        type="textarea"
        :rows="4"
        :placeholder="commentAction === 'reject' ? '请填写驳回理由（必填）' : '审核意见（可选）'"
      />
      <template #footer>
        <el-button @click="commentDialog = false">取消</el-button>
        <el-button :type="commentAction === 'reject' ? 'danger' : 'primary'" :loading="submitting" @click="submitComment">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { aiCenterAdminApi } from '@/api/ai';
import type { AIAdminOverview } from '@/types/ai';

const router = useRouter();
const PAGE_SIZE = 20;

const type = ref<'kb' | 'agent'>('kb');
const status = ref<'pending' | 'published' | 'rejected'>('pending');
const page = ref(1);
const items = ref<any[]>([]);
const total = ref(0);
const loading = ref(true);
const overview = ref<AIAdminOverview | null>(null);
const submitting = ref(false);

const approveDialog = ref(false);
const approveTarget = ref<any>(null);
const commentDialog = ref(false);
const commentAction = ref<'reject' | 'takedown' | ''>('');
const commentTarget = ref<any>(null);
const comment = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const overviewCards = computed(() => {
  if (!overview.value) return [];
  const o = overview.value;
  return [
    { label: '知识库总数', value: o.kbTotal },
    { label: '待审知识库', value: o.kbPending },
    { label: '已发布知识库', value: o.kbPublished },
    { label: '智能体总数', value: o.agentTotal },
    { label: '待审智能体', value: o.agentPending },
    { label: '已发布智能体', value: o.agentPublished },
    { label: '外部 AI 服务', value: o.integrations }
  ];
});

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
      status: status.value,
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
async function loadOverview() {
  try {
    overview.value = await aiCenterAdminApi.overview();
  } catch {
    /* 概览失败不阻塞 */
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
  if (type.value === 'kb') ElMessage.info('知识库详情页待迁移');
  else router.push('/ai/chat');
}

function confirmApprove(row: any) {
  approveTarget.value = row;
  approveDialog.value = true;
}
async function doApprove() {
  if (!approveTarget.value) return;
  submitting.value = true;
  try {
    await aiCenterAdminApi.reviewAction(type.value, approveTarget.value.id, 'approve');
    ElMessage.success('操作成功');
    approveDialog.value = false;
    approveTarget.value = null;
    load();
    loadOverview();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    submitting.value = false;
  }
}

function openComment(row: any, action: 'reject' | 'takedown') {
  commentTarget.value = row;
  commentAction.value = action;
  comment.value = '';
  commentDialog.value = true;
}
async function submitComment() {
  if (!commentTarget.value) return;
  const trimmed = comment.value.trim();
  if (commentAction.value === 'reject' && !trimmed) {
    ElMessage.warning('请填写驳回理由');
    return;
  }
  submitting.value = true;
  try {
    await aiCenterAdminApi.reviewAction(type.value, commentTarget.value.id, commentAction.value as any, trimmed || undefined);
    ElMessage.success('操作成功');
    commentDialog.value = false;
    commentTarget.value = null;
    load();
    loadOverview();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  load();
  loadOverview();
});
</script>

<style scoped>
.reviews-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.stats-row { margin-bottom: 16px; }
.stat { background: #fff; border-radius: 8px; padding: 12px; text-align: center; }
.stat-label { color: #909399; font-size: 12px; }
.stat-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
.filter-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.pager { margin-top: 12px; justify-content: flex-end; }
.target-name { font-weight: 600; margin: 8px 0; }
</style>
