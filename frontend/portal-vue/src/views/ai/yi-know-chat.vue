<template>
  <div class="yk-chat">
    <!-- 左侧功能轨 -->
    <aside class="yk-side">
      <div class="yk-brand">
        <div class="brand-logo"><el-icon><MagicStick /></el-icon></div>
        <div>
          <div class="brand-name">YIKnow</div>
          <div class="brand-sub">You Ask · I Know · 你问，我懂</div>
        </div>
      </div>

      <nav class="yk-nav">
        <div
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: view === item.id }"
          @click="view = item.id"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </div>
        <div v-for="p in placeholderItems" :key="p.id" class="nav-item placeholder" @click="toastPlaceholder(p.label)">
          <el-icon><component :is="p.icon" /></el-icon>
          <span>{{ p.label }}</span>
          <span class="soon">待上线</span>
        </div>
      </nav>

      <div class="conv-header">
        <span>历史会话</span>
        <el-button text size="small" type="primary" @click="startNewChat">
          <el-icon><Plus /></el-icon>新对话
        </el-button>
      </div>
      <div class="conv-list">
        <p v-if="!conversations.length" class="conv-empty">暂无历史会话</p>
        <template v-for="g in convGroups" :key="g.label">
          <p class="conv-group-label">{{ g.label }}</p>
          <div
            v-for="c in g.items"
            :key="c.id"
            class="conv-item"
            :class="{ active: c.id === activeConvId }"
            :title="'双击重命名'"
            @click="openConversation(c.id)"
            @dblclick="startRename(c)"
          >
            <el-icon v-if="renamingId !== c.id"><ChatDotRound /></el-icon>
            <input
              v-if="renamingId === c.id"
              v-model="renameValue"
              class="rename-input"
              @click.stop
              @blur="submitRename(c.id)"
              @keydown.enter="submitRename(c.id)"
              @keydown.esc="renamingId = null"
            />
            <span v-else class="conv-title">{{ c.title || '未命名会话' }}</span>
            <el-icon class="conv-del" @click.stop="deleteConversation(c.id)"><Delete /></el-icon>
          </div>
        </template>
      </div>
      <div class="yk-foot">基于租户自有 AI 服务，会话自动保存</div>
    </aside>

    <!-- 主区 -->
    <main class="yk-main">
      <template v-if="view !== 'chat'">
        <div class="assets">
          <div class="assets-head">
            <h2>{{ view === 'kbs' ? '我的知识库' : '我的智能体' }}</h2>
            <p>{{ view === 'kbs' ? '你创建的与收藏的知识库，点击即可进入详情提问' : '你创建的与收藏的智能体，点击即可进入对话' }}</p>
          </div>
          <div v-if="assetsLoading" class="assets-loading">加载中...</div>
          <template v-else>
            <div class="asset-section">
              <div class="asset-sec-head"><el-icon><component :is="assetIcon" /></el-icon>我创建的<span>{{ mine.length }}</span></div>
              <p v-if="!mine.length" class="asset-empty">{{ view === 'kbs' ? '暂无知识库' : '暂无智能体' }}</p>
              <div v-else class="asset-grid">
                <button v-for="a in mine" :key="a.id" class="asset-item" @click="openAsset(a.id)">
                  <span class="asset-ico">{{ a.avatar || (view === 'kbs' ? '📚' : '🤖') }}</span>
                  <span class="asset-info">
                    <span class="asset-name"><AiStatusBadge :status="a.status" /> {{ a.name }}</span>
                    <span class="asset-meta">
                      <el-icon><View /></el-icon>{{ a.viewCount ?? 0 }}
                      <template v-if="view === 'kbs'"><el-icon><Document /></el-icon>{{ a.docCount ?? 0 }} 个文档</template>
                    </span>
                  </span>
                </button>
              </div>
            </div>
            <div class="asset-section">
              <div class="asset-sec-head"><el-icon><Star /></el-icon>我收藏的<span>{{ favs.length }}</span></div>
              <p v-if="!favs.length" class="asset-empty">{{ view === 'kbs' ? '暂无知识库' : '暂无智能体' }}</p>
              <div v-else class="asset-grid">
                <button v-for="a in favs" :key="a.id" class="asset-item" @click="openAsset(a.id)">
                  <span class="asset-ico">{{ a.avatar || (view === 'kbs' ? '📚' : '🤖') }}</span>
                  <span class="asset-info">
                    <span class="asset-name"><AiStatusBadge :status="a.status" /> {{ a.name }}</span>
                    <span class="asset-meta">
                      <el-icon><View /></el-icon>{{ a.viewCount ?? 0 }}
                      <template v-if="view === 'kbs'"><el-icon><Document /></el-icon>{{ a.docCount ?? 0 }} 个文档</template>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template v-else>
        <div class="chat-wrap">
          <div ref="listRef" class="msg-list" @scroll="onScroll">
            <div v-if="loadingConv" class="msg-loading">加载中...</div>
            <div v-else-if="!messages.length" class="chat-empty">
              <div class="empty-logo"><el-icon :size="32"><MagicStick /></el-icon></div>
              <h1>YIKnow 智能对话</h1>
              <p>你好，我是 YIKnow 智能助手。输入内容开始对话，我会尽力帮助你。</p>
              <div class="presets">
                <button v-for="q in presets" :key="q" :disabled="sending" @click="handleSend(q)">{{ q }}</button>
              </div>
            </div>
            <div v-for="(m, i) in messages" :key="i" class="msg-row" :class="m.role">
              <div class="bubble">{{ m.content || (m.role === 'assistant' && sending && !m.failed ? '思考中' : '') }}</div>
              <div v-if="m.failed" class="msg-failed" @click="handleRegenerate">生成失败 · 点击重试</div>
            </div>
          </div>
          <div class="input-row">
            <el-input
              v-model="input"
              type="textarea"
              :rows="1"
              resize="none"
              :disabled="sending"
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              @keydown.enter.exact.prevent="handleSend()"
            />
            <el-button v-if="sending" type="danger" plain @click="handleStop">停止</el-button>
            <el-button v-else type="primary" :disabled="!input.trim()" @click="handleSend()">发送</el-button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ChatDotRound,
  Delete,
  Document,
  MagicStick,
  Plus,
  Star,
  View
} from '@element-plus/icons-vue';
import { streamYiknowChat, aiCenterAgentApi } from '@/api/ai';
import { aiAgentExt, aiKbExt, aiV22Ext, aiFavoriteList } from './ai-api';
import type { AIConversation } from './ai-api';
import AiStatusBadge from './components/AiStatusBadge.vue';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

