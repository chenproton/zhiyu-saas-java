<!--
  我的收藏 Tab（React career-tab 对位）。
  对齐 React frontend/edu/app/portal/workspace/_components/career-tab.tsx：
  - 分类筛选：全部收藏（N）/ 职业岗位 / 实践场景 / 数字课程 / 测评资源（题库+试卷）/ AI 服务（知识库+智能体）；
  - 岗位收藏走 /job/positions/favorites 与 POST /job/positions/{id}/favorite（toggle）；
    其余走 GET /favorites 与 POST /favorites/{targetType}/{id}；
  - 岗位/场景卡片复用门户已有 JobCard / SceneCard（与 landing 页一致）；
  - 空态给出「去收藏岗位/场景/课程/测评」四个入口。
  数据加载与取消收藏逻辑沿用门户既有 views/portal/favorites.vue 的实现思路。
-->
<template>
  <SectionCard title="我的收藏" :icon="Star" icon-color="rose">
    <!-- 分类筛选 -->
    <div class="cat-tabs">
      <button
        type="button"
        class="cat-tab"
        :class="{ active: activeCategory === 'all' }"
        @click="activeCategory = 'all'"
      >
        全部收藏（{{ totalCount }}）
      </button>
      <button
        v-for="c in CATEGORIES"
        :key="c.id"
        type="button"
        class="cat-tab"
        :class="{ active: activeCategory === c.id }"
        @click="activeCategory = c.id"
      >
        <el-icon><component :is="c.icon" /></el-icon>{{ c.label }}
      </button>
    </div>

    <div v-if="loading" class="fav-loading">
      <el-icon class="is-loading"><Loading /></el-icon> 加载收藏中...
    </div>

    <div v-else-if="totalCount === 0" class="fav-empty">
      <div class="empty-icon"><el-icon :size="32"><Star /></el-icon></div>
      <div class="empty-title">暂无收藏内容</div>
      <div class="empty-sub">浏览岗位、场景、课程或测评资源时，点击“收藏”即可在这里查看</div>
      <div class="empty-links">
        <router-link to="/job/landing">去收藏岗位 <el-icon><ArrowRight /></el-icon></router-link>
        <router-link to="/scene/landing">去收藏场景 <el-icon><ArrowRight /></el-icon></router-link>
        <router-link to="/lesson/landing">去收藏课程 <el-icon><ArrowRight /></el-icon></router-link>
        <router-link to="/evaluation/landing">去收藏测评 <el-icon><ArrowRight /></el-icon></router-link>
      </div>
    </div>

    <template v-else>
      <!-- 职业岗位 -->
      <div v-if="visibleKeys.includes('jobs')" class="fav-block">
        <h4 class="block-title">
          <el-icon class="i-primary"><Briefcase /></el-icon>职业岗位
          <span class="block-count">（{{ favorites.jobs.length }}）</span>
        </h4>
        <div class="card-grid">
          <div v-for="job in favorites.jobs" :key="job.id" class="card-wrap">
            <JobCard :position="job" />
            <button type="button" class="unfav-btn" title="取消收藏" @click="unfavorite('jobs', job.id)">
              <el-icon><Star /></el-icon>取消收藏
            </button>
          </div>
        </div>
      </div>

      <!-- 实践场景 -->
      <div v-if="visibleKeys.includes('scenes')" class="fav-block">
        <h4 class="block-title">
          <el-icon class="i-amber"><Collection /></el-icon>实践场景
          <span class="block-count">（{{ favorites.scenes.length }}）</span>
        </h4>
        <div class="card-grid">
          <div v-for="scene in favorites.scenes" :key="scene.id" class="card-wrap">
            <SceneCard :scenario="scene" :task-count="scene.taskCount" />
            <button
              type="button"
              class="unfav-btn"
              title="取消收藏"
              @click="unfavorite('scenes', scene.id, 'scene')"
            >
              <el-icon><Star /></el-icon>取消收藏
            </button>
          </div>
        </div>
      </div>

      <!-- 数字课程 -->
      <div v-if="visibleKeys.includes('courses')" class="fav-block">
        <h4 class="block-title">
          <el-icon class="i-green"><Reading /></el-icon>数字课程
          <span class="block-count">（{{ favorites.courses.length }}）</span>
        </h4>
        <div class="card-grid">
          <div v-for="(course, i) in favorites.courses" :key="course.id" class="card-wrap">
            <router-link :to="`/lesson/landing/${course.id}`" class="cover-card">
              <div class="cover-head" :style="coverStyle(course.coverImage, i)">
                <span v-if="!course.coverImage" class="cover-text">{{ course.name.slice(0, 8) }}</span>
                <span class="cover-badge">已发布</span>
                <span v-if="course.batchName" class="cover-sub">{{ course.batchName }}</span>
              </div>
              <div class="cover-body">
                <h3 class="cover-title">{{ course.name }}</h3>
                <p v-if="course.majorName" class="cover-meta">
                  <el-icon><Location /></el-icon>{{ course.majorName }}
                </p>
                <div class="cover-foot">
                  <span><el-icon><Collection /></el-icon>{{ course.nodeCount }} 节点</span>
                  <span><el-icon><Reading /></el-icon>{{ course.resourceCount }} 资源</span>
                </div>
              </div>
            </router-link>
            <button
              type="button"
              class="unfav-btn"
              title="取消收藏"
              @click="unfavorite('courses', course.id, 'course')"
            >
              <el-icon><Star /></el-icon>取消收藏
            </button>
          </div>
        </div>
      </div>

      <!-- 测评资源（题库 + 试卷） -->
      <div v-if="visibleKeys.includes('banks')" class="fav-block">
        <h4 class="block-title">
          <el-icon class="i-primary"><Document /></el-icon>测评资源
          <span class="block-count">（{{ favorites.banks.length + favorites.exams.length }}）</span>
        </h4>

        <div v-if="favorites.banks.length > 0" class="sub-block">
          <div class="sub-title"><el-icon><Collection /></el-icon> 题库</div>
          <div class="card-grid">
            <div v-for="(bank, i) in favorites.banks" :key="bank.id" class="card-wrap">
              <router-link :to="`/evaluation/landing/banks/${bank.id}`" class="cover-card">
                <div class="cover-head" :style="coverStyle(bank.coverImage, i + 2)">
                  <el-icon v-if="!bank.coverImage" :size="48" class="cover-icon"><Collection /></el-icon>
                  <span class="cover-badge">{{ bank.version || 'V1.0' }}</span>
                </div>
                <div class="cover-body">
                  <h3 class="cover-title">{{ bank.name }}</h3>
                  <p class="cover-desc">{{ bank.description || '暂无描述' }}</p>
                  <div class="cover-foot">
                    <span><el-icon><Document /></el-icon>{{ bank.questionCount }} 题</span>
                    <span class="cover-link">查看详情 →</span>
                  </div>
                </div>
              </router-link>
              <button
                type="button"
                class="unfav-btn"
                title="取消收藏"
                @click="unfavorite('banks', bank.id, 'question_bank')"
              >
                <el-icon><Star /></el-icon>取消收藏
              </button>
            </div>
          </div>
        </div>

        <div v-if="favorites.exams.length > 0" class="sub-block">
          <div class="sub-title"><el-icon><Tickets /></el-icon> 试卷</div>
          <div class="card-grid">
            <div v-for="(exam, i) in favorites.exams" :key="exam.id" class="card-wrap">
              <router-link :to="`/evaluation/landing/exams/${exam.id}`" class="cover-card">
                <div class="cover-head" :style="coverStyle(exam.coverImage, i + 4)">
                  <el-icon v-if="!exam.coverImage" :size="48" class="cover-icon"><Tickets /></el-icon>
                  <span class="cover-badge">{{ exam.duration }} 分钟</span>
                </div>
                <div class="cover-body">
                  <h3 class="cover-title">{{ exam.name }}</h3>
                  <p class="cover-desc">{{ exam.description || '暂无描述' }}</p>
                  <div class="cover-foot">
                    <span><el-icon><Tickets /></el-icon>{{ exam.totalScore }} 分</span>
                    <span class="status-badge" :style="statusStyle(exam.status)">
                      {{ getStatusConfig(exam.status).label }}
                    </span>
                  </div>
                </div>
              </router-link>
              <button
                type="button"
                class="unfav-btn"
                title="取消收藏"
                @click="unfavorite('exams', exam.id, 'exam')"
              >
                <el-icon><Star /></el-icon>取消收藏
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI 知识库 -->
      <div v-if="visibleKeys.includes('aiKbs') && favorites.aiKbs.length > 0" class="fav-block">
        <h4 class="block-title">
          <el-icon class="i-cyan"><MagicStick /></el-icon>AI 知识库
          <span class="block-count">（{{ favorites.aiKbs.length }}）</span>
        </h4>
        <div class="card-grid">
          <div v-for="kb in favorites.aiKbs" :key="kb.id" class="card-wrap">
            <router-link :to="`/portal/apps/ai/kb/${kb.id}`" class="mini-card">
              <div class="mini-title">{{ kb.name }}</div>
              <div class="mini-desc">{{ kb.description || '无描述' }}</div>
              <div class="mini-meta">{{ kb.docCount }} 个文档</div>
            </router-link>
            <button
              type="button"
              class="unfav-btn light"
              title="取消收藏"
              @click="unfavorite('aiKbs', kb.id, 'ai_kb')"
            >
              <el-icon><Star /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- AI 智能体 -->
      <div v-if="visibleKeys.includes('aiAgents') && favorites.aiAgents.length > 0" class="fav-block">
        <h4 class="block-title">
          <el-icon class="i-cyan"><MagicStick /></el-icon>AI 智能体
          <span class="block-count">（{{ favorites.aiAgents.length }}）</span>
        </h4>
        <div class="card-grid">
          <div v-for="agent in favorites.aiAgents" :key="agent.id" class="card-wrap">
            <router-link :to="`/portal/apps/ai/agents/${agent.id}`" class="mini-card">
              <div class="mini-head">
                <span class="mini-avatar">{{ agent.avatar }}</span>
                <div class="mini-title">{{ agent.name }}</div>
              </div>
              <div class="mini-desc">{{ agent.description || agent.greeting || '无描述' }}</div>
            </router-link>
            <button
              type="button"
              class="unfav-btn light"
              title="取消收藏"
              @click="unfavorite('aiAgents', agent.id, 'ai_agent')"
            >
              <el-icon><Star /></el-icon>
            </button>
          </div>
        </div>
      </div>
    </template>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ArrowRight,
  Briefcase,
  Collection,
  Document,
  Loading,
  Location,
  MagicStick,
  Reading,
  Star,
  Tickets
} from '@element-plus/icons-vue';
import { favoriteApi } from '@/api/portal';
import type { FavoriteTargetType } from '@/api/portal';
import { positionApi } from '@/api/job';
import type { CareerPosition } from '@/types/job';
import type { Scenario } from '@/types/scene';
import type { Course } from '@/types/lesson';
import type { Exam, QuestionBank } from '@/types/evaluation';
import type { AIAgent, AIKnowledgeBase } from '@/types/ai';
import JobCard from '@/views/landing/JobCard.vue';
import SceneCard from '@/views/landing/SceneCard.vue';
import SectionCard from './SectionCard.vue';
import { getStatusConfig } from './workspace-utils';

