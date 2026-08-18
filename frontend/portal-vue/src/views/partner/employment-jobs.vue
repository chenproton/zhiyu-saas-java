<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">就业岗位</span>
          <el-button type="primary" @click="openDialog()">新建岗位</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="title" label="岗位名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="jobType" label="类型" width="110" />
        <el-table-column prop="location" label="地点" width="120" />
        <el-table-column label="薪资" width="120">
          <template #default="{ row }">{{ row.salaryMin ?? '-' }} - {{ row.salaryMax ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="headcount" label="招聘人数" width="90" />
        <el-table-column label="状态" width="90">
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

    <el-dialog v-model="dialog" :title="editing ? '编辑岗位' : '新建岗位'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="岗位名称"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.jobType" /></el-form-item>
        <el-form-item label="地点"><el-input v-model="form.location" /></el-form-item>
        <el-form-item label="薪资范围">
          <div style="display:flex;gap:8px;align-items:center">
            <el-input-number v-model="form.salaryMin" :min="0" placeholder="最低" />
            <span>-</span>
            <el-input-number v-model="form.salaryMax" :min="0" placeholder="最高" />
          </div>
        </el-form-item>
        <el-form-item label="招聘人数"><el-input-number v-model="form.headcount" :min="1" /></el-form-item>
        <el-form-item label="学历要求"><el-input v-model="form.education" /></el-form-item>
        <el-form-item label="岗位描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
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
import { partnerEmploymentApi } from '@/api/partner';
import type { EmploymentJob } from '@/types/partner';

const items = ref<EmploymentJob[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<EmploymentJob | null>(null);
const form = reactive({
  title: '', jobType: '', location: '', salaryMin: undefined as number | undefined, salaryMax: undefined as number | undefined,
  headcount: 1, education: '', description: '', schoolTenantId: ''
});

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerEmploymentApi.listJobs({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: EmploymentJob) {
  editing.value = row || null;
  form.title = row?.title || '';
  form.jobType = row?.jobType || '';
  form.location = row?.location || '';
  form.salaryMin = row?.salaryMin;
  form.salaryMax = row?.salaryMax;
  form.headcount = row?.headcount ?? 1;
  form.education = row?.education || '';
  form.description = row?.description || '';
  form.schoolTenantId = row?.tenantId || '';
  dialog.value = true;
}
async function save() {
  if (!form.title.trim()) { ElMessage.warning('岗位名称不能为空'); return; }
  saving.value = true;
  try {
    const payload = {
      title: form.title.trim(), jobType: form.jobType.trim() || undefined, location: form.location.trim() || undefined,
      salaryMin: form.salaryMin, salaryMax: form.salaryMax, headcount: form.headcount, education: form.education.trim() || undefined,
      description: form.description.trim() || undefined
    };
    if (editing.value) { await partnerEmploymentApi.updateJob(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await partnerEmploymentApi.createJob({ ...payload, schoolTenantId: form.schoolTenantId }); ElMessage.success('创建成功'); }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function confirmDelete(row: EmploymentJob) {
  try { await ElMessageBox.confirm('确定要删除该岗位吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await partnerEmploymentApi.deleteJob(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
