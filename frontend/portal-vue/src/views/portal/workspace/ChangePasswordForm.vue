<!--
  个人中心-修改密码（学生/教师/学校管理员共用）：无需旧密码，两遍新密码一致即可。
  对齐原 React 版 change-password-form.tsx
  （规则：至少 8 位且同时含字母与数字；POST /portal/workspace/me/password）。
-->
<template>
  <div class="password-form">
    <div class="field-grid">
      <div class="field-row">
        <label class="field-label" for="new-password">新密码</label>
        <el-input
          id="new-password"
          v-model="password"
          type="password"
          show-password
          placeholder="至少 8 位，包含字母和数字"
        />
      </div>
      <div class="field-row">
        <label class="field-label" for="confirm-new-password">确认新密码</label>
        <el-input
          id="confirm-new-password"
          v-model="confirmPassword"
          type="password"
          show-password
          placeholder="再次输入新密码"
        />
      </div>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <div class="form-actions">
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!password || !confirmPassword"
        @click="handleSubmit"
      >
        确认修改
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { portalMeApi } from './workspace-api';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const password = ref('');
const confirmPassword = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

async function handleSubmit() {
  if (!PASSWORD_RULE.test(password.value)) {
    error.value = '密码长度至少 8 位，且需同时包含字母和数字';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致';
    return;
  }
  error.value = null;
  submitting.value = true;
  try {
    await portalMeApi.changePassword(password.value);
    ElMessage.success('密码已更新，下次登录请使用新密码');
    password.value = '';
    confirmPassword.value = '';
  } catch (e) {
    error.value = (e as Error).message || '修改密码失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.password-form {
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
.form-error {
  margin: 0;
  font-size: 12px;
  color: #e11d48;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
