<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-header-left">
            <el-button link @click="router.push('/portal/apps/alliance/agreements')">
              <el-icon><ArrowLeft /></el-icon>
              返回列表
            </el-button>
            <span class="card-title">{{ agreement?.name || '' }}</span>
            <el-tag v-if="agreement" size="small" type="info">{{ statusLabel(agreement.status) }}</el-tag>
          </div>
          <el-button v-if="agreement" type="primary" @click="router.push(`/portal/apps/alliance/agreements/${id}/edit`)">编辑</el-button>
        </div>
      </template>

      <el-empty v-if="!agreement && !loading" description="协议不存在" />

      <div v-else-if="agreement" class="info-grid">
        <div class="info-card">
          <div class="info-card-title">协议信息</div>
          <div class="info-row"><span class="info-label">协议类型：</span>{{ agreement.type || '-' }}</div>
          <div class="info-row"><span class="info-label">协议状态：</span>{{ statusLabel(agreement.status) }}</div>
          <div class="info-row"><span class="info-label">生效日期：</span>{{ agreement.startDate || '-' }}</div>
          <div class="info-row"><span class="info-label">到期日期：</span>{{ agreement.endDate || '-' }}</div>
          <div class="info-row"><span class="info-label">创建人：</span>{{ agreement.createdBy || '-' }}</div>
        </div>
        <div class="info-card">
          <div class="info-card-title">关联对象</div>
          <div class="info-row"><span class="info-label">合作企业：</span>{{ enterpriseNames() }}</div>
          <div class="info-row"><span class="info-label">关联项目：</span>{{ projectNames() }}</div>
        </div>
        <div v-if="agreement.content" class="info-card info-card-full">
          <div class="info-card-title">协议概要</div>
          <p class="info-desc">{{ agreement.content }}</p>
        </div>
        <div v-if="agreement.attachments && agreement.attachments.length > 0" class="info-card info-card-full">
          <div class="info-card-title">协议附件</div>
          <div class="attach-grid">
            <a v-for="(a, i) in agreement.attachments" :key="i" :href="attachSrc(a)" target="_blank" rel="noreferrer">
              <el-image :src="attachSrc(a)" fit="cover" class="attach-img" />
            </a>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  allianceAgreementApi,
  listAllEnterprises,
  listAllProjects,
  allianceLabel,
  type AllianceAgreement,
  type AllianceEnterprise,
  type AllianceProject,
} from './crud-shared';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const id = route.params.id as string;

const agreement = ref<AllianceAgreement | null>(null);
const enterprises = ref<AllianceEnterprise[]>([]);
const projects = ref<AllianceProject[]>([]);
const loading = ref(true);

function statusLabel(v?: string): string {
  return allianceLabel('agreementStatus', v);
}

function attachSrc(a: unknown): string {
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') {
    const o = a as { url?: unknown; name?: unknown };
    return String(o.url ?? o.name ?? '');
  }
  return '';
}

function enterpriseNames(): string {
  const ids = (agreement.value?.enterpriseIds || []).map(String);
  if (ids.length === 0) return '-';
  return ids
    .map((eid) => enterprises.value.find((e) => e.id === eid)?.name || eid)
    .join('、');
}

function projectNames(): string {
  const ids = (agreement.value?.projectIds || []).map(String);
  if (ids.length === 0) return '-';
  return ids
    .map((pid) => projects.value.find((p) => p.id === pid)?.name || pid)
    .join('、');
}

async function load() {
  if (!id) return;
  loading.value = true;
  try {
    const [a, ents, projs] = await Promise.all([
      allianceAgreementApi.get(id),
      listAllEnterprises(),
      listAllProjects(),
    ]);
    agreement.value = a;
    enterprises.value = ents;
    projects.value = projs;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      // 忽略
    }
  }
  load();
});
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-header-left { display: flex; align-items: center; gap: 12px; }
.card-title { font-size: 18px; font-weight: 600; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.info-card { border: 1px solid #ebeef5; border-radius: 8px; padding: 16px; }
.info-card-full { grid-column: span 2; }
.info-card-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.info-row { font-size: 13px; color: #303133; margin-bottom: 8px; }
.info-label { color: #909399; }
.info-desc { margin: 0; font-size: 13px; white-space: pre-wrap; }
.attach-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.attach-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; border: 1px solid #ebeef5; }
</style>
