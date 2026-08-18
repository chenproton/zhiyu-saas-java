<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ title }}</span>
          <el-button type="primary" @click="openDialog()">新建批次</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'open' ? 'success' : 'info'">{{ row.status === 'open' ? '开放' : '关闭' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="toggleStatus(row)">{{ row.status === 'open' ? '关闭' : '开放' }}</el-button>
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑批次' : '新建批次'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
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

interface BatchApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[] }>;
  create: (req: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, req: Record<string, unknown>) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  updateStatus?: (id: string, status: string) => Promise<unknown>;
}

const props = defineProps<{ title: string; api: BatchApi }>();

const items = ref<any[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<any | null>(null);
const form = reactive({ name: '', code: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await props.api.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: any) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.code = row?.code || '';
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), code: form.code.trim() || undefined };
    if (editing.value) { await props.api.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await props.api.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function toggleStatus(row: any) {
  if (!props.api.updateStatus) return;
  try {
    await props.api.updateStatus(row.id, row.status === 'open' ? 'closed' : 'open');
    ElMessage.success('状态已更新');
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '操作失败'); }
}
async function confirmDelete(row: any) {
  try { await ElMessageBox.confirm('确定要删除该批次吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await props.api.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
