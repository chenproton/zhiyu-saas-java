<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">岗位目标推荐管理</h2>
        <p class="page-sub">配置前台“为你推荐”模块展示的岗位及顺序，支持企业岗位与教学岗位混合推荐</p>
      </div>
      <el-button type="primary" @click="openAdd">添加推荐</el-button>
    </div>

    <el-card shadow="never">
      <div class="hint">已配置 {{ allRecommendations.length }} 个推荐岗位</div>
      <el-table v-loading="loading" :data="allRecommendations" stripe>
        <el-table-column label="顺序" width="70">
          <template #default="{ row }">
            <span class="order-badge">{{ row.sortOrder }}</span>
          </template>
        </el-table-column>
        <el-table-column label="岗位名称" min-width="200">
          <template #default="{ row }">
            <div>{{ positionName(row.careerPositionId) }}</div>
            <div class="sub">{{ positionShortName(row.careerPositionId) }} · {{ positionIndustry(row.careerPositionId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.positionType === 'teaching' ? 'warning' : 'primary'">
              {{ positionTypeLabel(row.positionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上架时间" width="160">
          <template #default="{ row }">{{ positionCreatedAt(row.careerPositionId) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row, $index }">
            <el-button size="small" :disabled="$index === 0" @click="move($index, -1)">上移</el-button>
            <el-button size="small" :disabled="$index === allRecommendations.length - 1" @click="move($index, 1)">下移</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addDialog" title="添加岗位目标推荐" width="560px">
      <el-form label-width="90px">
        <el-form-item label="推荐岗位">
          <el-select v-model="selectedPositionId" filterable placeholder="搜索或选择岗位" style="width: 100%">
            <el-option
              v-for="p in availablePositions"
              :key="p.id"
              :label="`${p.name}（${p.shortName}）`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="selectedPosition" class="selected-pos">
        <div class="sp-head">
          <span class="sp-name">{{ selectedPosition.name }}</span>
          <router-link :to="`/job/landing/${selectedPosition.id}`" target="_blank" class="sp-link">查看岗位</router-link>
        </div>
        <div class="sp-meta">
          行业：{{ positionIndustry(selectedPosition.id) }} · 能力点：{{ selectedPosition.abilityCount ?? 0 }} 个 · 上架时间：{{ formatDate(selectedPosition.createdAt) }}
        </div>
      </div>

      <template #footer>
        <el-button @click="addDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedPositionId" :loading="saving" @click="handleAdd">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { positionApi, recommendApi } from '@/api/job';
import { industryApi } from '@/api/system';
import { POSITION_TYPE_LABELS } from '@/types/job';
import type { CareerPosition, PositionRecommendation } from '@/types/job';
import type { Industry } from '@/types/system';

const recommendations = ref<PositionRecommendation[]>([]);
const positions = ref<CareerPosition[]>([]);
const loading = ref(false);
const saving = ref(false);
const addDialog = ref(false);
const selectedPositionId = ref('');

const industryMap = ref<Record<string, string>>({});

const allRecommendations = computed(() =>
  [...recommendations.value].filter((r) => r.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder)
);
const recommendedPositionIds = computed(() => new Set(allRecommendations.value.map((r) => r.careerPositionId)));
const availablePositions = computed(() =>
  positions.value.filter((p) => p.status === 'published' && !recommendedPositionIds.value.has(p.id))
);
const selectedPosition = computed(() => positions.value.find((p) => p.id === selectedPositionId.value) || null);

function positionTypeLabel(t: string) {
  return POSITION_TYPE_LABELS[t as keyof typeof POSITION_TYPE_LABELS] || t;
}
function findPosition(id: string) {
  return positions.value.find((p) => p.id === id);
}
function positionName(id: string) {
  return findPosition(id)?.name || '未知岗位';
}
function positionShortName(id: string) {
  return findPosition(id)?.shortName || '-';
}
function positionIndustry(id: string) {
  const indId = findPosition(id)?.industryId;
  return indId ? industryMap.value[indId] || '-' : '-';
}
function positionCreatedAt(id: string) {
  return formatDate(findPosition(id)?.createdAt);
}
function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function load() {
  loading.value = true;
  try {
    const [posRes, recRes, indRes] = await Promise.all([
      positionApi.list({ limit: 1000 }),
      recommendApi.list({ limit: 1000 }),
      industryApi.list({ limit: 1000 })
    ]);
    positions.value = posRes.items;
    recommendations.value = recRes.items;
    const im: Record<string, string> = {};
    (indRes.items as Industry[]).forEach((i) => {
      im[i.id] = i.name;
    });
    industryMap.value = im;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  selectedPositionId.value = '';
  addDialog.value = true;
}

async function handleAdd() {
  const position = findPosition(selectedPositionId.value);
  if (!position) return;
  saving.value = true;
  try {
    await recommendApi.create({
      careerPositionId: position.id,
      positionType: position.positionType,
      sortOrder: allRecommendations.value.length + 1,
      isEnabled: true
    });
    await load();
    selectedPositionId.value = '';
    addDialog.value = false;
  } catch (e) {
    ElMessage.error((e as Error).message || '添加失败');
  } finally {
    saving.value = false;
  }
}

async function move(index: number, direction: -1 | 1) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= allRecommendations.value.length) return;
  const ids = allRecommendations.value.map((r) => r.id);
  const [moved] = ids.splice(index, 1);
  ids.splice(newIndex, 0, moved);
  try {
    const sortedRecs = [...allRecommendations.value].sort((a, b) => a.sortOrder - b.sortOrder);
    await Promise.all(
      ids.map(async (id, idx) => {
        const rec = sortedRecs.find((r) => r.id === id);
        if (!rec) return;
        const newOrder = idx + 1;
        if (newOrder === rec.sortOrder) return;
        await recommendApi.update(id, {
          careerPositionId: rec.careerPositionId,
          positionType: rec.positionType,
          sortOrder: newOrder,
          isEnabled: rec.isEnabled
        });
      })
    );
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '排序失败');
  }
}

async function confirmDelete(row: PositionRecommendation) {
  try {
    await ElMessageBox.confirm('确定要删除该推荐吗？此操作不可撤销。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await recommendApi.delete(row.id);
    ElMessage.success('删除成功');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.hint { color: #606266; font-size: 13px; margin-bottom: 12px; }
.order-badge { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 50%; background: #ecf5ff; color: #409eff; font-weight: 600; }
.sub { color: #909399; font-size: 12px; }
.selected-pos {
  margin-top: 8px; padding: 12px; border: 1px solid #ebeef5; border-radius: 6px; background: #f5f7fa;
}
.sp-head { display: flex; align-items: center; justify-content: space-between; }
.sp-name { font-weight: 600; }
.sp-link { color: #409eff; text-decoration: none; font-size: 13px; }
.sp-link:hover { text-decoration: underline; }
.sp-meta { color: #909399; font-size: 13px; margin-top: 6px; }
</style>
