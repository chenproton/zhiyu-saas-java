<template>
  <el-dialog
    :model-value="modelValue"
    title="套餐配置"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-desc">
      {{ tenant ? `配置租户「${tenant.name}」的订阅套餐` : '' }}
    </div>

    <div v-if="loading" class="state">加载中...</div>

    <template v-else>
      <div class="section-title">平台模块</div>
      <div class="module-grid">
        <el-checkbox
          v-for="m in PLATFORM_MODULES"
          :key="m.id"
          :model-value="!!modules[m.id]"
          border
          @change="toggleModule(m.id)"
        >
          {{ m.label }}
        </el-checkbox>
      </div>
    </template>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="loading" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { superAdminApi, PLATFORM_MODULES } from '@/api/superadmin';
import type { AdminTenant } from '@/api/superadmin';

const props = defineProps<{
  modelValue: boolean;
  tenant: AdminTenant | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const loading = ref(false);
const submitting = ref(false);
const modules = reactive<Record<string, boolean>>({});

function resetModules() {
  for (const key of Object.keys(modules)) delete modules[key];
  for (const m of PLATFORM_MODULES) modules[m.id] = false;
}

async function load() {
  if (!props.tenant) return;
  loading.value = true;
  resetModules();
  try {
    const sub = await superAdminApi.getSubscription(props.tenant.id);
    for (const m of PLATFORM_MODULES) {
      const v = sub.modules?.[m.id];
      modules[m.id] = v === true || v === 'true' || v === 1;
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '加载套餐失败');
  } finally {
    loading.value = false;
  }
}

function toggleModule(key: string) {
  modules[key] = !modules[key];
}

async function handleSave() {
  if (!props.tenant) return;
  submitting.value = true;
  try {
    await superAdminApi.updateSubscription(props.tenant.id, {
      modules: { ...modules }
    });
    ElMessage.success('保存成功');
    emit('update:modelValue', false);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load();
  }
);
</script>

<style scoped>
.dialog-desc {
  color: #909399;
  font-size: 13px;
  margin-bottom: 16px;
}
.state {
  text-align: center;
  padding: 40px 0;
  color: #909399;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.module-grid :deep(.el-checkbox) {
  margin-right: 0;
  width: 100%;
}
.module-grid :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.3;
}
</style>
