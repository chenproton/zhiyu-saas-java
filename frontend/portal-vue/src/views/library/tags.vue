<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">标签管理</span>
          <el-button type="primary" @click="openDialog()">新建标签</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="160">
          <template #default="{ row }">
            <el-tag :color="row.color" effect="dark" style="border: none">{{ row.name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="resourceCount" label="资源数" width="100" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑标签' : '新建标签'" width="420px">
      <el-form label-width="60px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" />
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
import { tagApi } from '@/api/library';
import type { TagItem } from '@/types/library';

const items = ref<TagItem[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<TagItem | null>(null);
const form = reactive({ name: '', color: '#409eff' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await tagApi.list();
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: TagItem) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.color = row?.color || '#409eff';
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), color: form.color };
    if (editing.value) {
      await tagApi.update(editing.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await tagApi.create(payload);
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
async function confirmDelete(row: TagItem) {
  try {
    await ElMessageBox.confirm('确定要删除该标签吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await tagApi.delete(row.id);
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
