<template>
  <div class="list-page">
    <div class="page-header">
      <h2 class="page-title">合作内容</h2>
      <p class="page-sub">按学校查看与本企业的合作项目、合作成果与合作协议；内容由合作学校维护，企业只读，点击名称可查看详情。</p>
    </div>

    <el-empty v-if="!loading && schools.length === 0" description="暂无合作内容；合作学校发布项目、成果或协议后将在此展示。" />

    <el-card v-for="school in schools" :key="school.tenantId" shadow="never" class="school-card">
      <template #header><span class="school-name">{{ school.schoolName }}</span></template>
      <template v-if="schoolRows(school).length === 0">
        <p class="empty-hint">暂无</p>
      </template>
      <el-table v-else :data="schoolRows(school)" stripe>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="kindType(row.kind)" size="small">{{ kindLabel(row.kind) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ row.name }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="阶段 / 状态" prop="label" width="140" />
        <el-table-column label="更新时间" width="120">
          <template #default="{ row }">{{ fmt(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailDialog" :title="detail?.name || ''" width="640px">
      <div v-loading="detailLoading" class="detail-body">
        <el-alert v-if="detailError" :title="detailError" type="error" show-icon />
        <template v-else-if="detailData">
          <template v-if="detail?.kind === 'project'">
            <div class="detail-grid">
              <div><div class="l">合作类型</div><div class="v">{{ (detailData as any).type || '-' }}</div></div>
              <div><div class="l">当前阶段</div><div class="v">{{ phaseLabel((detailData as any).phase) }}</div></div>
              <div><div class="l">发布状态</div><div class="v">{{ publishStatusLabel((detailData as any).publishStatus) }}</div></div>
              <div><div class="l">预算</div><div class="v">{{ (detailData as any).budget || '-' }}</div></div>
              <div><div class="l">开始日期</div><div class="v">{{ fmt((detailData as any).startDate) }}</div></div>
              <div><div class="l">结束日期</div><div class="v">{{ fmt((detailData as any).endDate) }}</div></div>
              <div class="full">
                <div class="l">关联二级学院</div>
                <div class="v">{{ joinList((detailData as any).secondaryColleges) }}</div>
              </div>
              <div class="full"><div class="l">项目简介</div><div class="v">{{ (detailData as any).description || '-' }}</div></div>
            </div>
            <div v-if="(detailData as any).milestones?.length" class="milestones">
              <div class="l">项目里程碑</div>
              <div v-for="m in (detailData as any).milestones" :key="m.id" class="milestone">
                <div class="m-name">
                  {{ m.name }}
                  <el-tag :type="m.isCompleted ? 'success' : 'info'" size="small">{{ m.isCompleted ? '已完成' : '未完成' }}</el-tag>
                </div>
                <div v-if="m.description" class="m-desc">{{ m.description }}</div>
                <div v-if="m.dueDate || m.completedDate" class="m-dates">
                  <template v-if="m.dueDate">计划：{{ fmt(m.dueDate) }}</template>
                  <template v-if="m.dueDate && m.completedDate"> ｜ </template>
                  <template v-if="m.completedDate">完成：{{ fmt(m.completedDate) }}</template>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="detail?.kind === 'achievement'">
            <div class="detail-grid">
              <div><div class="l">成果类型</div><div class="v">{{ achievementTypeLabel((detailData as any).type) }}</div></div>
              <div><div class="l">成果状态</div><div class="v">{{ achievementStatusLabel((detailData as any).status) }}</div></div>
              <div><div class="l">发布日期</div><div class="v">{{ fmt((detailData as any).achievementDate) }}</div></div>
              <div><div class="l">浏览次数</div><div class="v">{{ (detailData as any).viewCount }}</div></div>
              <div class="full">
                <div class="l">关联二级学院</div>
                <div class="v">{{ joinList((detailData as any).secondaryColleges) }}</div>
              </div>
              <div class="full"><div class="l">成果简介</div><div class="v">{{ (detailData as any).description || '-' }}</div></div>
              <div class="full"><div class="l">引用原因 / 核心亮点</div><div class="v">{{ (detailData as any).citationReason || '-' }}</div></div>
              <div><div class="l">成果归属人</div><div class="v">{{ joinList((detailData as any).ownerPersons) }}</div></div>
              <div><div class="l">成果共建人</div><div class="v">{{ joinList((detailData as any).coBuilders) }}</div></div>
            </div>
          </template>
          <template v-else>
            <div class="detail-grid">
              <div><div class="l">协议类型</div><div class="v">{{ (detailData as any).type || '-' }}</div></div>
              <div><div class="l">协议状态</div><div class="v">{{ agreementStatusLabel((detailData as any).status) }}</div></div>
              <div><div class="l">开始日期</div><div class="v">{{ fmt((detailData as any).startDate) }}</div></div>
              <div><div class="l">结束日期</div><div class="v">{{ fmt((detailData as any).endDate) }}</div></div>
              <div class="full"><div class="l">协议正文</div><div class="v">{{ (detailData as any).content || '-' }}</div></div>
            </div>
          </template>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { partnerCooperationApi } from '@/api/partner';
import type { PartnerCooperationSchool } from '@/types/partner';

type RowKind = 'project' | 'achievement' | 'agreement';
interface Row { kind: RowKind; id: string; name: string; label: string; updatedAt: string }

const PROJECT_PHASE_LABELS: Record<string, string> = {
  initiation: '启动',
  execution: '执行中',
  acceptance: '验收',
  closure: '关闭',
  archived: '已归档',
  terminated: '已终止'
};
const PUBLISH_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档'
};
const ACHIEVEMENT_TYPE_LABELS: Record<string, string> = {
  job: '岗位成果',
  scene: '场景成果',
  course: '课程成果',
  custom: '自定义成果'
};
const ACHIEVEMENT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档'
};
const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  active: '生效中',
  expired: '已失效',
  renewed: '已续签',
  terminated: '已终止'
};

