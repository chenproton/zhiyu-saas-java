<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ isNew ? '新建方案' : '编辑方案' }}</span>
          <div>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
          </div>
        </div>
      </template>

      <el-form v-loading="loading" :model="form" label-width="90px" class="basic-form">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="方案名称" /></el-form-item>
        <el-form-item label="入学年份"><el-input-number v-model="form.entryYear" :min="2000" :max="2100" /></el-form-item>
        <el-form-item label="层次"><el-input v-model="form.level" placeholder="如 本科/专科" /></el-form-item>
        <el-form-item label="学制(年)"><el-input-number v-model="form.duration" :min="1" :max="8" /></el-form-item>
        <el-form-item label="总学分"><el-input-number v-model="form.totalCredits" :min="0" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="3" placeholder="方案简介" /></el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { programApi } from '@/api/affairs';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const loading = ref(false);
const saving = ref(false);
const form = reactive({
  name: '',
  entryYear: new Date().getFullYear(),
  level: '',
  duration: 3,
  totalCredits: 0,
  description: ''
});

async function load() {
  if (isNew) return;
  loading.value = true;
  try {
    const p = await programApi.get(id);
    form.name = p.name;
    form.entryYear = p.entryYear;
    form.level = p.level || '';
    form.duration = p.duration ?? 3;
    form.totalCredits = p.totalCredits ?? 0;
    form.description = p.description || '';
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      entryYear: form.entryYear,
      level: form.level.trim() || undefined,
      duration: form.duration,
      totalCredits: form.totalCredits,
      description: form.description.trim() || undefined
    };
    if (isNew) {
      await programApi.create(payload);
      ElMessage.success('创建成功');
    } else {
      await programApi.update(id, payload);
      ElMessage.success('保存成功');
    }
    router.push('/affairs/programs');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function onBack() {
  router.push('/affairs/programs');
}

onMounted(load);
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.basic-form { max-width: 640px; }
</style>
