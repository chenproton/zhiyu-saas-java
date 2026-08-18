<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">审批中心</span>
          <div>
            <el-button size="small" type="success" :disabled="!selection.length" @click="batchReview('approved')">批量通过</el-button>
            <el-button size="small" type="danger" :disabled="!selection.length" @click="batchReview('rejected')">批量驳回</el-button>
          </div>
        </div>
      </template>

      <el-radio-group v-model="statusFilter" class="filter-bar" @change="loadItems">
        <el-radio-button value="pending">待我审批</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
        <el-radio-button value="">全部</el-radio-button>
      </el-radio-group>

      <el-table v-loading="loading" :data="items" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column label="目标类型" width="140">
          <template #default="{ row }">{{ targetTypeLabel(row.targetType) }}</template>
        </el-table-column>
        <el-table-column prop="targetId" label="目标ID" width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="currentStepIdx" label="步骤" width="70" />
        <el-table-column prop="createdAt" label="提交时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="review(row, 'approved')">通过</el-button>
              <el-button size="small" type="danger" @click="review(row, 'rejected')">驳回</el-button>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>

    <!-- 审批意见弹窗 -->
    <el-dialog v-model="reviewDialog" :title="reviewAction === 'approved' ? '通过审批' : '驳回审批'" width="460px">
      <el-input v-model="comment" type="textarea" :rows="3" placeholder="审批意见（可选）" />
      <template #footer>
        <el-button @click="reviewDialog = false">取消</el-button>
        <el-button :type="reviewAction === 'approved' ? 'success' : 'danger'" :loading="reviewing" @click="confirmReview">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { approvalApi } from '@/api/approval';
import type { ApprovalRecord } from '@/types/approval';

const PAGE_SIZE = 100;
const items = ref<ApprovalRecord[]>([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const statusFilter = ref('pending');
const selection = ref<ApprovalRecord[]>([]);
const reviewDialog = ref(false);
const reviewing = ref(false);
const reviewAction = ref<'approved' | 'rejected'>('approved');
const comment = ref('');
let reviewTarget: ApprovalRecord | null = null;

const TARGET_TYPE_LABELS: Record<string, string> = {
  career_position: '岗位',
  scenario: '场景',
  course: '课程',
  exam: '试卷',
  question_bank: '题库',
  training_program: '人培方案',
  teaching_plan: '教学计划'
};
function targetTypeLabel(t: string) {
  return TARGET_TYPE_LABELS[t] || t;
}
function statusLabel(s: string) {
  return s === 'pending' ? '待审批' : s === 'approved' ? '已通过' : '已驳回';
}
function statusTag(s: string) {
  return s === 'pending' ? 'warning' : s === 'approved' ? 'success' : 'danger';
}

function onSelectionChange(v: ApprovalRecord[]) {
  selection.value = v;
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await approvalApi.list({
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
    });
    items.value = res.items;
    total.value = res.total ?? 0;
    selection.value = [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function review(row: ApprovalRecord, action: 'approved' | 'rejected') {
  reviewTarget = row;
  reviewAction.value = action;
  comment.value = '';
  reviewDialog.value = true;
}

async function confirmReview() {
  if (!reviewTarget) return;
  reviewing.value = true;
  try {
    await approvalApi.review(reviewTarget.id, { status: reviewAction.value, comment: comment.value.trim() || undefined });
    ElMessage.success(reviewAction.value === 'approved' ? '已通过' : '已驳回');
    reviewDialog.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    reviewing.value = false;
  }
}

async function batchReview(action: 'approved' | 'rejected') {
  const ids = selection.value.map((r) => r.id);
  if (!ids.length) return;
  for (const id of ids) {
    try {
      await approvalApi.review(id, { status: action });
    } catch (e) {
      ElMessage.error(`${id} 操作失败: ${(e as Error).message}`);
    }
  }
  ElMessage.success('批量操作完成');
  loadItems();
}

onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.filter-bar { margin-bottom: 12px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
