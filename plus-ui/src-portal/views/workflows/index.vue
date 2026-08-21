<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">审批流程配置</span>
          <el-button type="primary" @click="openDialog()">新建流程</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="流程名称" min-width="160" />
        <el-table-column prop="scene" label="适用场景" min-width="140" />
        <el-table-column label="步骤数" width="90">
          <template #default="{ row }">{{ row.steps?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑流程' : '新建流程'" width="620px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="适用场景"><el-input v-model="form.scene" placeholder="如 career_position/scenario" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="审批步骤">
          <div class="steps">
            <div v-for="(step, i) in form.steps" :key="i" class="step-block">
              <div class="step-row">
                <span class="step-index">{{ i + 1 }}</span>
                <el-input v-model="step.name" placeholder="步骤名称（如：教研组长审批）" class="step-name" />
                <el-button size="small" type="danger" :disabled="form.steps.length <= 1" @click="removeStep(i)">删除</el-button>
              </div>
              <div class="step-approvers">
                <div class="approver-picker">
                  <UserSelector v-model="step.approverIds" multiple placeholder="选择审批人" />
                </div>
                <el-select v-model="step.approvalMode" class="step-mode">
                  <el-option label="任一通过" value="any" />
                  <el-option label="全员通过" value="all" />
                </el-select>
              </div>
            </div>
            <el-button size="small" @click="addStep">+ 添加步骤</el-button>
          </div>
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
import { workflowApi } from '@/api/system';
import UserSelector from '@/views/job/position-builder/UserSelector.vue';
import type { Workflow, WorkflowStep } from '@/types/system';

const items = ref<Workflow[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Workflow | null>(null);
const form = reactive({ name: '', scene: '', description: '', steps: [] as WorkflowStep[] });

async function loadItems() {
  loading.value = true;
  try {
    const res = await workflowApi.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openDialog(row?: Workflow) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.scene = row?.scene || '';
  form.description = row?.description || '';
  // 兼容历史数据：旧步骤可能缺 approverIds，统一归一化为数组
  form.steps = row?.steps
    ? row.steps.map((s) => ({
        name: s.name,
        order: s.order,
        approvalMode: s.approvalMode,
        approverIds: s.approverIds || []
      }))
    : [];
  dialog.value = true;
}
function addStep() {
  form.steps.push({ name: '', order: form.steps.length, approverIds: [], approvalMode: 'any' });
}
function removeStep(i: number) {
  form.steps.splice(i, 1);
}
async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  if (form.steps.length === 0) {
    ElMessage.warning('请至少添加一个审批步骤');
    return;
  }
  for (let i = 0; i < form.steps.length; i++) {
    const s = form.steps[i];
    if (!s.name.trim()) {
      ElMessage.warning(`步骤 ${i + 1} 的名称不能为空`);
      return;
    }
    if (!s.approverIds || s.approverIds.length === 0) {
      ElMessage.warning(`步骤 ${i + 1} 未选择审批人，审批流程将无法推进`);
      return;
    }
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      scene: form.scene.trim() || undefined,
      description: form.description.trim() || undefined,
      steps: form.steps.map((s, i) => ({ ...s, order: i }))
    };
    if (editing.value) {
      await workflowApi.update(editing.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await workflowApi.create(payload);
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
async function confirmDelete(row: Workflow) {
  try {
    await ElMessageBox.confirm('确定要删除该流程吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await workflowApi.delete(row.id);
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
.steps { width: 100%; }
.step-block {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  padding: 10px;
  margin-bottom: 10px;
}
.step-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.step-index {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  font-size: 12px;
}
.step-name { flex: 1; }
.step-approvers { display: flex; gap: 8px; align-items: flex-start; padding-left: 30px; }
.approver-picker { flex: 1; min-width: 0; }
.step-mode { width: 110px; flex-shrink: 0; }
</style>
