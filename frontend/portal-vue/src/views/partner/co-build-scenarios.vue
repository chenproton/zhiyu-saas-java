<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">共建场景</span>
          <el-button type="primary" @click="openDialog()">新建共建场景</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="schoolName" label="学校" min-width="140" show-overflow-tooltip />
        <el-table-column prop="difficulty" label="难度" width="80" />
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

    <el-dialog v-model="dialog" :title="editing ? '编辑共建场景' : '新建共建场景'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="学校ID"><el-input v-model="form.schoolTenantId" :disabled="!!editing" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="难度"><el-input-number v-model="form.difficulty" :min="1" :max="5" /></el-form-item>
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
import { partnerCobuildScenarioApi } from '@/api/partner';
import type { CoBuildScenario } from '@/types/partner';
import { contentStatusLabel } from '@/types/content-status';

const items = ref<CoBuildScenario[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<CoBuildScenario | null>(null);
const form = reactive({ schoolTenantId: '', name: '', difficulty: 3 });

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerCobuildScenarioApi.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: CoBuildScenario) {
  editing.value = row || null;
  form.schoolTenantId = row?.schoolTenantId || '';
  form.name = row?.name || '';
  form.difficulty = row?.difficulty ?? 3;
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await partnerCobuildScenarioApi.update(editing.value.id, { name: form.name.trim(), difficulty: form.difficulty });
      ElMessage.success('更新成功');
    } else {
      if (!form.schoolTenantId.trim()) { ElMessage.warning('学校ID不能为空'); return; }
      await partnerCobuildScenarioApi.create({ schoolTenantId: form.schoolTenantId.trim(), name: form.name.trim(), difficulty: form.difficulty });
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: CoBuildScenario) {
  try { await ElMessageBox.confirm('确定要删除该共建场景吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await partnerCobuildScenarioApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