const COVER_GRADIENTS = [
  'linear-gradient(135deg,#1e3a8a,#3b7cff)',
  'linear-gradient(135deg,#7c2d12,#dc2626)',
  'linear-gradient(135deg,#064e3b,#0891b2)',
  'linear-gradient(135deg,#334155,#64748b)',
  'linear-gradient(135deg,#581c87,#a855f7)',
  'linear-gradient(135deg,#1e40af,#3b82f6)'
];

const CATEGORIES = [
  { id: 'jobs', label: '职业岗位', icon: Briefcase },
  { id: 'scenes', label: '实践场景', icon: Collection },
  { id: 'courses', label: '数字课程', icon: Reading },
  { id: 'exams', label: '测评资源', icon: Document },
  { id: 'ai', label: 'AI 服务', icon: MagicStick }
];

type FavKey = 'jobs' | 'scenes' | 'courses' | 'banks' | 'exams' | 'aiKbs' | 'aiAgents';

// 分类 -> 收藏实体集合的键名映射（测评资源含题库与试卷，AI 服务含知识库与智能体）
const CATEGORY_KEYS: Record<string, FavKey[]> = {
  all: ['jobs', 'scenes', 'courses', 'banks', 'exams', 'aiKbs', 'aiAgents'],
  jobs: ['jobs'],
  scenes: ['scenes'],
  courses: ['courses'],
  exams: ['banks', 'exams'],
  ai: ['aiKbs', 'aiAgents']
};

