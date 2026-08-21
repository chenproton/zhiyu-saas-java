<template>
  <div class="exam-center-page">
    <!-- 页头 -->
    <div class="ec-header">
      <div class="ec-header-inner">
        <router-link to="/evaluation/landing" class="ec-back">
          <el-icon><ArrowLeft /></el-icon>
          返回测评资源平台
        </router-link>
        <div class="ec-title-group">
          <div class="ec-title-icon"><el-icon :size="26"><Notebook /></el-icon></div>
          <div>
            <h1 class="ec-title">考试中心</h1>
            <p class="ec-sub">查看全部考试与你可参加的考试，按班级开放</p>
          </div>
        </div>
      </div>
    </div>

    <main class="ec-main">
      <!-- 工具栏：Tab + 搜索 -->
      <div class="ec-toolbar">
        <div class="ec-tabs">
          <button
            type="button"
            :class="['ec-tab', { active: tab === 'all' }]"
            @click="tab = 'all'"
          >
            全部考试 ({{ items.length }})
          </button>
          <button
            v-if="isStudent"
            type="button"
            :class="['ec-tab', { active: tab === 'mine' }]"
            @click="tab = 'mine'"
          >
            我可参加 ({{ participatableCount }})
          </button>
        </div>
        <el-input
          v-model="keyword"
          class="ec-search"
          placeholder="搜索考试名称..."
          clearable
        />
      </div>

      <!-- 列表 -->
      <div v-if="loading" class="ec-grid">
        <div v-for="i in 6" :key="i" class="ec-skeleton" />
      </div>
      <div v-else-if="filtered.length === 0" class="ec-empty">
        <div class="ec-empty-icon"><el-icon :size="44"><Notebook /></el-icon></div>
        <div class="ec-empty-title">暂无考试</div>
        <div class="ec-empty-hint">发布后的考试安排会展示在这里</div>
      </div>
      <div v-else class="ec-grid">
        <ExamCenterCard
          v-for="item in filtered"
          :key="item.id"
          :item="item"
          :cover-image="examCovers[item.examId]"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowLeft, Notebook } from '@element-plus/icons-vue';
import { examApi } from '@/api/evaluation';
import { request } from '@/api/http';
import type { Exam } from '@/types/evaluation';
import ExamCenterCard from './ExamCenterCard.vue';
import type { ExamCenterItem } from './evaluation-types';

const items = ref<ExamCenterItem[]>([]);
const examCovers = ref<Record<string, string>>({});
const loading = ref(true);
const tab = ref<'all' | 'mine'>('all');
const keyword = ref('');

const isStudent = computed(() => (items.value.length > 0 ? items.value[0].studentView : true));

const participatableCount = computed(() => items.value.filter((i) => i.participatable).length);

const filtered = computed(() => {
  let list = items.value;
  if (tab.value === 'mine') list = list.filter((i) => i.participatable);
  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();
    list = list.filter(
      (i) => i.usageName.toLowerCase().includes(q) || i.examName.toLowerCase().includes(q)
    );
  }
  return list;
});

onMounted(async () => {
  // examUsageApi.center() 未封装在 Vue api 层，直接按同一契约调用 GET /evaluation/exam-center
  // （对齐 React examUsageApi.center()；401 时 http.ts 统一跳转登录，等价 React）
  try {
    items.value = await request<ExamCenterItem[]>('/evaluation/exam-center');
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
  try {
    const res = await examApi.list({ status: 'published', limit: 1000 });
    const map: Record<string, string> = {};
    (res.items || []).forEach((e: Exam) => {
      if (e.coverImage) map[e.id] = e.coverImage;
    });
    examCovers.value = map;
  } catch {
    /* 封面加载失败不阻断列表 */
  }
});
</script>

<style scoped>
.exam-center-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f8ff;
}

/* ===== 页头 ===== */
.ec-header {
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
}
.ec-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
.ec-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  text-decoration: none;
  margin-bottom: 16px;
  transition: color 0.2s;
}
.ec-back:hover {
  color: #fff;
}
.ec-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ec-title-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ec-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.ec-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

/* ===== 主体 ===== */
.ec-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
}
.ec-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.ec-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #fff;
  padding: 4px;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.ec-tab {
  border: none;
  background: none;
  padding: 8px 18px;
  border-radius: 9px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}
.ec-tab:hover {
  color: var(--el-color-primary);
}
.ec-tab.active {
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
}
.ec-search {
  width: 100%;
  max-width: 320px;
}
.ec-search :deep(.el-input__wrapper) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px #e7e5e4 inset;
  background: #fff;
}
.ec-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.ec-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
@media (min-width: 640px) {
  .ec-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .ec-grid { grid-template-columns: repeat(3, 1fr); }
}
.ec-skeleton {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  height: 220px;
  animation: ec-pulse 1.6s ease-in-out infinite;
}
@keyframes ec-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ec-empty {
  text-align: center;
  padding: 72px 0;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}
.ec-empty-icon {
  color: #cbd5e1;
  margin-bottom: 12px;
}
.ec-empty-title {
  font-size: 15px;
  font-weight: 500;
  color: #475569;
}
.ec-empty-hint {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
}
</style>
