<template>
  <div class="preview-panel">
    <div class="preview-head">
      <div class="preview-avatar">{{ avatar || '🤖' }}</div>
      <div class="preview-title">
        <div class="p-name">{{ name?.trim() || '未命名智能体' }}</div>
        <div class="p-sub">实时试聊 · 用当前提示词，不产生记录</div>
      </div>
      <el-button v-if="messages.length" text size="small" @click="messages = []">清空</el-button>
    </div>
    <div ref="listRef" class="preview-list">
      <div v-if="!messages.length" class="preview-empty">
        <div class="p-empty-icon"><el-icon><ChatDotRound /></el-icon></div>
        <p>输入一句话试试当前配置的效果</p>
        <p class="p-empty-sub">左侧提示词改动即时生效，无需先保存</p>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="p-msg-row" :class="m.role">
        <div class="p-bubble">{{ m.content }}</div>
      </div>
      <div v-if="sending" class="p-msg-row assistant">
        <div class="p-bubble p-loading"><el-icon class="is-loading"><Loading /></el-icon></div>
      </div>
    </div>
    <div class="preview-input">
      <el-input
        v-model="input"
        :disabled="sending"
        placeholder="输入测试消息，Enter 发送"
        @keydown.enter.exact.prevent="send"
      />
      <el-button type="primary" :loading="sending" :disabled="!input.trim()" @click="send">发送</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Loading } from '@element-plus/icons-vue';
import { aiV22Ext } from '../ai-api';

const props = defineProps<{
  agentId: string;
  systemPrompt: string;
  avatar?: string;
  name?: string;
}>();

const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([]);
const input = ref('');
const sending = ref(false);
const listRef = ref<HTMLElement | null>(null);

async function send() {
  const content = input.value.trim();
  if (!content || sending.value) return;
  messages.value.push({ role: 'user', content });
  input.value = '';
  sending.value = true;
  try {
    const res = await aiV22Ext.previewAgent(props.agentId, props.systemPrompt, content);
    messages.value.push({ role: 'assistant', content: res.reply });
    nextTick(() => {
      const el = listRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '预览失败');
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.preview-panel {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8.5rem);
  position: sticky;
  top: 7.5rem;
}
.preview-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px dashed #e7e5e4;
}
.preview-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #79bbff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.preview-title {
  flex: 1;
  min-width: 0;
}
.p-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.preview-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #909399;
}
.p-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  font-size: 24px;
  margin-bottom: 12px;
}
.p-empty-sub {
  font-size: 12px;
  color: #c0c4cc;
}
.p-msg-row {
  display: flex;
}
.p-msg-row.user {
  justify-content: flex-end;
}
.p-msg-row.assistant {
  justify-content: flex-start;
}
.p-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
.user .p-bubble {
  background: var(--el-color-primary);
  color: #fff;
  border-top-right-radius: 4px;
}
.assistant .p-bubble {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.p-loading {
  display: flex;
  align-items: center;
}
.preview-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e7e5e4;
  background: #fff;
}
</style>
