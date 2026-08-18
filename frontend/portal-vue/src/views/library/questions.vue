<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">现场问答</span>
          <el-button type="primary" @click="openDialog()">新建问答</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="questionText" label="问题" min-width="240" show-overflow-tooltip />
        <el-table-column prop="answer" label="答案" min-width="200" show-overflow-tooltip />
        <el-table-column prop="questionType" label="类型" width="100" />
        <el-table-column prop="score" label="分值" width="80" />
        <el-table-column prop="difficulty" label="难度" width="80" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑问答' : '新建问答'" width="520px">
      <el-form label-width="80px">
        <el-form-item label="问题"><el-input v-model="form.questionText" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="答案"><el-input v-model="form.answer" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.questionType" placeholder="如 oral/written" /></el-form-item>
        <el-form-item label="分值"><el-input-number v-model="form.score" :min="0" /></el-form-item>
        <el-form-item label="难度">
          <el-select v-model="form.difficulty" style="width: 160px">
            <el-option label="简单" value="easy" />
            <el-option label="中等" value="medium" />
            <el-option label="困难" value="hard" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { onSiteQuestionLibraryApi } from '@/api/library';
import type { OnSiteQuestionLibraryItem } from '@/types/library';

const PAGE_SIZE = 200;
const items = ref<OnSiteQuestionLibraryItem[]>([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const dialog = ref(false);
const saving = ref(false);
const editing = ref<OnSiteQuestionLibraryItem | null>(null);
const form = reactive({ questionText: '', answer: '', questionType: 'oral', score: 1, difficulty: 'medium' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await onSiteQuestionLibraryApi.list({ limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE });
    items.value = res.items;
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: OnSiteQuestionLibraryItem) {
  editing.value = row || null;
  form.questionText = row?.questionText || '';
  form.answer = row?.answer || '';
  form.questionType = row?.questionType || 'oral';
  form.score = row?.score ?? 1;
  form.difficulty = row?.difficulty || 'medium';
  dialog.value = true;
}
async function save() {
  if (!form.questionText.trim()) {
    ElMessage.warning('问题不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      questionText: form.questionText.trim(),
      answer: form.answer.trim() || undefined,
      questionType: form.questionType.trim(),
      score: form.score,
      difficulty: form.difficulty
    };
    if (editing.value) {
      await onSiteQuestionLibraryApi.update(editing.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await onSiteQuestionLibraryApi.create(payload);
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}
async function confirmDelete(row: OnSiteQuestionLibraryItem) {
  try {
    await ElMessageBox.confirm('确定要删除该问答吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await onSiteQuestionLibraryApi.delete(row.id);
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