interface AssetRow {
  id: string;
  name: string;
  status: string;
  viewCount?: number;
  docCount?: number;
  avatar?: string;
}

const navItems = [
  { id: 'chat' as const, label: '智能对话', icon: ChatDotRound },
  { id: 'kbs' as const, label: '我的知识库', icon: Document },
  { id: 'agents' as const, label: '我的智能体', icon: MagicStick }
];
const placeholderItems = [
  { id: 'plans', label: '我的方案', icon: Document },
  { id: 'jobs', label: '岗位库', icon: Star },
  { id: 'scenes', label: '场景库', icon: View },
  { id: 'settings', label: '设置', icon: Delete }
];
const presets = ['帮我写一份实训报告大纲', '如何准备一场技术面试？', '推荐一些专业课的学习方法'];

const messages = ref<ChatMsg[]>([]);
const input = ref('');
const sending = ref(false);
const conversations = ref<AIConversation[]>([]);
const view = ref<'chat' | 'kbs' | 'agents'>('chat');
const activeConvId = ref<string | null>(null);
const loadingConv = ref(false);
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const listRef = ref<HTMLElement | null>(null);
const follow = ref(true);
let abort: AbortController | null = null;

// 我的资产
const mine = ref<AssetRow[]>([]);
const favs = ref<AssetRow[]>([]);
const assetsLoading = ref(false);

const assetIcon = computed(() => (view.value === 'kbs' ? Document : MagicStick));

function toastPlaceholder(label: string) {
  ElMessage.info(`功能建设中，敬请期待：${label}`);
}

