<template>
  <div class="list-page">
    <div class="page-header">
      <h2 class="page-title">就业项目</h2>
      <p class="page-sub">查看合作学校分配给本企业的就业项目；点击项目名称可查看详情并在项目下录入岗位。</p>
    </div>

    <div class="toolbar">
      <el-input
        v-model="search"
        placeholder="搜索项目名称..."
        clearable
        style="max-width: 320px"
      />
      <el-select
        v-model="schoolFilter"
        placeholder="全部学校"
        clearable
        filterable
        style="width: 220px"
        @change="loadItems"
      >
        <el-option v-for="s in schools" :key="s.tenantId" :label="s.schoolName" :value="s.tenantId" />
      </el-select>
    </div>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="filtered" stripe>
        <el-table-column label="项目名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row)">{{ row.name }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ projectTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag type="info" effect="plain">{{ phaseLabel(derivePhase(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="起止日期" width="200">
          <template #default="{ row }">{{ fmt(row.startDate) }} ~ {{ fmt(row.endDate) }}</template>
        </el-table-column>
        <el-table-column label="发起单位" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.organizer || '-' }}</template>
        </el-table-column>
        <el-table-column label="发布状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.publishStatus === 'published' ? 'success' : 'info'" effect="plain">
              {{ publishStatusLabel(row.publishStatus) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && filtered.length === 0"
        description="暂无分配给本企业的就业项目。"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerEmploymentApi, partnerSchoolApi } from '@/api/partner';
import type { EmploymentProject, PartnerSchool } from '@/types/partner';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  spring: '春季招聘',
  autumn: '秋季招聘',
  directed: '定向招聘',
  order: '订单班招聘'
};
const PROJECT_PHASE_LABELS: Record<string, string> = {
  preparing: '筹备中',
  ongoing: '进行中',
  ended: '已结束'
};
const PUBLISH_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布'
};

const router = useRouter();
const items = ref<EmploymentProject[]>([]);
const schools = ref<PartnerSchool[]>([]);
const search = ref('');
const schoolFilter = ref('');
const loading = ref(false);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((p) => p.name.toLowerCase().includes(q));
});

function projectTypeLabel(t: string) { return PROJECT_TYPE_LABELS[t] || t; }
function phaseLabel(p: string) { return PROJECT_PHASE_LABELS[p] || p; }
function publishStatusLabel(s: string) { return PUBLISH_STATUS_LABELS[s] || s; }
function derivePhase(p: { startDate?: string; endDate?: string }): string {
  const today = new Date().toISOString().slice(0, 10);
  if (p.startDate && p.startDate > today) return 'preparing';
  if (p.endDate && p.endDate < today) return 'ended';
  return 'ongoing';
}
function fmt(d?: string) { return d ? String(d).slice(0, 10) : '-'; }

function goDetail(row: EmploymentProject) {
  router.push(`/partner/employment-projects/${row.id}`);
}

async function loadSchools() {
  try {
    const res = await partnerSchoolApi.list({ limit: 200 });
    schools.value = (res.items || []).filter((s) => s.status === 'active');
  } catch {
    schools.value = [];
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerEmploymentApi.listProjects(schoolFilter.value || undefined);
    items.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadSchools();
  loadItems();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
</style>
