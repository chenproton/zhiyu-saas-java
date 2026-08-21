<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">{{ expert?.name || '专家详情' }}</div>
            <div v-if="expert" class="card-sub">{{ subtitle }}</div>
          </div>
          <div class="header-actions">
            <el-tag v-if="expert" :type="statusTagType(expert.status)">{{ expertStatusLabel(expert.status) }}</el-tag>
            <el-button v-if="expert" @click="router.push(`/partner/experts/${id}/edit`)">编辑</el-button>
            <el-button @click="router.push('/partner/experts')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="notFound" description="专家不存在" />

      <template v-else>
        <div class="expert-grid">
          <el-card shadow="never">
            <template #header><span class="section-title">基础信息</span></template>
            <div class="info-list">
              <div class="info-row"><span class="info-label">性别：</span>{{ genderText(expert?.gender) }}</div>
              <div class="info-row"><span class="info-label">年龄：</span>{{ expert?.age ? `${expert.age}岁` : '-' }}</div>
              <div class="info-row"><span class="info-label">所在城市：</span>{{ expert?.city || '-' }}</div>
              <div class="info-row">
                <span class="info-label">从业年限：</span>{{ expert?.experienceYears ? `${expert.experienceYears}年` : '-' }}
              </div>
              <div class="info-row"><span class="info-label">教育背景：</span>{{ expert?.education || '-' }}</div>
              <div class="info-row"><span class="info-label">行业方向：</span>{{ expert?.industry || '-' }}</div>
            </div>
          </el-card>

          <el-card v-if="expert?.avatarUrl" shadow="never">
            <template #header><span class="section-title">头像</span></template>
            <img :src="expert.avatarUrl" :alt="expert.name" class="avatar-img" />
          </el-card>

          <el-card v-if="(expert?.specialties?.length ?? 0) > 0" shadow="never">
            <template #header><span class="section-title">擅长领域</span></template>
            <div class="specialty-list">
              <el-tag v-for="s in expert?.specialties" :key="s" type="info" effect="plain">{{ s }}</el-tag>
            </div>
          </el-card>

          <el-card v-if="expert?.introduction" shadow="never">
            <template #header><span class="section-title">专家简介</span></template>
            <p class="pre-wrap">{{ expert?.introduction }}</p>
          </el-card>

          <el-card v-if="expert?.workExperience" shadow="never">
            <template #header><span class="section-title">从业经历</span></template>
            <p class="pre-wrap">{{ expert?.workExperience }}</p>
          </el-card>

          <el-card v-if="(expert?.attachments?.length ?? 0) > 0" shadow="never" class="full-width">
            <template #header><span class="section-title">资质荣誉</span></template>
            <div class="attachment-grid">
              <a
                v-for="(a, i) in expert?.attachments"
                :key="i"
                :href="a"
                target="_blank"
                rel="noreferrer"
                class="attachment-item"
              >
                <img :src="a" :alt="`资质荣誉 ${i + 1}`" class="attachment-img" />
              </a>
            </div>
          </el-card>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerExpertApi } from '@/api/partner';
import type { PartnerExpert } from '@/types/partner';

interface ExpertDetail extends PartnerExpert {
  status: string;
  isPublic: boolean;
}

const EXPERT_STATUS_LABELS: Record<string, string> = {
  active: '正常',
  inactive: '已停用'
};

function expertStatusLabel(s: string): string {
  return EXPERT_STATUS_LABELS[s] || s;
}
function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  return s === 'inactive' ? 'info' : 'success';
}
function genderText(g?: string): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '-';
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const expert = ref<ExpertDetail | null>(null);
const loading = ref(false);

const subtitle = computed(() =>
  [expert.value?.title, expert.value?.position].filter(Boolean).join(' · ')
);
const notFound = computed(() => !loading.value && !expert.value);

async function loadExpert() {
  loading.value = true;
  try {
    expert.value = (await partnerExpertApi.get(id)) as ExpertDetail;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadExpert);
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.header-left { min-width: 0; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.expert-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.full-width { grid-column: 1 / -1; }
.section-title { font-size: 14px; font-weight: 600; }
.info-list { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.info-row { color: #303133; }
.info-label { color: #909399; }
.avatar-img { width: 96px; height: 128px; object-fit: cover; border-radius: 8px; }
.specialty-list { display: flex; flex-wrap: wrap; gap: 8px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; margin: 0; font-size: 14px; }
.attachment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.attachment-item { display: block; }
.attachment-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: opacity 0.2s;
}
.attachment-img:hover { opacity: 0.8; }
@media (max-width: 768px) {
  .expert-grid { grid-template-columns: 1fr; }
  .attachment-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
