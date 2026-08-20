<!--
  我的学习 Tab：顶部 4 指标 + 左「我的实践场景」/ 右「我的课程」，各带状态筛选。
  对齐原 React 版 learning-tab.tsx
  （dashboard?role=student 取 courses/sceneTasks；场景筛选 全部/进行中/待提交/已完成，
   课程筛选 全部/进行中/未开始/已完成；按钮跳 scene/lesson landing 并带排课 resourceVersion）。
-->
<template>
  <div class="learning-tab">
    <!-- 顶部指标 -->
    <div class="stat-grid">
      <StatCard
        title="在修课程"
        :value="loading ? '-' : courses.length"
        :icon="Reading"
        :trend="loading ? '加载中...' : '本学期共 5 门'"
        color="blue"
      />
      <StatCard
        title="场景任务"
        :value="loading ? '-' : sceneTasks.length"
        :icon="Collection"
        :trend="loading ? '加载中...' : '2 个待完成'"
        color="green"
      />
      <StatCard
        title="学习时长"
        :value="loading ? '-' : '86h'"
        :icon="Clock"
        :trend="loading ? '加载中...' : '本月 +12h'"
        :trend-up="!loading"
        color="amber"
      />
      <StatCard
        title="本周完成任务"
        :value="loading ? '-' : 12"
        :icon="Histogram"
        :trend="loading ? '加载中...' : '较上周 +3'"
        :trend-up="!loading"
        color="purple"
      />
    </div>

    <div v-if="!loading" class="content-grid">
      <!-- 实践场景 -->
      <SectionCard title="我的实践场景" :icon="Collection" icon-color="green" action-label="全部场景">
        <el-radio-group v-model="sceneFilter" size="small" class="filter-row">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="进行中">进行中</el-radio-button>
          <el-radio-button value="待提交">待提交</el-radio-button>
          <el-radio-button value="已完成">已完成</el-radio-button>
        </el-radio-group>

        <div class="item-list">
          <div v-if="filteredScenes.length === 0" class="empty-line">暂无实践场景</div>
          <div v-for="task in filteredScenes" :key="task.id" class="list-item scene-item">
            <div class="item-cover scene-cover">{{ task.sceneName.charAt(0) }}</div>
            <div class="item-body">
              <div class="item-head">
                <div class="item-head-text">
                  <h3 class="item-title">{{ task.taskName }}</h3>
                  <p class="item-sub">{{ task.sceneName }} · 目标岗位：{{ task.position }}</p>
                </div>
                <span class="status-badge" :style="statusStyle(task.status)">
                  {{ getStatusConfig(task.status).label }}
                </span>
              </div>
              <div class="tag-row">
                <span v-for="tag in task.abilityTags" :key="tag" class="ability-tag">{{ tag }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-cell">
                  <el-icon><Clock /></el-icon>截止 {{ task.deadline || '未设置' }}
                </span>
                <span :style="{ color: DIFFICULTY_TEXT_COLORS[task.difficulty] || '#6b7280' }">
                  难度：{{ task.difficulty }}
                </span>
                <span v-if="task.score !== undefined" class="score-cell">
                  得分：{{ task.score }}/{{ task.totalScore }}
                </span>
              </div>
            </div>
            <el-button
              type="success"
              size="small"
              class="item-action"
              @click="goScene(task)"
            >
              <el-icon><VideoPlay /></el-icon>
              {{ task.status === '已完成' ? '查看' : '继续' }}
            </el-button>
          </div>
        </div>
      </SectionCard>

      <!-- 课程 -->
      <SectionCard title="我的课程" :icon="Reading" icon-color="blue" action-label="全部课程">
        <el-radio-group v-model="courseFilter" size="small" class="filter-row">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="进行中">进行中</el-radio-button>
          <el-radio-button value="未开始">未开始</el-radio-button>
          <el-radio-button value="已完成">已完成</el-radio-button>
        </el-radio-group>

        <div class="item-list">
          <div v-if="filteredCourses.length === 0" class="empty-line">暂无课程</div>
          <div v-for="course in filteredCourses" :key="course.id" class="list-item course-item">
            <div class="item-cover course-cover">{{ course.cover }}</div>
            <div class="item-body">
              <div class="item-head">
                <div class="item-head-text">
                  <h3 class="item-title">{{ course.name }}</h3>
                  <p class="item-sub">
                    {{ course.code }} · {{ course.teacher }} · {{ course.credit }}学分 ·
                    {{ course.hours }}学时
                  </p>
                </div>
                <span class="type-badge">{{ course.type }}</span>
              </div>
              <div class="tag-row">
                <span class="progress-tag">{{ course.progress }}% 完成</span>
              </div>
              <div v-if="course.nextTask" class="meta-row">
                <span class="meta-cell">
                  <el-icon><Clock /></el-icon>
                  下一步：<strong>{{ course.nextTask }}</strong> · 截止
                  {{ course.nextDeadline ?? '-' }}
                </span>
              </div>
            </div>
            <el-button type="primary" size="small" class="item-action" @click="goCourse(course)">
              <el-icon><VideoPlay /></el-icon>
              {{ course.status === '已完成' ? '复习' : '学习' }}
            </el-button>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Clock, Collection, Histogram, Reading, VideoPlay } from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import StatCard from './StatCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspaceCourse, WorkspaceSceneTask } from './workspace-api';
