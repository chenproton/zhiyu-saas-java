<template>
  <el-dialog
    :model-value="modelValue"
    :title="kind === 'kp' ? '关联考查知识点' : '关联考查能力点'"
    width="900px"
    top="6vh"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <p class="dialog-hint">此处仅可选择任务关联的知识点/能力点，请先在任务中配置后选择。</p>
    <div class="picker-body">
      <div class="picker-left">
        <el-input
          v-model="search"
          size="small"
          clearable
          :placeholder="kind === 'kp' ? '搜索知识点名称、描述或编码...' : '搜索能力点名称、描述或编码...'"
          class="search"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="scroll-area">
          <div v-if="isSearching && searchLoading" class="loading">搜索中...</div>
          <el-empty
            v-else-if="visibleItems.length === 0"
            :description="isSearching ? (kind === 'kp' ? '未找到相关知识点' : '未找到相关能力点') : '暂无可选项'"
            :image-size="60"
          />
          <el-table v-else :data="visibleItems" size="small" @row-click="(row: any) => emit('toggle', row.id)">
            <el-table-column :label="kind === 'kp' ? '知识点名称' : '能力点名称'" min-width="160">
              <template #default="{ row }">
                <div class="item-name">
                  <span class="check-box" :class="{ on: selectedIds.includes(row.id) }">
                    <el-icon v-if="selectedIds.includes(row.id)" :size="11"><Check /></el-icon>
                  </span>
                  <span class="name-text">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="编码" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.code" size="small" type="info" disable-transitions>{{ row.code }}</el-tag>
                <span v-else class="dim">-</span>
              </template>
            </el-table-column>
            <el-table-column label="描述" min-width="180">
              <template #default="{ row }">
                <span class="dim ellipsis" :title="row.description">{{ row.description || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="88" align="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  :type="selectedIds.includes(row.id) ? 'default' : 'primary'"
                  :plain="selectedIds.includes(row.id)"
                  @click.stop="emit('toggle', row.id)"
                >
                  {{ selectedIds.includes(row.id) ? '取消' : '选择' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="picker-right">
        <p class="right-title">
          {{ kind === 'kp' ? '已选择知识点' : '已选择能力点' }} ({{ selectedIds.length }})
        </p>
        <div class="scroll-area">
          <el-empty
            v-if="selectedIds.length === 0"
            :description="kind === 'kp' ? '从左侧选择知识点' : '从左侧选择能力点'"
            :image-size="60"
          />
          <div v-else class="selected-list">
            <div v-for="id in selectedIds" :key="id" class="selected-card">
              <div class="selected-head">
                <span class="selected-name">{{ nameOf(id) }}</span>
                <el-button link size="small" @click="emit('toggle', id)">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              <p class="selected-desc">{{ descOf(id) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)">完成</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 知识点 / 能力点关联弹窗：对齐 React EvaluationRulesEditor 的 rubricKpDialog / rubricAbDialog。
 * 无搜索词时展示任务关联的池（props.pool）；有搜索词时走后端模糊搜索（300ms 防抖，
 * knowledgeApi.list / abilityApi.list，limit=200），可命中池外全部条目。
 */
import { computed, ref, watch } from 'vue';
import { Check, Close, Search } from '@element-plus/icons-vue';
import { knowledgeApi } from '@/api/lesson';
import { abilityApi } from '@/api/job';

interface PointItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

const props = defineProps<{
  modelValue: boolean;
  kind: 'kp' | 'ab';
  pool: PointItem[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'toggle', id: string): void;
}>();

const search = ref('');
const searchLoading = ref(false);
const results = ref<PointItem[] | null>(null);
let searchSeq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const isSearching = computed(() => !!search.value.trim());

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      search.value = '';
      results.value = null;
    }
  }
);

watch(search, (raw) => {
  const term = raw.trim();
  if (timer) clearTimeout(timer);
  const seq = ++searchSeq;
  if (!term) {
    results.value = null;
    searchLoading.value = false;
    return;
  }
  timer = setTimeout(async () => {
    searchLoading.value = true;
    try {
      const res =
        props.kind === 'kp'
          ? await knowledgeApi.list({ search: term, limit: 200 })
          : await abilityApi.list({ search: term, limit: 200 });
      if (seq !== searchSeq) return;
      results.value = ((res.items || []) as any[]).map((k) => ({
        id: k.id,
        name: k.name,
        code: k.code,
        description: k.description
      }));
    } catch {
      if (seq !== searchSeq) return;
      results.value = [];
    } finally {
      if (seq === searchSeq) searchLoading.value = false;
    }
  }, 300);
});

const visibleItems = computed<PointItem[]>(() => (isSearching.value ? results.value || [] : props.pool));

function findItem(id: string): PointItem | undefined {
  return props.pool.find((p) => p.id === id) || (results.value || []).find((p) => p.id === id);
}

function nameOf(id: string): string {
  return findItem(id)?.name || id;
}

function descOf(id: string): string {
  return findItem(id)?.description || '暂无描述';
}
</script>

<style scoped>
.dialog-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #909399;
}
.picker-body {
  display: flex;
  gap: 16px;
}
.picker-left {
  width: 60%;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}
.picker-right {
  width: 40%;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}
.search {
  margin-bottom: 10px;
}
.scroll-area {
  max-height: 420px;
  min-height: 220px;
  overflow-y: auto;
}
.loading {
  text-align: center;
  color: #a8abb2;
  font-size: 13px;
  padding: 24px 0;
}
.item-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
.check-box {
  width: 16px;
  height: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
}
.check-box.on {
  background: #409eff;
  border-color: #409eff;
}
.name-text {
  font-size: 13px;
  color: #303133;
}
.dim {
  font-size: 12px;
  color: #a8abb2;
}
.ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selected-card {
  border: 1px solid #d9ecff;
  background: #f7fbff;
  border-radius: 8px;
  padding: 8px 10px;
}
.selected-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.selected-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-desc {
  margin: 2px 0 0;
  font-size: 11px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
