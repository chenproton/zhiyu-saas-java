<template>
  <div class="detail-page">
    <div class="topbar">
      <div class="header-left">
        <el-button @click="goBack">返回评分列表</el-button>
        <div>
          <h2 class="page-title">节点测评评分</h2>
          <p class="page-sub">{{ nodeName }} · {{ methodLabel(result?.methodKey || '') }}</p>
        </div>
      </div>
      <el-tag v-if="result" :type="isPending ? 'warning' : 'success'">{{ isPending ? '待评分' : '已评分' }}</el-tag>
    </div>

    <div v-loading="loading" class="body">
      <el-empty v-if="!loading && !result" description="测评结果不存在" />

      <template v-if="result">
        <!-- 基本信息 -->
        <el-card shadow="never" class="block">
          <div class="info-row">
            <div class="info-item">
              <span class="info-label">学生</span>
              <span class="info-value">{{ studentName || '未知学生' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">节点</span>
              <span class="info-value">{{ nodeName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">方式</span>
              <span class="info-value">{{ methodLabel(result.methodKey) }}</span>
            </div>
            <div v-if="result.gradedAt" class="info-item">
              <span class="info-label">评分时间</span>
              <span class="info-value">{{ fmt(result.gradedAt) }}</span>
            </div>
          </div>
        </el-card>

        <!-- 得分概览 -->
        <el-card shadow="never" class="block">
          <div class="score-overview">
            <span class="score-title">客观题自动得分</span>
            <div class="score-value">
              {{ result.totalScore != null ? result.totalScore : 0 }}
              <span class="score-max">/ {{ maxScore }}</span>
            </div>
          </div>
          <p class="score-hint">{{ isPending ? '该结果包含主观题（填空/简答等）或人工提交内容，需教师评分后计入成绩' : '该结果已完成评分' }}</p>
        </el-card>

        <!-- 提交内容 -->
        <el-card shadow="never" class="block">
          <template #header><span class="block-title">提交内容</span></template>
          <template v-if="subjective.text">
            <div class="sub-label">作答内容</div>
            <pre class="sub-content">{{ subjective.text }}</pre>
          </template>
          <template v-else-if="subjective.attended">
            <div class="sub-label">到场情况</div>
            <p class="sub-content">学生已标记到场参与（现场问答/现场评审）</p>
          </template>
          <p v-else class="sub-empty">无文本提交内容</p>

          <template v-if="subjective.files.length">
            <div class="sub-label">附件（{{ subjective.files.length }}）</div>
            <div class="file-list">
              <a v-for="(f, i) in subjective.files" :key="i" :href="f.url" target="_blank" rel="noopener" class="file-link">{{ f.name || `附件 ${i + 1}` }}</a>
            </div>
          </template>

          <template v-if="result.objectiveAnswers && Object.keys(result.objectiveAnswers).length">
            <div class="sub-label">考试作答（含主观题）</div>
            <pre class="sub-content json">{{ JSON.stringify(result.objectiveAnswers, null, 2) }}</pre>
          </template>
        </el-card>

        <!-- 评分表单 / 已评分结果 -->
        <el-card v-if="isPending" shadow="never" class="block">
          <template #header><span class="block-title">评分</span></template>
          <div class="grade-form">
            <el-form-item label="得分">
              <el-input-number v-model="score" :min="0" :max="maxScore" />
            </el-form-item>
            <el-form-item label="评语">
              <el-input v-model="comment" placeholder="评语" />
            </el-form-item>
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
import { courseNodeApi, nodeEvaluationResultApi } from '@/api/lesson';
import { userManagementApi } from '@/api/portal';
import { EVAL_METHOD_LABELS_GRADING, getHybridMethodLabel } from '@/types/lesson';
import type { NodeEvaluationResult } from '@/types/lesson';

const route = useRoute();
const router = useRouter();
const id = String(route.params.id || '');

const result = ref<NodeEvaluationResult | null>(null);
const nodeName = ref('');
const courseId = ref('');
const studentName = ref('');
const loading = ref(true);
const score = ref(0);
const comment = ref('');
const saving = ref(false);

const isPending = computed(() => result.value?.status === 'pending');
const maxScore = computed(() => result.value?.maxScore || 100);
const isValidScore = computed(() => score.value >= 0 && score.value <= maxScore.value);

const subjective = computed(() => {
  const sc = (result.value?.subjectiveContent || {}) as {
    text?: unknown;
    files?: unknown;
    attended?: unknown;
  };
  return {
    text: typeof sc.text === 'string' ? sc.text : '',
    files: Array.isArray(sc.files) ? (sc.files as { url?: string; name?: string }[]) : [],
    attended: !!sc.attended
  };
});

function methodLabel(key: string) {
  return getHybridMethodLabel(key, (k) => EVAL_METHOD_LABELS_GRADING[k] || k);
}
function fmt(d?: string) {
  return d ? new Date(d).toLocaleString() : '-';
}
function goBack() {
  router.push(`/evaluation/lesson-results${courseId.value ? `?courseId=${courseId.value}` : ''}`);
}

async function load() {
  loading.value = true;
  try {
    const [res, users] = await Promise.all([
      nodeEvaluationResultApi.get(id),
      userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] }))
    ]);
    result.value = res;
    if (res.totalScore != null) score.value = res.totalScore;
    if (res.comment) comment.value = res.comment;
    const user = (users.items || []).find((u) => u.id === res.evaluateeId);
    if (user) studentName.value = user.name || '未知';
    try {
      const node = await courseNodeApi.get(res.nodeId);
      courseId.value = node.courseId || '';
      nodeName.value = node.name || res.nodeId;
    } catch {
      nodeName.value = res.nodeId;
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
    await nodeEvaluationResultApi.grade(result.value.id, { score: score.value, comment: comment.value.trim() || undefined });
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
.score-hint { color: #909399; font-size: 12px; margin: 8px 0 0; }
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
