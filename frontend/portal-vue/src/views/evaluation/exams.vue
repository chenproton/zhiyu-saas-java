<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">试卷管理</span>
          <el-button type="primary" @click="openAdd">新建试卷</el-button>
        </div>
      </template>

      <el-input v-model="searchQuery" placeholder="搜索试卷名称..." clearable style="max-width: 320px; margin-bottom: 12px" @input="onSearch" @clear="onSearch" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="总分" width="90">
          <template #default="{ row }">{{ row.totalScore ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="时长(分)" width="100">
          <template #default="{ row }">{{ row.duration ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="题目数" width="90">
          <template #default="{ row }">{{ row.questionCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ contentStatusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'draft'" size="small" type="primary" @click="wf.submit(row.id)">提交审批</el-button>
            <el-button v-if="row.status === 'approved'" size="small" type="success" @click="wf.publish(row.id)">发布</el-button>
            <el-button v-if="row.status === 'published'" size="small" @click="wf.archive(row.id)">归档</el-button>
            <el-button size="small" @click="goEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>

    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑试卷' : '新建试卷'" width="520px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="试卷名称" /></el-form-item>
        <el-form-item label="总分"><el-input-number v-model="form.totalScore" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="时长(分)"><el-input-number v-model="form.duration" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="试卷简介" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { examApi } from '@/api/evaluation';
import type { Exam } from '@/types/evaluation';
import { contentStatusLabel } from '@/types/content-status';
import { useContentWorkflow } from '@/composables/useContentWorkflow';

const PAGE_SIZE = 200;
const items = ref<Exam[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const dialogOpen = ref(false);
const editingItem = ref<Exam | null>(null);
const submitting = ref(false);
const form = reactive({ name: '', totalScore: 100, duration: 60, description: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await examApi.list({
      ...(searchQuery.value ? { search: searchQuery.value } : {}),
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

const wf = useContentWorkflow(examApi, loadItems);

const router = useRouter();
function goEdit(row: Exam) {
  router.push(`/evaluation/exams/${row.id}/edit`);
}
function openAdd() {
  editingItem.value = null;
  Object.assign(form, { name: '', totalScore: 100, duration: 60, description: '' });
  dialogOpen.value = true;
}
function openEdit(item: Exam) {
  editingItem.value = item;
  Object.assign(form, { name: item.name, totalScore: item.totalScore, duration: item.duration, description: item.description || '' });
  dialogOpen.value = true;
}
async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload = { name: form.name.trim(), totalScore: form.totalScore, duration: form.duration, description: form.description.trim() || undefined };
    if (editingItem.value) {
      await examApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await examApi.create(payload);
      ElMessage.success('创建成功');
    }
    dialogOpen.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}
async function confirmDelete(item: Exam) {
  try {
    await ElMessageBox.confirm('确定要删除该试卷吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await examApi.delete(item.id);
    ElMessage.success('删除成功');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
