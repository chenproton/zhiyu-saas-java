<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">AI 智能体</span>
          <el-button type="primary" @click="openAdd">新建智能体</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="简介" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="对话数" width="90">
          <template #default="{ row }">{{ row.chatCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ contentStatusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑智能体' : '新建智能体'" width="520px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="智能体名称" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="智能体简介" /></el-form-item>
        <el-form-item label="问候语"><el-input v-model="form.greeting" type="textarea" :rows="2" placeholder="开场问候语" /></el-form-item>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { aiCenterAgentApi } from '@/api/ai';
import type { AIAgent } from '@/types/ai';
import { contentStatusLabel } from '@/types/content-status';

const items = ref<AIAgent[]>([]);
const loading = ref(false);
const dialogOpen = ref(false);
const editingItem = ref<AIAgent | null>(null);
const submitting = ref(false);
const form = reactive({ name: '', description: '', greeting: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await aiCenterAgentApi.listMine();
    items.value = res.items ?? [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openAdd() {
  editingItem.value = null;
  Object.assign(form, { name: '', description: '', greeting: '' });
  dialogOpen.value = true;
}
function openEdit(item: AIAgent) {
  editingItem.value = item;
  Object.assign(form, { name: item.name, description: item.description || '', greeting: item.greeting || '' });
  dialogOpen.value = true;
}
async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload = { name: form.name.trim(), description: form.description.trim() || undefined, greeting: form.greeting.trim() || undefined };
    if (editingItem.value) {
      await aiCenterAgentApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await aiCenterAgentApi.create(payload);
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
async function confirmDelete(item: AIAgent) {
  try {
    await ElMessageBox.confirm('确定要删除该智能体吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await aiCenterAgentApi.remove(item.id);
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
</style>