const activeCategory = ref('all');
const loading = ref(true);

const favorites = reactive({
  jobs: [] as CareerPosition[],
  scenes: [] as Scenario[],
  courses: [] as Course[],
  banks: [] as QuestionBank[],
  exams: [] as Exam[],
  aiKbs: [] as AIKnowledgeBase[],
  aiAgents: [] as AIAgent[]
});

const visibleKeys = computed(() => CATEGORY_KEYS[activeCategory.value] || CATEGORY_KEYS.all);

const totalCount = computed(
  () =>
    favorites.jobs.length +
    favorites.scenes.length +
    favorites.courses.length +
    favorites.banks.length +
    favorites.exams.length +
    favorites.aiKbs.length +
    favorites.aiAgents.length
);

function coverStyle(coverImage: string | undefined, index: number) {
  return coverImage
    ? { backgroundImage: `url('${coverImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: COVER_GRADIENTS[index % COVER_GRADIENTS.length] };
}

function statusStyle(status: string) {
  const cfg = getStatusConfig(status);
  return { color: cfg.color, background: cfg.bg };
}

async function unfavorite(key: FavKey, id: string, targetType?: FavoriteTargetType) {
  try {
    if (targetType) {
      await favoriteApi.toggle(targetType, id);
    } else {
      await positionApi.favorite(id);
    }
    // 局部剔除，避免整表重载
    const list = favorites[key] as unknown as { id: string }[];
    const idx = list.findIndex((item) => item.id === id);
    if (idx >= 0) list.splice(idx, 1);
  } catch {
    ElMessage.error('取消收藏失败，请稍后再试');
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const [jobsRes, favRes] = await Promise.all([
      positionApi.listFavorites().catch(() => null),
      favoriteApi.list().catch(() => null)
    ]);
    favorites.jobs = jobsRes?.items || [];
    favorites.scenes = favRes?.scene || [];
    favorites.courses = favRes?.course || [];
    favorites.banks = favRes?.question_bank || [];
    favorites.exams = favRes?.exam || [];
    favorites.aiKbs = favRes?.ai_kb || [];
    favorites.aiAgents = favRes?.ai_agent || [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* 分类筛选（下划线 tab，对齐 React UnderlineTabs 玫红强调色） */
.cat-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 20px;
}
.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 0 0 8px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.cat-tab:hover {
  color: #e11d48;
}
.cat-tab.active {
  color: #e11d48;
  border-bottom-color: #e11d48;
  font-weight: 500;
}

.fav-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 64px 0;
  color: #9ca3af;
}

/* 空态 */
.fav-empty {
  text-align: center;
  padding: 64px 0;
  color: #9ca3af;
}
.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 16px;
  background: #fff1f2;
  color: #fecdd3;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-title {
  font-size: 15px;
  font-weight: 500;
  color: #4b5563;
}
.empty-sub {
  font-size: 13px;
  margin-top: 4px;
}
.empty-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  font-size: 12px;
}
.empty-links a {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #f43f5e;
  text-decoration: none;
}
.empty-links a:hover {
  text-decoration: underline;
}

/* 分组 */
.fav-block {
  margin-bottom: 24px;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.block-count {
  font-size: 12px;
  font-weight: 400;
  color: #9ca3af;
}
.i-primary { color: var(--el-color-primary); }
.i-amber { color: #f59e0b; }
.i-green { color: #10b981; }
.i-cyan { color: #06b6d4; }
.sub-block {
  margin-bottom: 16px;
}
.sub-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.card-wrap {
  position: relative;
}

/* 取消收藏按钮（覆盖卡片左上角，对齐 React 位置） */
.unfav-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  transition: color 0.2s;
}
.unfav-btn:hover {
  color: #fda4af;
}
.unfav-btn.light {
  left: auto;
  right: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: #6b7280;
}
.unfav-btn.light:hover {
  color: #f43f5e;
}

/* 课程/题库/试卷封面卡 */
.cover-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.25s, transform 0.25s, border-color 0.25s;
}
.cover-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: var(--el-color-primary-light-7);
}
.cover-head {
  position: relative;
  height: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
}
.cover-text {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.cover-icon {
  color: rgba(255, 255, 255, 0.8);
}
.cover-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}
.cover-sub {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 10px;
}
.cover-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
}
.cover-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cover-meta {
  margin: 0 0 4px;
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
}
.cover-desc {
  margin: 0 0 12px;
  flex: 1;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cover-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #f8fafc;
  padding-top: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.cover-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cover-link {
  color: var(--el-color-primary);
  font-weight: 500;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
}

/* AI 知识库 / 智能体简卡 */
.mini-card {
  display: block;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s;
}
.mini-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.mini-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mini-avatar {
  font-size: 20px;
}
.mini-title {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
  min-height: 32px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mini-meta {
  margin-top: 8px;
  font-size: 11px;
  color: #9ca3af;
}
</style>
