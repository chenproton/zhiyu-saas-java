<template>
  <div class="detail-page">
    <div v-if="loading" class="page-loading">加载中</div>
    <el-empty v-else-if="!kb" description="知识库不存在或无权访问">
      <el-button @click="router.push('/portal/apps/ai/landing')">返回广场</el-button>
    </el-empty>
    <div v-else class="content">
      <el-button text size="small" class="back" @click="router.push('/portal/apps/ai/landing')">
        <el-icon><ArrowLeft /></el-icon>返回广场
      </el-button>

      <el-card shadow="never" class="head-card">
        <div class="cover" :style="coverStyle" />
        <div class="head-body">
          <div class="head-main">
            <div class="head-icon"><el-icon><Collection /></el-icon></div>
            <div class="head-info">
              <h1>{{ kb.name }}</h1>
              <p class="desc">{{ kb.description || '无描述' }}</p>
            </div>
            <FavoriteButton target-type="ai_kb" :target-id="kb.id" />
          </div>
          <div v-if="kb.tags && kb.tags.length" class="tags">
            <el-tag v-for="t in kb.tags" :key="t" type="info">{{ t }}</el-tag>
          </div>
          <div class="stats">
            <span><el-icon><Document /></el-icon>{{ kb.docCount }} 个文档</span>
            <span><el-icon><QuestionFilled /></el-icon>{{ kb.askCount }} 次提问</span>
            <span><el-icon><View /></el-icon>{{ kb.viewCount ?? 0 }} 次浏览</span>
            <span><el-icon><User /></el-icon>{{ kb.ownerName || '未知' }}</span>
          </div>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-title"><el-icon><UserFilled /></el-icon>贡献者</div>
        </template>
        <div class="contributors">
          <div class="contributor">
            <span class="c-avatar owner">{{ (kb.ownerName || '?').slice(0, 1) }}</span>
            <span class="c-name">{{ kb.ownerName || '未知' }}</span>
            <el-tag size="small" type="info">创建者</el-tag>
          </div>
          <div v-for="c in collaborators" :key="c.id" class="contributor">
            <span class="c-avatar">{{ (c.userName || '?').slice(0, 1) }}</span>
            <span class="c-name">{{ c.userName || '未知' }}</span>
            <el-tag size="small" type="info" effect="plain">{{ c.role === 'editor' ? '编辑者' : '查看者' }}</el-tag>
          </div>
          <span v-if="!collaborators.length" class="no-collab">暂无协作者</span>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-title">文档列表</div>
        </template>
        <p v-if="!docs.length" class="empty">暂无文档</p>
        <el-table v-else :data="docs" size="small">
          <el-table-column label="名称" min-width="220">
            <template #default="{ row }">
              <span class="doc-name"><el-icon><Document /></el-icon>{{ row.name }}</span>
              <span v-if="row.status === 'failed' && row.error" class="doc-error">{{ row.error }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="110">
            <template #default="{ row }">{{ (row.name.split('.').pop() || '').slice(0, 6) }}</template>
          </el-table-column>
          <el-table-column label="贡献者" width="120">
            <template #default="{ row }">{{ row.uploaderName || '未知' }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="130">
            <template #default="{ row }">{{ new Date(row.createdAt).toLocaleDateString() }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'ready'" type="success" size="small">就绪</el-tag>
              <el-tag v-else-if="row.status === 'parsing'" type="warning" size="small">解析中</el-tag>
              <el-tag v-else type="danger" size="small">解析失败</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-title">问一问</div>
          <p class="card-sub">基于库内文档回答，回答附来源片段；你的提问记录会自动保存</p>
        </template>
        <div ref="listRef" class="qa-list">
          <p v-if="!qaList.length" class="empty">输入问题开始问答</p>
          <div v-for="item in qaList" :key="item.id" class="qa-item">
            <div class="qa-row user">
              <div class="qa-bubble user">{{ item.question }}</div>
            </div>
            <div class="qa-row assistant">
              <div class="qa-bubble assistant">
                {{ item.answer || (item.streaming ? '思考中' : '') }}
                <SourceList :sources="item.sources" />
              </div>
            </div>
            <p v-if="item.failed" class="qa-failed">回答中断，请重试</p>
          </div>
        </div>
        <div class="qa-input">
          <el-input v-model="input" :disabled="asking" placeholder="输入问题，Enter 发送" @keydown.enter.exact.prevent="ask" />
          <el-button type="primary" :loading="asking" :disabled="!input.trim()" @click="ask">发送</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Collection, Document, QuestionFilled, User, UserFilled, View } from '@element-plus/icons-vue';
import { aiCenterKbApi, streamAICenter } from '@/api/ai';
import type { AIKnowledgeBase } from '@/types/ai';
import { aiKbExt, aiV22Ext, coverGradientFor } from './ai-api';
import type { AIKBCollaborator, AIKBDocument, AIMessageSource } from './ai-api';
import FavoriteButton from './components/FavoriteButton.vue';
import SourceList from './components/SourceList.vue';

