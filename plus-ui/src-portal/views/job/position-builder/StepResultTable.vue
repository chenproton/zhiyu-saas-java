<template>
  <!-- 步骤三：能力模型汇总 -->
  <div class="result-wrap">
    <div class="stats-row">
      <div class="stats-grid">
        <el-card shadow="never" class="stat-card">
          <p class="stat-label">工作职责</p>
          <p class="stat-value">{{ position.responsibilities.length }}</p>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <p class="stat-label">能力点</p>
          <p class="stat-value">{{ bindings.length }}</p>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <p class="stat-label">能力域</p>
          <p class="stat-value">{{ domainCount }}</p>
        </el-card>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <template #header><span class="card-title">能力模型明细表</span></template>
      <el-empty
        v-if="bindings.length === 0"
        description="暂无能力点数据，请返回步骤二进行拆解"
        :image-size="80"
      />
      <el-table v-else :data="rows" row-key="key" border :span-method="spanMethod" class="detail-table">
        <el-table-column label="所属能力领域" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.domainLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="能力点名称" min-width="150">
          <template #default="{ row }">
            <span class="cell-name">{{ row.binding.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="能力属性" width="120">
          <template #default="{ row }">
            <span class="cell-dim">{{ (row.binding.attributes || []).join('、') || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="能力领域" width="170">
          <template #default="{ row }">
            <el-select
              :model-value="row.binding.domain || ''"
              size="small"
              clearable
              placeholder="选择领域"
              style="width: 100%"
              @update:model-value="(v: string) => updateBinding(row.binding.id, { domain: v || undefined })"
            >
              <el-option v-for="d in ABILITY_DOMAINS" :key="d.value" :label="d.value" :value="d.value">
                <span>{{ d.value }}（{{ d.hint }}）</span>
              </el-option>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="掌握程度" width="130">
          <template #default="{ row }">
            <el-select
              :model-value="row.binding.level"
              size="small"
              placeholder="请选择"
              style="width: 100%"
              @update:model-value="(v: CompetencyLevel) => updateBinding(row.binding.id, { level: v })"
            >
              <el-option v-for="l in COMPETENCY_LEVELS" :key="l.value" :label="l.label" :value="l.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="胜任标准描述" min-width="260">
          <template #default="{ row }">
            <el-input
              :model-value="row.binding.rubricDescription"
              size="small"
              placeholder="请输入胜任标准描述..."
              @update:model-value="(v: string) => updateBinding(row.binding.id, { rubricDescription: v })"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  ABILITY_DOMAINS,
  COMPETENCY_LEVELS,
  type CompetencyLevel,
  type LocalAbilityBinding,
  type LocalPosition
} from './types';

interface TableRow {
  key: string;
  domainLabel: string;
  span: number;
  binding: LocalAbilityBinding;
}

const props = defineProps<{ position: LocalPosition }>();
const emit = defineEmits<{ (e: 'update', data: Partial<LocalPosition>): void }>();

const bindings = computed(() => props.position.abilityBindings);

/** 按能力域分组后的扁平行（首行承载 rowSpan，对齐 React rowSpan 合并单元格） */
const rows = computed<TableRow[]>(() => {
  const groups = new Map<string, LocalAbilityBinding[]>();
  for (const b of bindings.value) {
    const key = b.domain || '未分类';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  const list: TableRow[] = [];
  for (const [domainLabel, group] of groups) {
    group.forEach((binding, idx) => {
      list.push({
        key: `${domainLabel}-${binding.id}`,
        domainLabel,
        span: idx === 0 ? group.length : 0,
        binding
      });
    });
  }
  return list;
});

const domainCount = computed(
  () =>
    new Set(bindings.value.map((b) => b.domain).filter(Boolean)).size +
    (bindings.value.some((b) => !b.domain) ? 1 : 0)
);

function spanMethod({ row, columnIndex }: { row: TableRow; columnIndex: number }) {
  if (columnIndex !== 0) return { rowspan: 1, colspan: 1 };
  return row.span > 0 ? { rowspan: row.span, colspan: 1 } : { rowspan: 0, colspan: 0 };
}

function updateBinding(bindingId: string, updates: Partial<LocalAbilityBinding>) {
  emit('update', {
    abilityBindings: props.position.abilityBindings.map((b) => (b.id === bindingId ? { ...b, ...updates } : b))
  });
}
</script>

<style scoped>
.result-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stats-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.stat-card {
  border-radius: 10px;
  text-align: center;
}
.stat-label {
  margin: 0;
  font-size: 12px;
  color: #909399;
}
.stat-value {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}
.table-card {
  border-radius: 10px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.cell-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.cell-dim {
  font-size: 12px;
  color: #606266;
}
</style>