async function loadConversations() {
  try {
    const res = await aiV22Ext.listYiknowConversations();
    conversations.value = res.items || [];
  } catch {
    /* 忽略 */
  }
}

const convGroups = computed(() => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: { label: string; items: AIConversation[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '7 天内', items: [] },
    { label: '更早', items: [] }
  ];
  for (const c of conversations.value) {
    const ts = new Date(c.updatedAt || c.createdAt).getTime();
    if (ts >= startOfDay) groups[0].items.push(c);
    else if (startOfDay - ts <= 86400000) groups[1].items.push(c);
    else if (startOfDay - ts <= 7 * 86400000) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
});

function scrollToBottom(force = false) {
  if (!force && !follow.value) return;
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function onScroll() {
  const el = listRef.value;
  if (!el) return;
  follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

function startNewChat() {
  abort?.abort();
  sending.value = false;
  activeConvId.value = null;
  messages.value = [];
  input.value = '';
  follow.value = true;
}

async function openConversation(id: string) {
  if (id === activeConvId.value || loadingConv.value) return;
  abort?.abort();
  sending.value = false;
  loadingConv.value = true;
  try {
    const res = await aiAgentExt.getConversation(id);
    activeConvId.value = id;
    messages.value = (res.messages || []).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
    follow.value = true;
    scrollToBottom(true);
  } catch {
    ElMessage.error('加载会话失败');
  } finally {
    loadingConv.value = false;
  }
}

async function deleteConversation(id: string) {
  try {
    await aiAgentExt.removeConversation(id);
    if (id === activeConvId.value) startNewChat();
    conversations.value = conversations.value.filter((c) => c.id !== id);
  } catch {
    ElMessage.error('删除失败');
  }
}

function startRename(c: AIConversation) {
  renamingId.value = c.id;
  renameValue.value = c.title || '';
}

async function submitRename(id: string) {
  const title = renameValue.value.trim();
  renamingId.value = null;
  if (!title) return;
  try {
    await aiAgentExt.renameConversation(id, title);
    conversations.value = conversations.value.map((c) => (c.id === id ? { ...c, title } : c));
  } catch (e) {
    ElMessage.error((e as Error).message || '重命名失败');
  }
}

async function runStream(content: string, regenerate = false) {
  if (!content || sending.value) return;
  sending.value = true;
  if (!regenerate) {
    messages.value.push({ role: 'user', content }, { role: 'assistant', content: '' });
  } else {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'assistant') {
        messages.value[i] = { role: 'assistant', content: '' };
        break;
      }
    }
  }
  follow.value = true;
  scrollToBottom(true);
  abort = new AbortController();
  const signal = abort.signal;
  try {
    await streamYiknowChat(
      activeConvId.value,
      content,
      {
        onMeta: (data) => {
          if (data.conversationId) activeConvId.value = data.conversationId;
        },
        onDelta: (t) => {
          const last = messages.value[messages.value.length - 1];
          if (last && last.role === 'assistant') last.content += t;
          scrollToBottom();
        },
        onDone: () => loadConversations(),
        onError: (_code, msg) => {
          const last = messages.value[messages.value.length - 1];
          if (last && last.role === 'assistant') last.failed = true;
          ElMessage.error(msg || '发送失败');
        }
      },
      signal
    );
  } catch (e) {
    if (signal.aborted) return;
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === 'assistant') last.failed = true;
    ElMessage.error((e as Error).message || '发送失败');
  } finally {
    sending.value = false;
  }
}

function handleSend(preset?: string) {
  const content = (preset ?? input.value).trim();
  if (!content || sending.value) return;
  input.value = '';
  runStream(content);
}

function handleStop() {
  abort?.abort();
  sending.value = false;
}

function handleRegenerate() {
  if (sending.value) return;
  const lastUser = [...messages.value].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  runStream(lastUser.content, true);
}

