<template>
  <div class="ai-card kb-card" @click="go">
    <div class="card-banner" :style="bannerStyle">
      <el-icon v-if="!kb.coverImage" class="banner-icon"><Collection /></el-icon>
      <span v-if="isNew" class="new-badge">新上线</span>
    </div>
    <div class="card-body">
      <div class="card-head">
        <div class="card-title-wrap">
          <p class="card-title">{{ kb.name }}</p>
          <p class="card-owner">{{ kb.ownerName || '未知' }}</p>
        </div>
        <FavoriteButton target-type="ai_kb" :target-id="kb.id" />
      </div>
      <p class="card-desc">{{ kb.description || '无描述' }}</p>
      <div v-if="kb.tags && kb.tags.length" class="card-tags">
        <el-tag v-for="t in kb.tags.slice(0, 3)" :key="t" size="small" type="info">{{ t }}</el-tag>
      </div>
      <div class="card-foot">
        <span class="foot-stat"><el-icon><Document /></el-icon>{{ kb.docCount }} 个文档</span>
        <span class="foot-stat"><el-icon><QuestionFilled /></el-icon>{{ kb.askCount }} 次提问</span>
        <span class="foot-stat"><el-icon><View /></el-icon>{{ kb.viewCount ?? 0 }} 次浏览</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Collection, Document, QuestionFilled, View } from '@element-plus/icons-vue';
import type { AIKnowledgeBase } from '@/types/ai';
import { coverGradientFor, isNewContent } from '../ai-api';
import FavoriteButton from './FavoriteButton.vue';

const props = defineProps<{ kb: AIKnowledgeBase }>();
const router = useRouter();

const isNew = computed(() => isNewContent(props.kb.createdAt));
const bannerStyle = computed(() =>
  props.kb.coverImage
    ? { backgroundImage: `url('${props.kb.coverImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: coverGradientFor(props.kb.id) }
);

function go() {
  router.push(`/portal/apps/ai/kb/${props.kb.id}`);
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
  cursor: pointer;
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
  color: rgba(255, 255, 255, 0.8);
}
.banner-icon {
  font-size: 40px;
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
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
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
</style>
