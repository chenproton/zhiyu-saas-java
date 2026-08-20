<template>
  <div class="favorites-page">
    <div class="page-header">
      <h2 class="page-title">我的收藏</h2>
      <p class="page-sub">浏览岗位、场景、课程或测评资源时，点击「收藏」即可在这里查看</p>
    </div>

    <el-card shadow="never">
      <!-- 分类筛选（对齐 React：测评资源=题库+试卷） -->
      <el-radio-group v-model="activeCategory" class="cat-tabs">
        <el-radio-button value="all">全部收藏（{{ totalCount }}）</el-radio-button>
        <el-radio-button value="jobs">职业岗位</el-radio-button>
        <el-radio-button value="scenes">实践场景</el-radio-button>
        <el-radio-button value="courses">数字课程</el-radio-button>
        <el-radio-button value="exams">测评资源</el-radio-button>
      </el-radio-group>

      <div v-loading="loading" class="content">
        <el-empty
          v-if="!loading && totalCount === 0"
          description="暂无收藏内容"
          class="fav-empty"
        >
          <div class="empty-links">
            <el-link type="primary" @click="$router.push('/job/landing')">去收藏岗位</el-link>
            <el-link type="primary" @click="$router.push('/scene/landing')">去收藏场景</el-link>
            <el-link type="primary" @click="$router.push('/lesson/landing')">去收藏课程</el-link>
            <el-link type="primary" @click="$router.push('/evaluation/landing')">去收藏测评</el-link>
          </div>
        </el-empty>

        <template v-else>
          <div v-for="g in visibleGroups" :key="g.key" class="cat-block">
            <h4 class="cat-title">{{ g.label }}<span class="cat-count">（{{ g.items.length }}）</span></h4>
            <div class="card-grid">
              <el-card v-for="item in g.items" :key="item.id" shadow="hover" class="fav-card">
                <div class="fav-name" @click="goDetail(item)">{{ item.name }}</div>
                <div class="fav-desc">{{ item.description || '-' }}</div>
                <el-button size="small" type="danger" plain @click="unfavorite(item)">取消收藏</el-button>
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
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { favoriteApi } from '@/api/portal';
import { positionApi } from '@/api/job';
import type { FavoriteTargetType } from '@/api/portal';

interface FavItem {
  id: string;
  name: string;
  description?: string;
  href: string;
  targetType?: FavoriteTargetType;
}

const router = useRouter();
const loading = ref(true);
const activeCategory = ref('all');

const favorites = reactive<Record<string, FavItem[]>>({
  jobs: [],
  scenes: [],
  courses: [],
  banks: [],
  exams: []
});

const totalCount = computed(() =>
  Object.values(favorites).reduce((s, arr) => s + arr.length, 0)
);

/* 展示分组：测评资源合并题库+试卷 */
const groups = computed(() => [
  { key: 'jobs', label: '职业岗位', items: favorites.jobs },
  { key: 'scenes', label: '实践场景', items: favorites.scenes },
  { key: 'courses', label: '数字课程', items: favorites.courses },
  { key: 'exams', label: '测评资源', items: [...favorites.banks, ...favorites.exams] }
]);

const visibleGroups = computed(() =>
  activeCategory.value === 'all'
    ? groups.value.filter((g) => g.items.length > 0)
    : groups.value.filter((g) => g.key === activeCategory.value)
);

function goDetail(item: FavItem) {
  if (item.href) router.push(item.href);
}

async function load() {
  loading.value = true;
  try {
    const [jobsRes, favRes] = await Promise.all([
      positionApi.listFavorites().catch(() => null),
      favoriteApi.list().catch(() => null)
    ]);
    favorites.jobs = (jobsRes?.items || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.shortName || p.description,
      href: `/job/landing/${p.id}`
    }));
    favorites.scenes = (favRes?.scene || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: (s as any).description || s.background || s.deliveryGoal,
      href: `/scene/landing/${s.id}`,
      targetType: 'scene' as FavoriteTargetType
    }));
    favorites.courses = (favRes?.course || []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      href: `/lesson/landing/${c.id}`,
      targetType: 'course' as FavoriteTargetType
    }));
    favorites.banks = (favRes?.question_bank || []).map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      href: `/evaluation/landing/banks/${b.id}`,
      targetType: 'question_bank' as FavoriteTargetType
    }));
    favorites.exams = (favRes?.exam || []).map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      href: `/evaluation/landing/exams/${e.id}`,
      targetType: 'exam' as FavoriteTargetType
    }));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function unfavorite(item: FavItem) {
  try {
    if (item.targetType) {
      await favoriteApi.toggle(item.targetType, item.id);
    } else {
      await positionApi.favorite(item.id);
    }
    // 从对应内部集合移除
    for (const key of Object.keys(favorites) as (keyof typeof favorites)[]) {
      favorites[key] = favorites[key].filter((i) => i.id !== item.id);
    }
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
.fav-name {
  font-weight: 600;
  margin-bottom: 6px;
  cursor: pointer;
  color: #303133;
}
.fav-name:hover { color: #409eff; }
.fav-desc {
  color: #909399;
  font-size: 12px;
  min-height: 32px;
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.fav-empty { padding: 24px 0; }
.empty-links { display: flex; justify-content: center; gap: 16px; margin-top: 8px; }
</style>
