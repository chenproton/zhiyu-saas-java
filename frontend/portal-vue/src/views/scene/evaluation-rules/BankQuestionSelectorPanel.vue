<template>
  <div class="bank-panel">
    <!-- 左：题库列表 / 题库内题目 -->
    <div class="panel-left">
      <template v-if="selectedBankId">
        <div class="back-row">
          <el-button link size="small" @click="handleBackToBanks">
            <el-icon><ArrowLeft /></el-icon> 返回题库列表
          </el-button>
          <span class="bank-name">{{ selectedBankName }}</span>
        </div>
        <el-input v-model="questionSearch" size="small" placeholder="搜索题目内容..." clearable class="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="scroll-area">
          <div v-if="loadingQuestions" class="loading">加载中...</div>
          <el-empty
            v-else-if="filteredQuestions.length === 0"
            :description="bankQuestions.length === 0 ? '该题库暂无题目' : '没有找到匹配的题目'"
            :image-size="60"
          />
          <el-table v-else :data="filteredQuestions" size="small" @row-click="(row: any) => emit('toggle-question', row.id)">
            <el-table-column label="题目内容" min-width="200">
              <template #default="{ row }">
                <div class="q-content">
                  <span class="check-box" :class="{ on: isSelected(row.id) }">
                    <el-icon v-if="isSelected(row.id)" :size="11"><Check /></el-icon>
                  </span>
                  <span class="q-text">{{ questionContent(row) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="题型" width="92">
              <template #default="{ row }">
                <el-tag size="small" disable-transitions :color="typeColor(row.type)" style="color: #fff; border: none">
                  {{ typeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="难度" width="70">
              <template #default="{ row }">
                <span class="dim">{{ difficultyLabel(row.difficulty) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  :type="isSelected(row.id) ? 'default' : 'primary'"
                  :plain="isSelected(row.id)"
                  @click.stop="emit('toggle-question', row.id)"
                >
                  {{ isSelected(row.id) ? '取消' : '使用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
      <template v-else>
        <el-radio-group v-model="bankTab" size="small" class="bank-tabs">
          <el-radio-button value="my">我的</el-radio-button>
          <el-radio-button value="collab">共建</el-radio-button>
          <el-radio-button value="public">公共题库</el-radio-button>
        </el-radio-group>
        <el-input v-model="bankSearch" size="small" placeholder="搜索题库名称..." clearable class="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="scroll-area">
          <div v-if="loadingBanks" class="loading">加载中...</div>
          <el-empty v-else-if="filteredBanks.length === 0" description="暂无题库" :image-size="60" />
          <div v-else class="bank-list">
            <div
              v-for="bank in filteredBanks"
              :key="bank.id"
              class="bank-card"
              @click="handleSelectBank(bank.id, bank.name)"
            >
              <div class="bank-row">
                <el-icon color="#909399"><Collection /></el-icon>
                <span class="bank-label">{{ bank.name }}</span>
                <el-tag size="small" type="info" disable-transitions>{{ bank.questionCount ?? 0 }} 题</el-tag>
                <el-icon class="arrow" color="#c0c4cc"><ArrowRight /></el-icon>
              </div>
              <p v-if="bank.description" class="bank-desc">{{ bank.description }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 右：已选题目 -->
    <div class="panel-right">
      <div class="right-head">
        <p class="right-title">已选择题目 ({{ selectedIds.length }}<span v-if="maxCount">/{{ maxCount }}</span>)</p>
        <el-dropdown v-if="selectedIds.length > 0" trigger="click" @command="onScoreCommand">
          <el-button size="small" plain>
            <el-icon><Operation /></el-icon> 分数配置
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="even">均匀分配 — 将 100 分均匀分给每道题，余数从第一题起加 1 分</el-dropdown-item>
              <el-dropdown-item command="byType">题型分配 — 为每种题型分配总分（合计 100），各题型内均匀分配</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="scroll-area">
        <el-empty v-if="selectedIds.length === 0" description="从左侧搜索并选择题目" :image-size="60" />
        <div v-else class="selected-list">
          <div v-for="qid in selectedIds" :key="qid" class="selected-card">
            <div class="selected-head">
              <span class="selected-text">{{ questionContent(resolveQuestion(qid)) }}</span>
              <el-button link size="small" @click="emit('toggle-question', qid)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="selected-meta">
              <el-tag
                size="small"
                disable-transitions
                :color="typeColor(resolveQuestion(qid)?.type)"
                style="color: #fff; border: none"
              >
                {{ typeLabel(resolveQuestion(qid)?.type) }}
              </el-tag>
              <span class="dim">{{ difficultyLabel(resolveQuestion(qid)?.difficulty) }}</span>
              <div class="score-box">
                <span class="dim">分值</span>
                <el-input-number
                  :model-value="questionScores?.[qid] ?? resolveQuestion(qid)?.score ?? 0"
                  :min="0"
                  :max="100"
                  :precision="0"
                  size="small"
                  controls-position="right"
                  class="score-input"
                  @update:model-value="(v: number | undefined) => emit('update-scores', { [qid]: Math.max(0, Math.min(100, v || 0)) })"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ScoreConfigDialog
      v-model="scoreDialogOpen"
      :questions="selectedQuestionItems"
      @apply="(scores) => emit('update-scores', scores)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 题库选题面板：对齐原 React 版 bank-question-selector-panel.tsx
 * 题库 Tab（我的/共建/公共题库）→ 题库搜索 → 进入题库选题 → 右侧已选题目与分值配置（均匀/题型分配）。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, Check, Close, Collection, Operation, Search } from '@element-plus/icons-vue';
import { questionApi, questionBankApi } from '@/api/evaluation';
import { fetchAllPages } from '@/views/lesson/lesson-edit-utils';
import ScoreConfigDialog from './ScoreConfigDialog.vue';
import { DIFFICULTY_LABELS, QUESTION_TYPE_COLORS, QUESTION_TYPE_LABELS } from './types';

const props = defineProps<{
  field: 'questionBankQuestions' | 'quizQuestions';
  selectedIds: string[];
  maxCount?: number;
  questionScores?: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'toggle-question', qid: string): void;
  (e: 'update-scores', scores: Record<string, number>): void;
}>();

const banks = ref<any[]>([]);
const bankQuestions = ref<any[]>([]);
const questionCache = ref<Record<string, any>>({});
const selectedBankId = ref<string | null>(null);
const selectedBankName = ref('');
const loadingBanks = ref(false);
const loadingQuestions = ref(false);
const bankTab = ref<'my' | 'collab' | 'public'>('my');
const bankSearch = ref('');
const questionSearch = ref('');
const scoreDialogOpen = ref(false);
// 题库切换请求序号：丢弃过期响应，避免旧题库题目覆盖新题库
let loadSeq = 0;

async function loadBanks() {
  loadingBanks.value = true;
  try {
    banks.value = await fetchAllPages<any>(({ limit, offset }) => questionBankApi.list({ limit, offset }));
  } catch (err) {
    ElMessage.error((err as Error).message || '加载题库列表失败');
  } finally {
    loadingBanks.value = false;
  }
}

async function loadQuestions(bankId: string) {
  const seq = ++loadSeq;
  loadingQuestions.value = true;
  try {
    const res = await questionApi.list({ bankId, limit: 1000 });
    if (seq !== loadSeq) return;
    const items = (res.items || []) as any[];
    items.forEach((q) => (questionCache.value[q.id] = q));
    bankQuestions.value = items;
  } catch (err) {
    if (seq !== loadSeq) return;
    ElMessage.error((err as Error).message || '加载题库题目失败');
  } finally {
    if (seq === loadSeq) loadingQuestions.value = false;
  }
}

/** 已选但未在当前题库列表中的题目：逐个补拉详情，保证右侧展示题干/题型/分值 */
async function preloadSelected() {
  const missing = props.selectedIds.filter((qid) => !questionCache.value[qid]);
  if (missing.length === 0) return;
  await Promise.all(
    missing.map(async (qid) => {
      try {
        const q = await questionApi.get(qid);
        questionCache.value[qid] = q;
      } catch {
        // 单题详情失败不阻塞其他题目
      }
    })
  );
}

onMounted(() => {
  loadBanks();
  preloadSelected();
});

watch(() => props.selectedIds.join(','), () => void preloadSelected());

function handleSelectBank(bankId: string, bankName: string) {
  selectedBankId.value = bankId;
  selectedBankName.value = bankName;
  questionSearch.value = '';
  loadQuestions(bankId);
}

function handleBackToBanks() {
  selectedBankId.value = null;
  selectedBankName.value = '';
  bankQuestions.value = [];
  questionSearch.value = '';
}

const tabBanks = computed(() => {
  switch (bankTab.value) {
    case 'my':
      return banks.value.filter((b) => b.ownerType === 'mine' || !b.ownerType);
    case 'collab':
      return banks.value.filter((b) => (b.collaboratorIds || []).length > 0);
    default:
      return banks.value.filter((b) => b.status === 'published');
  }
});

const filteredBanks = computed(() => {
  const q = bankSearch.value.trim().toLowerCase();
  if (!q) return tabBanks.value;
  return tabBanks.value.filter(
    (b) => (b.name || '').toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q)
  );
});

const filteredQuestions = computed(() => {
  const q = questionSearch.value.trim().toLowerCase();
  if (!q) return bankQuestions.value;
  return bankQuestions.value.filter(
    (qu) => (qu.content || '').toLowerCase().includes(q) || (qu.name || '').toLowerCase().includes(q)
  );
});

function isSelected(qid: string): boolean {
  return props.selectedIds.includes(qid);
}

function resolveQuestion(qid: string): any | undefined {
  return bankQuestions.value.find((q) => q.id === qid) || questionCache.value[qid];
}

function questionContent(q: any): string {
  const raw = q?.content || q?.name || '未命名题目';
  const stripped = String(raw).replace(/<[^>]+>/g, '');
  return stripped.length > 60 ? `${stripped.slice(0, 60)}...` : stripped;
}

function typeLabel(type?: string): string {
  return type ? QUESTION_TYPE_LABELS[type] || type : '-';
}

function typeColor(type?: string): string {
  return (type && QUESTION_TYPE_COLORS[type]) || '#909399';
}

function difficultyLabel(d?: string): string {
  return d ? DIFFICULTY_LABELS[d] || d : '-';
}

const selectedQuestionItems = computed(() =>
  props.selectedIds.map((qid) => ({ questionId: qid, type: resolveQuestion(qid)?.type || 'single' }))
);

function onScoreCommand(cmd: string) {
  if (cmd === 'even') {
    handleEvenDistribution();
    return;
  }
  scoreDialogOpen.value = true;
}

function handleEvenDistribution() {
  const n = props.selectedIds.length;
  if (n === 0) return;
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  const scores: Record<string, number> = {};
  props.selectedIds.forEach((qid, idx) => {
    scores[qid] = base + (idx < remainder ? 1 : 0);
  });
  emit('update-scores', scores);
}
</script>

<style scoped>
.bank-panel {
  display: flex;
  gap: 16px;
  min-height: 0;
}
.panel-left {
  width: 60%;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}
.panel-right {
  width: 40%;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}
.back-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.bank-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.bank-tabs,
.search {
  margin-bottom: 10px;
}
.scroll-area {
  flex: 1;
  min-height: 220px;
  max-height: 420px;
  overflow-y: auto;
}
.loading {
  text-align: center;
  color: #a8abb2;
  font-size: 13px;
  padding: 24px 0;
}
.bank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bank-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.bank-card:hover {
  border-color: #a0cfff;
  background: #f7fbff;
}
.bank-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bank-label {
  font-size: 13px;
  font-weight: 500;
}
.arrow {
  margin-left: auto;
}
.bank-desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.q-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.check-box {
  width: 16px;
  height: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
}
.check-box.on {
  background: #409eff;
  border-color: #409eff;
}
.q-text {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
}
.right-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selected-card {
  border: 1px solid #d9ecff;
  background: #f7fbff;
  border-radius: 8px;
  padding: 8px 10px;
}
.selected-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.selected-text {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.dim {
  font-size: 11px;
  color: #a8abb2;
}
.score-box {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.score-input {
  width: 92px;
}
</style>
