<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">
              {{ expert?.name || '专家详情' }}
              <span v-if="expert" class="card-sub-inline">{{ [expert.title, expert.position].filter(Boolean).join(' · ') }}</span>
              <el-tag v-if="expert" size="small" class="status-tag">{{ allianceLabel('expertStatus', expert.status) }}</el-tag>
            </div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/portal/apps/alliance/experts')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="notFound" description="专家不存在" />

      <div v-else-if="expert" class="detail-body">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="性别">{{ genderText(expert.gender) }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ expert.age ? `${expert.age}岁` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="所在城市">{{ expert.city || '-' }}</el-descriptions-item>
          <el-descriptions-item label="从业年限">{{ expert.experienceYears ? `${expert.experienceYears}年` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="教育背景">{{ expert.education || '-' }}</el-descriptions-item>
          <el-descriptions-item label="行业方向">{{ expert.industry || '-' }}</el-descriptions-item>
          <el-descriptions-item label="前台展示">{{ expert.isPublic ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ expert.createdBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ partnerSourceText(expert.partnerSource) }}</el-descriptions-item>
          <el-descriptions-item label="所属机构">{{ expert.organization || enterprise?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="关联企业">
            <el-link v-if="enterprise" type="primary" :underline="false" @click="router.push(`/portal/apps/alliance/enterprises/${enterprise.id}`)">
              {{ enterprise.name }}
            </el-link>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="关联二级学院">{{ (expert.secondaryColleges || []).join('、') || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="expert.avatarUrl" class="block">
          <div class="block-title">头像</div>
          <el-image :src="expert.avatarUrl" fit="cover" class="avatar" />
        </div>

        <div v-if="(expert.specialties || []).length" class="block">
          <div class="block-title">擅长领域</div>
          <div class="tag-list">
            <el-tag v-for="s in expert.specialties" :key="s" type="info">{{ s }}</el-tag>
          </div>
        </div>

        <div v-if="expert.introduction" class="block">
          <div class="block-title">专家简介</div>
          <p class="pre-wrap">{{ expert.introduction }}</p>
        </div>

        <div v-if="expert.workExperience" class="block">
          <div class="block-title">从业经历</div>
          <p class="pre-wrap">{{ expert.workExperience }}</p>
        </div>

        <div v-if="(expert.attachments || []).length" class="block">
          <div class="block-title">资质荣誉</div>
          <div class="attach-grid">
            <a v-for="(a, i) in expert.attachments" :key="i" :href="a" target="_blank" rel="noreferrer">
              <el-image :src="a" fit="cover" class="attach-img" />
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
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { allianceLabel } from './alliance-admin';
import type { AllianceExpert, AllianceEnterprise, ListResponse } from './alliance-admin';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const id = route.params.id as string;

const expert = ref<AllianceExpert | null>(null);
const enterprise = ref<AllianceEnterprise | null>(null);
const loading = ref(true);
const notFound = ref(false);

function genderText(g?: string): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '-';
}

function partnerSourceText(s?: string): string {
  if (s === 'cooperation') return '合作企业';
  if (s === 'third-party') return '第三方机构';
  return '-';
}

async function loadData() {
  if (!tenantId.value || !id) return;
  loading.value = true;
  try {
    const [e, ents] = await Promise.all([
      portalRequest<AllianceExpert>(`/alliance/experts/${id}`),
      portalRequest<ListResponse<AllianceEnterprise>>('/alliance/enterprises?limit=200'),
    ]);
    expert.value = e;
    enterprise.value = (ents.items || []).find((x) => x.id === e.enterpriseId) || null;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
    if (!expert.value) notFound.value = true;
  }
}

onMounted(loadData);
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.header-left { min-width: 0; }
.card-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.card-sub-inline { font-size: 12px; color: #909399; font-weight: 400; }
.status-tag { margin-left: 4px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.detail-body { display: flex; flex-direction: column; gap: 16px; }
.block { margin-top: 4px; }
.block-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.avatar { width: 96px; height: 128px; border-radius: 8px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; font-size: 13px; }
.attach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.attach-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; border: 1px solid #f1f5f9; }
</style>
