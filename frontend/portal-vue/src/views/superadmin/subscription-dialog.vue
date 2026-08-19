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

      <!-- AI 服务配置 + 套餐额度 -->
      <div class="ai-card">
        <div class="ai-head">
          <div class="ai-head-title">AI 服务配置</div>
          <el-tag :type="aiConfig?.configured ? 'success' : 'info'">
            {{ aiConfig?.configured ? '已配置' : '未配置' }}
          </el-tag>
          <el-button size="small" @click="openAiDialog">配置</el-button>
        </div>
        <div class="ai-fields">
          <div><span class="f-label">Base URL</span><span class="f-value">{{ aiConfig?.baseUrl || '-' }}</span></div>
          <div><span class="f-label">模型</span><span class="f-value">{{ aiConfig?.model || '-' }}</span></div>
          <div><span class="f-label">API Key</span><span class="f-value mono">{{ aiConfig?.apiKeyMasked || '-' }}</span></div>
        </div>
        <div class="quota-row">
          <span class="quota-label">AI 套餐额度</span>
          <el-input v-model="quotaRmb" type="number" :min="0" step="0.01" class="quota-input" placeholder="如：100" @input="onQuotaRmbInput">
            <template #prepend>¥</template>
          </el-input>
          <span class="quota-hint">≈ {{ (aiTokenQuota || 0).toLocaleString() }} tokens（2 元 / 1M token）</span>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="loading" @click="handleSave">保存</el-button>
    </template>

    <!-- AI 服务配置弹窗 -->
    <el-dialog v-model="aiDialog" title="AI 服务配置" width="480px" append-to-body>
      <p class="dialog-desc">
        {{ tenant ? `为租户「${tenant.name}」配置 OpenAI 兼容服务，API Key 将加密存储` : '' }}
      </p>
      <el-form label-width="90px">
        <el-form-item label="Base URL" required>
          <el-input v-model="aiForm.baseUrl" placeholder="https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="API Key" :required="!aiConfig?.configured">
          <el-input v-model="aiForm.apiKey" type="password" show-password :placeholder="aiConfig?.configured ? '留空则不修改' : 'sk-...'" />
        </el-form-item>
        <el-form-item label="模型" required>
          <el-input v-model="aiForm.model" placeholder="gpt-4o-mini" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="aiConfig?.configured" type="danger" plain style="float: left" :disabled="aiSubmitting" @click="aiDeleteConfirm = true">清除配置</el-button>
        <el-button @click="aiDialog = false">取消</el-button>
        <el-button type="primary" :loading="aiSubmitting" @click="handleAiSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 清除 AI 配置确认 -->
    <el-dialog v-model="aiDeleteConfirm" title="确认清除" width="420px" append-to-body>
      <p>确定清除该租户的 AI 服务配置吗？清除后租户内所有 AI 功能将不可用。</p>
      <template #footer>
        <el-button @click="aiDeleteConfirm = false">取消</el-button>
        <el-button type="danger" :loading="aiSubmitting" @click="handleAiDelete">清除</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { superAdminApi, PLATFORM_MODULES, AI_TOKEN_PER_RMB } from '@/api/superadmin';
import type { AdminTenant, AIConfigView } from '@/api/superadmin';

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
const aiTokenQuota = ref(0);
const quotaRmb = ref('');

const aiConfig = ref<AIConfigView | null>(null);
const aiDialog = ref(false);
const aiDeleteConfirm = ref(false);
const aiSubmitting = ref(false);
const aiForm = reactive({ baseUrl: '', apiKey: '', model: '' });

function resetModules() {
  for (const key of Object.keys(modules)) delete modules[key];
  for (const m of PLATFORM_MODULES) modules[m.id] = false;
}

async function load() {
  if (!props.tenant) return;
  loading.value = true;
  resetModules();
  aiConfig.value = null;
  try {
    const sub = await superAdminApi.getSubscription(props.tenant.id);
    for (const m of PLATFORM_MODULES) {
      const v = sub.modules?.[m.id];
      modules[m.id] = v === true || v === 'true' || v === 1 ? true : false;
    }
    const quota = sub.aiTokenQuota || 0;
    aiTokenQuota.value = quota;
    quotaRmb.value = quota > 0 ? String(quota / AI_TOKEN_PER_RMB) : '';
  } catch (e) {
    ElMessage.error((e as Error).message || '加载套餐失败');
  } finally {
    loading.value = false;
  }
  try {
    aiConfig.value = await superAdminApi.getAiConfig(props.tenant.id);
  } catch {
    aiConfig.value = null;
  }
}

function toggleModule(key: string) {
  modules[key] = !modules[key];
}

function onQuotaRmbInput(v: string) {
  const n = parseFloat(v);
  aiTokenQuota.value = Number.isFinite(n) && n > 0 ? Math.round(n * AI_TOKEN_PER_RMB) : 0;
}

async function handleSave() {
  if (!props.tenant) return;
  submitting.value = true;
  try {
    await superAdminApi.updateSubscription(props.tenant.id, {
      modules: { ...modules },
      aiTokenQuota: aiTokenQuota.value
    });
    ElMessage.success('保存成功');
    emit('update:modelValue', false);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

function openAiDialog() {
  aiForm.baseUrl = aiConfig.value?.baseUrl || '';
  aiForm.apiKey = '';
  aiForm.model = aiConfig.value?.model || '';
  aiDialog.value = true;
}

async function handleAiSave() {
  if (!props.tenant) return;
  if (!aiForm.baseUrl || !aiForm.model) {
    ElMessage.warning('请填写 Base URL 与模型');
    return;
  }
  aiSubmitting.value = true;
  try {
    await superAdminApi.saveAiConfig(props.tenant.id, {
      baseUrl: aiForm.baseUrl,
      model: aiForm.model,
      ...(aiForm.apiKey ? { apiKey: aiForm.apiKey } : {})
    });
    aiDialog.value = false;
    ElMessage.success('保存成功');
    aiConfig.value = await superAdminApi.getAiConfig(props.tenant.id);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    aiSubmitting.value = false;
  }
}

async function handleAiDelete() {
  if (!props.tenant) return;
  aiSubmitting.value = true;
  try {
    await superAdminApi.deleteAiConfig(props.tenant.id);
    aiDeleteConfirm.value = false;
    aiDialog.value = false;
    ElMessage.success('已清除 AI 配置');
    aiConfig.value = await superAdminApi.getAiConfig(props.tenant.id);
  } catch (e) {
    ElMessage.error((e as Error).message || '清除失败');
  } finally {
    aiSubmitting.value = false;
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
.ai-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}
.ai-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f8f9fb;
  border-bottom: 1px solid #e4e7ed;
}
.ai-head-title {
  font-weight: 600;
  font-size: 14px;
}
.ai-fields {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px 16px;
  font-size: 13px;
}
.f-label {
  display: block;
  color: #909399;
  font-size: 12px;
}
.f-value {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: monospace;
}
.quota-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
}
.quota-label {
  font-size: 13px;
  flex-shrink: 0;
}
.quota-input {
  width: 160px;
}
.quota-hint {
  font-size: 12px;
  color: #909399;
}
</style>
