<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">联盟成果</span>
          <el-button type="primary" @click="openDialog()">新建成果</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="viewCount" label="浏览" width="80" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialog" :title="editing ? '编辑成果' : '新建成果'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.type" /></el-form-item>
        <el-form-item label="取得日期"><el-date-picker v-model="form.achievementDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
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
import { allianceAchievementApi } from '@/api/alliance';
import type { AllianceAchievement } from '@/types/alliance';

const items = ref<AllianceAchievement[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<AllianceAchievement | null>(null);
const form = reactive({ title: '', type: '', achievementDate: '', description: '' });

async function loadItems() {
  loading.value = true;
  try { const res = await allianceAchievementApi.list({ limit: 200 }); items.value = res.items; }
  catch (e) { ElMessage.error((e as Error).message || '加载失败'); } finally { loading.value = false; }
}
function openDialog(row?: AllianceAchievement) {
  editing.value = row || null;
  form.title = row?.title || ''; form.type = row?.type || ''; form.achievementDate = row?.achievementDate || ''; form.description = row?.description || '';
  dialog.value = true;
}
async function save() {
  if (!form.title.trim()) { ElMessage.warning('标题不能为空'); return; }
  saving.value = true;
  try {
    const payload = { title: form.title.trim(), type: form.type.trim() || undefined, achievementDate: form.achievementDate || undefined, description: form.description.trim() || undefined };
    if (editing.value) { await allianceAchievementApi.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await allianceAchievementApi.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false; loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: AllianceAchievement) {
  try { await ElMessageBox.confirm('确定要删除该成果吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await allianceAchievementApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
