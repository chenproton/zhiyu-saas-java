<template>
  <div class="landing">
    <div class="landing-header">
      <h2>岗位广场</h2>
      <el-input v-model="keyword" placeholder="搜索岗位..." clearable style="max-width: 320px" @input="onSearch" @clear="onSearch" />
    </div>

    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="pos in items" :key="pos.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="pos-card" @click="openDetail(pos)">
          <div class="pos-name">{{ pos.name }}</div>
          <div class="pos-type">{{ pos.positionType === 'enterprise' ? '企业岗位' : '教学岗位' }}</div>
          <div class="pos-desc">{{ pos.description || '暂无描述' }}</div>
          <div class="pos-meta">
            <el-tag v-if="pos.salaryMin || pos.salaryMax" size="small" type="success">
              {{ pos.salaryMin ?? '?' }} - {{ pos.salaryMax ?? '?' }}
            </el-tag>
            <span class="view-count">浏览 {{ pos.viewCount ?? 0 }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-empty v-if="!loading && !items.length" description="暂无岗位" />

    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next, total"
      class="pagination"
      @current-change="loadItems"
    />

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawer" :title="detail?.name" size="480px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="简称">{{ detail.shortName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ detail.positionType === 'enterprise' ? '企业岗位' : '教学岗位' }}</el-descriptions-item>
          <el-descriptions-item label="薪资">{{ detail.salaryMin ?? '-' }} - {{ detail.salaryMax ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="版本">{{ detail.version }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ contentStatusLabel(detail.status) }}</el-descriptions-item>
        </el-descriptions>
        <div class="detail-section">
          <h4>岗位描述</h4>
          <p class="detail-text">{{ detail.description || '暂无' }}</p>
        </div>
        <div class="detail-section" v-if="detail.requirements?.length">
          <h4>任职要求</h4>
          <ul>
            <li v-for="(r, i) in detail.requirements" :key="i">{{ r }}</li>
          </ul>
        </div>
        <div class="detail-section" v-if="detail.careerPath">
          <h4>发展路径</h4>
          <p class="detail-text">{{ detail.careerPath }}</p>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { publicPositionApi } from '@/api/job';
import type { CareerPosition } from '@/types/job';
import { contentStatusLabel } from '@/types/content-status';

const PAGE_SIZE = 20;
const items = ref<CareerPosition[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const drawer = ref(false);
const detail = ref<CareerPosition | null>(null);

async function loadItems() {
  loading.value = true;
  try {
    const res = await publicPositionApi.list({
      ...(keyword.value ? { keyword: keyword.value } : {}),
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
    });
    items.value = res.items;
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function onSearch() {
  page.value = 1;
  loadItems();
}
async function openDetail(pos: CareerPosition) {
  drawer.value = true;
  detail.value = pos;
  try {
    detail.value = await publicPositionApi.get(pos.id);
  } catch {
    /* 保留列表数据 */
  }
}
onMounted(loadItems);
</script>

<style scoped>
.landing { padding: 16px; }
.landing-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.pos-card { cursor: pointer; margin-bottom: 16px; }
.pos-name { font-size: 16px; font-weight: 600; }
.pos-type { font-size: 12px; color: #909399; margin: 4px 0; }
.pos-desc { font-size: 13px; color: #606266; height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pos-meta { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.view-count { font-size: 12px; color: #c0c4cc; }
.pagination { margin-top: 16px; justify-content: flex-end; }
.detail-section { margin-top: 16px; }
.detail-section h4 { margin: 0 0 8px; }
.detail-text { white-space: pre-wrap; color: #606266; }
</style>
