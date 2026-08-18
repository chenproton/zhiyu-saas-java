<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ isNew ? '新建课程' : '编辑课程' }}</span>
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
              <el-input v-model="form.name" placeholder="课程名称" />
            </el-form-item>
            <el-form-item label="编码">
              <el-input v-model="form.code" placeholder="课程编码" />
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="form.type" style="width: 200px">
                <el-option label="体系课" value="system" />
                <el-option label="颗粒课" value="granular" />
                <el-option label="混合课" value="hybrid" />
              </el-select>
            </el-form-item>
            <el-form-item label="专业">
              <el-select v-model="form.majorId" clearable style="width: 100%" placeholder="选择专业">
                <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="所属行业">
              <el-select v-model="form.industryId" clearable style="width: 100%" placeholder="选择行业">
                <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="批次">
              <el-select v-model="form.batchId" clearable style="width: 100%" placeholder="选择批次">
                <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="分类">
              <el-input v-model="form.category" placeholder="课程分类" />
            </el-form-item>
            <el-form-item label="简介">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="课程简介" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="课程节点" name="nodes">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openNodeDialog()">新增节点</el-button>
          </div>
          <el-table :data="nodes" stripe>
            <el-table-column label="序号" width="70">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column prop="name" label="节点名称" min-width="180" />
            <el-table-column prop="type" label="类型" width="120" />
            <el-table-column prop="difficulty" label="难度" width="80" />
            <el-table-column prop="estimatedHours" label="学时" width="80" />
            <el-table-column prop="teachingGoals" label="教学目标" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button size="small" @click="openNodeDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeNode(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="nodeDialog" :title="editingNode ? '编辑节点' : '新增节点'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="nodeForm.name" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="nodeForm.type" placeholder="如 lesson/quiz" /></el-form-item>
        <el-form-item label="难度"><el-input-number v-model="nodeForm.difficulty" :min="1" :max="5" /></el-form-item>
        <el-form-item label="学时"><el-input-number v-model="nodeForm.estimatedHours" :min="0" /></el-form-item>
        <el-form-item label="教学目标"><el-input v-model="nodeForm.teachingGoals" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nodeDialog = false">取消</el-button>
        <el-button type="primary" :loading="nodeSaving" @click="saveNode">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { courseApi, courseNodeApi, lessonBatchApi } from '@/api/lesson';
import { industryApi, majorApi } from '@/api/system';
import type { Course, CourseType, SystemCourseNode } from '@/types/lesson';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');
const form = reactive({
  name: '',
  code: '',
  type: 'system' as CourseType,
  majorId: '',
  industryId: '',
  batchId: '',
  category: '',
  description: ''
});
const majors = ref<{ id: string; name: string }[]>([]);
const industries = ref<{ id: string; name: string }[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);

const nodes = ref<SystemCourseNode[]>([]);
const nodeDialog = ref(false);
const nodeSaving = ref(false);
const editingNode = ref<SystemCourseNode | null>(null);
const nodeForm = reactive({ name: '', type: '', difficulty: 3, estimatedHours: 1, teachingGoals: '' });

async function loadAll() {
  loading.value = true;
  try {
    const [course, nodeRes, majorRes, indRes, batchRes] = await Promise.all([
      courseApi.get(id),
      courseNodeApi.list({ courseId: id, limit: 500 }),
      majorApi.list({ limit: 500 }),
      industryApi.list({ limit: 500 }),
      lessonBatchApi.list({ limit: 200 })
    ]);
    form.name = course.name;
    form.code = course.code || '';
    form.type = course.type;
    form.majorId = course.majorId || '';
    form.industryId = course.industryId || '';
    form.batchId = course.batchId || '';
    form.category = course.category || '';
    form.description = course.description || '';
    nodes.value = nodeRes.items;
    majors.value = majorRes.items;
    industries.value = indRes.items;
    batches.value = batchRes.items;
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
    await courseApi.update(id, {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      type: form.type,
      majorId: form.majorId || undefined,
      industryId: form.industryId || undefined,
      batchId: form.batchId || undefined,
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined
    });
    ElMessage.success('保存成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function openNodeDialog(row?: SystemCourseNode) {
  editingNode.value = row || null;
  nodeForm.name = row?.name || '';
  nodeForm.type = row?.type || '';
  nodeForm.difficulty = row?.difficulty ?? 3;
  nodeForm.estimatedHours = row?.estimatedHours ?? 1;
  nodeForm.teachingGoals = row?.teachingGoals || '';
  nodeDialog.value = true;
}
async function saveNode() {
  if (!nodeForm.name.trim()) {
    ElMessage.warning('节点名称不能为空');
    return;
  }
  nodeSaving.value = true;
  try {
    const payload = {
      name: nodeForm.name.trim(),
      type: nodeForm.type.trim() || 'lesson',
      difficulty: nodeForm.difficulty,
      estimatedHours: nodeForm.estimatedHours,
      teachingGoals: nodeForm.teachingGoals.trim() || undefined,
      courseId: id,
      parentId: null,
      order: editingNode.value?.order ?? nodes.value.length,
      status: editingNode.value?.status ?? 'draft'
    };
    if (editingNode.value) {
      await courseNodeApi.update(editingNode.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await courseNodeApi.create(payload);
      ElMessage.success('创建成功');
    }
    nodeDialog.value = false;
    loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    nodeSaving.value = false;
  }
}
async function removeNode(row: SystemCourseNode) {
  try {
    await ElMessageBox.confirm('确定要删除该节点吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await courseNodeApi.delete(row.id);
    ElMessage.success('删除成功');
    loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

function onBack() {
  router.push('/lesson/courses');
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
