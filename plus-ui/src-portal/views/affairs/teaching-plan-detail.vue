<template>
  <div class="detail-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ plan?.programName || '教学计划详情' }}</div>
            <div v-if="plan" class="card-sub">
              {{ plan.termName || '-' }} · {{ plan.majorName || '-' }} · {{ plan.entryYear }}级 ·
              生成于 {{ formatDateTime(plan.generatedAt) }}
            </div>
            <div v-else class="card-sub">教学计划条目与授课安排</div>
          </div>
          <div class="header-actions">
            <el-tag v-if="plan" :type="statusTagType(plan.status)">{{ contentStatusLabel(plan.status) }}</el-tag>
            <template v-if="plan && ['draft', 'rejected'].includes(plan.status) && !isEditing">
              <el-button @click="startEdit">编辑</el-button>
              <el-button type="primary" @click="handleSubmitApproval">提交审批</el-button>
            </template>
            <el-button v-if="plan?.status === 'pending' && !isEditing" @click="handleWithdrawApproval">撤回审批</el-button>
            <el-button v-if="plan?.status === 'approved' && !isEditing" type="primary" @click="handlePublish">发布</el-button>
            <template v-if="isEditing">
              <el-button :disabled="saving" @click="cancelEdit">取消</el-button>
              <el-button type="primary" :loading="saving" @click="handleSaveAll">保存</el-button>
            </template>
            <el-button @click="router.push('/affairs/teaching-plans')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="flatRows" stripe :span-method="spanMethod" row-key="__key">
        <el-table-column label="课程" min-width="180">
          <template #default="{ row }">
            <template v-if="row.__group">
              <span class="group-label">第 {{ row.startWeek }} 周起（{{ row.count }} 门）</span>
            </template>
            <template v-else>
              <div class="course-name">{{ row.courseName }}</div>
              <div v-if="row.courseCode" class="course-code">{{ row.courseCode }}</div>
              <div v-if="row.type === 'scene' && row.positionName" class="scene-position">{{ row.positionName }}</div>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="70">
          <template #default="{ row }">
            <span v-if="!row.__group" :class="['entry-badge', `entry-badge-${row.type}`]">{{ entryTypeLabel(row.type) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="学分" width="90">
          <template #default="{ row }">
            <el-input
              v-if="isEditing && editMap[row.id]"
              v-model="editMap[row.id].credits"
              class="cell-input"
              type="number"
              min="0"
              step="0.5"
            />
            <span v-else-if="!row.__group">{{ row.credits }}</span>
          </template>
        </el-table-column>
        <el-table-column label="总学时" width="90">
          <template #default="{ row }">
            <el-input
              v-if="isEditing && editMap[row.id]"
              v-model="editMap[row.id].totalHours"
              class="cell-input"
              type="number"
              min="0"
            />
            <span v-else-if="!row.__group">{{ row.totalHours }}</span>
          </template>
        </el-table-column>
        <el-table-column label="起止周" width="130">
          <template #default="{ row }">
            <div v-if="isEditing && editMap[row.id]" class="week-editor">
              <el-input v-model="editMap[row.id].startWeek" class="cell-input" type="number" min="1" />
              <span class="week-sep">-</span>
              <el-input v-model="editMap[row.id].endWeek" class="cell-input" type="number" min="1" />
            </div>
            <span v-else-if="!row.__group">{{ row.startWeek }}-{{ row.endWeek }}周</span>
          </template>
        </el-table-column>
        <el-table-column label="班级" min-width="150">
          <template #default="{ row }">
            <el-select
              v-if="isEditing && editMap[row.id]"
              v-model="editMap[row.id].classNodeIds"
              multiple
              filterable
              placeholder="选择授课班级"
              class="cell-select"
            >
              <el-option v-for="c in classOptions" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
            <span v-else-if="!row.__group">{{ classNamesText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="教师" min-width="130">
          <template #default="{ row }">
            <el-select
              v-if="isEditing && editMap[row.id]"
              v-model="editMap[row.id].teacherId"
              filterable
              clearable
              :placeholder="row.teacherName || '选择教师'"
              class="cell-select"
            >
              <el-option v-for="u in teacherOptions" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
            <span v-else-if="!row.__group">{{ row.teacherName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="场地类型" width="110">
          <template #default="{ row }">
            <el-select
              v-if="isEditing && editMap[row.id]"
              v-model="editMap[row.id].venueType"
              clearable
              placeholder="选择"
              class="cell-select"
            >
              <el-option v-for="v in VENUE_TYPES" :key="v" :label="v" :value="v" />
            </el-select>
            <span v-else-if="!row.__group">{{ row.venueType || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span v-if="!row.__group">{{ contentStatusLabel(row.status) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="bottom-bar">
      <el-button type="primary" @click="router.push(`/affairs/scheduling?planId=${id}`)">前往排课</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { teachingPlanApi, affairsBatchApi } from '@/api/affairs';
import { approvalApi } from '@/api/approval';
import { organizationApi, orgTypeApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import type { TeachingPlanDetail, TeachingPlanEntry } from '@/types/affairs';
import type { Organization } from '@/types/system';
import { contentStatusLabel } from '@/types/content-status';

const VENUE_TYPES = ['教室', '机房', '实训室', '实验室', '校外基地'];

const ENTRY_TYPE_LABELS: Record<string, string> = {
  theory: '课程',
  practice: '实践',
  traditional: '课程',
  scene: '场景'
};

interface EditState {
  startWeek: string;
  endWeek: string;
  credits: string;
  totalHours: string;
  venueType: string;
  classNodeIds: string[];
  teacherId?: string;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const plan = ref<TeachingPlanDetail | null>(null);
const entries = ref<TeachingPlanEntry[]>([]);
const loading = ref(false);
const isEditing = ref(false);
const saving = ref(false);
const editMap = reactive<Record<string, EditState>>({});

const classOptions = ref<Organization[]>([]);
const teacherOptions = ref<{ id: string; name: string }[]>([]);

function formatDateTime(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published' || s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'info';
}

function entryTypeLabel(t: string): string {
  return ENTRY_TYPE_LABELS[t] || t;
}

function classNamesText(e: TeachingPlanEntry): string {
  if (e.classNames && e.classNames.length > 0) {
    const shown = e.classNames.slice(0, 2).join('、');
    return e.classNames.length > 2 ? `${shown} 等${e.classNames.length}个` : shown;
  }
  return e.className || '-';
}

// 按 startWeek 分组，拍平为表格行（分组行 + 条目行）
const flatRows = computed(() => {
  const map = new Map<number, TeachingPlanEntry[]>();
  for (const e of entries.value) {
    const list = map.get(e.startWeek) || [];
    list.push(e);
    map.set(e.startWeek, list);
  }
  const groups = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  const rows: (TeachingPlanEntry & { __group?: boolean; __key: string; startWeek: number; count?: number })[] = [];
  for (const [startWeek, groupEntries] of groups) {
    rows.push({ __group: true, __key: `group-${startWeek}`, startWeek, count: groupEntries.length } as never);
    for (const e of groupEntries) rows.push({ ...e, __key: e.id });
  }
  return rows;
});

function spanMethod({ row, columnIndex }: { row: any; columnIndex: number }) {
  if (row.__group) {
    return columnIndex === 0 ? { rowspan: 1, colspan: 9 } : { rowspan: 0, colspan: 0 };
  }
  return { rowspan: 1, colspan: 1 };
}

async function loadPlan() {
  loading.value = true;
  try {
    const detail = await teachingPlanApi.get(id);
    plan.value = detail;
    entries.value = detail.entries;
  } catch (e) {
    ElMessage.error((e as Error).message || '查询教学计划失败');
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  try {
    const [orgTypes, treeRes, usersRes] = await Promise.all([
      orgTypeApi.list({ limit: 200 }),
      organizationApi.tree(),
      userManagementApi.list({ limit: 200 })
    ]);
    const classTypeId = orgTypes.items.find((t) => t.name === '班级')?.id;
    const walk = (nodes: Organization[]): Organization[] => {
      const out: Organization[] = [];
      for (const n of nodes) {
        if (classTypeId ? n.typeId === classTypeId : true) out.push(n);
        if (n.children) out.push(...walk(n.children));
      }
      return out;
    };
    classOptions.value = walk(treeRes.items || []);
    teacherOptions.value = usersRes.items.map((u) => ({ id: u.id, name: `${u.name}${u.username ? `（${u.username}）` : ''}` }));
  } catch {
    /* 选项加载失败不阻断 */
  }
}

function startEdit() {
  const map: Record<string, EditState> = {};
  for (const e of entries.value) {
    map[e.id] = {
      startWeek: String(e.startWeek),
      endWeek: String(e.endWeek),
      credits: String(e.credits || 0),
      totalHours: String(e.totalHours || 0),
      venueType: e.venueType || '',
      classNodeIds: e.classNodeIds || (e.classNodeId ? [e.classNodeId] : []),
      teacherId: e.teacherId || undefined
    };
  }
  Object.keys(editMap).forEach((k) => delete editMap[k]);
  Object.assign(editMap, map);
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  Object.keys(editMap).forEach((k) => delete editMap[k]);
}

async function handleSaveAll() {
  const toSave = entries.value.filter((e) => editMap[e.id]);
  if (!toSave.length) return;
  saving.value = true;
  try {
    const results = await Promise.allSettled(
      toSave.map((e) => {
        const s = editMap[e.id];
        return teachingPlanApi.updateEntry(e.id, {
          startWeek: Number(s.startWeek) || 1,
          endWeek: Number(s.endWeek) || 1,
          credits: s.credits !== '' ? Number(s.credits) : undefined,
          totalHours: s.totalHours !== '' ? Number(s.totalHours) : undefined,
          venueType: s.venueType,
          classNodeIds: s.classNodeIds,
          teacherId: s.teacherId ?? ''
        });
      })
    );
    let success = 0;
    const failedIds: string[] = [];
    const updatedById = new Map<string, TeachingPlanEntry>();
    toSave.forEach((e, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        success++;
        updatedById.set(e.id, r.value);
      } else {
        failedIds.push(e.id);
      }
    });
    entries.value = entries.value.map((x) => (updatedById.has(x.id) ? (updatedById.get(x.id) as TeachingPlanEntry) : x));
    if (failedIds.length > 0) {
      // 保留失败条目编辑态供重试
      for (const e of toSave) {
        if (!failedIds.includes(e.id)) delete editMap[e.id];
      }
      ElMessage.error(
        `保存完成：${success}/${toSave.length} 项；以下条目保存失败，请重试：${failedIds
          .map((fid) => entries.value.find((x) => x.id === fid)?.courseName || fid)
          .join('、')}`
      );
    } else {
      isEditing.value = false;
      Object.keys(editMap).forEach((k) => delete editMap[k]);
      ElMessage.success(`保存完成：${success}/${toSave.length} 项`);
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleSubmitApproval() {
  if (!plan.value) return;
  try {
    if (!plan.value.batchId) {
      ElMessage.warning('该教学计划未关联批次分组，请在列表页绑定批次后提交审批');
      return;
    }
    const batch = await affairsBatchApi.get(plan.value.batchId);
    await teachingPlanApi.submit(plan.value.id);
    await approvalApi.create({
      targetType: 'teaching_plan',
      targetId: plan.value.id,
      workflowId: batch.workflowId
    });
    ElMessage.success('已提交审批');
    await loadPlan();
  } catch (e) {
    ElMessage.error((e as Error).message || '提交审批失败，请稍后重试');
  }
}

async function handleWithdrawApproval() {
  try {
    await teachingPlanApi.withdraw(id);
    ElMessage.success('已撤回审批');
    await loadPlan();
  } catch (e) {
    ElMessage.error((e as Error).message || '撤回审批失败，请稍后重试');
  }
}

async function handlePublish() {
  try {
    await teachingPlanApi.publish(id);
    ElMessage.success('教学计划已发布');
    await loadPlan();
  } catch (e) {
    ElMessage.error((e as Error).message || '发布教学计划失败');
  }
}

onMounted(() => {
  loadPlan();
  loadOptions();
});
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.group-label { font-size: 12px; font-weight: 600; color: #909399; }
.course-name { font-weight: 500; }
.course-code { font-size: 12px; color: #909399; }
.scene-position { font-size: 12px; color: #e67e22; }
.entry-badge {
  display: inline-flex; align-items: center; border-radius: 9999px; padding: 0 10px;
  font-size: 12px; font-weight: 500; line-height: 22px;
}
.entry-badge-theory, .entry-badge-traditional { background: #dbeafe; color: #2563eb; }
.entry-badge-practice { background: #dcfce7; color: #16a34a; }
.entry-badge-scene { background: #ffedd5; color: #ea580c; }
.cell-input { width: 60px; }
.cell-select { width: 100%; }
.week-editor { display: flex; align-items: center; gap: 4px; }
.week-sep { color: #909399; font-size: 12px; }
.bottom-bar { margin-top: 16px; text-align: right; }
</style>
