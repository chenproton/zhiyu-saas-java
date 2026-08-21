<template>
  <div class="settings-page">
    <div class="page-header">
      <h2 class="page-title">账号安全</h2>
      <p class="page-sub">当前登录账号：{{ account }}</p>
    </div>

    <el-card shadow="never" class="form-card">
      <template #header><span class="card-title">修改密码</span></template>
      <el-form label-width="100px">
        <el-form-item label="当前密码" required>
          <el-input v-model="oldPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="newPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认新密码" required>
          <el-input v-model="confirmPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerMeApi } from '@/api/partner';
import { partnerRequest, removeToken } from '@/api/http';

const router = useRouter();
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const saving = ref(false);
const account = ref('');

async function loadAccount() {
  try {
    const me = await partnerRequest<{ user?: { name?: string; username?: string } }>('/auth/partner/me');
    account.value = me.user?.username || me.user?.name || '';
  } catch {
    account.value = '';
  }
}

onMounted(loadAccount);

async function submit() {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    ElMessage.warning('请填写完整');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  saving.value = true;
  try {
    await partnerMeApi.changePassword({ oldPassword: oldPassword.value, newPassword: newPassword.value });
    ElMessage.success('密码已修改，请重新登录');
    removeToken('partner');
    router.replace('/login');
  } catch (e) {
    ElMessage.error((e as Error).message || '修改失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.settings-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.form-card { max-width: 520px; }
.card-title { font-weight: 600; }
</style>
