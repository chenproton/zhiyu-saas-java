<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-header-left">
            <el-button link @click="router.push('/portal/apps/alliance/projects')">
              <el-icon><ArrowLeft /></el-icon>
              返回列表
            </el-button>
            <span class="card-title">{{ project?.name || '' }}</span>
            <el-tag v-if="project" size="small" type="info">{{ phaseLabel(project.phase) }}</el-tag>
          </div>
          <el-button v-if="project" type="primary" @click="router.push(`/portal/apps/alliance/projects/${id}/edit`)">编辑</el-button>
        </div>
      </template>

      <el-empty v-if="!project && !loading" description="项目不存在" />

      <template v-else-if="project">
        <el-tabs v-model="activeTab">
          <el-tab-pane name="info" label="基本信息">
            <div class="info-grid">
              <div class="info-card">
                <div class="info-card-title">基础信息</div>
                <div class="info-row"><span class="info-label">项目类型：</span>{{ project.type || '-' }}</div>
                <div class="info-row"><span class="info-label">项目阶段：</span>{{ phaseLabel(project.phase) }}</div>
                <div class="info-row"><span class="info-label">公开显示：</span>{{ project.isPublic ? '是' : '否' }}</div>
              </div>
              <div class="info-card">
                <div class="info-card-title">时间信息</div>
                <div class="info-row"><span class="info-label">开始日期：</span>{{ project.startDate || '-' }}</div>
                <div class="info-row"><span class="info-label">结束日期：</span>{{ project.endDate || '-' }}</div>
                <div class="info-row"><span class="info-label">预算：</span>{{ project.budget || '-' }}</div>
              </div>
              <div v-if="project.description" class="info-card info-card-full">
                <div class="info-card-title">项目描述</div>
                <p class="info-desc">{{ project.description }}</p>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane name="milestones">
            <template #label>里程碑 ({{ milestones.length }})</template>
            <div class="milestone-progress">
              <span class="mp-label">总体进度</span>
              <span class="mp-text">{{ doneCount }}/{{ milestones.length }} 个里程碑已完成</span>
              <div class="mp-bar">
                <el-progress :percentage="milestoneProgress" :stroke-width="10" style="flex: 1" />
                <span class="mp-pct">{{ milestoneProgress }}%</span>
              </div>
            </div>
            <div class="tab-toolbar">
              <el-button size="small" type="primary" @click="openMForm()">
                <el-icon><Plus /></el-icon>
                新增里程碑
              </el-button>
            </div>
            <el-table :data="milestones" stripe>
              <el-table-column label="里程碑名称" min-width="160" show-overflow-tooltip>
                <template #default="{ row }"><span class="m-name">{{ row.name }}</span></template>
              </el-table-column>
              <el-table-column label="描述" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.description || '-' }}</template>
              </el-table-column>
              <el-table-column label="截止日期" width="120">
                <template #default="{ row }">{{ row.dueDate || '-' }}</template>
              </el-table-column>
              <el-table-column label="完成日期" width="120">
                <template #default="{ row }">{{ row.completedDate || '-' }}</template>
              </el-table-column>
              <el-table-column label="完成状态" width="160">
                <template #default="{ row }">
                  <div class="m-status">
                    <el-switch :model-value="row.isCompleted" :disabled="togglingMilestone === row.id" @change="toggleMilestone(row)" />
                    <span :class="row.isCompleted ? 'm-done' : 'm-todo'">{{ row.isCompleted ? '已完成' : '未完成' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="openMForm(row)">编辑</el-button>
                  <el-button link type="danger" size="small" @click="deleteMilestone(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane name="agreements">
            <template #label>项目协议 ({{ linkedAgreements.length }})</template>
            <div class="tab-toolbar">
              <el-button size="small" @click="openLinkAgr">关联已有协议</el-button>
              <el-button size="small" type="primary" @click="router.push(`/portal/apps/alliance/agreements/new?projectId=${id}`)">
                <el-icon><Plus /></el-icon>
                新增协议
              </el-button>
            </div>
            <el-table :data="linkedAgreements" stripe>
              <el-table-column label="协议名称" min-width="200" show-overflow-tooltip>
                <template #default="{ row }">{{ row.name }}</template>
              </el-table-column>
              <el-table-column label="类型" width="140">
                <template #default="{ row }">{{ row.type || '-' }}</template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">{{ agreementStatusLabel(row.status) }}</template>
              </el-table-column>
              <el-table-column label="起止日期" min-width="200">
                <template #default="{ row }">{{ row.startDate || '-' }} ~ {{ row.endDate || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="110">
                <template #default="{ row }">
                  <el-button link type="danger" size="small" @click="unlinkAgr(row.id)">取消关联</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane name="achievements">
            <template #label>关联成果 ({{ linkedAchievements.length }})</template>
            <div class="tab-toolbar">
              <el-button size="small" @click="openLinkAch">关联已有成果</el-button>
              <el-button size="small" type="primary" @click="router.push(`/portal/apps/alliance/achievements/new?projectId=${id}`)">
                <el-icon><Plus /></el-icon>
                新增成果
              </el-button>
            </div>
            <el-table :data="linkedAchievements" stripe>
              <el-table-column label="成果名称" min-width="200" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-link type="primary" @click="router.push(`/portal/apps/alliance/achievements/${row.id}`)">{{ row.title }}</el-link>
                </template>
              </el-table-column>
              <el-table-column label="类型" width="140">
                <template #default="{ row }">{{ achievementTypeLabel(row.type) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">{{ achievementStatusLabel(row.status) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="160">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/achievements/${row.id}/edit`)">编辑</el-button>
                  <el-button link type="danger" size="small" @click="unlinkAch(row.id)">取消关联</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-card>

    <!-- 里程碑编辑弹窗 -->
    <el-dialog v-model="milestoneDialog" :title="editingMilestone ? '编辑里程碑' : '新增里程碑'" width="480px">
      <el-form :model="mForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="mForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="mForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="mForm.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="milestoneDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingM" @click="saveMilestone">保存</el-button>
      </template>
    </el-dialog>

    <!-- 关联已有协议弹窗 -->
    <el-dialog v-model="linkDialog" title="关联已有协议" width="520px">
      <div class="link-list">
        <el-checkbox-group v-model="linkSelected">
          <div v-for="a in linkableAgreements" :key="a.id" class="link-item">
            <el-checkbox :value="a.id" :label="a.id">
              <div>
                <div class="link-name">{{ a.name }}</div>
                <div class="link-sub">{{ a.type || '未分类' }} · {{ agreementStatusLabel(a.status) }}</div>
              </div>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty v-if="linkableAgreements.length === 0" description="暂无可关联的协议" />
      </div>
      <template #footer>
        <el-button @click="linkDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingA" :disabled="linkSelected.length === 0" @click="saveLinkAgr">关联 ({{ linkSelected.length }})</el-button>
      </template>
    </el-dialog>

    <!-- 关联已有成果弹窗 -->
    <el-dialog v-model="achLinkDialog" title="关联已有成果" width="520px">
      <div class="link-list">
        <el-checkbox-group v-model="achLinkSelected">
          <div v-for="a in linkableAchievements" :key="a.id" class="link-item">
            <el-checkbox :value="a.id" :label="a.id">
              <div>
                <div class="link-name">{{ a.title }}</div>
                <div class="link-sub">{{ achievementTypeLabel(a.type) }} · {{ achievementStatusLabel(a.status) }}</div>
              </div>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty v-if="linkableAchievements.length === 0" description="暂无可关联的成果" />
      </div>
      <template #footer>
        <el-button @click="achLinkDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingA" :disabled="achLinkSelected.length === 0" @click="saveLinkAch">关联 ({{ achLinkSelected.length }})</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Plus } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  allianceProjectApi,
  allianceAgreementApi,
  achievementApi,
  milestoneApi,
  syncAgreementProjectLinks,
  allianceLabel,
  formatDate,
  type AllianceProject,
  type AllianceAgreement,
  type AllianceAchievement,
  type AllianceProjectMilestone,
} from './crud-shared';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const id = route.params.id as string;

