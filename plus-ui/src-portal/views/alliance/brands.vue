<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">联盟品牌</span>
          <el-button type="primary" @click="openDialog()">新建品牌</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="brandType" label="类型" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ row.status }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialog" :title="editing ? '编辑品牌' : '新建品牌'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.brandType" /></el-form-item>
        <el-form-item label="公开"><el-switch v-model="form.isPublic" /></el-form-item>
        <el-form-item label="推荐"><el-switch v-model="form.isFeatured" /></el-form-item>
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
import { allianceBrandApi } from '@/api/alliance';
import type { AllianceBrand } from '@/types/alliance';

const items = ref<AllianceBrand[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<AllianceBrand | null>(null);
const form = reactive({ name: '', brandType: '', isPublic: false, isFeatured: false, description: '' });

async function loadItems() {
  loading.value = true;
  try { const res = await allianceBrandApi.list({ limit: 200 }); items.value = res.items; }
  catch (e) { ElMessage.error((e as Error).message || '加载失败'); } finally { loading.value = false; }
}
function openDialog(row?: AllianceBrand) {
  editing.value = row || null;
  form.name = row?.name || ''; form.brandType = row?.brandType || ''; form.isPublic = row?.isPublic ?? false; form.isFeatured = row?.isFeatured ?? false; form.description = row?.description || '';
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), brandType: form.brandType.trim() || undefined, isPublic: form.isPublic, isFeatured: form.isFeatured, description: form.description.trim() || undefined };
    if (editing.value) { await allianceBrandApi.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await allianceBrandApi.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false; loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: AllianceBrand) {
  try { await ElMessageBox.confirm('确定要删除该品牌吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await allianceBrandApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
