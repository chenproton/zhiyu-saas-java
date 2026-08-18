<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">企业信息</span>
          <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
        </div>
      </template>

      <el-form v-loading="loading" :model="form" label-width="120px" class="basic-form">
        <el-form-item label="企业名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="统一信用代码"><el-input v-model="form.unifiedSocialCreditCode" /></el-form-item>
        <el-form-item label="行业"><el-input v-model="form.industry" /></el-form-item>
        <el-form-item label="地区"><el-input v-model="form.region" /></el-form-item>
        <el-form-item label="成立年份"><el-input-number v-model="form.establishedYear" :min="1900" :max="2100" /></el-form-item>
        <el-form-item label="员工数"><el-input-number v-model="form.employeeCount" :min="0" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactPerson" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contactPhone" /></el-form-item>
        <el-form-item label="联系邮箱"><el-input v-model="form.contactEmail" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="企业简介"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="对外展示">
          <el-switch v-model="form.enablePublic" />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { partnerEnterpriseApi } from '@/api/partner';

const loading = ref(false);
const saving = ref(false);
const form = reactive({
  name: '',
  unifiedSocialCreditCode: '',
  industry: '',
  region: '',
  establishedYear: undefined as number | undefined,
  employeeCount: undefined as number | undefined,
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  description: '',
  enablePublic: false
});

async function load() {
  loading.value = true;
  try {
    const p = await partnerEnterpriseApi.getProfile();
    form.name = p.name || '';
    form.unifiedSocialCreditCode = p.unifiedSocialCreditCode || '';
    form.industry = p.industry || '';
    form.region = p.region || '';
    form.establishedYear = p.establishedYear;
    form.employeeCount = p.employeeCount;
    form.contactPerson = p.contactPerson || '';
    form.contactPhone = p.contactPhone || '';
    form.contactEmail = p.contactEmail || '';
    form.address = p.address || '';
    form.description = p.description || '';
    form.enablePublic = p.enablePublic;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!form.name.trim()) { ElMessage.warning('企业名称不能为空'); return; }
  saving.value = true;
  try {
    await partnerEnterpriseApi.updateProfile({
      name: form.name.trim(),
      unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
      industry: form.industry.trim() || undefined,
      region: form.region.trim() || undefined,
      establishedYear: form.establishedYear,
      employeeCount: form.employeeCount,
      contactPerson: form.contactPerson.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      address: form.address.trim() || undefined,
      description: form.description.trim() || undefined,
      enablePublic: form.enablePublic
    });
    ElMessage.success('保存成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.basic-form { max-width: 640px; }
</style>
