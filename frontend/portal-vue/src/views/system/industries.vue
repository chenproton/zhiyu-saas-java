<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">行业管理</span>
          <el-button type="primary" @click="openDialog()">新建行业</el-button>
        </div>
      </template>

      <el-input v-model="keyword" placeholder="搜索代码/名称/上级行业..." clearable style="max-width: 320px; margin-bottom: 12px" @input="loadItems" @clear="loadItems" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="上级行业" min-width="140">
          <template #default="{ row }">{{ parentName(row.parentId) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑行业' : '新建行业'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="上级行业">
          <el-select v-model="form.parentId" clearable style="width: 100%" placeholder="无（一级行业）">
            <el-option v-for="i in parentOptions" :key="i.id" :label="i.name" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { industryApi } from '@/api/system';
import type { Industry } from '@/types/system';

const items = ref<Industry[]>([]);
const loading = ref(false);
const keyword = ref('');
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Industry | null>(null);
const form = reactive({ code: '', name: '', parentId: '', sortOrder: 0, enabled: true });

const parentOptions = computed(() => {
  if (!editing.value) return items.value;
  return items.value.filter((i) => i.id !== editing.value!.id);
});

function parentName(id?: string) {
  if (!id) return '-';
  return items.value.find((i) => i.id === id)?.name || id;
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await industryApi.list({ ...(keyword.value ? { keyword: keyword.value } : {}), limit: 500 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: Industry) {
  editing.value = row || null;
  form.code = row?.code || '';
  form.name = row?.name || '';
  form.parentId = row?.parentId || '';
  form.sortOrder = row?.sortOrder ?? 0;
  form.enabled = row?.enabled ?? true;
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload = {
      code: form.code.trim() || undefined,
      name: form.name.trim(),
      parentId: form.parentId || undefined,
      sortOrder: form.sortOrder,
      enabled: form.enabled
    };
    if (editing.value) { await industryApi.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await industryApi.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: Industry) {
  try { await ElMessageBox.confirm('确定要删除该行业吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await industryApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
