<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ isNew ? '新建场景' : '编辑场景' }}</span>
          <div>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="onSave">保存基本信息</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" v-loading="loading">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" label-width="90px" class="basic-form">
            <el-form-item label="名称">
              <el-input v-model="form.name" placeholder="场景名称" />
            </el-form-item>
            <el-form-item label="难度">
              <el-input-number v-model="form.difficulty" :min="1" :max="5" />
            </el-form-item>
            <el-form-item label="关联岗位">
              <el-select v-model="form.careerPositionId" clearable style="width: 100%" placeholder="选择岗位">
                <el-option v-for="p in positions" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="所属行业">
              <el-select v-model="form.industryIds" multiple style="width: 100%" placeholder="选择行业">
                <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="适用专业">
              <el-select v-model="form.professionIds" multiple style="width: 100%" placeholder="选择专业">
                <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="批次">
              <el-select v-model="form.batchId" clearable style="width: 100%" placeholder="选择批次">
                <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="背景">
              <el-input v-model="form.background" type="textarea" :rows="3" placeholder="场景背景" />
            </el-form-item>
            <el-form-item label="交付目标">
              <el-input v-model="form.deliveryGoal" type="textarea" :rows="3" placeholder="交付目标" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="任务链" name="tasks">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openTaskDialog()">新增任务</el-button>
          </div>
          <el-table :data="tasks" stripe>
            <el-table-column label="序号" width="70">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column prop="name" label="任务名称" min-width="180" />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ row.taskType === 'assessment' ? '考核' : '训练' }}</template>
            </el-table-column>
            <el-table-column prop="difficulty" label="难度" width="80" />
            <el-table-column prop="estimatedHours" label="学时" width="80" />
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button size="small" @click="openTaskDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeTask(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 任务弹窗 -->
    <el-dialog v-model="taskDialog" :title="editingTask ? '编辑任务' : '新增任务'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="taskForm.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="taskForm.taskType" style="width: 100%">
            <el-option label="训练" value="training" />
            <el-option label="考核" value="assessment" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度"><el-input-number v-model="taskForm.difficulty" :min="1" :max="5" /></el-form-item>
        <el-form-item label="学时"><el-input-number v-model="taskForm.estimatedHours" :min="0" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="taskForm.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskDialog = false">取消</el-button>
        <el-button type="primary" :loading="taskSaving" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { scenarioApi, taskApi, sceneBatchApi } from '@/api/scene';
import { positionApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import type { Scenario, ScenarioTask } from '@/types/scene';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');
const form = reactive({
  name: '',
  difficulty: 3,
  careerPositionId: '',
  industryIds: [] as string[],
  professionIds: [] as string[],
  batchId: '',
  coBuilderIds: [] as string[],
  background: '',
  deliveryGoal: ''
});
const positions = ref<{ id: string; name: string }[]>([]);
const industries = ref<{ id: string; name: string }[]>([]);
const majors = ref<{ id: string; name: string }[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);
const users = ref<{ id: string; name: string }[]>([]);

const tasks = ref<ScenarioTask[]>([]);
const taskDialog = ref(false);
const taskSaving = ref(false);
const editingTask = ref<ScenarioTask | null>(null);
const taskForm = reactive({ name: '', taskType: 'training' as ScenarioTask['taskType'], difficulty: 3, estimatedHours: 1, description: '' });

async function loadAll() {
  loading.value = true;
  try {
    const [scenario, taskRes, posRes, indRes, majorRes, batchRes, userRes] = await Promise.all([
      scenarioApi.get(id),
      taskApi.list({ scenarioId: id, limit: 500 }),
      positionApi.list({ limit: 500 }),
      industryApi.list({ limit: 500 }),
      majorApi.list({ limit: 500 }),
      sceneBatchApi.list({ limit: 200 }),
      userManagementApi.list({ limit: 1000 })
    ]);
    form.name = scenario.name;
    form.difficulty = scenario.difficulty;
    form.careerPositionId = scenario.careerPositionId || '';
    form.industryIds = scenario.industryIds || [];
    form.professionIds = scenario.professionIds || [];
    form.batchId = scenario.batchId || '';
    form.coBuilderIds = scenario.coBuilderIds || [];
    form.background = scenario.background || '';
    form.deliveryGoal = scenario.deliveryGoal || '';
    tasks.value = taskRes.items;
    positions.value = posRes.items;
    industries.value = indRes.items;
    majors.value = majorRes.items;
    batches.value = batchRes.items;
    users.value = userRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    await scenarioApi.update(id, {
      name: form.name.trim(),
      difficulty: form.difficulty,
      careerPositionId: form.careerPositionId || undefined,
      industryIds: form.industryIds.length ? form.industryIds : undefined,
      professionIds: form.professionIds.length ? form.professionIds : undefined,
      batchId: form.batchId || undefined,
      coBuilderIds: form.coBuilderIds,
      background: form.background.trim() || undefined,
      deliveryGoal: form.deliveryGoal.trim() || undefined
    });
    ElMessage.success('保存成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

// 任务
function openTaskDialog(row?: ScenarioTask) {
  editingTask.value = row || null;
  taskForm.name = row?.name || '';
  taskForm.taskType = row?.taskType || 'training';
  taskForm.difficulty = row?.difficulty ?? 3;
  taskForm.estimatedHours = row?.estimatedHours ?? 1;
  taskForm.description = row?.description || '';
  taskDialog.value = true;
}
async function saveTask() {
  if (!taskForm.name.trim()) {
    ElMessage.warning('任务名称不能为空');
    return;
  }
  taskSaving.value = true;
  try {
    const payload = {
      name: taskForm.name.trim(),
      taskType: taskForm.taskType,
      difficulty: taskForm.difficulty,
      estimatedHours: taskForm.estimatedHours,
      description: taskForm.description.trim() || undefined,
      scenarioId: id,
      sortOrder: editingTask.value?.sortOrder ?? tasks.value.length,
      code: editingTask.value?.code ?? `T${tasks.value.length + 1}`,
      isReferenced: editingTask.value?.isReferenced ?? false
    };
    if (editingTask.value) {
      await taskApi.update(editingTask.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await taskApi.create(payload);
      ElMessage.success('创建成功');
    }
    taskDialog.value = false;
    loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    taskSaving.value = false;
  }
}
async function removeTask(row: ScenarioTask) {
  try {
    await ElMessageBox.confirm('确定要删除该任务吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await taskApi.delete(row.id);
    ElMessage.success('删除成功');
    loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

function onBack() {
  router.push('/scene/scenarios');
}

onMounted(loadAll);
</script>

<style scoped>
.edit-page {
  padding: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.basic-form {
  max-width: 640px;
}
.tab-toolbar {
  margin-bottom: 12px;
}
</style>