const schools = ref<PartnerCooperationSchool[]>([]);
const loading = ref(true);
const detail = ref<Row | null>(null);
const detailData = ref<any>(null);
const detailLoading = ref(false);
const detailError = ref('');
const detailDialog = ref(false);

const KIND_LABELS: Record<RowKind, string> = { project: '合作项目', achievement: '合作成果', agreement: '合作协议' };

function kindLabel(k: RowKind) { return KIND_LABELS[k]; }
function kindType(k: RowKind) { return k === 'project' ? 'primary' : k === 'achievement' ? 'success' : 'warning'; }
function fmt(d?: string) { return d ? String(d).slice(0, 10) : '-'; }
function joinList(list?: string[]) { return (list ?? []).join('、') || '-'; }
function phaseLabel(s?: string) { return (s && PROJECT_PHASE_LABELS[s]) || s || '-'; }
function publishStatusLabel(s?: string) { return (s && PUBLISH_STATUS_LABELS[s]) || s || '-'; }
function achievementTypeLabel(s?: string) { return (s && ACHIEVEMENT_TYPE_LABELS[s]) || s || '-'; }
function achievementStatusLabel(s?: string) { return (s && ACHIEVEMENT_STATUS_LABELS[s]) || s || '-'; }
function agreementStatusLabel(s?: string) { return (s && AGREEMENT_STATUS_LABELS[s]) || s || '-'; }

function schoolRows(school: PartnerCooperationSchool): Row[] {
  const items: Row[] = [];
  for (const p of school.projects || []) items.push({ kind: 'project', id: p.id, name: p.name, label: phaseLabel(p.phase), updatedAt: p.updatedAt });
  for (const a of school.achievements || []) items.push({ kind: 'achievement', id: a.id, name: a.title, label: achievementTypeLabel(a.type), updatedAt: a.updatedAt });
  for (const g of school.agreements || []) items.push({ kind: 'agreement', id: g.id, name: g.name, label: agreementStatusLabel(g.status), updatedAt: g.updatedAt });
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

async function load() {
  loading.value = true;
  try {
    const res = await partnerCooperationApi.overview();
    schools.value = res.schools || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: Row) {
  detail.value = row;
  detailData.value = null;
  detailError.value = '';
  detailLoading.value = true;
  detailDialog.value = true;
  try {
    detailData.value =
      row.kind === 'project'
        ? await partnerCooperationApi.project(row.id)
        : row.kind === 'achievement'
          ? await partnerCooperationApi.achievement(row.id)
          : await partnerCooperationApi.agreement(row.id);
  } catch (e) {
    detailError.value = (e as Error).message || '加载失败';
  } finally {
    detailLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.school-card { margin-bottom: 16px; }
.school-name { font-weight: 600; }
.empty-hint { text-align: center; color: #909399; padding: 16px; }
.detail-body { min-height: 120px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.detail-grid .full { grid-column: span 2; }
.l { color: #909399; font-size: 12px; }
.v { color: #303133; margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
.milestones { margin-top: 16px; }
.milestone { border: 1px solid #f0f2f5; border-radius: 8px; padding: 10px; margin-top: 8px; }
.m-name { font-weight: 500; }
.m-desc { color: #909399; font-size: 12px; margin-top: 4px; }
.m-dates { color: #909399; font-size: 12px; margin-top: 4px; }
</style>
