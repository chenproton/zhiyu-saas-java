<template>
  <div class="favorites-page">
    <div class="page-header">
      <h2 class="page-title">我的收藏</h2>
      <p class="page-sub">浏览岗位、场景、课程或测评资源时，点击「收藏」即可在这里查看</p>
    </div>

    <el-card shadow="never">
      <!-- 分类筛选 -->
      <el-radio-group v-model="activeCategory" class="cat-tabs">
        <el-radio-button value="all">全部收藏（{{ totalCount }}）</el-radio-button>
        <el-radio-button v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</el-radio-button>
      </el-radio-group>

      <div v-loading="loading" class="content">
        <el-empty v-if="!loading && totalCount === 0" description="暂无收藏内容" />

        <template v-else>
          <div v-for="c in visibleCategories" :key="c.key" class="cat-block">
            <h4 class="cat-title">{{ c.label }}<span class="cat-count">（{{ c.items.length }}）</span></h4>
            <div class="card-grid">
              <el-card v-for="item in c.items" :key="item.id" shadow="hover" class="fav-card">
                <div class="fav-name">{{ item.name }}</div>
                <div class="fav-desc">{{ item.description || '-' }}</div>
                <el-button size="small" type="danger" plain @click="unfavorite(c.key, item.id)">取消收藏</el-button>
              </el-card>
            </div>
          </div>
        </template>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { favoriteApi } from '@/api/portal';
import { positionApi } from '@/api/job';
import type { FavoriteTargetType } from '@/api/portal';

interface FavItem {
  id: string;
  name: string;
  description?: string;
}

const loading = ref(true);
const activeCategory = ref('all');
const favorites = reactive<Record<string, FavItem[]>>({
  jobs: [],
  scenes: [],
  courses: [],
  banks: [],
  exams: [],
  aiKbs: [],
  aiAgents: []
});

const categories = [
  { key: 'jobs', label: '职业岗位', targetType: undefined as FavoriteTargetType | undefined },
  { key: 'scenes', label: '实践场景', targetType: 'scene' as FavoriteTargetType },
  { key: 'courses', label: '课程', targetType: 'course' as FavoriteTargetType },
  { key: 'banks', label: '测评题库', targetType: 'question_bank' as FavoriteTargetType },
  { key: 'exams', label: '试卷', targetType: 'exam' as FavoriteTargetType },
  { key: 'aiKbs', label: '知识库', targetType: 'ai_kb' as FavoriteTargetType },
  { key: 'aiAgents', label: '智能体', targetType: 'ai_agent' as FavoriteTargetType }
];

const totalCount = computed(() =>
  Object.values(favorites).reduce((s, arr) => s + arr.length, 0)
);
const visibleCategories = computed(() =>
  activeCategory.value === 'all'
    ? categories.map((c) => ({ ...c, items: favorites[c.key] }))
    : categories
        .filter((c) => c.key === activeCategory.value)
        .map((c) => ({ ...c, items: favorites[c.key] }))
);

async function load() {
  loading.value = true;
  try {
    const [jobsRes, favRes] = await Promise.all([
      positionApi.listFavorites().catch(() => null),
      favoriteApi.list().catch(() => null)
    ]);
    favorites.jobs = (jobsRes?.items || []).map((p) => ({ id: p.id, name: p.name, description: p.shortName || p.description }));
    favorites.scenes = (favRes?.scene || []).map((s) => ({ id: s.id, name: s.name, description: (s as any).description || s.background || s.deliveryGoal }));
    favorites.courses = (favRes?.course || []).map((c) => ({ id: c.id, name: c.name, description: c.description }));
    favorites.banks = (favRes?.question_bank || []).map((b) => ({ id: b.id, name: b.name, description: b.description }));
    favorites.exams = (favRes?.exam || []).map((e) => ({ id: e.id, name: e.name, description: e.description }));
    favorites.aiKbs = (favRes?.ai_kb || []).map((k) => ({ id: k.id, name: k.name, description: k.description }));
    favorites.aiAgents = (favRes?.ai_agent || []).map((a) => ({ id: a.id, name: a.name, description: a.description }));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function unfavorite(key: string, id: string) {
  const cat = categories.find((c) => c.key === key);
  try {
    if (cat?.targetType) {
      await favoriteApi.toggle(cat.targetType, id);
    } else {
      await positionApi.favorite(id);
    }
    favorites[key] = favorites[key].filter((i) => i.id !== id);
    ElMessage.success('已取消收藏');
  } catch (e) {
    ElMessage.error((e as Error).message || '取消收藏失败');
  }
}

onMounted(load);
</script>

<style scoped>
.favorites-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.cat-tabs { margin-bottom: 16px; }
.content { min-height: 200px; }
.cat-block { margin-bottom: 20px; }
.cat-title { font-size: 14px; font-weight: 600; margin: 0 0 10px; color: #303133; }
.cat-count { color: #909399; font-size: 12px; font-weight: 400; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.fav-card { position: relative; }
.fav-name { font-weight: 600; margin-bottom: 6px; }
.fav-desc { color: #909399; font-size: 12px; min-height: 32px; margin-bottom: 10px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>
