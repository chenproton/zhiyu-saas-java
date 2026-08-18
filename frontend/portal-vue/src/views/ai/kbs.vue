<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">AI 知识库</span>
          <el-button type="primary" @click="openDialog()">新建知识库</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ kbTypeLabel(row.kbType) }}</template>
        </el-table-column>
        <el-table-column prop="docCount" label="文档数" width="90" />
        <el-table-column prop="askCount" label="问答数" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ contentStatusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑知识库' : '新建知识库'" width="520px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.kbType" style="width: 100%">
            <el-option v-for="(label, key) in AI_KB_TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
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
import { aiCenterKbApi } from '@/api/ai';
import { AI_KB_TYPE_LABELS } from '@/types/ai';
import type { AIKBType, AIKnowledgeBase } from '@/types/ai';
import { contentStatusLabel } from '@/types/content-status';

const items = ref<AIKnowledgeBase[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<AIKnowledgeBase | null>(null);
const form = reactive({ name: '', kbType: 'qa' as AIKBType, description: '' });

function kbTypeLabel(kind?: string) {
  return (kind && AI_KB_TYPE_LABELS[kind as AIKBType]) || kind || '-';
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await aiCenterKbApi.list();
    items.value = res.items ?? [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: AIKnowledgeBase) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.kbType = row?.kbType || 'qa';
  form.description = row?.description || '';
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), kbType: form.kbType, description: form.description.trim() || undefined };
    if (editing.value) { await aiCenterKbApi.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await aiCenterKbApi.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: AIKnowledgeBase) {
  try { await ElMessageBox.confirm('确定要删除该知识库吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await aiCenterKbApi.remove(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
