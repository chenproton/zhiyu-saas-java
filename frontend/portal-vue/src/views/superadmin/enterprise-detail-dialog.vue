<template>
  <el-dialog
    :model-value="modelValue"
    title="企业租户详情"
    width="680px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="loading" class="state">加载中...</div>
    <template v-else>
      <div class="detail-grid">
        <div class="detail-item"><span class="label">租户标识：</span><span class="mono">{{ tenant?.code }}</span></div>
        <div class="detail-item">
          <span class="label">状态：</span>
          <el-tag :type="(tenant?.status || 'inactive') === 'active' ? 'success' : 'info'">
            {{ (tenant?.status || 'inactive') === 'active' ? '启用' : '停用' }}
          </el-tag>
        </div>
        <div class="detail-item"><span class="label">企业名称：</span><span class="strong">{{ profile?.name || tenant?.name }}</span></div>
        <div class="detail-item"><span class="label">统一社会信用代码：</span>{{ profile?.unifiedSocialCreditCode || '-' }}</div>
        <div class="detail-item"><span class="label">联系人：</span>{{ profile?.contactPerson || tenant?.contact || '-' }}</div>
        <div class="detail-item"><span class="label">联系电话：</span>{{ profile?.contactPhone || tenant?.phone || '-' }}</div>
        <div class="detail-item"><span class="label">联系邮箱：</span>{{ profile?.contactEmail || '-' }}</div>
        <div class="detail-item"><span class="label">绑定域名：</span>{{ tenant?.domain || '-' }}</div>
        <div class="detail-item span2"><span class="label">企业地址：</span>{{ tenant?.address || '-' }}</div>
        <div class="detail-item span2">
          <span class="label">前台展示开关：</span>
          <el-switch
            :model-value="profile?.enablePublic || false"
            :loading="savingPublic"
            @change="onTogglePublic"
          />
          <span class="hint">企业愿意在联盟前台对外展示</span>
        </div>
        <div class="detail-item span2"><span class="label">企业简介：</span>{{ profile?.description || tenant?.description || '-' }}</div>
        <div class="detail-item"><span class="label">创建时间：</span>{{ formatDate(tenant?.createdAt) }}</div>
      </div>
    </template>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { superAdminApi } from '@/api/superadmin';
import type { AdminTenant, AdminEnterpriseProfile } from '@/api/superadmin';

const props = defineProps<{
  modelValue: boolean;
  tenant: AdminTenant | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const profile = ref<AdminEnterpriseProfile | null>(null);
const loading = ref(false);
const savingPublic = ref(false);

function formatDate(v?: string): string {
  if (!v) return '-';
  return new Date(v).toLocaleString('zh-CN', { hour12: false });
}

async function load() {
  if (!props.tenant) return;
  loading.value = true;
  try {
    const res = await superAdminApi.getEnterprise(props.tenant.id);
    profile.value = res.enterprise;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载企业信息失败');
    profile.value = null;
  } finally {
    loading.value = false;
  }
}

async function onTogglePublic(v: string | number | boolean) {
  const next = Boolean(v);
  if (!props.tenant || !profile.value) return;
  const prev = profile.value.enablePublic;
  savingPublic.value = true;
  try {
    await superAdminApi.updateEnterprise(props.tenant.id, {
      unifiedSocialCreditCode: profile.value.unifiedSocialCreditCode || null,
      contactPerson: profile.value.contactPerson || null,
      contactPhone: profile.value.contactPhone || null,
      contactEmail: profile.value.contactEmail || null,
      enablePublic: next
    });
    profile.value.enablePublic = next;
    ElMessage.success('企业信息已更新');
  } catch (e) {
    profile.value.enablePublic = prev;
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    savingPublic.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      profile.value = null;
      void load();
    }
  }
);
</script>

<style scoped>
.state {
  text-align: center;
  padding: 40px 0;
  color: #909399;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
  font-size: 14px;
}
.detail-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.detail-item .label {
  color: #909399;
  white-space: nowrap;
}
.detail-item .mono {
  font-family: monospace;
}
.detail-item .strong {
  font-weight: 600;
}
.span2 {
  grid-column: 1 / -1;
}
.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
