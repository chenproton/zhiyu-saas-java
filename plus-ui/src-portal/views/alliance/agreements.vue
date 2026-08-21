<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">联盟协议</span>
          <el-button type="primary" @click="openDialog()">新建协议</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialog" :title="editing ? '编辑协议' : '新建协议'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.type" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="公开"><el-switch v-model="form.isPublic" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="3" /></el-form-item>
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
import { allianceAgreementApi } from '@/api/alliance';
import type { AllianceAgreement } from '@/types/alliance';

const items = ref<AllianceAgreement[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<AllianceAgreement | null>(null);
const form = reactive({ name: '', type: '', startDate: '', endDate: '', isPublic: false, content: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await allianceAgreementApi.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: AllianceAgreement) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.type = row?.type || '';
  form.startDate = row?.startDate || '';
  form.endDate = row?.endDate || '';
  form.isPublic = row?.isPublic ?? false;
  form.content = row?.content || '';
  dialog.value = true;
}
async function save() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), type: form.type.trim() || undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined, isPublic: form.isPublic, content: form.content.trim() || undefined };
    if (editing.value) { await allianceAgreementApi.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await allianceAgreementApi.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: AllianceAgreement) {
  try { await ElMessageBox.confirm('确定要删除该协议吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await allianceAgreementApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
