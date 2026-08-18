<template>
  <div class="agent-form">
    <!-- 基本信息 -->
    <el-card shadow="never" class="form-card">
      <template #header>
        <div class="card-head">
          <div class="card-title">基本信息</div>
          <div class="card-desc">名称、头像与分类决定了它在大厅中的展示与筛选</div>
        </div>
      </template>
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="name" placeholder="智能体名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="头像">
          <div class="avatar-row">
            <span
              v-for="e in PRESET_AVATARS"
              :key="e"
              class="avatar-opt"
              :class="{ active: avatar === e }"
              @click="setAvatar(e)"
            >{{ e }}</span>
            <el-input v-model="avatar" class="avatar-input" maxlength="8" placeholder="输入 emoji" />
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="description" placeholder="描述智能体的用途" maxlength="200" />
        </el-form-item>
        <el-form-item label="封面">
          <div class="cover-row">
            <el-button size="small" :loading="coverUploading" @click="pickCover">上传封面</el-button>
            <span v-if="coverUrl" class="cover-preview" :style="{ backgroundImage: `url('${coverUrl}')` }" />
            <el-button v-if="coverUrl" size="small" text type="danger" @click="coverUrl = ''">移除</el-button>
            <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="onCoverPick" />
          </div>
        </el-form-item>
        <el-form-item>
          <ClassifySelects :value="classify" @update:value="onClassify" />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 对话设定 -->
    <el-card shadow="never" class="form-card">
      <template #header>
        <div class="card-head">
          <div class="card-title">对话设定</div>
          <div class="card-desc">开场白与角色提示词直接决定对话风格与回答边界</div>
        </div>
      </template>
      <el-form label-position="top">
        <el-form-item label="开场白">
          <el-input v-model="greeting" type="textarea" :rows="2" maxlength="500" placeholder="用户进入对话时展示的欢迎语" />
        </el-form-item>
        <el-form-item>
          <div class="prompt-label">
            <span>角色提示词</span>
            <span :class="['prompt-count', { over: promptLen > MAX_PROMPT_LEN }]">{{ promptLen }}/4000 字</span>
          </div>
          <el-input v-model="systemPrompt" type="textarea" :rows="8" placeholder="定义智能体的角色设定与回答规则" />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 关联知识库 -->
    <el-card shadow="never" class="form-card">
      <template #header>
        <div class="card-head">
          <div class="card-title">关联知识库</div>
          <div class="card-desc">勾选后对话将基于库内文档检索回答（我创建的 / 共享给我的 / 广场已发布）</div>
        </div>
      </template>
      <div class="kb-head">
        <span>关联知识库</span>
        <span class="kb-count">最多关联 5 个知识库（已选 {{ kbIds.length }}/5）</span>
      </div>
      <div class="kb-list">
        <div v-if="loadingKbs" class="kb-loading">加载中...</div>
        <p v-else-if="!kbOptions.length" class="kb-empty">暂无可关联的知识库</p>
        <label
          v-for="kb in kbOptions"
          :key="kb.id"
          class="kb-item"
          :class="{ disabled: !kbIds.includes(kb.id) && kbIds.length >= MAX_KB }"
        >
          <el-checkbox
            :model-value="kbIds.includes(kb.id)"
            :disabled="!kbIds.includes(kb.id) && kbIds.length >= MAX_KB"
            @change="toggleKb(kb.id)"
          />
          <span class="kb-name">{{ kb.name }}</span>
          <span class="kb-docs">{{ kb.docCount }} 个文档</span>
        </label>
      </div>
    </el-card>

    <div class="form-actions">
      <el-button type="primary" :loading="submitting" @click="submit">{{ submitLabel }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { aiCenterKbApi, aiCenterSquareApi } from '@/api/ai';
import type { AIAgent, AIKnowledgeBase } from '@/types/ai';
import { aiKbExt, fileApi } from '../ai-api';
import ClassifySelects from './ClassifySelects.vue';
import type { ClassifyValue } from './ClassifySelects.vue';

const MAX_PROMPT_LEN = 4000;
const MAX_KB = 5;
const PRESET_AVATARS = ['🤖', '🧠', '📚', '💡', '🎓', '🧪', '📝', '🗣️', '🔬', '🎨', '🎵', '⚽'];

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

const props = defineProps<{
  initial?: AIAgent;
  submitLabel: string;
  onSubmit: (input: AgentInput) => Promise<void>;
  onLiveChange?: (v: { prompt: string; name: string; avatar: string }) => void;
}>();

const name = ref(props.initial?.name ?? '');
const avatar = ref(props.initial?.avatar ?? '🤖');
const description = ref(props.initial?.description ?? '');
const greeting = ref(props.initial?.greeting ?? '');
const systemPrompt = ref(props.initial?.systemPrompt ?? '');
const classify = ref<ClassifyValue>({
  majorId: props.initial?.majorId ?? '',
  departmentId: props.initial?.departmentId ?? '',
  kbType: ''
});
const kbIds = ref<string[]>(props.initial?.kbIds ?? []);
const coverUrl = ref(props.initial?.coverImage ?? '');
const coverUploading = ref(false);
const coverInput = ref<HTMLInputElement | null>(null);
const kbOptions = ref<AIKnowledgeBase[]>([]);
const loadingKbs = ref(true);
const submitting = ref(false);

const promptLen = computed(() => Array.from(systemPrompt.value).length);

function emitLive() {
  props.onLiveChange?.({ prompt: systemPrompt.value, name: name.value, avatar: avatar.value });
}
function setName(v: string) {
  name.value = v;
  emitLive();
}
function setAvatar(v: string) {
  avatar.value = v;
  emitLive();
}
function setPrompt(v: string) {
  systemPrompt.value = v;
  emitLive();
}

function onClassify(v: ClassifyValue) {
  classify.value = v;
}

function toggleKb(id: string) {
  if (kbIds.value.includes(id)) {
    kbIds.value = kbIds.value.filter((x) => x !== id);
  } else if (kbIds.value.length < MAX_KB) {
    kbIds.value = [...kbIds.value, id];
  }
}

async function loadKbOptions() {
  const results = await Promise.allSettled([
    aiKbExt.listMine({ scope: 'owned' }),
    aiKbExt.listMine({ scope: 'collaborating' }),
    aiCenterSquareApi.kbs({ pageSize: 100 })
  ]);
  const seen = new Map<string, AIKnowledgeBase>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const kb of r.value.items) if (!seen.has(kb.id)) seen.set(kb.id, kb);
    }
  }
  kbOptions.value = Array.from(seen.values());
  loadingKbs.value = false;
}

