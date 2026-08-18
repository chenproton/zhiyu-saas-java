<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">新建就业项目</div>
            <div class="card-sub">维护项目基本信息、参与企业、面向学生群体与发布设置。</div>
          </div>
          <el-button @click="router.push('/portal/apps/alliance/employmentproject')">返回列表</el-button>
        </div>
      </template>

      <div class="edit-layout">
        <div class="edit-main">
          <el-card shadow="never" class="section">
            <div class="section-title">基本信息</div>
            <el-form :model="form" label-width="110px">
              <el-form-item label="项目名称" required>
                <el-input v-model="form.name" placeholder="请输入项目名称" />
              </el-form-item>
              <el-form-item label="项目类型" required>
                <el-select v-model="form.type" style="width: 100%">
                  <el-option v-for="v in PROJECT_TYPES" :key="v" :label="EMPLOYMENT_PROJECT_TYPE_LABELS[v]" :value="v" />
                  <el-option label="自定义" value="custom" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="form.type === 'custom'" label="自定义类型" required>
                <el-input v-model="form.customType" placeholder="如：寒暑假实习专场" />
              </el-form-item>
              <el-form-item label="发起单位">
                <el-input v-model="form.organizer" placeholder="如：招生就业处" />
              </el-form-item>
              <el-form-item label="开始日期">
                <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
              <el-form-item label="结束日期">
                <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
              <el-form-item label="项目封面">
                <ImageUpload v-model="form.coverImage" label="项目封面（展示在服务大厅与联盟首页，建议 16:9 横图）" hint="建议 16:9 横图" />
              </el-form-item>
            </el-form>
          </el-card>

          <el-card shadow="never" class="section">
            <div class="section-header">
              <div>
                <div class="section-title">面向学生群体</div>
                <div class="section-sub">每组内条件同时满足，多组之间任一满足；留空表示不限制</div>
              </div>
              <el-button size="small" @click="addTargetGroup">添加条件组</el-button>
            </div>
            <p v-if="form.targetGroups.length === 0" class="muted">未添加条件组，面向全校</p>
            <div v-for="(g, idx) in form.targetGroups" :key="idx" class="target-group">
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
            <el-input v-model="form.description" type="textarea" :rows="4" placeholder="项目简介" />
          </el-card>
        </div>

        <div class="edit-side">
          <el-card shadow="never" class="section">
            <div class="section-title">参与企业</div>
            <el-select v-model="form.enterpriseIds" multiple filterable placeholder="选择参与企业" style="width: 100%">
              <el-option v-for="e in enterpriseOptions" :key="e.value" :label="e.label" :value="e.value" />
            </el-select>
          </el-card>

          <el-card shadow="never" class="section">
            <div class="section-title">发布设置</div>
            <div class="publish-row">
              <span>发布到服务大厅</span>
              <el-switch v-model="form.published" />
            </div>
            <p class="muted">{{ form.published ? '已发布，学生可在服务大厅查看' : '草稿，暂不对外展示' }}</p>
          </el-card>

          <el-card shadow="never" class="section">
            <el-button type="primary" style="width: 100%" :loading="saving" @click="handleSave">创建</el-button>
            <el-button style="width: 100%; margin-top: 8px" @click="router.push('/portal/apps/alliance/employmentproject')">取消</el-button>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { organizationApi, majorApi } from '@/api/system';
import type { Organization, Major } from '@/types/system';
import { EMPLOYMENT_PROJECT_TYPE_LABELS, fetchAllPages } from './alliance-admin';
import type { EmploymentProject, EmploymentTargetGroup, ListResponse } from './alliance-admin';
import ImageUpload from './components/ImageUpload.vue';

const PROJECT_TYPES = ['spring', 'autumn', 'directed', 'order'];

const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const saving = ref(false);
const form = reactive({
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

function flattenOrgs(nodes: Organization[], out: Organization[]) {
  for (const n of nodes) {
    out.push(n);
    if (n.children && n.children.length) flattenOrgs(n.children, out);
  }
}

async function loadEnterprises() {
  if (!tenantId.value) return;
  try {
    const res = await portalRequest<ListResponse<{ id: string; name: string; status?: string }>>('/alliance/enterprises?limit=200');
    enterpriseOptions.value = (res.items || [])
      .filter((e) => e.status !== 'terminated')
      .map((e) => ({ label: e.name, value: e.id }));
  } catch {
    // 参与企业选项加载失败不阻断表单
  }
}

async function loadMajors() {
  if (!tenantId.value) return;
  try {
    const items = await fetchAllPages<Major>((page, pageSize) =>
      majorApi.list({ tenantId: tenantId.value, limit: pageSize, offset: page * pageSize }),
    );
    majorOptions.value = items.filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name, code: m.code }));
  } catch {
    // 专业选项加载失败不阻断表单
  }
}

async function loadOrgTree() {
  if (!tenantId.value) return;
  try {
    const res = await organizationApi.tree({ tenantId: tenantId.value });
    orgTree.value = res.items || [];
    const flat: Organization[] = [];
    flattenOrgs(orgTree.value, flat);
    orgMap.value = new Map(flat.map((n) => [n.id, n]));
  } catch {
    // 组织树加载失败不阻断表单
  }
}

function addTargetGroup() {
  form.targetGroups.push({});
}

function removeTargetGroup(idx: number) {
  form.targetGroups.splice(idx, 1);
}

function onOrgNodeChange(idx: number, v: string | undefined) {
  const g = form.targetGroups[idx];
  if (!g) return;
  g.orgNodeId = v || undefined;
  g.orgNodeName = v ? orgMap.value.get(v)?.name : undefined;
}

function onMajorChange(idx: number, v: string | undefined) {
  const g = form.targetGroups[idx];
  if (!g) return;
  g.majorId = v || undefined;
  g.majorName = v ? majorOptions.value.find((m) => m.id === v)?.name : undefined;
}

function onGraduateYear(idx: number, v: string) {
  const g = form.targetGroups[idx];
  if (!g) return;
  const n = Number(v);
  g.graduateYear = v.trim() === '' || !Number.isFinite(n) ? undefined : n;
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('项目名称不能为空');
    return;
  }
  if (form.type === 'custom' && !form.customType.trim()) {
    ElMessage.warning('请填写自定义项目类型');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type === 'custom' ? `custom:${form.customType.trim()}` : form.type,
      organizer: form.organizer.trim() || undefined,
      description: form.description || undefined,
      coverImage: form.coverImage || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      publishStatus: form.published ? 'published' : 'draft',
      enterpriseIds: form.enterpriseIds,
      targetGroups: form.targetGroups.filter((g) => g.orgNodeId || g.majorId || g.graduateYear),
    };
    const data = await portalRequest<EmploymentProject>('/alliance/employment-projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    ElMessage.success('项目已创建');
    router.push(`/portal/apps/alliance/employmentproject/${data.id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadEnterprises();
  loadMajors();
  loadOrgTree();
});
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.edit-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; }
.edit-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.edit-side { display: flex; flex-direction: column; gap: 16px; }
.section { --el-card-padding: 20px; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.section-sub { font-size: 12px; color: #909399; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.target-group { display: grid; grid-template-columns: 1fr 1fr 140px auto; gap: 12px; align-items: end; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }
.target-field { min-width: 0; }
.field-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.publish-row { display: flex; align-items: center; justify-content: space-between; }
.muted { font-size: 13px; color: #909399; }
@media (max-width: 992px) {
  .edit-layout { grid-template-columns: 1fr; }
  .target-group { grid-template-columns: 1fr; }
}
</style>
