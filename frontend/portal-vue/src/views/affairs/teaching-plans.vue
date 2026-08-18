<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">教学计划</span>
          <el-button type="primary" @click="openGenerate">生成教学计划</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="programName" label="人培方案" min-width="160" show-overflow-tooltip />
        <el-table-column prop="termName" label="学期" width="120" />
        <el-table-column prop="majorName" label="专业" min-width="120" show-overflow-tooltip />
        <el-table-column prop="entryYear" label="入学年份" width="100" />
        <el-table-column prop="entryCount" label="课程数" width="90" />
        <el-table-column label="所属批次" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.batchName || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ contentStatusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="router.push(`/affairs/teaching-plans/${row.id}`)">详情</el-button>
            <el-button v-if="row.status === 'draft'" size="small" type="success" link @click="confirm(row)">确认</el-button>
            <el-button size="small" link @click="exportExcel(row)">导出</el-button>
            <el-button size="small" type="danger" link @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 生成教学计划弹窗 -->
    <el-dialog v-model="generateDialog" title="生成教学计划" width="480px">
      <el-form label-width="90px">
        <el-form-item label="人培方案">
          <el-select v-model="generateForm.programId" style="width: 100%" placeholder="选择人培方案">
            <el-option v-for="p in programs" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="学期">
          <el-select v-model="generateForm.termId" style="width: 100%" placeholder="选择学期">
            <el-option v-for="t in terms" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialog = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="generate">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { teachingPlanApi, programApi, termApi } from '@/api/affairs';
import type { TeachingPlan, TrainingProgram, AffairsTerm } from '@/types/affairs';
import { contentStatusLabel } from '@/types/content-status';

const router = useRouter();
const items = ref<TeachingPlan[]>([]);
const programs = ref<TrainingProgram[]>([]);
const terms = ref<AffairsTerm[]>([]);
const loading = ref(false);
const generateDialog = ref(false);
const generating = ref(false);
const generateForm = reactive({ programId: '', termId: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await teachingPlanApi.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
async function loadOptions() {
  try {
    const [pRes, tRes] = await Promise.all([programApi.list({ limit: 200 }), termApi.list({ limit: 100 })]);
    programs.value = pRes.items;
    terms.value = tRes.items;
  } catch {
    /* 选项加载失败不阻断 */
  }
}
function openGenerate() {
  generateForm.programId = '';
  generateForm.termId = '';
  generateDialog.value = true;
}
async function generate() {
  if (!generateForm.programId || !generateForm.termId) {
    ElMessage.warning('请选择人培方案和学期');
    return;
  }
  generating.value = true;
  try {
    await teachingPlanApi.generate({ programId: generateForm.programId, termId: generateForm.termId });
    ElMessage.success('生成成功');
    generateDialog.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '生成失败');
  } finally {
    generating.value = false;
  }
}
async function confirm(row: TeachingPlan) {
  try {
    await teachingPlanApi.confirm(row.id);
    ElMessage.success('已确认');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}
async function confirmDelete(row: TeachingPlan) {
  try {
    await ElMessageBox.confirm('确定要删除该教学计划吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await teachingPlanApi.delete(row.id);
    ElMessage.success('删除成功');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}
async function exportExcel(row: TeachingPlan) {
  try {
    await teachingPlanApi.exportExcel(row.id);
    ElMessage.success(`导出成功：${row.programName || '教学计划'}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '导出失败');
  }
}
onMounted(() => {
  loadItems();
  loadOptions();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
