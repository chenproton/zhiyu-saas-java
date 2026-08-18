<template>
  <div class="detail-page">
    <div class="topbar">
      <div class="header-left">
        <el-button @click="goBack">返回评分列表</el-button>
        <div>
          <h2 class="page-title">场景任务评分</h2>
          <p class="page-sub">{{ taskName }} · {{ methodLabel(result?.methodKey || '') }}</p>
        </div>
      </div>
      <el-tag v-if="result" :type="isPending ? 'warning' : 'success'">{{ isPending ? '待评分' : '已评分' }}</el-tag>
    </div>

    <div v-loading="loading" class="body">
      <el-empty v-if="!loading && !result" description="测评结果不存在" />

      <template v-if="result">
        <el-card shadow="never" class="block">
          <div class="info-row">
            <div class="info-item"><span class="info-label">学生</span><span class="info-value">{{ studentName || '未知学生' }}</span></div>
            <div class="info-item"><span class="info-label">任务</span><span class="info-value">{{ taskName }}</span></div>
            <div class="info-item"><span class="info-label">方式</span><span class="info-value">{{ methodLabel(result.methodKey) }}</span></div>
            <div v-if="result.gradedAt" class="info-item"><span class="info-label">评分时间</span><span class="info-value">{{ fmt(result.gradedAt) }}</span></div>
          </div>
        </el-card>

        <el-card shadow="never" class="block">
          <div class="score-overview">
            <span class="score-title">当前得分</span>
            <div class="score-value">{{ result.totalScore != null ? result.totalScore : 0 }}<span class="score-max">/ {{ maxScore }}</span></div>
          </div>
        </el-card>

        <el-card shadow="never" class="block">
          <template #header><span class="block-title">提交内容</span></template>
          <template v-if="subjective.text">
            <div class="sub-label">作答内容</div>
            <pre class="sub-content">{{ subjective.text }}</pre>
          </template>
          <template v-if="subjective.files.length">
            <div class="sub-label">附件（{{ subjective.files.length }}）</div>
            <div class="file-list">
              <a v-for="(f, i) in subjective.files" :key="i" :href="f.url" target="_blank" rel="noopener" class="file-link">{{ f.name || `附件 ${i + 1}` }}</a>
            </div>
          </template>
          <template v-if="result.objectiveAnswers && Object.keys(result.objectiveAnswers).length">
            <div class="sub-label">考试作答</div>
            <pre class="sub-content json">{{ JSON.stringify(result.objectiveAnswers, null, 2) }}</pre>
          </template>
          <template v-if="result.evalPointScores && Object.keys(result.evalPointScores).length">
            <div class="sub-label">能力点评分</div>
            <pre class="sub-content json">{{ JSON.stringify(result.evalPointScores, null, 2) }}</pre>
          </template>
          <p v-if="!subjective.text && !subjective.files.length && !Object.keys(result.objectiveAnswers || {}).length && !Object.keys(result.evalPointScores || {}).length" class="sub-empty">无提交内容</p>
        </el-card>

        <el-card v-if="isPending" shadow="never" class="block">
          <template #header><span class="block-title">评分</span></template>
          <div class="grade-form">
            <el-form-item label="得分"><el-input-number v-model="score" :min="0" :max="maxScore" /></el-form-item>
            <el-form-item label="评语"><el-input v-model="comment" placeholder="评语" /></el-form-item>
          </div>
          <div class="grade-actions">
            <el-button @click="goBack">取消</el-button>
            <el-button type="primary" :loading="saving" :disabled="!isValidScore" @click="save">保存评分</el-button>
          </div>
        </el-card>
        <el-card v-else shadow="never" class="block">
          <template #header><span class="block-title">评分结果</span></template>
          <div class="grade-result">
            <span>得分：<strong>{{ result.totalScore }} / {{ maxScore }}</strong></span>
            <span v-if="result.comment">评语：{{ result.comment }}</span>
            <span v-if="result.gradedAt">评分时间：{{ fmt(result.gradedAt) }}</span>
          </div>
        </el-card>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { evaluationResultApi } from '@/api/evaluation';
import { taskApi } from '@/api/scene';
import { userManagementApi } from '@/api/portal';
import { EVAL_METHOD_LABELS_GRADING } from '@/types/lesson';
import type { SceneEvaluationResult } from '@/types/evaluation';

const route = useRoute();
const router = useRouter();
const id = String(route.params.id || '');

const result = ref<SceneEvaluationResult | null>(null);
const taskName = ref('');
const studentName = ref('');
const loading = ref(true);
const score = ref(0);
const comment = ref('');
const saving = ref(false);

const isPending = computed(() => result.value?.status === 'pending');
const maxScore = computed(() => result.value?.maxScore || 100);
const isValidScore = computed(() => score.value >= 0 && score.value <= maxScore.value);

const subjective = computed(() => {
  const sc = (result.value?.subjectiveContent || {}) as { text?: unknown; files?: unknown };
  return {
    text: typeof sc.text === 'string' ? sc.text : '',
    files: Array.isArray(sc.files) ? (sc.files as { url?: string; name?: string }[]) : []
  };
});

function methodLabel(key: string) {
  return EVAL_METHOD_LABELS_GRADING[key] || key;
}
function fmt(d?: string) {
  return d ? new Date(d).toLocaleString() : '-';
}
function goBack() {
  router.push('/evaluation/scene-results');
}

async function load() {
  loading.value = true;
  try {
    const [res, users] = await Promise.all([
      evaluationResultApi.get(id),
      userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] }))
    ]);
    result.value = res;
    if (res.totalScore != null) score.value = res.totalScore;
    if (res.comment) comment.value = res.comment;
    const user = (users.items || []).find((u) => u.id === res.evaluateeId);
    if (user) studentName.value = user.name || '未知';
    try {
      const task = await taskApi.get(res.taskId);
      taskName.value = task.name || res.taskId;
    } catch {
      taskName.value = res.taskId;
    }
  } catch {
    ElMessage.error('测评结果不存在');
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!result.value || !isValidScore.value) return;
  saving.value = true;
  try {
    await evaluationResultApi.grade(result.value.id, { score: score.value, comment: comment.value.trim() || undefined });
    ElMessage.success('评分成功');
    goBack();
  } catch {
    ElMessage.error('评分失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.detail-page { padding: 16px; }
.topbar { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.body { min-height: 200px; }
.block { margin-bottom: 16px; }
.block-title { font-weight: 600; }
.info-row { display: flex; flex-wrap: wrap; gap: 24px; }
.info-item { display: flex; flex-direction: column; gap: 2px; }
.info-label { color: #909399; font-size: 12px; }
.info-value { color: #303133; font-weight: 500; }
.score-overview { display: flex; align-items: center; justify-content: space-between; }
.score-title { font-weight: 600; }
.score-value { font-size: 24px; font-weight: 700; color: #409eff; }
.score-max { font-size: 14px; font-weight: 400; color: #909399; }
.sub-label { color: #909399; font-size: 12px; margin-bottom: 6px; }
.sub-content { background: #f5f7fa; border-radius: 8px; padding: 12px; margin: 0 0 12px; white-space: pre-wrap; color: #303133; font-family: inherit; }
.sub-content.json { max-height: 280px; overflow: auto; font-size: 12px; }
.sub-empty { color: #909399; font-size: 12px; }
.file-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.file-link { color: #409eff; font-size: 13px; text-decoration: none; }
.grade-form { display: flex; flex-wrap: wrap; gap: 24px; }
.grade-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.grade-result { display: flex; flex-wrap: wrap; gap: 24px; color: #606266; }
</style>
