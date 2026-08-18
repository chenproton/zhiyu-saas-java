<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">共建岗位</span>
          <el-button type="primary" @click="openDialog()">新建共建岗位</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="schoolName" label="学校" min-width="140" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ row.positionType === 'enterprise' ? '企业岗位' : '教学岗位' }}</template>
        </el-table-column>
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

    <el-dialog v-model="dialog" :title="editing ? '编辑共建岗位' : '新建共建岗位'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="学校ID"><el-input v-model="form.schoolTenantId" :disabled="!!editing" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.positionType" style="width: 100%">
            <el-option label="企业岗位" value="enterprise" />
            <el-option label="教学岗位" value="teaching" />
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
import { partnerCobuildPositionApi } from '@/api/partner';
import type { CoBuildPosition } from '@/types/partner';
import { contentStatusLabel } from '@/types/content-status';
import type { PositionType } from '@/types/job';

const items = ref<CoBuildPosition[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<CoBuildPosition | null>(null);
const form = reactive({ schoolTenantId: '', name: '', positionType: 'enterprise' as PositionType });

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerCobuildPositionApi.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: CoBuildPosition) {
  editing.value = row || null;
  form.schoolTenantId = row?.schoolTenantId || '';
  form.name = row?.name || '';
  form.positionType = row?.positionType || 'enterprise';
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await partnerCobuildPositionApi.update(editing.value.id, { name: form.name.trim(), positionType: form.positionType });
      ElMessage.success('更新成功');
    } else {
      if (!form.schoolTenantId.trim()) { ElMessage.warning('学校ID不能为空'); return; }
      await partnerCobuildPositionApi.create({ schoolTenantId: form.schoolTenantId.trim(), name: form.name.trim(), positionType: form.positionType });
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: CoBuildPosition) {
  try { await ElMessageBox.confirm('确定要删除该共建岗位吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await partnerCobuildPositionApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
