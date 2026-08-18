<template>
  <div class="chat-page">
    <div v-if="agentLoading" class="page-loading">加载中</div>
    <el-empty v-else-if="!agent" description="智能体不存在或无权访问" />
    <div v-else class="chat-layout">
      <!-- 会话列表 -->
      <aside class="conv-side">
        <div class="conv-head">
          <el-button size="small" @click="startNew">新对话</el-button>
        </div>
        <div class="conv-list">
          <p v-if="!conversations.length" class="conv-empty">暂无会话</p>
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="conv-item"
            :class="{ active: activeConvId === conv.id }"
            @click="openConversation(conv)"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span class="conv-title">{{ conv.title || '未命名会话' }}</span>
            <el-icon class="conv-del" @click.stop="deleteTarget = conv"><Delete /></el-icon>
          </div>
        </div>
      </aside>

      <!-- 对话主区 -->
      <div class="chat-main">
        <div v-if="agent.coverImage" class="chat-cover" :style="{ backgroundImage: `url('${agent.coverImage}')` }" />
        <div class="chat-head">
          <div class="agent-avatar">{{ agent.avatar || '🤖' }}</div>
          <div class="agent-info">
            <h1>{{ agent.name }}</h1>
            <p v-if="agent.description">{{ agent.description }}</p>
          </div>
          <FavoriteButton target-type="ai_agent" :target-id="agent.id" />
        </div>

        <div ref="listRef" class="msg-list">
          <div v-if="historyLoading" class="msg-loading">加载中...</div>
          <template v-else>
            <div v-if="!messages.length && agent.greeting" class="msg-row assistant">
              <div class="bubble">{{ agent.greeting }}</div>
            </div>
            <p v-if="!messages.length && !agent.greeting" class="msg-empty">输入内容开始对话</p>
            <div v-for="m in messages" :key="m.id" class="msg-row" :class="m.role">
              <div class="bubble">
                {{ m.content || (m.streaming ? '思考中' : '') }}
                <span v-if="m.streaming && m.content" class="cursor">▍</span>
                <p v-if="m.failed" class="msg-failed">回答中断，请重试</p>
                <SourceList v-if="m.role === 'assistant'" :sources="m.sources" />
              </div>
            </div>
          </template>
        </div>

        <div class="msg-input">
          <el-input
            v-model="input"
            :disabled="sending"
            placeholder="输入消息，Enter 发送"
            @keydown.enter.exact.prevent="send"
          />
          <el-button v-if="sending" @click="stop">停止</el-button>
          <el-button v-else type="primary" :disabled="!input.trim()" @click="send">发送</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="deleteOpen" title="删除会话" width="420px">
      <p>确认删除该会话？删除后不可恢复</p>
      <template #footer>
        <el-button @click="deleteTarget = null">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="doDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Delete } from '@element-plus/icons-vue';
import { streamAICenter } from '@/api/ai';
import type { AIAgent } from '@/types/ai';
import { aiAgentExt } from './ai-api';
import type { AIConversation, AIMessageSource } from './ai-api';
import FavoriteButton from './components/FavoriteButton.vue';
import SourceList from './components/SourceList.vue';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AIMessageSource[];
  streaming?: boolean;
  failed?: boolean;
}

const route = useRoute();
const agentId = String(route.params.id);

const agent = ref<AIAgent | null>(null);
const agentLoading = ref(true);
const conversations = ref<AIConversation[]>([]);
const activeConvId = ref<string | undefined>(undefined);
const historyLoading = ref(false);
const messages = ref<ChatMsg[]>([]);
const input = ref('');
const sending = ref(false);
const deleteTarget = ref<AIConversation | null>(null);
const deleting = ref(false);
const listRef = ref<HTMLElement | null>(null);
let abort: AbortController | null = null;

const deleteOpen = computed({ get: () => !!deleteTarget.value, set: (v) => { if (!v) deleteTarget.value = null; } });

function scrollToBottom() {
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function refreshConversations() {
  try {
    const res = await aiAgentExt.listConversations(agentId);
    conversations.value = res.items;
  } catch {
    /* 忽略 */
  }
}

async function loadAgent() {
  agentLoading.value = true;
  try {
    agent.value = await aiAgentExt.get(agentId);
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    agentLoading.value = false;
  }
}

async function openConversation(conv: AIConversation) {
  if (conv.id === activeConvId.value) return;
  abort?.abort();
  sending.value = false;
  activeConvId.value = conv.id;
  historyLoading.value = true;
  messages.value = [];
  try {
    const res = await aiAgentExt.getConversation(conv.id);
    messages.value = res.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources || []
    }));
    scrollToBottom();
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    historyLoading.value = false;
  }
}

