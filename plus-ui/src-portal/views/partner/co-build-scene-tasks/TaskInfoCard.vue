<template>
  <div class="task-info-card">
    <el-form label-position="top">
      <el-form-item>
        <template #label>
          <span class="label-row">任务名称<slot name="name-ai" /></span>
        </template>
        <el-input v-model="nameModel" placeholder="输入任务名称" />
      </el-form-item>
      <el-form-item label="任务类型">
        <el-select v-model="typeModel" style="width: 100%">
          <el-option label="训练任务" value="training" />
          <el-option label="考核任务" value="assessment" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span>预估学时 <span class="tip">学生完成任务的预估时长</span></span>
        </template>
        <el-input-number v-model="hoursModel" :min="0" :max="999" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="label-row">难度<slot name="difficulty-ai" /></span>
        </template>
        <el-rate v-model="difficultyModel" :max="5" />
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="label-row">背景介绍<slot name="background-ai" /></span>
        </template>
        <el-input v-model="backgroundModel" type="textarea" :rows="3" placeholder="简述任务背景" />
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string;
  type: string;
  difficulty: number;
  hours: number | string;
  background?: string;
}>();

const emit = defineEmits<{
  (e: 'update:name', v: string): void;
  (e: 'update:type', v: string): void;
  (e: 'update:difficulty', v: number): void;
  (e: 'update:hours', v: number): void;
  (e: 'update:background', v: string): void;
}>();

const nameModel = computed({ get: () => props.name, set: (v) => emit('update:name', v) });
const typeModel = computed({ get: () => props.type, set: (v) => emit('update:type', v) });
const difficultyModel = computed({
  get: () => props.difficulty,
  set: (v) => emit('update:difficulty', v)
});
const hoursModel = computed({
  get: () => (typeof props.hours === 'string' ? Number(props.hours) || 0 : props.hours),
  set: (v) => emit('update:hours', v ?? 0)
});
const backgroundModel = computed({
  get: () => props.background || '',
  set: (v) => emit('update:background', v)
});
</script>

<style scoped>
.label-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tip {
  color: #999;
  font-size: 12px;
  margin-left: 4px;
}
</style>
