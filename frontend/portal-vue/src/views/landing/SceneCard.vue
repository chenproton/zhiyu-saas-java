<template>
  <!-- 场景卡片：对齐 React frontend/edu/components/scene/student/scene-card.tsx，
       点击跳转场景详情 /scene/landing/:id。 -->
  <router-link :to="`/scene/landing/${scenario.id}`" class="scene-card">
    <div class="scene-cover" :style="coverStyle">
      <el-icon v-if="!scenario.coverImage" class="scene-cover-icon"><Files /></el-icon>
      <div class="cover-chips">
        <span class="cover-chip">{{ scenario.version || 'V1.0' }}</span>
        <span class="cover-chip">创建人：{{ creatorName }}</span>
      </div>
      <div class="cover-title-block">
        <h3 class="scene-title">{{ scenario.name }}</h3>
        <div class="scene-code">场景编码：{{ scenario.code || scenario.id.slice(0, 8) }}</div>
      </div>
    </div>
    <div class="scene-body">
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="stat-value">{{ scenario.viewCount ?? 0 }}</div>
          <div class="stat-label">浏览次数</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">{{ taskCount || '-' }}</div>
          <div class="stat-label">关联任务</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">{{ knowledgePointCount || '-' }}</div>
          <div class="stat-label">关联知识点</div>
        </div>
      </div>
      <div class="tag-row">
        <span class="tag tag-industry">
          <el-icon><Location /></el-icon>
          面向行业：{{ industryName }}
        </span>
        <span class="tag tag-major">
          <el-icon><Location /></el-icon>
          适用专业：{{ professionName }}
        </span>
      </div>
      <div class="meta-row">
        <span>收录：{{ formatDate(scenario.createdAt) }}</span>
        <span>更新：{{ formatDate(scenario.updatedAt) }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Files, Location } from '@element-plus/icons-vue';
import type { Scenario } from '@/types/scene';
import { coverGradientFor, formatDate } from './evaluation-types';

const props = withDefaults(
  defineProps<{
    scenario: Scenario;
    taskCount?: number;
    knowledgePointCount?: number;
  }>(),
  { taskCount: 0, knowledgePointCount: 0 }
);

const coverStyle = computed(() =>
  props.scenario.coverImage
    ? { backgroundImage: `url('${props.scenario.coverImage}')` }
    : { background: coverGradientFor(props.scenario.id) }
);

const creatorName = computed(() => props.scenario.creatorName || props.scenario.creatorId?.slice(0, 8) || '-');
const industryName = computed(() =>
  props.scenario.industryNames?.[0] || (props.scenario.industryIds?.length ? '已关联' : '未分类')
);
const professionName = computed(() =>
  props.scenario.professionNames?.[0] || (props.scenario.professionIds?.length ? '已关联' : '未分类')
);
</script>

<style scoped>
.scene-card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  height: 100%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
  text-decoration: none;
  color: inherit;
}
.scene-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-5);
}

/* ===== 封面 ===== */
.scene-cover {
  height: 176px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
}
.scene-cover-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 48px;
  height: 48px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 48px;
  pointer-events: none;
}
.cover-chips {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  gap: 6px;
}
.cover-chip {
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(6px);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #fff;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.2);
  white-space: nowrap;
}
.cover-title-block {
  position: relative;
  z-index: 1;
}
.scene-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.scene-code {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* ===== 正文 ===== */
.scene-body {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.stat-cell {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  padding: 10px;
  text-align: center;
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}
.stat-label {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 500;
  white-space: nowrap;
}
.tag-industry {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #ffedd5;
}
.tag-major {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
}
.tag .el-icon {
  font-size: 12px;
}
.meta-row {
  margin-top: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  font-size: 12px;
  color: #64748b;
}
</style>
