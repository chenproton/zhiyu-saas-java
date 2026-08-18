<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ title }}</span>
          <el-button type="primary" @click="openDialog()">新建</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column v-for="f in fields" :key="f.key" :prop="f.key" :label="f.label" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑' : '新建'" width="440px">
      <el-form label-width="80px">
        <el-form-item v-for="f in fields" :key="f.key" :label="f.label">
          <el-input v-model="form[f.key]" />
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

interface Field {
  key: string;
  label: string;
}
interface CrudApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[]; total?: number }>;
  create: (req: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, req: Record<string, unknown>) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
}

const props = defineProps<{ title: string; api: CrudApi; fields: Field[] }>();

const items = ref<any[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<any | null>(null);
const form = reactive<Record<string, string>>({});

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
  for (const f of props.fields) {
    form[f.key] = (row?.[f.key] as string) || '';
  }
  dialog.value = true;
}
async function save() {
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {};
    for (const f of props.fields) {
      payload[f.key] = form[f.key].trim() || undefined;
    }
    if (editing.value) {
      await props.api.update(editing.value.id as string, payload);
      ElMessage.success('更新成功');
    } else {
      await props.api.create(payload);
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
async function confirmDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定要删除吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await props.api.delete(row.id as string);
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
