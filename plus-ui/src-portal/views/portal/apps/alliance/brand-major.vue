<template>
  <div class="crud-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">专业品牌管理</h1>
        <p class="page-desc">
          专业来自系统专业库，仅可开启前台展示，无法在此新增专业 · 共 {{ rows.length }} 个专业，已启用
          {{ enabledCount }} 个
        </p>
      </div>
      <BatchImport brand-type="major" entity-label="专业品牌" @success="load" />
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索专业名称..." clearable class="toolbar__search" />
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="filteredRows" style="width: 100%">
        <el-table-column label="专业名称" min-width="200">
          <template #default="{ row }">
            <span class="cell-strong">{{ row.major.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="140" align="center">
          <template #default="{ row }">
            <div class="toggle-cell">
              <el-switch
                :model-value="!!row.brand?.isPublic"
                :disabled="togglingId === row.major.id"
                @change="(v: boolean | string | number) => togglePublic(row, Boolean(v))"
              />
              <el-icon v-if="togglingId === row.major.id" class="is-loading"><Loading /></el-icon>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="专业代码" width="140">
          <template #default="{ row }">
            <span class="cell-muted">{{ row.major.code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="品牌管理" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.brand" type="primary" size="small" effect="light">已创建品牌</el-tag>
            <span v-else class="cell-muted">未创建品牌</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <el-button v-if="row.brand" link type="primary" size="small" @click="viewDetail(row.brand)">
              管理品牌内容
            </el-button>
            <span v-else class="cell-muted">开启展示后创建</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无专业数据" :image-size="60" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { AllianceBrand, MajorOption } from './shared';
import BatchImport from './components/BatchImport.vue';

const brandType = 'major';

const auth = useAuthStore();
const router = useRouter();
const tenantId = () => (auth.user?.tenantId as string) || '';

interface Row {
  major: MajorOption;
  brand?: AllianceBrand;
}

const majors = ref<MajorOption[]>([]);
const brands = ref<AllianceBrand[]>([]);
const loading = ref(false);
const togglingId = ref('');
const keyword = ref('');

const brandByMajor = computed(() => {
  const map = new Map<string, AllianceBrand>();
  for (const b of brands.value) if (b.majorId) map.set(b.majorId, b);
  return map;
});

const rows = computed<Row[]>(() =>
  majors.value.map((m) => ({ major: m, brand: brandByMajor.value.get(m.id) })),
);

const enabledCount = computed(() => rows.value.filter((r) => r.brand?.isPublic).length);

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return rows.value;
  return rows.value.filter((r) => r.major.name.toLowerCase().includes(kw));
});

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  try {
    const [majorsRes, brandsRes] = await Promise.all([
      portalRequest<{ items: MajorOption[] }>('/majors?limit=500'),
      allianceBrandApi.list({ brandType, limit: 200 }),
    ]);
    majors.value = majorsRes.items || [];
    brands.value = (brandsRes.items || []) as AllianceBrand[];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function togglePublic(row: Row, value: boolean) {
  togglingId.value = row.major.id;
  try {
    if (row.brand) {
      await allianceBrandApi.update(row.brand.id, { isPublic: value } as any);
    } else {
      await allianceBrandApi.create({
        brandType,
        name: row.major.name,
        majorId: row.major.id,
        isPublic: value,
      } as any);
    }
    ElMessage.success(value ? '已开启前台展示' : '已关闭前台展示');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    togglingId.value = '';
  }
}

function viewDetail(brand: AllianceBrand) {
  router.push(`/portal/apps/alliance/brands/${brand.id}`);
}

onMounted(load);
</script>

<style scoped>
.crud-page {
  min-height: 100%;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
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
.toolbar {
  margin-bottom: 16px;
}
.toolbar__search {
  max-width: 360px;
}
.table-card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.cell-strong {
  font-weight: 500;
}
.cell-muted {
  color: #94a3b8;
}
.toggle-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
