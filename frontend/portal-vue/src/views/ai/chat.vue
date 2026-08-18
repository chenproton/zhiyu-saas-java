<template>
  <div class="chat-page">
    <el-card shadow="never" class="chat-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">AI 对话</span>
        </div>
      </template>

      <div class="message-list" ref="listRef">
        <div v-for="(m, i) in messages" :key="i" class="message-row" :class="m.role">
          <div class="bubble">{{ m.content || (m.role === 'assistant' && streaming ? '思考中…' : '') }}</div>
        </div>
        <el-empty v-if="!messages.length" description="开始和 AI 对话吧" />
      </div>

      <div class="input-row">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          placeholder="输入消息，回车发送"
          @keydown.enter.exact.prevent="send"
        />
        <el-button type="primary" :loading="streaming" @click="send">发送</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { streamYiknowChat } from '@/api/ai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const messages = ref<ChatMessage[]>([]);
const input = ref('');
const streaming = ref(false);
const conversationId = ref<string | null>(null);
const listRef = ref<HTMLElement>();

async function scrollToBottom() {
  await nextTick();
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
}

async function send() {
  const text = input.value.trim();
  if (!text || streaming.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: text });
  messages.value.push({ role: 'assistant', content: '' });
  const assistantIdx = messages.value.length - 1;
  streaming.value = true;
  scrollToBottom();

  try {
    await streamYiknowChat(
      conversationId.value,
      text,
      {
        onMeta: (data) => {
          if (data.conversationId) conversationId.value = data.conversationId;
        },
        onDelta: (t) => {
          messages.value[assistantIdx].content += t;
          scrollToBottom();
        },
        onDone: () => {
          if (!messages.value[assistantIdx].content) {
            messages.value[assistantIdx].content = '(无回复)';
          }
        },
        onError: (_code, msg) => {
          ElMessage.error(msg || '对话失败');
        }
      }
    );
  } catch (e) {
    messages.value[assistantIdx].content = (e as Error).message || '对话失败';
  } finally {
    streaming.value = false;
    scrollToBottom();
  }
}
</script>

<style scoped>
.chat-page { padding: 16px; height: calc(100vh - 120px); }
.chat-card { height: 100%; display: flex; flex-direction: column; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.message-list { flex: 1; overflow-y: auto; padding: 12px; min-height: 300px; }
.message-row { display: flex; margin-bottom: 12px; }
.message-row.user { justify-content: flex-end; }
.message-row.assistant { justify-content: flex-start; }
.bubble { max-width: 70%; padding: 10px 14px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; }
.user .bubble { background: #409eff; color: #fff; }
.assistant .bubble { background: #f4f4f5; color: #303133; }
.input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #ebeef5; }
.input-row .el-textarea { flex: 1; }
</style>
