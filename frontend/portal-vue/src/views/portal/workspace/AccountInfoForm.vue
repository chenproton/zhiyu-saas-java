<!--
  个人中心-账号信息（学生/教师/学校管理员共用）：用户ID 与用户名只读，仅姓名可改。
  对齐原 React 版 account-info-form.tsx
  （PUT /portal/workspace/me；姓名空/未变更时保存按钮禁用；保存成功后刷新登录态）。
-->
<template>
  <div class="account-form">
    <div class="field-grid">
      <div class="field-row">
        <label class="field-label">用户ID</label>
        <el-input :model-value="user?.id || '—'" disabled />
      </div>
      <div class="field-row">
        <label class="field-label">用户名（登录账号）</label>
        <el-input :model-value="userName || '—'" disabled />
      </div>
      <div class="field-row">
        <label class="field-label">姓名</label>
        <el-input v-model="name" placeholder="请输入姓名" maxlength="50" />
      </div>
    </div>
    <div class="form-actions">
      <el-button type="primary" :loading="saving" :disabled="unchanged" @click="handleSave">
        保存姓名
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { portalMeApi } from './workspace-api';

const auth = useAuthStore();
const user = computed(() => auth.user);
const userName = computed(() => {
  const u = auth.user;
  const value = u?.username ?? u?.loginName;
  return typeof value === 'string' ? value : '';
});

const name = ref((auth.user?.name as string) || '');
const saving = ref(false);

watch(
  () => auth.user?.name,
  (val) => {
    if (typeof val === 'string' && !saving.value) name.value = val;
  }
);

const unchanged = computed(
  () => !user.value || !name.value.trim() || name.value.trim() === (user.value.name || '')
);

async function handleSave() {
  if (!user.value) return;
  const trimmed = name.value.trim();
  if (!trimmed) {
    ElMessage.error('姓名不能为空');
    return;
  }
  saving.value = true;
  try {
    await portalMeApi.updateName(trimmed);
    name.value = trimmed;
    await auth.fetchMe();
    ElMessage.success('姓名已更新');
  } catch (e) {
    ElMessage.error((e as Error).message || '更新姓名失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.account-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 768px) {
  .field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 13px;
  color: #374151;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
