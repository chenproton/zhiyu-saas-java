<template>
  <div class="editor-page">
    <div class="top-bar">
      <div class="top-inner">
        <router-link class="back-link" to="/portal/apps/ai/landing">
          <el-icon><ArrowLeft /></el-icon>返回工坊
        </router-link>
        <span class="divider" />
        <div v-if="agent" class="title-wrap">
          <span class="title-avatar">{{ agent.avatar }}</span>
          <h1 class="title">{{ agent.name }}</h1>
          <AiStatusBadge :status="agent.status" />
        </div>
        <div v-else class="title-wrap">
          <h1 class="title">加载中...</h1>
        </div>
        <div v-if="agent" class="actions">
          <el-button size="small" @click="router.push(`/portal/apps/ai/agents/${agent.id}`)">
            <el-icon><ChatDotRound /></el-icon>
            {{ agent.status === 'published' ? '去对话' : '预览对话' }}
          </el-button>
          <el-button v-if="agent.status === 'private' || agent.status === 'rejected'" size="small" type="primary" :loading="acting" @click="submit">
            <el-icon><Promotion /></el-icon>提交审核
          </el-button>
          <el-button v-if="agent.status === 'published'" size="small" :loading="acting" @click="unpublish">下架</el-button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="page-loading">加载中...</div>
    <div v-else-if="!agent" class="page-loading">加载失败</div>
    <div v-else class="content">
      <div v-if="agent.status === 'rejected' && agent.reviewComment" class="banner banner-danger">驳回原因：{{ agent.reviewComment }}</div>
      <div v-if="agent.status === 'pending'" class="banner banner-warning">审核中，请等待管理员处理</div>

      <div class="builder-grid">
        <AgentForm :initial="agent" submit-label="保存修改" :on-submit="save" :on-live-change="onLive" />
        <div class="preview-col">
          <AgentPreview :agent-id="agent.id" :system-prompt="live.prompt" :avatar="live.avatar" :name="live.name" />
        </div>
      </div>
    </div>

    <!-- 提交审核 warnings -->
    <el-dialog v-model="warningsOpen" title="已提交，等待管理员审核" width="480px">
      <p class="warn-sub">提交成功，但请注意以下事项</p>
      <ul class="warn-list">
        <li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
      </ul>
      <template #footer>
        <el-button type="primary" @click="warningsOpen = false">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ChatDotRound, Promotion } from '@element-plus/icons-vue';
import { aiCenterAgentApi } from '@/api/ai';
import type { AIAgent } from '@/types/ai';
import { aiAgentExt } from '../ai-api';
import AgentForm from '../components/AgentForm.vue';
import AgentPreview from '../components/AgentPreview.vue';
import AiStatusBadge from '../components/AiStatusBadge.vue';

interface AgentInput {
  name: string;
  avatar?: string;
  description?: string;
  coverImage?: string;
  greeting?: string;
  systemPrompt: string;
  kbIds?: string[];
  majorId?: string;
  departmentId?: string;
}

const route = useRoute();
const router = useRouter();
const agentId = String(route.params.id);

const agent = ref<AIAgent | null>(null);
const loading = ref(true);
const acting = ref(false);
const warnings = ref<string[]>([]);
const warningsOpen = ref(false);
const live = reactive({ prompt: '', name: '', avatar: '' });

async function load() {
  loading.value = true;
  try {
    const data = await aiAgentExt.get(agentId);
    agent.value = data;
    live.prompt = data.systemPrompt;
    live.name = data.name;
    live.avatar = data.avatar;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onLive(v: { prompt: string; name: string; avatar: string }) {
  live.prompt = v.prompt;
  live.name = v.name;
  live.avatar = v.avatar;
}

async function save(input: AgentInput) {
  await aiCenterAgentApi.update(agentId, input);
  ElMessage.success('保存成功');
  load();
}

async function submit() {
  if (acting.value) return;
  acting.value = true;
  try {
    const res = await aiAgentExt.submit(agentId);
    if (res.warnings && res.warnings.length > 0) {
      warnings.value = res.warnings;
      warningsOpen.value = true;
    } else {
      ElMessage.success('已提交，等待管理员审核');
    }
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}

async function unpublish() {
  if (acting.value) return;
  acting.value = true;
  try {
    await aiAgentExt.unpublish(agentId);
    ElMessage.success('已下架');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.editor-page {
  min-height: calc(100vh - 3.5rem);
  background: #f5f7fa;
}
.top-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid #e7e5e4;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
}
.top-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #909399;
  text-decoration: none;
  flex-shrink: 0;
}
.back-link:hover {
  color: var(--el-color-primary);
}
.divider {
  width: 1px;
  height: 20px;
  background: #e4e7ed;
  flex-shrink: 0;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.title-avatar {
  font-size: 20px;
}
.title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.page-loading {
  text-align: center;
  color: #909399;
  padding: 80px 0;
}
.content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 16px;
}
.banner {
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  margin-bottom: 16px;
}
.banner-danger {
  border: 1px solid #fde2e2;
  background: #fef0f0;
  color: #f56c6c;
}
.banner-warning {
  border: 1px solid #fdf0d5;
  background: #fdf6ec;
  color: #e6a23c;
}
.builder-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 20px;
  align-items: start;
}
.preview-col {
  display: none;
}
@media (min-width: 1280px) {
  .preview-col {
    display: block;
  }
  .builder-grid {
    grid-template-columns: minmax(0, 1fr) 420px;
  }
}
.warn-sub {
  color: #909399;
  margin: 0 0 12px;
}
.warn-list {
  margin: 0;
  padding-left: 20px;
  color: #606266;
  font-size: 14px;
}
</style>
