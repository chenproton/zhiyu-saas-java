<template>
  <div class="scheduling-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">排课管理</h2>
        <p class="page-sub">{{ selectedPlan ? `当前教学计划：${selectedPlan.programName || ''} · ${selectedPlan.termName || ''} · ${selectedPlan.majorName || ''} ${selectedPlan.entryYear}级` : '选择教学计划开始排课，发布后学生/教师工作台可见' }}</p>
      </div>
      <el-select v-model="planId" placeholder="请选择教学计划" style="width: 320px" @change="onPlanChange">
        <el-option v-for="p in plans" :key="p.id" :label="`${p.programName} · ${p.termName}${p.majorName ? ' · ' + p.majorName : ''}`" :value="p.id" />
      </el-select>
    </div>

    <el-radio-group v-model="step" class="step-tabs">
      <el-radio-button value="grid">自定义排课</el-radio-button>
      <el-radio-button value="timetable">课表视图与发布</el-radio-button>
    </el-radio-group>

    <!-- 自定义排课 -->
    <el-card v-if="step === 'grid'" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">排课列表</span>
          <div>
            <el-button :disabled="!planId" @click="autoSchedule">自动排课</el-button>
            <el-button :disabled="!planId" @click="exportExcel">导出排课</el-button>
            <el-button :disabled="!planId" @click="pickImport">导入排课表</el-button>
            <el-button type="primary" :disabled="!planId" @click="openCreate">新增排课</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="schedules" stripe>
        <el-table-column label="课程" prop="courseName" min-width="140" show-overflow-tooltip />
        <el-table-column label="班级" min-width="120">
          <template #default="{ row }">{{ row.className || row.classNames?.join('、') || '-' }}</template>
        </el-table-column>
        <el-table-column label="教师" prop="teacherName" width="100">
          <template #default="{ row }">{{ row.teacherName || '-' }}</template>
        </el-table-column>
        <el-table-column label="星期" width="80">
          <template #default="{ row }">周{{ '一二三四五六日'[(row.dayOfWeek - 1) % 7] }}</template>
        </el-table-column>
        <el-table-column label="节次" width="100">
          <template #default="{ row }">{{ (row.periods || []).join('、') }}</template>
        </el-table-column>
        <el-table-column label="周次" width="100">
          <template #default="{ row }">{{ row.startWeek }}-{{ row.endWeek }} 周</template>
        </el-table-column>
        <el-table-column label="场地" prop="venueName" width="100">
          <template #default="{ row }">{{ row.venueName || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 课表视图与发布 -->
    <el-card v-else shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">课表视图（已发布，版本 v{{ timetableVersion }}）</span>
          <el-button type="primary" :disabled="!planId" @click="publish">发布课表</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="timetableItems" stripe>
        <el-table-column label="课程" prop="courseName" min-width="140" show-overflow-tooltip />
        <el-table-column label="班级" min-width="120">
          <template #default="{ row }">{{ row.className || row.classNames?.join('、') || '-' }}</template>
        </el-table-column>
        <el-table-column label="教师" prop="teacherName" width="100">
          <template #default="{ row }">{{ row.teacherName || '-' }}</template>
        </el-table-column>
        <el-table-column label="星期" width="80">
          <template #default="{ row }">周{{ '一二三四五六日'[(row.dayOfWeek - 1) % 7] }}</template>
        </el-table-column>
        <el-table-column label="节次" width="100">
          <template #default="{ row }">{{ (row.periods || []).join('、') }}</template>
        </el-table-column>
        <el-table-column label="周次" width="100">
          <template #default="{ row }">{{ row.startWeek }}-{{ row.endWeek }} 周</template>
        </el-table-column>
        <el-table-column label="场地" prop="venueName" width="100">
          <template #default="{ row }">{{ row.venueName || '-' }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 导入预览 -->
    <el-dialog v-model="importDialog" title="导入排课表" width="520px">
      <div v-if="importFile" class="import-file">{{ importFile.name }}</div>
      <el-upload
        v-if="!importFile"
        drag
        :auto-upload="false"
        accept=".xlsx"
        :limit="1"
        :on-change="onImportFileChange"
        :file-list="importFileList"
      >
        <div>拖拽或点击上传 .xlsx 文件</div>
      </el-upload>
      <div v-if="importPreview" class="preview">
        <p>待导入 {{ importPreview.total }} 条，有效 {{ importPreview.valid }} 条，无效 {{ importPreview.invalid }} 条</p>
        <div v-for="(r, i) in importPreview.rows.slice(0, 20)" :key="i" class="preview-row">
          <span>{{ r.name || r.code || '-' }}</span>
          <span v-if="r.error" class="err">{{ r.error }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeImport">取消</el-button>
        <el-button v-if="!importPreview" type="primary" :loading="saving" @click="previewImport">预览并导入</el-button>
        <template v-else>
          <el-button type="primary" :loading="saving" @click="doImport(false)">导入</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 新增/编辑排课 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑排课' : '新增排课'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="课程" required>
          <el-select v-model="form.courseName" filterable allow-create placeholder="选择或输入课程" style="width: 100%">
            <el-option v-for="e in planEntries" :key="e.id" :label="e.courseName" :value="e.courseName" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级" required>
          <el-tree-select v-model="form.classNodeId" :data="classTreeData" node-key="value" :props="{ label: 'label', children: 'children' }" check-strictly placeholder="选择班级" style="width: 100%" />
        </el-form-item>
        <el-form-item label="教师">
          <el-select v-model="form.teacherId" clearable filterable placeholder="选择教师" style="width: 100%">
            <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="星期" required>
          <el-select v-model="form.dayOfWeek" style="width: 100%">
            <el-option v-for="d in 7" :key="d" :label="`周${'一二三四五六日'[d - 1]}`" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="节次" required>
          <el-select v-model="form.periods" multiple style="width: 100%">
            <el-option v-for="p in periodSlots" :key="p.name" :label="p.name" :value="p.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="周次">
          <div class="week-row">
            <el-input-number v-model="form.startWeek" :min="1" :max="30" /> 至
            <el-input-number v-model="form.endWeek" :min="1" :max="30" />
          </div>
        </el-form-item>
        <el-form-item label="场地">
          <el-select v-model="form.venueId" clearable filterable placeholder="选择场地" style="width: 100%">
            <el-option v-for="v in venues" :key="v.id" :label="v.name" :value="v.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { teachingPlanApi, scheduleApi, venueApi, periodSlotApi } from '@/api/affairs';
import { organizationApi, orgTypeApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { importExportApi, type ImportPreviewResult } from '@/api/import-export';
import type { TeachingPlanDetail, TeachingPlanEntry, ScheduleEntry, Venue, PeriodSlot } from '@/types/affairs';

const step = ref<'grid' | 'timetable'>('grid');
const plans = ref<TeachingPlanDetail[]>([]);
const planId = ref('');
const planEntries = ref<TeachingPlanEntry[]>([]);
const schedules = ref<ScheduleEntry[]>([]);
const timetableItems = ref<ScheduleEntry[]>([]);
const timetableVersion = ref(0);
const venues = ref<Venue[]>([]);
const periodSlots = ref<PeriodSlot[]>([]);
const teachers = ref<{ id: string; name: string }[]>([]);
const classTreeData = ref<{ value: string; label: string; children?: any[] }[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialog = ref(false);
const editing = ref<ScheduleEntry | null>(null);
const importDialog = ref(false);
const importFile = ref<File | null>(null);
const importFileList = ref<any[]>([]);
const importPreview = ref<ImportPreviewResult | null>(null);

const form = reactive({
  courseName: '', classNodeId: '', teacherId: '', dayOfWeek: 1,
  periods: [] as string[], startWeek: 1, endWeek: 16, venueId: ''
});

const selectedPlan = computed(() => plans.value.find((p) => p.id === planId.value) || null);

async function loadPlans() {
  try {
    const res = await teachingPlanApi.list({ status: 'published', limit: 200 });
    plans.value = res.items;
    if (!planId.value && res.items.length) planId.value = res.items[0].id;
  } catch (e) {
    ElMessage.error((e as Error).message || '查询教学计划列表失败');
  }
}

async function loadDicts() {
  try {
    const [venueRes, periodRes, teacherRes, orgRes, orgTypeRes] = await Promise.all([
      venueApi.list({ limit: 200 }),
      periodSlotApi.list({ limit: 200 }),
      userManagementApi.list({ roleCode: 'teacher', limit: 500 }),
      organizationApi.tree(),
      orgTypeApi.list({ limit: 200 })
    ]);
    venues.value = venueRes.items;
    periodSlots.value = periodRes.items;
    teachers.value = (teacherRes.items || []).map((u) => ({ id: u.id, name: u.name }));
    const classTypeIds = new Set((orgTypeRes.items || []).filter((t) => t.name === '班级').map((t) => t.id));
    const buildTree = (nodes: any[]): any[] => nodes.map((n) => ({ value: n.id, label: n.name, children: n.children ? buildTree(n.children) : [] }));
    const fullTree = buildTree(orgRes.items || []);
    const filterClassTree = (nodes: any[]): any[] =>
      nodes.map((n) => ({ ...n, children: filterClassTree(n.children || []) }))
        .filter((n) => n.children.length > 0 || classTypeIds.has(n.value));
    classTreeData.value = filterClassTree(fullTree);
  } catch {
    /* ignore */
  }
}

async function onPlanChange() {
  if (!planId.value) return;
  loading.value = true;
  try {
    const detail = await teachingPlanApi.get(planId.value);
    planEntries.value = detail.entries || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '查询教学计划详情失败');
    planEntries.value = [];
  } finally {
    loading.value = false;
  }
  await loadSchedules();
}

async function loadSchedules() {
  if (!planId.value) return;
  loading.value = true;
  try {
    const res = await scheduleApi.list({ termId: selectedPlan.value?.termId, limit: 500 });
    schedules.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载排课失败');
    schedules.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadTimetable() {
  if (!planId.value) return;
  loading.value = true;
  try {
    const res = await scheduleApi.timetable({ termId: selectedPlan.value?.termId || '', status: 'published' });
    timetableItems.value = res.items;
    timetableVersion.value = res.version || 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载课表失败');
    timetableItems.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.courseName = '';
  form.classNodeId = '';
  form.teacherId = '';
  form.dayOfWeek = 1;
  form.periods = [];
  form.startWeek = 1;
  form.endWeek = 16;
  form.venueId = '';
  dialog.value = true;
}
function openEdit(row: ScheduleEntry) {
  editing.value = row;
  form.courseName = row.courseName;
  form.classNodeId = row.classNodeId;
  form.teacherId = row.teacherId || '';
  form.dayOfWeek = row.dayOfWeek;
  form.periods = [...(row.periods || [])];
  form.startWeek = row.startWeek;
  form.endWeek = row.endWeek;
  form.venueId = row.venueId || '';
  dialog.value = true;
}

async function save() {
  if (!form.courseName.trim() || !form.classNodeId || !form.periods.length) {
    ElMessage.warning('课程、班级、节次必填');
    return;
  }
  saving.value = true;
  const payload = {
    termId: selectedPlan.value?.termId || '',
    courseName: form.courseName.trim(),
    classNodeId: form.classNodeId,
    teacherId: form.teacherId || undefined,
    dayOfWeek: form.dayOfWeek,
    periods: form.periods,
    startWeek: form.startWeek,
    endWeek: form.endWeek,
    venueId: form.venueId || undefined
  };
  try {
    if (editing.value) {
      await scheduleApi.update(editing.value.id, payload);
      ElMessage.success('保存成功');
    } else {
      await scheduleApi.create(payload);
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    loadSchedules();
  } catch (e) {
    const err = e as Error & { conflicts?: { courseName: string; className?: string; teacherName?: string }[] };
    if (err.conflicts && err.conflicts.length) {
      ElMessage.error('排课冲突：' + err.conflicts.map((c) => c.courseName).join('、'));
    } else {
      ElMessage.error(err.message || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: ScheduleEntry) {
  try { await ElMessageBox.confirm(`确定删除「${row.courseName}」的排课吗？`, '确认删除', { type: 'warning' }); } catch { return; }
  try {
    await scheduleApi.delete(row.id);
    ElMessage.success('删除成功');
    loadSchedules();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function autoSchedule() {
  if (!planId.value) return;
  try {
    const res = await scheduleApi.autoSchedule({ termId: selectedPlan.value?.termId || '', planId: planId.value });
    ElMessage.success(`自动排课完成：成功 ${res.success} 条，失败 ${res.failed} 条`);
    loadSchedules();
  } catch (e) {
    ElMessage.error((e as Error).message || '自动排课失败');
  }
}

async function exportExcel() {
  if (!planId.value) return;
  try {
    await scheduleApi.exportExcel(selectedPlan.value?.termId || '');
  } catch (e) {
    ElMessage.error((e as Error).message || '导出失败');
  }
}

function pickImport() {
  importFile.value = null;
  importFileList.value = [];
  importPreview.value = null;
  importDialog.value = true;
}
function onImportFileChange(file: any) {
  importFile.value = file.raw || null;
}
function closeImport() {
  importDialog.value = false;
  importFile.value = null;
  importFileList.value = [];
  importPreview.value = null;
}
async function previewImport() {
  if (!importFile.value) {
    ElMessage.warning('请选择文件');
    return;
  }
  saving.value = true;
  try {
    importPreview.value = await importExportApi.importPreview('schedules', importFile.value);
  } catch (e) {
    ElMessage.error((e as Error).message || '预览失败');
  } finally {
    saving.value = false;
  }
}
async function doImport(overwrite: boolean) {
  if (!importFile.value) return;
  saving.value = true;
  try {
    const res = await importExportApi.import('schedules', importFile.value, overwrite, false);
    ElMessage.success(`导入完成：新增 ${res.created} 条，失败 ${res.failed} 条`);
    closeImport();
    loadSchedules();
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败');
  } finally {
    saving.value = false;
  }
}

async function publish() {
  if (!planId.value) return;
  try {
    const res = await scheduleApi.publish(selectedPlan.value?.termId || '');
    ElMessage.success(`已发布 ${res.published} 条排课（版本 v${res.version}）`);
    loadTimetable();
  } catch (e) {
    ElMessage.error((e as Error).message || '发布失败');
  }
}

onMounted(async () => {
  await loadDicts();
  await loadPlans();
  if (planId.value) await onPlanChange();
});
</script>

<style scoped>
.scheduling-page { padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.step-tabs { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.week-row { display: flex; align-items: center; gap: 8px; }
</style>
