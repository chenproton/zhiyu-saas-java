<template>
  <div class="editor-page">
    <div class="top-bar">
      <div class="top-inner">
        <router-link class="back-link" to="/portal/apps/ai/landing#studio">
          <el-icon><ArrowLeft /></el-icon>返回工坊
        </router-link>
        <span class="divider" />
        <div class="title-wrap">
          <span class="title-avatar">{{ live.avatar || '🤖' }}</span>
          <h1 class="title">{{ live.name.trim() || '新建智能体' }}</h1>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="builder-grid">
        <AgentForm submit-label="创建智能体" :on-submit="create" :on-live-change="onLive" />
        <div class="preview-col">
          <div class="placeholder">
            <div class="ph-icon"><el-icon><ChatDotRound /></el-icon></div>
            <p class="ph-title">预览对话</p>
            <p class="ph-desc">在左侧填写并保存后，即可在这里用当前配置实时试聊效果</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ChatDotRound } from '@element-plus/icons-vue';
import { aiCenterAgentApi } from '@/api/ai';
import AgentForm from '../components/AgentForm.vue';

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

const router = useRouter();
const live = reactive({ prompt: '', name: '', avatar: '' });

function onLive(v: { prompt: string; name: string; avatar: string }) {
  live.prompt = v.prompt;
  live.name = v.name;
  live.avatar = v.avatar;
}

async function create(input: AgentInput) {
  const agent = await aiCenterAgentApi.create(input);
  ElMessage.success('创建成功，现在可以在右侧试聊了');
  router.replace(`/portal/apps/ai/studio/agents/${agent.id}`);
}
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
.content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 16px;
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
.placeholder {
  background: #fff;
  border: 1px dashed #d6d3d1;
  border-radius: 16px;
  height: calc(100vh - 8.5rem);
  position: sticky;
  top: 7.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 32px;
}
.ph-icon {
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
.ph-title {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  margin: 0;
}
.ph-desc {
  font-size: 12px;
  color: #909399;
  margin: 6px 0 0;
  line-height: 1.6;
}
</style>
