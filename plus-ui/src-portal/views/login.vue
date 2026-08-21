<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div class="login-title">知与 SaaS 业务门户</div>
      </template>
      <el-form :model="form" @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="账号" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <div class="captcha-row">
            <el-input v-model="form.captchaCode" placeholder="验证码" size="large" @keyup.enter="onSubmit" />
            <img v-if="captcha.image" :src="captcha.image" class="captcha-img" title="点击刷新验证码" alt="验证码" @click="loadCaptcha" />
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onSubmit">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 多租户账号：选择租户 -->
    <el-dialog v-model="tenantDialog" title="选择租户" width="420px" :close-on-click-modal="false">
      <p class="tenant-tip">该账号属于多个租户，请选择要进入的租户：</p>
      <div class="tenant-list">
        <div v-for="t in tenants" :key="t.tenantId" class="tenant-item" @click="onSelectTenant(t)">
          {{ t.tenantName }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import type { TenantOption } from '@/api/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ username: '', password: '', captchaCode: '' });
const captcha = ref({ captchaId: '', image: '' });

const tenantDialog = ref(false);
const tenants = ref<TenantOption[]>([]);
let preAuthToken = '';

async function loadCaptcha() {
  try {
    const data = await authApi.captcha();
    captcha.value = { captchaId: data.captchaId, image: data.image };
  } catch (e) {
    captcha.value = { captchaId: '', image: '' };
    ElMessage.error((e as Error).message || '验证码加载失败');
  }
}

async function onSubmit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  if (!form.captchaCode.trim()) {
    ElMessage.warning('请输入验证码');
    return;
  }
  loading.value = true;
  try {
    const res = await auth.login({
      username: form.username,
      password: form.password,
      captchaId: captcha.value.captchaId,
      captchaCode: form.captchaCode.trim()
    });
    if (res.needsTenantSelection) {
      preAuthToken = res.preAuthToken || '';
      tenants.value = res.tenants || [];
      tenantDialog.value = true;
    } else {
      ElMessage.success('登录成功');
      router.replace('/');
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '登录失败');
    form.captchaCode = '';
    loadCaptcha();
  } finally {
    loading.value = false;
  }
}

async function onSelectTenant(t: TenantOption) {
  try {
    await auth.selectTenant(preAuthToken, t.tenantId);
    ElMessage.success('登录成功');
    tenantDialog.value = false;
    router.replace('/');
  } catch (e) {
    ElMessage.error((e as Error).message || '选择租户失败');
  }
}

onMounted(loadCaptcha);
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.login-card {
  width: 360px;
}
.login-title {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
.captcha-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.captcha-img {
  height: 40px;
  width: 120px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  flex-shrink: 0;
}
.tenant-tip {
  color: #606266;
  margin: 0 0 12px;
}
.tenant-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tenant-item {
  padding: 10px 14px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
}
.tenant-item:hover {
  border-color: #409eff;
  color: #409eff;
}
</style>
