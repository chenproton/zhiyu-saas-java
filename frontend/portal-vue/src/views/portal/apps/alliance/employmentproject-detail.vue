<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">
              {{ project?.name || '就业项目详情' }}
              <template v-if="project">
                <el-tag size="small" :type="phaseTagType(deriveEmploymentProjectPhase(project))">{{ EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(project)] }}</el-tag>
                <el-tag size="small" :type="project.publishStatus === 'published' ? 'success' : 'info'">{{ project.publishStatus === 'published' ? '已发布' : '草稿' }}</el-tag>
              </template>
            </div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/portal/apps/alliance/employmentproject')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="notFound" description="就业项目不存在" />

      <el-tabs v-else v-model="activeTab">
        <el-tab-pane label="项目信息" name="info">
          <!-- 编辑模式 -->
          <div v-if="editing" class="edit-mode">
            <el-card shadow="never" class="section">
              <div class="section-title">编辑项目</div>
              <el-form :model="editForm" label-width="110px">
                <el-form-item label="项目名称" required>
                  <el-input v-model="editForm.name" />
                </el-form-item>
                <el-form-item label="项目类型" required>
                  <el-select v-model="editForm.type" style="width: 100%">
                    <el-option v-for="v in PROJECT_TYPES" :key="v" :label="EMPLOYMENT_PROJECT_TYPE_LABELS[v]" :value="v" />
                    <el-option label="自定义" value="custom" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="editForm.type === 'custom'" label="自定义类型" required>
                  <el-input v-model="editForm.customType" />
                </el-form-item>
                <el-form-item label="发起单位">
                  <el-input v-model="editForm.organizer" />
                </el-form-item>
                <el-form-item label="开始日期">
                  <el-date-picker v-model="editForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
                </el-form-item>
                <el-form-item label="结束日期">
                  <el-date-picker v-model="editForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
                </el-form-item>
                <el-form-item label="项目封面">
                  <ImageUpload v-model="editForm.coverImage" label="项目封面（展示在服务大厅与联盟首页，建议 16:9 横图）" hint="建议 16:9 横图" />
                </el-form-item>
                <el-form-item label="发布设置">
                  <div class="publish-row">
                    <span>发布到服务大厅</span>
                    <el-switch v-model="editForm.published" />
                  </div>
                </el-form-item>
              </el-form>
            </el-card>

            <el-card shadow="never" class="section">
              <div class="section-title">参与企业</div>
              <el-select v-model="editForm.enterpriseIds" multiple filterable placeholder="选择参与企业" style="width: 100%">
                <el-option v-for="e in enterpriseOptions" :key="e.value" :label="e.label" :value="e.value" />
              </el-select>
            </el-card>

            <el-card shadow="never" class="section">
              <div class="section-header">
                <div class="section-title">面向学生群体</div>
                <el-button size="small" @click="addTargetGroup">添加条件组</el-button>
              </div>
              <p v-if="editForm.targetGroups.length === 0" class="muted">未添加条件组，面向全校</p>
              <div v-for="(g, idx) in editForm.targetGroups" :key="idx" class="target-group">
                <div class="target-field">
                  <div class="field-label">组织节点</div>
                  <el-tree-select
                    v-model="g.orgNodeId"
                    :data="orgTree"
                    node-key="id"
                    check-strictly
                    :render-after-expand="false"
                    :props="{ label: 'name', children: 'children' }"
                    placeholder="不限制"
                    clearable
                    style="width: 100%"
                    @change="(v: any) => onOrgNodeChange(idx, v)"
                  />
                </div>
                <div class="target-field">
                  <div class="field-label">专业</div>
                  <el-select v-model="g.majorId" filterable clearable placeholder="不限制" style="width: 100%" @change="(v: any) => onMajorChange(idx, v)">
                    <el-option v-for="m in majorOptions" :key="m.id" :label="m.name" :value="m.id" />
                  </el-select>
                </div>
                <div class="target-field">
                  <div class="field-label">毕业年份</div>
                  <el-input :model-value="g.graduateYear != null ? String(g.graduateYear) : ''" placeholder="如 2025" @input="(v: any) => onGraduateYear(idx, v)" />
                </div>
                <div class="target-field">
                  <el-button size="small" type="danger" text @click="removeTargetGroup(idx)">删除</el-button>
                </div>
              </div>
            </el-card>

            <el-card shadow="never" class="section">
              <div class="section-title">项目简介</div>
              <el-input v-model="editForm.description" type="textarea" :rows="4" />
            </el-card>

            <div class="edit-actions">
              <el-button @click="editing = false">取消</el-button>
              <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
            </div>
          </div>

          <!-- 只读模式 -->
          <div v-else class="read-mode">
            <div class="read-toolbar">
              <el-button size="small" type="primary" @click="startEdit">编辑</el-button>
            </div>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="项目类型">{{ employmentTypeLabel(project?.type) }}</el-descriptions-item>
              <el-descriptions-item label="发起单位">{{ project?.organizer || '-' }}</el-descriptions-item>
              <el-descriptions-item label="起止日期">{{ formatDate(project?.startDate) }} ~ {{ formatDate(project?.endDate) }}</el-descriptions-item>
              <el-descriptions-item label="展示状态">{{ EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(project!)] }}</el-descriptions-item>
              <el-descriptions-item label="发布状态">{{ project?.publishStatus === 'published' ? '已发布' : '草稿' }}</el-descriptions-item>
              <el-descriptions-item label="参与企业">{{ (project?.enterpriseIds || []).map(entName).join('、') || '-' }}</el-descriptions-item>
              <el-descriptions-item v-if="project?.coverImage" label="项目封面" :span="2">
                <el-image :src="project.coverImage" fit="cover" class="cover-img" />
              </el-descriptions-item>
              <el-descriptions-item label="面向学生群体" :span="2">
                <template v-if="(project?.targetGroups || []).length === 0">面向全校</template>
                <ul v-else class="target-list">
                  <li v-for="(g, i) in project?.targetGroups" :key="i">条件组 {{ i + 1 }}：{{ targetGroupSummary(g) }}</li>
                </ul>
              </el-descriptions-item>
              <el-descriptions-item v-if="project?.description" label="项目简介" :span="2">
                <span class="pre-wrap">{{ project.description }}</span>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`岗位（${project?.jobCount ?? 0}）`" name="jobs">
          <el-table v-loading="jobsLoading" :data="jobs" stripe>
            <el-table-column prop="title" label="岗位名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="企业" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.enterpriseName || '-' }}</template></el-table-column>
            <el-table-column label="类型" width="90"><template #default="{ row }">{{ EMPLOYMENT_JOB_TYPE_LABELS[row.jobType] ?? row.jobType }}</template></el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }"><el-tag :type="jobStatusTagType(row.status)">{{ EMPLOYMENT_JOB_STATUS_LABELS[row.status] ?? row.status }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="applicationCount" label="投递数" width="90" />
          </el-table>
          <el-empty v-if="jobs.length === 0 && !jobsLoading" description="暂无岗位" />
        </el-tab-pane>

        <el-tab-pane :label="`投递（${project?.applicationCount ?? 0}）`" name="applications">
          <el-table v-loading="appsLoading" :data="apps" stripe>
            <el-table-column label="学生" min-width="120"><template #default="{ row }">{{ row.studentName || '-' }}</template></el-table-column>
            <el-table-column label="学号" min-width="120"><template #default="{ row }">{{ row.studentNo || '-' }}</template></el-table-column>
            <el-table-column label="专业" min-width="120" show-overflow-tooltip><template #default="{ row }">{{ row.majorName || '-' }}</template></el-table-column>
            <el-table-column label="班级" min-width="120" show-overflow-tooltip><template #default="{ row }">{{ row.className || '-' }}</template></el-table-column>
            <el-table-column label="岗位" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.jobTitle || '-' }}</template></el-table-column>
            <el-table-column label="企业" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.enterpriseName || '-' }}</template></el-table-column>
            <el-table-column label="投递时间" width="160"><template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="{ row }"><el-button size="small" text type="primary" @click="openApp(row)">查看</el-button></template>
            </el-table-column>
          </el-table>
          <el-empty v-if="apps.length === 0 && !appsLoading" description="暂无投递" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="appDialog" title="投递详情" width="520px">
      <el-descriptions v-if="viewingApp" :column="1" border>
        <el-descriptions-item label="学生">{{ viewingApp.studentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="学号">{{ viewingApp.studentNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="专业">{{ viewingApp.majorName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="班级">{{ viewingApp.className || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ viewingApp.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ viewingApp.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="岗位">{{ viewingApp.jobTitle || '-' }}</el-descriptions-item>
        <el-descriptions-item label="企业">{{ viewingApp.enterpriseName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="项目">{{ viewingApp.projectName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="投递时间">{{ formatDateTime(viewingApp.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="求职信"><span class="pre-wrap">{{ viewingApp.coverLetter || '-' }}</span></el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { organizationApi, majorApi } from '@/api/system';
import type { Organization, Major } from '@/types/system';
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  formatDate,
  formatDateTime,
  fetchAllPages,
  employmentTypeLabel,
  targetGroupSummary,
} from './alliance-admin';
import type {
  EmploymentProject,
  EmploymentTargetGroup,
  EmploymentJob,
  EmploymentApplication,
  ListResponse,
} from './alliance-admin';
import ImageUpload from './components/ImageUpload.vue';

const PROJECT_TYPES = ['spring', 'autumn', 'directed', 'order'];

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const id = route.params.id as string;

const project = ref<EmploymentProject | null>(null);
const loading = ref(true);
const notFound = ref(false);
const activeTab = ref('info');

const editing = ref(false);
const saving = ref(false);
const editForm = reactive({
  name: '',
  type: 'spring',
  customType: '',
  organizer: '',
  enterpriseIds: [] as string[],
  targetGroups: [] as EmploymentTargetGroup[],
  startDate: '',
  endDate: '',
  published: false,
  description: '',
  coverImage: '',
});

const enterpriseOptions = ref<{ label: string; value: string }[]>([]);
const majorOptions = ref<{ id: string; name: string; code?: string }[]>([]);
const orgTree = ref<Organization[]>([]);
const orgMap = ref<Map<string, Organization>>(new Map());

const jobs = ref<EmploymentJob[]>([]);
const jobsLoading = ref(false);
const apps = ref<EmploymentApplication[]>([]);
const appsLoading = ref(false);
const viewingApp = ref<EmploymentApplication | null>(null);
const appDialog = ref(false);

function phaseTagType(phase: string): 'success' | 'warning' | 'info' {
  if (phase === 'ongoing') return 'success';
  if (phase === 'ended') return 'info';
  return 'warning';
}

function jobStatusTagType(s: string): 'success' | 'warning' | 'info' {
  if (s === 'published') return 'success';
  if (s === 'closed') return 'info';
  return 'warning';
}

function entName(eid: string): string {
  return enterpriseOptions.value.find((e) => e.value === eid)?.label || eid;
}

function flattenOrgs(nodes: Organization[], out: Organization[]) {
  for (const n of nodes) {
    out.push(n);
    if (n.children && n.children.length) flattenOrgs(n.children, out);
  }
}

async function loadProject() {
  if (!tenantId.value || !id) return;
  loading.value = true;
  try {
    project.value = await portalRequest<EmploymentProject>(`/alliance/employment-projects/${id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
    if (!project.value) notFound.value = true;
  }
}

async function loadRefs() {
  if (!tenantId.value) return;
  try {
    const [ent, org] = await Promise.all([
      portalRequest<ListResponse<{ id: string; name: string; status?: string }>>('/alliance/enterprises?limit=200'),
      organizationApi.tree({ tenantId: tenantId.value }),
    ]);
    enterpriseOptions.value = (ent.items || [])
      .filter((e) => e.status !== 'terminated')
      .map((e) => ({ label: e.name, value: e.id }));
    orgTree.value = org.items || [];
    const flat: Organization[] = [];
    flattenOrgs(orgTree.value, flat);
    orgMap.value = new Map(flat.map((n) => [n.id, n]));
  } catch {
    // 引用数据加载失败不阻断主流程
  }
  try {
    const items = await fetchAllPages<Major>((page, pageSize) =>
      majorApi.list({ tenantId: tenantId.value, limit: pageSize, offset: page * pageSize }),
    );
    majorOptions.value = items.filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name, code: m.code }));
  } catch {
    // 专业选项加载失败不阻断主流程
  }
}

async function loadJobs() {
  if (!tenantId.value || !id) return;
  jobsLoading.value = true;
  try {
    const res = await portalRequest<ListResponse<EmploymentJob>>(
      `/alliance/employment-jobs${buildQuery({ projectId: id, limit: 200 })}`,
    );
    jobs.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载岗位失败');
  } finally {
    jobsLoading.value = false;
  }
}

async function loadApps() {
  if (!tenantId.value || !id) return;
  appsLoading.value = true;
  try {
    const res = await portalRequest<ListResponse<EmploymentApplication>>(
      `/alliance/employment-applications${buildQuery({ projectId: id, limit: 200 })}`,
    );
    apps.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载投递失败');
  } finally {
    appsLoading.value = false;
  }
}

function startEdit() {
  if (!project.value) return;
  const p = project.value;
  const isCustom = (p.type || '').startsWith('custom:');
  editForm.name = p.name || '';
  editForm.type = isCustom ? 'custom' : p.type || 'spring';
  editForm.customType = isCustom ? p.type.slice('custom:'.length) : '';
  editForm.organizer = p.organizer || '';
  editForm.enterpriseIds = [...(p.enterpriseIds || [])];
  editForm.targetGroups = JSON.parse(JSON.stringify(p.targetGroups || []));
  editForm.startDate = p.startDate || '';
  editForm.endDate = p.endDate || '';
  editForm.published = p.publishStatus === 'published';
  editForm.description = p.description || '';
  editForm.coverImage = p.coverImage || '';
  editing.value = true;
}

function addTargetGroup() {
  editForm.targetGroups.push({});
}
function removeTargetGroup(idx: number) {
  editForm.targetGroups.splice(idx, 1);
}
function onOrgNodeChange(idx: number, v: string | undefined) {
  const g = editForm.targetGroups[idx];
  if (!g) return;
  g.orgNodeId = v || undefined;
  g.orgNodeName = v ? orgMap.value.get(v)?.name : undefined;
}
function onMajorChange(idx: number, v: string | undefined) {
  const g = editForm.targetGroups[idx];
  if (!g) return;
  g.majorId = v || undefined;
  g.majorName = v ? majorOptions.value.find((m) => m.id === v)?.name : undefined;
}
function onGraduateYear(idx: number, v: string) {
  const g = editForm.targetGroups[idx];
  if (!g) return;
  const n = Number(v);
  g.graduateYear = v.trim() === '' || !Number.isFinite(n) ? undefined : n;
}

async function saveEdit() {
  if (!project.value) return;
  if (!editForm.name.trim()) {
    ElMessage.warning('项目名称不能为空');
    return;
  }
  if (editForm.type === 'custom' && !editForm.customType.trim()) {
    ElMessage.warning('请填写自定义项目类型');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: editForm.name.trim(),
      type: editForm.type === 'custom' ? `custom:${editForm.customType.trim()}` : editForm.type,
      organizer: editForm.organizer.trim() || undefined,
      description: editForm.description || undefined,
      coverImage: editForm.coverImage || undefined,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
      publishStatus: editForm.published ? 'published' : 'draft',
      enterpriseIds: editForm.enterpriseIds,
      targetGroups: editForm.targetGroups.filter((g) => g.orgNodeId || g.majorId || g.graduateYear),
    };
    const updated = await portalRequest<EmploymentProject>(`/alliance/employment-projects/${project.value.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    project.value = updated;
    editing.value = false;
    ElMessage.success('已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function openApp(a: EmploymentApplication) {
  viewingApp.value = a;
  appDialog.value = true;
}

onMounted(() => {
  loadProject();
  loadRefs();
  loadJobs();
  loadApps();
});
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.header-left { min-width: 0; }
.card-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.edit-mode { display: flex; flex-direction: column; gap: 16px; }
.section { --el-card-padding: 20px; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-header .section-title { margin-bottom: 0; }
.target-group { display: grid; grid-template-columns: 1fr 1fr 140px auto; gap: 12px; align-items: end; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }
.target-field { min-width: 0; }
.field-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.publish-row { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.muted { font-size: 13px; color: #909399; }
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; }
.read-mode { min-height: 200px; }
.read-toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.cover-img { width: 200px; height: 120px; border-radius: 8px; border: 1px solid #e5e7eb; }
.target-list { margin: 0; padding-left: 16px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
@media (max-width: 992px) {
  .target-group { grid-template-columns: 1fr; }
}
</style>