import {
  DIFFICULTY_TEXT_COLORS,
  getStatusConfig,
  lessonLandingHref,
  sceneLandingHref
} from './workspace-utils';

const router = useRouter();

const courses = ref<WorkspaceCourse[]>([]);
const sceneTasks = ref<WorkspaceSceneTask[]>([]);
const loading = ref(true);
const courseFilter = ref('all');
const sceneFilter = ref('all');

const filteredCourses = computed(() =>
  courses.value.filter((c) => courseFilter.value === 'all' || c.status === courseFilter.value)
);
const filteredScenes = computed(() =>
  sceneTasks.value.filter((s) => sceneFilter.value === 'all' || s.status === sceneFilter.value)
);

function statusStyle(status: string) {
  const cfg = getStatusConfig(status);
  return { color: cfg.color, background: cfg.bg };
}

function goScene(task: WorkspaceSceneTask) {
  router.push(sceneLandingHref(task.scenarioId, task.resourceVersion));
}

function goCourse(course: WorkspaceCourse) {
  router.push(lessonLandingHref(course.id, course.resourceVersion));
}

onMounted(async () => {
  loading.value = true;
  try {
    const res = await workspaceDashboardApi.get({ role: 'student' });
    courses.value = res.courses || [];
    sceneTasks.value = res.sceneTasks || [];
  } catch {
    courses.value = [];
    sceneTasks.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.learning-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.stat-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 640px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
@media (min-width: 1024px) {
  .content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.filter-row {
  margin-bottom: 16px;
}
.item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty-line {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
.list-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.scene-item:hover {
  border-color: #a7f3d0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.course-item:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.item-cover {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}
.scene-cover {
  background: linear-gradient(135deg, #ecfdf5, #f0fdfa);
  color: #059669;
}
.course-cover {
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  color: var(--el-color-primary);
}
.item-body {
  flex: 1;
  min-width: 0;
}
.item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.item-head-text {
  min-width: 0;
}
.item-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.item-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.status-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
}
.type-badge {
  flex-shrink: 0;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--el-color-primary-light-7);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.ability-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #ecfdf5;
  color: #059669;
  font-weight: 500;
}
.progress-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.meta-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.meta-cell strong {
  color: #111827;
  font-weight: 500;
}
.score-cell {
  color: #059669;
  font-weight: 500;
}
.item-action {
  flex-shrink: 0;
}
</style>