const project = ref<AllianceProject | null>(null);
const milestones = ref<AllianceProjectMilestone[]>([]);
const allAgreements = ref<AllianceAgreement[]>([]);
const achievements = ref<AllianceAchievement[]>([]);
const loading = ref(true);

const activeTab = ref('info');
const savingM = ref(false);
const savingA = ref(false);
const togglingMilestone = ref<string | null>(null);

const milestoneDialog = ref(false);
const editingMilestone = ref<AllianceProjectMilestone | null>(null);
const mForm = reactive({ name: '', description: '', dueDate: '' });

const linkDialog = ref(false);
const linkSelected = ref<string[]>([]);
const achLinkDialog = ref(false);
const achLinkSelected = ref<string[]>([]);

function phaseLabel(v?: string): string {
  return allianceLabel('projectPhase', v);
}
function agreementStatusLabel(v?: string): string {
  return allianceLabel('agreementStatus', v);
}
function achievementTypeLabel(v?: string): string {
  return allianceLabel('achievementType', v);
}
function achievementStatusLabel(v?: string): string {
  return allianceLabel('achievementStatus', v);
}

const doneCount = computed(() => milestones.value.filter((m) => m.isCompleted).length);
const milestoneProgress = computed(() =>
  milestones.value.length > 0 ? Math.round((doneCount.value / milestones.value.length) * 100) : 0,
);

const linkedAgreements = computed(() =>
  allAgreements.value.filter(
    (a) => (a.projectIds ?? []).includes(id) || (project.value?.agreementIds ?? []).includes(a.id),
  ),
);
const linkableAgreements = computed(() =>
  allAgreements.value.filter(
    (a) => !(a.projectIds ?? []).includes(id) && !(project.value?.agreementIds ?? []).includes(a.id),
  ),
);
const linkedAchievements = computed(() =>
  achievements.value.filter((a) => (a.projectIds ?? []).includes(id)),
);
const linkableAchievements = computed(() =>
  achievements.value.filter((a) => !(a.projectIds ?? []).includes(id)),
);

