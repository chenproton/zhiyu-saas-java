<template>
  <!-- 岗位卡片：对齐原 React 版 job-card，
       点击跳转岗位详情 /job/landing/:id（路由由详情页对齐任务注册）。 -->
  <router-link :to="`/job/landing/${position.id}`" class="job-card">
    <div class="job-cover" :style="coverStyle">
      <el-icon v-if="!position.coverImage" class="job-cover-icon"><Briefcase /></el-icon>
      <span v-if="isHot" class="hot-badge">
        <el-icon class="hot-badge-icon"><Sunny /></el-icon>
        热门
      </span>
      <div class="cover-chips">
        <span class="cover-chip">{{ position.version || 'V1.0' }}</span>
        <span class="cover-chip">创建人：{{ creatorName }}</span>
      </div>
      <div class="cover-title-block">
        <h3 class="job-title">{{ position.name }}</h3>
        <div class="job-code">岗位编码：{{ position.code || position.id.slice(0, 8) }}</div>
      </div>
    </div>
    <div class="job-body">
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="stat-value">{{ viewCount }}</div>
          <div class="stat-label">浏览次数</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">{{ scenarioCount }}</div>
          <div class="stat-label">关联场景</div>
        </div>
        <div class="stat-cell">
          <div class="stat-value">{{ abilityCount || '-' }}</div>
          <div class="stat-label">关联能力点</div>
        </div>
      </div>
      <div class="tag-row">
        <span class="tag tag-industry">面向行业：{{ industryName || '未分类' }}</span>
        <span class="tag tag-major">
          <el-icon><Location /></el-icon>
          适用专业：{{ majorName }}
        </span>
      </div>
      <div class="meta-row">
        <span>收录：{{ formatDate(position.createdAt) }}</span>
        <span>更新：{{ formatDate(position.updatedAt) }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Briefcase, Location, Sunny } from '@element-plus/icons-vue';
import type { CareerPosition } from '@/types/job';
import { coverGradientFor, formatDate } from './evaluation-types';

const props = withDefaults(
  defineProps<{
    position: CareerPosition;
    isHot?: boolean;
    scenarioCount?: number;
    abilityCount?: number;
    industryName?: string;
  }>(),
  {
    isHot: false,
    scenarioCount: 0,
    abilityCount: 0,
    industryName: ''
  }
);

const coverStyle = computed(() =>
  props.position.coverImage
    ? {
        backgroundImage: `url('${props.position.coverImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : { background: coverGradientFor(props.position.id) }
);

const majorName = computed(() => props.position.majorNames?.[0] || '未分类');
const viewCount = computed(() => props.position.viewCount ?? 0);
const creatorName = computed(() => props.position.createdByName || props.position.createdBy?.slice(0, 8) || '-');
</script>

<style scoped>
.job-card {
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
.job-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-5);
}

/* ===== 封面 ===== */
.job-cover {
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
.job-cover-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 48px;
  height: 48px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 48px;
  pointer-events: none;
}
.hot-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ef4444, #f43f5e);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
}
.hot-badge-icon {
  font-size: 12px;
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
.job-title {
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
.job-code {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* ===== 正文 ===== */
.job-body {
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
.tag-major .el-icon {
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