interface QAItem {
  id: string;
  question: string;
  answer: string;
  sources: AIMessageSource[];
  streaming: boolean;
  failed?: boolean;
}

const route = useRoute();
const router = useRouter();
const kbId = String(route.params.id);

const kb = ref<AIKnowledgeBase | null>(null);
const docs = ref<AIKBDocument[]>([]);
const collaborators = ref<AIKBCollaborator[]>([]);
const loading = ref(true);

const qaList = ref<QAItem[]>([]);
const input = ref('');
const asking = ref(false);
const listRef = ref<HTMLElement | null>(null);
let abort: AbortController | null = null;

const coverStyle = computed(() =>
  kb.value?.coverImage
    ? { backgroundImage: `url('${kb.value.coverImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: coverGradientFor(kbId) }
);

async function load() {
  loading.value = true;
  try {
    const [kbRes, docRes, colRes, askRes] = await Promise.all([
      aiCenterKbApi.get(kbId),
      aiKbExt.listDocuments(kbId),
      aiKbExt.listCollaborators(kbId).catch(() => ({ items: [] as AIKBCollaborator[] })),
      aiV22Ext.listMyKBAsks(kbId).catch(() => ({ items: [] }))
    ]);
    kb.value = kbRes;
    docs.value = docRes.items;
    collaborators.value = colRes.items || [];
    qaList.value = (askRes.items || []).slice().reverse().map((a) => ({
      id: a.id,
      question: a.question,
      answer: a.answer,
      sources: [],
      streaming: false
    }));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function patchQA(id: string, patch: Partial<QAItem>) {
  qaList.value = qaList.value.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

async function ask() {
  const message = input.value.trim();
  if (!message || asking.value) return;
  abort?.abort();
  const controller = new AbortController();
  abort = controller;
  const qaId = `qa-${crypto.randomUUID()}`;
  qaList.value = [...qaList.value, { id: qaId, question: message, answer: '', sources: [], streaming: true }];
  input.value = '';
  asking.value = true;
  scrollToBottom();
  try {
    await streamAICenter(
      `/ai/kb/${kbId}/ask`,
      { message },
      {
        onDelta: (text) => {
          qaList.value = qaList.value.map((item) => (item.id === qaId ? { ...item, answer: item.answer + text } : item));
          scrollToBottom();
        },
        onSources: (sources) => patchQA(qaId, { sources }),
        onDone: () => patchQA(qaId, { streaming: false }),
        onError: (code, msg) => {
          patchQA(qaId, { streaming: false, failed: true });
          ElMessage.error(msg || code || '发送失败');
        }
      },
      controller.signal
    );
  } catch (e) {
    patchQA(qaId, { streaming: false, failed: true });
    if ((e as Error).name !== 'AbortError') {
      ElMessage.error((e as Error).message || '发送失败');
    }
  } finally {
    asking.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => abort?.abort());
</script>

<style scoped>
.detail-page {
  max-width: 960px;
  margin: 0 auto;
}
.page-loading {
  text-align: center;
  color: #909399;
  padding: 80px 0;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 0;
}
.back {
  align-self: flex-start;
}
.head-card {
  overflow: hidden;
}
.head-card :deep(.el-card__body) {
  padding: 0;
}
.cover {
  height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.head-body {
  padding: 20px;
}
.head-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.head-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.head-info {
  flex: 1;
  min-width: 0;
}
.head-info h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.desc {
  color: #909399;
  font-size: 14px;
  margin: 4px 0 0;
  white-space: pre-wrap;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #909399;
  font-size: 12px;
  margin-top: 12px;
}
.stats span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  color: #909399;
  font-size: 12px;
  margin: 4px 0 0;
}
.contributors {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.contributor {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 999px;
  padding: 4px 12px 4px 4px;
}
.c-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.c-avatar.owner {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.c-name {
  font-size: 14px;
}
.no-collab {
  color: #909399;
  font-size: 12px;
  align-self: center;
}
.doc-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.doc-error {
  color: #f56c6c;
  font-size: 12px;
  margin-left: 8px;
}
.empty {
  text-align: center;
  color: #909399;
  font-size: 14px;
  padding: 24px 0;
  margin: 0;
}
.qa-list {
  max-height: 384px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px;
}
.qa-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qa-row {
  display: flex;
}
.qa-row.user {
  justify-content: flex-end;
}
.qa-row.assistant {
  justify-content: flex-start;
}
.qa-bubble {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.qa-bubble.user {
  background: var(--el-color-primary);
  color: #fff;
}
.qa-bubble.assistant {
  background: #f5f7fa;
  color: #303133;
}
.qa-failed {
  color: #f56c6c;
  font-size: 12px;
  margin: 0;
  text-align: right;
}
.qa-input {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>
