<template>
  <div class="ref-section">
    <div class="ref-section__head">
      <h3 class="ref-section__title">{{ title }}</h3>
      <el-button size="small" @click="openPicker">
        <el-icon class="mr-4"><Plus /></el-icon>
        关联
      </el-button>
    </div>

    <div v-if="items.length === 0" class="ref-section__empty">{{ empty }}</div>
    <div v-else class="ref-grid">
      <div v-for="item in items" :key="item.id" class="ref-card">
        <p class="ref-card__name">{{ item.name }}</p>
        <el-button class="ref-card__remove" size="small" circle type="danger" @click="remove(item.id)">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <el-dialog v-model="open" :title="pickerTitle" width="520px">
      <p class="dialog-tip">选择后确认关联</p>
      <el-input v-model="search" :placeholder="placeholder" clearable class="mb-12" />
      <div v-loading="loading" class="picker-list">
        <div v-if="referable.length === 0" class="picker-empty">没有可选内容</div>
        <div
          v-for="o in referable"
          :key="o.id"
          class="picker-item"
          :class="{ 'picker-item--active': isSelected(o.id) }"
          @click="toggle(o)"
        >
          <span class="picker-item__name">{{ o.name }}</span>
          <span class="picker-item__check" :class="{ 'picker-item__check--on': isSelected(o.id) }" />
        </div>
      </div>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" :disabled="selected.length === 0" @click="confirm">
          确认关联 ({{ selected.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Close } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import type { RefItem } from '../shared';

const props = defineProps<{
  kind: 'brands' | 'enterprises' | 'achievements' | 'courses';
  title: string;
  empty: string;
  items: RefItem[];
  placeholder: string;
  pickerTitle: string;
}>();

const emit = defineEmits<{
  (e: 'change', items: RefItem[]): void;
}>();

const open = ref(false);
const search = ref('');
const selected = ref<RefItem[]>([]);
const options = ref<RefItem[]>([]);
const loading = ref(false);

const existingIds = computed(() => new Set(props.items.map((i) => i.id)));

const referable = computed(() => {
  const list = options.value.filter((o) => !existingIds.value.has(o.id));
  const kw = search.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((o) => o.name.toLowerCase().includes(kw));
});

function isSelected(id: string) {
  return selected.value.some((x) => x.id === id);
}

function toggle(item: RefItem) {
  selected.value = isSelected(item.id)
    ? selected.value.filter((x) => x.id !== item.id)
    : [...selected.value, item];
}

async function openPicker() {
  open.value = true;
  search.value = '';
  selected.value = [];
  loading.value = true;
  try {
    options.value = await fetchOptions();
  } catch {
    options.value = [];
  } finally {
    loading.value = false;
  }
}

async function fetchOptions(): Promise<RefItem[]> {
  if (props.kind === 'brands') {
    const res = await allianceBrandApi.list({ brandType: 'job', limit: 200 });
    return (res.items || []).map((b) => ({
      id: b.id,
      name: (b as any).name || (b as any).positionName || '',
    }));
  }
  if (props.kind === 'enterprises') {
    const [entsRes, brandsRes] = await Promise.all([
      portalRequest<{ items: RefItem[] }>('/alliance/enterprises?limit=200'),
      allianceBrandApi.list({ brandType: 'employer', limit: 200 }),
    ]);
    const enterpriseItems = (entsRes.items || []).map((e) => ({ id: e.id, name: e.name }));
    const brandItems = (brandsRes.items || [])
      .filter((b) => !(b as any).enterpriseId)
      .map((b) => ({ id: b.id, name: b.name }));
    return [...enterpriseItems, ...brandItems];
  }
  if (props.kind === 'achievements') {
    const res = await portalRequest<{ items: any[] }>('/alliance/achievements?limit=200');
    return (res.items || []).map((a) => ({ id: a.id, name: a.title }));
  }
  const res = await portalRequest<{ items: RefItem[] }>('/lesson/courses?limit=200');
  return (res.items || []).map((c) => ({ id: c.id, name: c.name }));
}

function confirm() {
  if (selected.value.length === 0) return;
  emit('change', [...props.items, ...selected.value]);
  ElMessage.success(`已关联 ${selected.value.length} 项`);
  open.value = false;
}

function remove(itemId: string) {
  emit(
    'change',
    props.items.filter((i) => i.id !== itemId),
  );
}
</script>

<style scoped>
.ref-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.ref-section__title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.mr-4 {
  margin-right: 4px;
}
.ref-section__empty {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  padding: 48px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.ref-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.ref-card {
  position: relative;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  min-height: 72px;
}
.ref-card__name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  word-break: break-all;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ref-card__remove {
  position: absolute;
  top: -8px;
  right: -8px;
}
.dialog-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #64748b;
}
.mb-12 {
  margin-bottom: 12px;
}
.picker-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.picker-empty {
  padding: 32px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
}
.picker-item--active {
  border-color: #409eff;
  background: #f5f9ff;
}
.picker-item__name {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-item__check {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #cbd5e1;
  flex-shrink: 0;
}
.picker-item__check--on {
  border-color: #409eff;
  background: #409eff;
}
@media (max-width: 992px) {
  .ref-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
