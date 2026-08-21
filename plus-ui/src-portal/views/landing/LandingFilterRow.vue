<template>
  <!-- 筛选行（行业/专业等 chip 组，超出一行自动折叠 + 展开/收起）：
       对齐原 React 版 landing-filter-row（accentColor=primary）。 -->
  <div v-if="items.length > 1" class="filter-row" :class="{ 'filter-row-border': showBorder }">
    <span class="filter-label">{{ label }}</span>
    <div class="filter-body">
      <div
        ref="containerRef"
        class="filter-chips"
        :class="{ 'filter-chips-collapsed': !expanded }"
      >
        <button
          v-for="item in items"
          :key="item"
          type="button"
          :class="['chip', { active: selected === item }]"
          @click="emit('update:selected', item)"
        >
          {{ item }}
        </button>
      </div>
      <button v-if="overflow" type="button" class="expand-btn" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  label: string;
  items: string[];
  selected: string;
  showBorder?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:selected', value: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const expanded = ref(false);
const overflow = ref(false);

function checkOverflow() {
  const el = containerRef.value;
  if (el) overflow.value = el.scrollHeight > el.clientHeight + 2;
}

onMounted(checkOverflow);
watch(() => props.items, checkOverflow);
</script>

<style scoped>
.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 0;
}
.filter-row-border {
  border-bottom: 1px dashed #cbd5e1;
}
.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  min-width: 40px;
  padding-top: 6px;
  flex-shrink: 0;
}
.filter-body {
  flex: 1;
  min-width: 0;
}
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}
.filter-chips-collapsed {
  max-height: 80px;
  overflow: hidden;
}
.chip {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.chip:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.chip.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}
.expand-btn {
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 500;
  margin-top: 6px;
  padding: 0;
  cursor: pointer;
}
</style>
