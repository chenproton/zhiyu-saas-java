<template>
  <div class="classify-grid">
    <div class="classify-item">
      <span class="classify-label">所属院系</span>
      <el-select :model-value="value.departmentId || ''" clearable placeholder="不限" style="width: 100%" @update:model-value="onDept">
        <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
    </div>
    <div class="classify-item">
      <span class="classify-label">所属专业</span>
      <el-select :model-value="value.majorId || ''" clearable placeholder="不限" style="width: 100%" @update:model-value="onMajor">
        <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
      </el-select>
    </div>
    <div v-if="withKbType" class="classify-item">
      <span class="classify-label">知识库类型</span>
      <el-select :model-value="value.kbType || ''" clearable placeholder="不限" style="width: 100%" @update:model-value="onKbType">
        <el-option v-for="(label, key) in AI_KB_TYPE_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClassifyDicts, AI_KB_TYPE_LABELS } from '../ai-api';

export interface ClassifyValue {
  majorId: string;
  departmentId: string;
  kbType: string;
}

const props = defineProps<{
  value: ClassifyValue;
  withKbType?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:value', v: ClassifyValue): void }>();

const { majors, departments } = useClassifyDicts();

function onDept(v: string) {
  emit('update:value', { ...props.value, departmentId: v || '' });
}
function onMajor(v: string) {
  emit('update:value', { ...props.value, majorId: v || '' });
}
function onKbType(v: string) {
  emit('update:value', { ...props.value, kbType: v || '' });
}
</script>

<style scoped>
.classify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.classify-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.classify-label {
  font-size: 13px;
  color: #606266;
}
</style>
