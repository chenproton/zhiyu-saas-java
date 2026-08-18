<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ isNew ? '新建试卷' : '编辑试卷' }}</span>
          <div>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" v-loading="loading">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" label-width="90px" class="basic-form">
            <el-form-item label="名称"><el-input v-model="form.name" placeholder="试卷名称" /></el-form-item>
            <el-form-item label="编码"><el-input v-model="form.code" placeholder="试卷编码" /></el-form-item>
            <el-form-item label="批次">
              <el-select v-model="form.batchId" clearable style="width: 100%" placeholder="选择批次">
                <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="总分"><el-input-number v-model="form.totalScore" :min="0" /></el-form-item>
            <el-form-item label="时长(分)"><el-input-number v-model="form.duration" :min="1" /></el-form-item>
            <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="组卷（题目）" name="questions">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openAddQuestion">从题库选题</el-button>
          </div>
          <el-table :data="questions" stripe>
            <el-table-column label="序号" width="60">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column label="类型" width="90">
              <template #default="{ row }">{{ questionTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column prop="content" label="题目内容" min-width="240" show-overflow-tooltip />
            <el-table-column label="分值" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.score" :min="0" size="small" @change="(v: number | undefined) => onScoreChange(row, v)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button size="small" type="danger" @click="removeQuestion(row)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 从题库选题弹窗 -->
    <el-dialog v-model="addDialog" title="从题库选题" width="640px">
      <el-form label-width="80px">
        <el-form-item label="题库">
          <el-select v-model="selectedBankId" style="width: 100%" @change="loadBankQuestions">
            <el-option v-for="b in banks" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-table :data="bankQuestions" stripe max-height="320" @selection-change="onBankSelection">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="content" label="题目内容" min-width="280" show-overflow-tooltip />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ questionTypeLabel(row.type) }}</template>
        </el-table-column>
      </el-table>
      <el-form label-width="80px" style="margin-top: 12px">
        <el-form-item label="默认分值"><el-input-number v-model="defaultScore" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="confirmAdd">添加选中题目</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { examApi, questionBankApi, questionApi, evaluationBatchApi } from '@/api/evaluation';
import { QUESTION_TYPE_LABELS } from '@/types/evaluation';
import type { Exam, ExamQuestion, Question, QuestionBank, QuestionType } from '@/types/evaluation';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');
const form = reactive({ name: '', code: '', batchId: '', totalScore: 100, duration: 60, description: '' });
const questions = ref<ExamQuestion[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);

const banks = ref<QuestionBank[]>([]);
const bankQuestions = ref<Question[]>([]);
const addDialog = ref(false);
const adding = ref(false);
const selectedBankId = ref('');
const selectedBankQuestions = ref<Question[]>([]);
const defaultScore = ref(1);

function questionTypeLabel(kind: string): string {
  return QUESTION_TYPE_LABELS[kind as QuestionType] || kind;
}

async function loadAll() {
  loading.value = true;
  try {
    const [exam, bankRes, batchRes] = await Promise.all([
      examApi.get(id),
      questionBankApi.list({ limit: 200 }),
      evaluationBatchApi.list({ limit: 200 })
    ]);
    form.name = exam.name;
    form.code = exam.code || '';
    form.batchId = exam.batchId || '';
    form.totalScore = exam.totalScore;
    form.duration = exam.duration;
    form.description = exam.description || '';
    questions.value = exam.questions || [];
    banks.value = bankRes.items;
    batches.value = batchRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!form.name.trim()) { ElMessage.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    await examApi.update(id, {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      batchId: form.batchId || undefined,
      totalScore: form.totalScore,
      duration: form.duration,
      description: form.description.trim() || undefined
    });
    ElMessage.success('保存成功');
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}

async function onScoreChange(row: ExamQuestion, v?: number) {
  if (v == null) return;
  try {
    await examApi.updateQuestionScore(id, row.questionId, v);
  } catch (e) { ElMessage.error((e as Error).message || '分值更新失败'); }
}

async function removeQuestion(row: ExamQuestion) {
  try {
    await examApi.removeQuestion(id, row.questionId);
    ElMessage.success('已移除');
    questions.value = questions.value.filter((q) => q.questionId !== row.questionId);
  } catch (e) { ElMessage.error((e as Error).message || '移除失败'); }
}

function openAddQuestion() {
  selectedBankId.value = '';
  bankQuestions.value = [];
  selectedBankQuestions.value = [];
  addDialog.value = true;
}
async function loadBankQuestions() {
  if (!selectedBankId.value) return;
  try {
    const res = await questionApi.list({ bankId: selectedBankId.value, limit: 500 });
    bankQuestions.value = res.items;
  } catch (e) { ElMessage.error((e as Error).message || '加载失败'); }
}
function onBankSelection(v: Question[]) {
  selectedBankQuestions.value = v;
}
async function confirmAdd() {
  if (!selectedBankQuestions.value.length) { ElMessage.warning('请选择题目'); return; }
  adding.value = true;
  try {
    for (const q of selectedBankQuestions.value) {
      await examApi.addQuestion(id, q.id, defaultScore.value);
    }
    ElMessage.success('已添加');
    addDialog.value = false;
    const exam = await examApi.get(id);
    questions.value = exam.questions || [];
  } catch (e) { ElMessage.error((e as Error).message || '添加失败'); } finally { adding.value = false; }
}

function onBack() {
  router.push('/evaluation/exams');
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