function startNew() {
  abort?.abort();
  sending.value = false;
  activeConvId.value = undefined;
  messages.value = [];
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await aiAgentExt.removeConversation(deleteTarget.value.id);
    if (activeConvId.value === deleteTarget.value.id) startNew();
    await refreshConversations();
    deleteTarget.value = null;
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    deleting.value = false;
  }
}

function patchMsg(id: string, patch: Partial<ChatMsg>) {
  messages.value = messages.value.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

async function send() {
  const content = input.value.trim();
  if (!content || sending.value) return;
  abort?.abort();
  const controller = new AbortController();
  abort = controller;

  const userMsg: ChatMsg = { id: `local-u-${crypto.randomUUID()}`, role: 'user', content, sources: [] };
  const assistantId = `local-a-${crypto.randomUUID()}`;
  const assistantMsg: ChatMsg = { id: assistantId, role: 'assistant', content: '', sources: [], streaming: true };
  messages.value = [...messages.value, userMsg, assistantMsg];
  input.value = '';
  sending.value = true;
  scrollToBottom();

  const convIdAtSend = activeConvId.value;
  try {
    await streamAICenter(
      `/ai/agents/${agentId}/chat`,
      { conversationId: convIdAtSend, message: content },
      {
        onMeta: (data) => {
          if (!convIdAtSend && data.conversationId) activeConvId.value = data.conversationId;
        },
        onSources: (sources) => patchMsg(assistantId, { sources }),
        onDelta: (text) => {
          messages.value = messages.value.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m));
          scrollToBottom();
        },
        onDone: () => {
          patchMsg(assistantId, { streaming: false });
          refreshConversations();
        },
        onError: (code, msg) => {
          patchMsg(assistantId, { streaming: false, failed: true });
          ElMessage.error(msg || code || '发送失败');
        }
      },
      controller.signal
    );
  } catch (e) {
    patchMsg(assistantId, { streaming: false, failed: true });
    if ((e as Error).name !== 'AbortError') {
      ElMessage.error((e as Error).message || '发送失败');
    }
  } finally {
    sending.value = false;
  }
}

function stop() {
  abort?.abort();
}

onMounted(() => {
  loadAgent();
  refreshConversations();
});
onBeforeUnmount(() => abort?.abort());
</script>

<style scoped>
.chat-page {
  max-width: 1200px;
  margin: 0 auto;
}
.page-loading {
  text-align: center;
  color: #909399;
  padding: 80px 0;
}
.chat-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 3.5rem);
  padding: 16px 0;
}
.conv-side {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.conv-head {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.conv-head .el-button {
  width: 100%;
}
.conv-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.conv-empty {
  text-align: center;
  color: #909399;
  font-size: 12px;
  padding: 24px 0;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  color: #303133;
  transition: all 0.2s;
}
.conv-item:hover {
  background: #f5f7fa;
}
.conv-item.active {
  background: var(--el-color-primary-light-9);
  font-weight: 500;
}
.conv-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-del {
  color: #c0c4cc;
  opacity: 0;
  transition: opacity 0.2s;
}
.conv-item:hover .conv-del {
  opacity: 1;
}
.conv-del:hover {
  color: #f56c6c;
}
.chat-main {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.chat-cover {
  height: 80px;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
.chat-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}
.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.agent-info {
  flex: 1;
  min-width: 0;
}
.agent-info h1 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-info p {
  font-size: 12px;
  color: #909399;
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.msg-loading {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}
.msg-empty {
  text-align: center;
  color: #909399;
  font-size: 14px;
  margin-top: 64px;
}
.msg-row {
  display: flex;
}
.msg-row.user {
  justify-content: flex-end;
}
.msg-row.assistant {
  justify-content: flex-start;
}
.bubble {
  max-width: 80%;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.user .bubble {
  background: var(--el-color-primary);
  color: #fff;
}
.assistant .bubble {
  background: #f5f7fa;
  color: #303133;
}
.cursor {
  animation: blink 1s infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.msg-failed {
  color: #f56c6c;
  font-size: 12px;
  margin: 8px 0 0;
}
.msg-input {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}
</style>