async function loadData() {
  if (!id) return;
  loading.value = true;
  try {
    const [p, m, agr, ach] = await Promise.all([
      allianceProjectApi.get(id),
      milestoneApi.list(id),
      allianceAgreementApi.list({ limit: 200 }),
      achievementApi.list({ limit: 200 }),
    ]);
    project.value = p;
    milestones.value = m.items || [];
    allAgreements.value = agr.items || [];
    achievements.value = ach.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

// ---- 里程碑 ----
function openMForm(m?: AllianceProjectMilestone) {
  editingMilestone.value = m || null;
  mForm.name = m?.name || '';
  mForm.description = m?.description || '';
  mForm.dueDate = m?.dueDate || '';
  milestoneDialog.value = true;
}

async function saveMilestone() {
  if (!mForm.name.trim()) {
    ElMessage.warning('里程碑名称不能为空');
    return;
  }
  savingM.value = true;
  try {
    if (editingMilestone.value) {
      await milestoneApi.update(id, editingMilestone.value.id, {
        ...editingMilestone.value,
        name: mForm.name.trim(),
        description: mForm.description,
        dueDate: mForm.dueDate || undefined,
      });
      ElMessage.success('里程碑已更新');
    } else {
      await milestoneApi.create(id, {
        name: mForm.name.trim(),
        description: mForm.description,
        dueDate: mForm.dueDate || undefined,
      });
      ElMessage.success('里程碑已创建');
    }
    milestoneDialog.value = false;
    loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    savingM.value = false;
  }
}

async function deleteMilestone(mid: string) {
  try {
    await milestoneApi.delete(id, mid);
    ElMessage.success('已删除');
    loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function toggleMilestone(m: AllianceProjectMilestone) {
  const next = !m.isCompleted;
  const today = formatDate(new Date());
  togglingMilestone.value = m.id;
  try {
    await milestoneApi.update(id, m.id, { isCompleted: next, completedDate: next ? today : '' });
    m.isCompleted = next;
    m.completedDate = next ? today : '';
    ElMessage.success(next ? '已标记完成' : '已标记未完成');
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  } finally {
    togglingMilestone.value = null;
  }
}

// ---- 协议关联 ----
function openLinkAgr() {
  linkSelected.value = [];
  linkDialog.value = true;
}

async function saveLinkAgr() {
  savingA.value = true;
  try {
    for (const aid of linkSelected.value) {
      const agreement = allAgreements.value.find((a) => a.id === aid);
      if (!agreement) continue;
      await syncAgreementProjectLinks(aid, [...new Set([...(agreement.projectIds ?? []), id])]);
    }
    ElMessage.success(`已关联 ${linkSelected.value.length} 份协议`);
    linkDialog.value = false;
    linkSelected.value = [];
    loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '关联失败');
  } finally {
    savingA.value = false;
  }
}

async function unlinkAgr(aid: string) {
  try {
    const agreement = allAgreements.value.find((a) => a.id === aid);
    if (agreement) {
      await syncAgreementProjectLinks(aid, (agreement.projectIds ?? []).filter((x) => x !== id));
    }
    ElMessage.success('已取消关联');
    loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

// ---- 成果关联 ----
function openLinkAch() {
  achLinkSelected.value = [];
  achLinkDialog.value = true;
}

async function saveLinkAch() {
  savingA.value = true;
  try {
    for (const achId of achLinkSelected.value) {
      const achievement = achievements.value.find((a) => a.id === achId);
      if (!achievement) continue;
      await achievementApi.update(achId, {
        ...achievement,
        projectIds: [...new Set([...(achievement.projectIds ?? []), id])],
      });
    }
    ElMessage.success(`已关联 ${achLinkSelected.value.length} 项成果`);
    achLinkDialog.value = false;
    achLinkSelected.value = [];
    loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '关联失败');
  } finally {
    savingA.value = false;
  }
}

async function unlinkAch(achId: string) {
  const achievement = achievements.value.find((a) => a.id === achId);
  if (!achievement) return;
  try {
    await achievementApi.update(achId, {
      ...achievement,
      projectIds: (achievement.projectIds ?? []).filter((x) => x !== id),
    });
    ElMessage.success('已取消关联');
    loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
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
  loadData();
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
.milestone-progress { display: flex; align-items: center; gap: 12px; border: 1px solid #ebeef5; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
.mp-label { font-size: 13px; font-weight: 500; }
.mp-text { font-size: 13px; color: #909399; }
.mp-bar { display: flex; align-items: center; gap: 12px; flex: 1; }
.mp-pct { font-size: 13px; font-weight: 500; width: 40px; text-align: right; }
.tab-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
.m-name { font-weight: 500; }
.m-status { display: flex; align-items: center; gap: 8px; }
.m-done { font-size: 12px; color: #67c23a; }
.m-todo { font-size: 12px; color: #909399; }
.link-list { max-height: 50vh; overflow-y: auto; }
.link-item { padding: 8px 12px; border: 1px solid #ebeef5; border-radius: 6px; margin-bottom: 8px; }
.link-name { font-size: 13px; font-weight: 500; }
.link-sub { font-size: 12px; color: #909399; margin-top: 2px; }
</style>
