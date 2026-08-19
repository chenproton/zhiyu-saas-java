<template>
  <el-dialog
    :model-value="modelValue"
    title="新建试卷"
    width="520px"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <el-form label-width="90px" label-position="top">
      <el-form-item label="试卷名称" required>
        <el-input v-model="form.name" placeholder="输入试卷名称" maxlength="100" />
      </el-form-item>
      <el-form-item label="试卷简介">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="简述试卷用途、覆盖范围" />
      </el-form-item>
      <el-form-item label="所属批次">
        <el-select v-model="form.batchId" placeholder="不设置批次" clearable style="width: 100%">
          <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="考试时长（分钟）">
        <el-input-number v-model="form.duration" :min="0" :precision="0" controls-position="right" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!form.name.trim()" @click="handleSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 新建试卷弹窗：对齐 React frontend/edu/components/evaluation/exam-form-dialog.tsx 的核心字段
 * （名称/简介/所属批次/考试时长）。封面上传与协作者维护走试卷管理页，不在任务编排内联表单里做。
 */
import { ref, watch } from 'vue';
import { evaluationBatchApi } from '@/api/evaluation';
import type { ExamFormData } from './types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', data: ExamFormData): void;
}>();

const form = ref<ExamFormData>({ name: '', description: '', batchId: undefined, duration: 60 });
const batches = ref<{ id: string; name: string }[]>([]);

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    form.value = { name: '', description: '', batchId: undefined, duration: 60 };
    try {
      const res = await evaluationBatchApi.list({ limit: 200 });
      batches.value = ((res.items || []) as any[]).map((b) => ({ id: b.id, name: b.name }));
    } catch {
      batches.value = [];
    }
  }
);

function handleSubmit() {
  if (!form.value.name.trim()) return;
  emit('submit', {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    batchId: form.value.batchId || undefined,
    duration: form.value.duration || 60
  });
  emit('update:modelValue', false);
}
</script>
