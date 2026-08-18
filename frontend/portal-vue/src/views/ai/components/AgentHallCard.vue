<template>
  <div class="ai-card agent-card">
    <div class="card-banner" :style="bannerStyle">
      <span v-if="!agent.coverImage" class="banner-emoji">{{ agent.avatar || '🤖' }}</span>
      <span v-if="isNew" class="new-badge">新上线</span>
    </div>
    <div class="card-body">
      <div class="card-head">
        <div class="card-title-wrap">
          <p class="card-title">{{ agent.name }}</p>
          <p class="card-owner">{{ agent.ownerName || '未知' }}</p>
        </div>
        <FavoriteButton target-type="ai_agent" :target-id="agent.id" />
      </div>
      <p class="card-desc">{{ agent.description || agent.greeting || '无描述' }}</p>
      <div class="card-foot">
        <span class="foot-stat"><el-icon><ChatDotRound /></el-icon>{{ agent.chatCount }} 次对话</span>
        <span class="foot-stat"><el-icon><View /></el-icon>{{ agent.viewCount ?? 0 }} 次浏览</span>
        <el-button size="small" type="primary" @click="go">立即体验</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ChatDotRound, View } from '@element-plus/icons-vue';
import type { AIAgent } from '@/types/ai';
import { coverGradientFor, isNewContent } from '../ai-api';
import FavoriteButton from './FavoriteButton.vue';

const props = defineProps<{ agent: AIAgent }>();
const router = useRouter();

const isNew = computed(() => isNewContent(props.agent.createdAt));
const bannerStyle = computed(() =>
  props.agent.coverImage
    ? { backgroundImage: `url('${props.agent.coverImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: coverGradientFor(props.agent.id) }
);

function go() {
  router.push(`/portal/apps/ai/agents/${props.agent.id}`);
}
</script>

<style scoped>
.ai-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}
.ai-card:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}
.card-banner {
  height: 96px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.banner-emoji {
  font-size: 40px;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.2));
}
.new-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(245, 158, 11, 0.95);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
}
.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.card-title-wrap {
  flex: 1;
  min-width: 0;
}
.card-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}
.card-owner {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-desc {
  color: #606266;
  font-size: 13px;
  min-height: 40px;
  margin: 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
.foot-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 12px;
}
.card-foot .el-button {
  margin-left: auto;
}
</style>