function pickCover() {
  coverInput.value?.click();
}
async function onCoverPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 5MB');
    return;
  }
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件');
    return;
  }
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    coverUrl.value = res.url;
  } catch (err) {
    ElMessage.error((err as Error).message || '上传失败');
  } finally {
    coverUploading.value = false;
  }
}

async function submit() {
  if (!name.value.trim()) {
    ElMessage.warning('请填写名称');
    return;
  }
  if (!systemPrompt.value.trim()) {
    ElMessage.warning('请填写角色提示词');
    return;
  }
  submitting.value = true;
  try {
    await props.onSubmit({
      name: name.value.trim(),
      avatar: avatar.value.trim(),
      description: description.value.trim(),
      coverImage: coverUrl.value || undefined,
      greeting: greeting.value.trim(),
      systemPrompt: systemPrompt.value.trim(),
      kbIds: kbIds.value,
      majorId: classify.value.majorId || undefined,
      departmentId: classify.value.departmentId || undefined
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadKbOptions);
</script>

<style scoped>
.agent-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-card :deep(.el-card__header) {
  padding: 16px 20px 12px;
  border-bottom: 1px dashed #e7e5e4;
}
.card-head .card-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.card-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.avatar-opt {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
}
.avatar-opt.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.avatar-input {
  width: 120px;
}
.cover-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cover-preview {
  width: 60px;
  height: 40px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  border: 1px solid #e4e7ed;
}
.prompt-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 6px;
  font-size: 14px;
  color: #606266;
}
.prompt-count {
  font-size: 12px;
  color: #909399;
}
.prompt-count.over {
  color: #f56c6c;
}
.kb-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
}
.kb-count {
  font-size: 12px;
  color: #909399;
}
.kb-list {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  max-height: 256px;
  overflow-y: auto;
}
.kb-loading,
.kb-empty {
  padding: 16px;
  text-align: center;
  color: #909399;
  font-size: 14px;
  margin: 0;
}
.kb-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.kb-item:last-child {
  border-bottom: none;
}
.kb-item:hover {
  background: #f5f7fa;
}
.kb-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.kb-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-docs {
  color: #909399;
  font-size: 12px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
