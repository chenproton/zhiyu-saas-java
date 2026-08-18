<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">题库编辑</span>
          <div>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" v-loading="loading">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" label-width="90px" class="basic-form">
            <el-form-item label="名称"><el-input v-model="form.name" placeholder="题库名称" /></el-form-item>
            <el-form-item label="编码"><el-input v-model="form.code" placeholder="题库编码" /></el-form-item>
            <el-form-item label="批次">
              <el-select v-model="form.batchId" clearable style="width: 100%" placeholder="选择批次">
                <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="3" placeholder="题库简介" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="题目列表" name="questions">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openQuestionDialog()">新增题目</el-button>
          </div>
          <el-table :data="questions" stripe>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ questionTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column prop="content" label="题目内容" min-width="240" show-overflow-tooltip />
            <el-table-column prop="score" label="分值" width="80" />
            <el-table-column prop="difficulty" label="难度" width="80" />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button size="small" @click="openQuestionDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeQuestion(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="questionDialog" :title="editingQuestion ? '编辑题目' : '新增题目'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-select v-model="questionForm.type" style="width: 100%">
            <el-option v-for="(label, key) in QUESTION_TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"><el-input v-model="questionForm.content" type="textarea" :rows="2" /></el-form-item>
        <el-form-item v-if="questionForm.type === 'single' || questionForm.type === 'multiple'" label="选项">
          <el-input v-model="questionForm.optionsText" type="textarea" :rows="4" placeholder="每行一个选项" />
        </el-form-item>
        <el-form-item label="答案"><el-input v-model="questionForm.answer" placeholder="如 A 或 正确答案" /></el-form-item>
        <el-form-item label="分值"><el-input-number v-model="questionForm.score" :min="0" /></el-form-item>
        <el-form-item label="难度">
          <el-select v-model="questionForm.difficulty" style="width: 160px">
            <el-option label="简单" value="easy" />
            <el-option label="中等" value="medium" />
            <el-option label="困难" value="hard" />
          </el-select>
        </el-form-item>
        <el-form-item label="解析"><el-input v-model="questionForm.analysis" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="questionDialog = false">取消</el-button>
        <el-button type="primary" :loading="questionSaving" @click="saveQuestion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { questionBankApi, questionApi, evaluationBatchApi } from '@/api/evaluation';
import { QUESTION_TYPE_LABELS } from '@/types/evaluation';
import type { Question, QuestionType } from '@/types/evaluation';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

function questionTypeLabel(kind: string): string {
  return QUESTION_TYPE_LABELS[kind as QuestionType] || kind;
}

const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');
const form = reactive({ name: '', code: '', batchId: '', description: '' });
const batches = ref<{ id: string; name: string }[]>([]);

const questions = ref<Question[]>([]);
const questionDialog = ref(false);
const questionSaving = ref(false);
const editingQuestion = ref<Question | null>(null);
const questionForm = reactive({
  type: 'single' as QuestionType,
  content: '',
  optionsText: '',
  answer: '',
  score: 1,
  difficulty: 'medium',
  analysis: ''
});

async function loadAll() {
  loading.value = true;
  try {
    const [bank, qRes, batchRes] = await Promise.all([
      questionBankApi.get(id),
      questionApi.list({ bankId: id, limit: 500 }),
      evaluationBatchApi.list({ limit: 200 })
    ]);
    form.name = bank.name;
    form.code = bank.code || '';
    form.batchId = bank.batchId || '';
    form.description = bank.description || '';
    questions.value = qRes.items;
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
    await questionBankApi.update(id, { name: form.name.trim(), code: form.code.trim() || undefined, batchId: form.batchId || undefined, description: form.description.trim() || undefined });
    ElMessage.success('保存成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function openQuestionDialog(row?: Question) {
  editingQuestion.value = row || null;
  questionForm.type = row?.type || 'single';
  questionForm.content = row?.content || '';
  questionForm.optionsText = (row?.options || []).join('\n');
  questionForm.answer = Array.isArray(row?.answer) ? row.answer.join(',') : (row?.answer || '');
  questionForm.score = row?.score ?? 1;
  questionForm.difficulty = row?.difficulty || 'medium';
  questionForm.analysis = row?.analysis || '';
  questionDialog.value = true;
}
async function saveQuestion() {
  if (!questionForm.content.trim()) {
    ElMessage.warning('题目内容不能为空');
    return;
  }
  questionSaving.value = true;
  try {
    const options = questionForm.optionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      type: questionForm.type,
      content: questionForm.content.trim(),
      options: options.length ? options : undefined,
      answer: questionForm.answer.trim(),
      score: questionForm.score,
      difficulty: questionForm.difficulty,
      analysis: questionForm.analysis.trim() || undefined,
      bankId: id
    };
    if (editingQuestion.value) {
      await questionApi.update(editingQuestion.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await questionApi.create(payload);
      ElMessage.success('创建成功');
    }
    questionDialog.value = false;
    loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    questionSaving.value = false;
  }
}
async function removeQuestion(row: Question) {
  try {
    await ElMessageBox.confirm('确定要删除该题目吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await questionApi.delete(row.id);
    ElMessage.success('删除成功');
    loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

function onBack() {
  router.push('/evaluation/question-banks');
}

onMounted(loadAll);
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.basic-form { max-width: 640px; }
.tab-toolbar { margin-bottom: 12px; }
</style>
