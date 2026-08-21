<template>
  <div class="brands-page">
    <div class="page-head">
      <h1 class="page-title">品牌运营管理</h1>
      <p class="page-desc">管理六大品牌模块内容，配置前台展示</p>
    </div>
    <div class="brand-grid">
      <router-link
        v-for="card in brandCards"
        :key="card.type"
        :to="card.path"
        class="brand-card"
      >
        <div class="brand-card__head">
          <div class="brand-card__icon" :style="{ background: card.bg, color: card.color }">
            <el-icon :size="20"><component :is="card.icon" /></el-icon>
          </div>
          <span class="brand-card__title">{{ card.label }}</span>
        </div>
        <div class="brand-card__body">
          <p class="brand-card__desc">{{ card.desc }}</p>
          <p class="brand-card__count">{{ counts[card.type] || 0 }} 条内容</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { School, OfficeBuilding, Briefcase, Reading, User, Brush } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const counts = ref<Record<string, number>>({});

const brandCards = [
  { type: 'talent', label: '人才品牌', desc: '展示学生能力画像与典型就业案例', icon: School, color: '#2563eb', bg: '#eff6ff', path: '/portal/apps/alliance/brands/talent' },
  { type: 'employer', label: '雇主品牌', desc: '展示合作企业/机构的品牌形象', icon: OfficeBuilding, color: '#16a34a', bg: '#f0fdf4', path: '/portal/apps/alliance/brands/employer' },
  { type: 'job', label: '岗位品牌', desc: '展示优质岗位的品牌级运营', icon: Briefcase, color: '#ea580c', bg: '#fff7ed', path: '/portal/apps/alliance/brands/job' },
  { type: 'major', label: '专业品牌', desc: '展示专业建设水平与培养特色', icon: Reading, color: '#9333ea', bg: '#faf5ff', path: '/portal/apps/alliance/brands/major' },
  { type: 'teacher', label: '师资品牌', desc: '展示校本师资与产业导师', icon: User, color: '#dc2626', bg: '#fef2f2', path: '/portal/apps/alliance/brands/teacher' },
  { type: 'culture', label: '文化思政品牌', desc: '展示典型案例、思政资源与文化活动', icon: Brush, color: '#0891b2', bg: '#ecfeff', path: '/portal/apps/alliance/brands/culture' },
];

async function loadCounts() {
  if (!tenantId.value) return;
  try {
    const data = await allianceBrandApi.list({ limit: 500 });
    const c: Record<string, number> = {};
    for (const b of data.items || []) {
      c[b.brandType] = (c[b.brandType] || 0) + 1;
    }
    counts.value = c;
  } catch {
    counts.value = {};
  }
}

onMounted(loadCounts);
</script>

<style scoped>
.brands-page {
  min-height: 100%;
}
.page-head {
  margin-bottom: 24px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.page-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.brand-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.brand-card {
  display: block;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  text-decoration: none;
  transition: box-shadow 0.2s;
}
.brand-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.brand-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
}
.brand-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}
.brand-card__desc {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 8px;
}
.brand-card__count {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
@media (max-width: 992px) {
  .brand-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .brand-grid {
    grid-template-columns: 1fr;
  }
}
</style>