async function loadAssets() {
  const isKb = view.value === 'kbs';
  assetsLoading.value = true;
  const toRow = (k: { id: string; name: string; status: string; viewCount?: number; docCount?: number; avatar?: string }): AssetRow => ({
    id: k.id,
    name: k.name,
    status: k.status,
    viewCount: k.viewCount,
    docCount: k.docCount,
    avatar: k.avatar
  });
  try {
    const [mineRes, favRes] = await Promise.allSettled([
      isKb ? aiKbExt.listMine({ scope: 'owned', pageSize: 100 }) : aiCenterAgentApi.listMine(),
      aiFavoriteList.list()
    ]);
    if (mineRes.status === 'fulfilled') {
      mine.value = (mineRes.value.items || []).map(toRow);
    }
    if (favRes.status === 'fulfilled') {
      const fl = favRes.value;
      favs.value = isKb ? (fl.ai_kb || []).map(toRow) : (fl.ai_agent || []).map(toRow);
    }
  } finally {
    assetsLoading.value = false;
  }
}

function openAsset(id: string) {
  window.location.href = view.value === 'kbs' ? `/portal/apps/ai/kb/${id}` : `/portal/apps/ai/agents/${id}`;
}

watch(
  () => view.value,
  (v) => {
    if (v !== 'chat') loadAssets();
  }
);

onMounted(loadConversations);
</script>

<style scoped>
.yk-chat {
  display: flex;
  height: 100%;
  min-height: 0;
  background: #f5f7fa;
}
.yk-side {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.yk-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #79bbff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 8px rgba(64, 158, 255, 0.3);
}
.brand-name {
  font-size: 14px;
  font-weight: 700;
}
.brand-sub {
  font-size: 11px;
  color: #909399;
}
.yk-nav {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}
.nav-item:hover {
  background: #f5f7fa;
}
.nav-item.active {
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
}
.nav-item.placeholder {
  color: #909399;
}
.soon {
  margin-left: auto;
  font-size: 10px;
  background: #f0f0f0;
  color: #909399;
  padding: 2px 6px;
  border-radius: 999px;
}
.conv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  color: #909399;
  border-top: 1px solid #f0f0f0;
}
.conv-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 8px;
}
.conv-empty {
  font-size: 11px;
  color: #909399;
  padding: 8px 4px;
}
.conv-group-label {
  font-size: 10px;
  color: #c0c4cc;
  padding: 8px 10px 2px;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  color: #303133;
  transition: all 0.2s;
}
.conv-item:hover {
  background: #f5f7fa;
}
.conv-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
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
.rename-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-color-primary);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  outline: none;
}
.yk-foot {
  padding: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 11px;
  color: #909399;
}
.yk-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.chat-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}
.msg-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}
.msg-loading {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}
.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.empty-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #409eff, #79bbff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.35);
  margin-bottom: 16px;
}
.chat-empty h1 {
  font-size: 18px;
  margin: 0 0 8px;
}
.chat-empty p {
  color: #909399;
  font-size: 14px;
  max-width: 420px;
  margin: 0;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 20px;
}
.presets button {
  border: 1px solid #e4e7ed;
  background: #fff;
  color: #606266;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
}
.presets button:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.msg-row {
  display: flex;
  flex-direction: column;
}
.msg-row.user {
  align-items: flex-end;
}
.msg-row.assistant {
  align-items: flex-start;
}
.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.user .bubble {
  background: var(--el-color-primary);
  color: #fff;
}
.assistant .bubble {
  background: #fff;
  border: 1px solid #e4e7ed;
  color: #303133;
}
.msg-failed {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
  cursor: pointer;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 12px;
}
.input-row .el-textarea {
  flex: 1;
}
.assets {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 16px;
  box-sizing: border-box;
}
.assets-head h2 {
  font-size: 16px;
  margin: 0;
}
.assets-head p {
  color: #909399;
  font-size: 12px;
  margin: 4px 0 20px;
}
.assets-loading {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}
.asset-section {
  margin-bottom: 24px;
}
.asset-sec-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}
.asset-sec-head .el-icon {
  color: var(--el-color-primary);
}
.asset-empty {
  font-size: 12px;
  color: #909399;
  text-align: center;
  padding: 16px;
  border: 1px dashed #e4e7ed;
  border-radius: 12px;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}
.asset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e4e7ed;
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}
.asset-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.asset-ico {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.asset-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.asset-name {
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 11px;
}
</style>
