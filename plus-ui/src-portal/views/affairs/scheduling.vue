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

    <!-- ============ 自定义排课：场地×节次可视化网格 ============ -->
    <template v-if="step === 'grid'">
      <el-empty
        v-if="!selectedPlan"
        description="请先在顶部选择已确认的教学计划"
        :image-size="80"
        class="grid-empty"
      />

      <template v-else>
        <!-- 工具栏 -->
        <div class="grid-toolbar">
          <div class="toolbar-left">
            <span class="toolbar-stats">已排 {{ scheduledCount }}/{{ planEntries.length }} 门 · 待排 {{ pendingEntries.length }} 门</span>
          </div>
          <div class="toolbar-actions">
            <el-button :disabled="!planId" @click="exportExcel">导出排课</el-button>
            <el-button :disabled="!planId" @click="pickImport">导入排课表</el-button>
            <el-button :disabled="!planId" @click="autoSchedule">自动排课</el-button>
            <el-button type="primary" :disabled="!planId" @click="openCreate">新增排课</el-button>
          </div>
        </div>

        <!-- 场地筛选 -->
        <div class="venue-filter">
          <button
            type="button"
            class="venue-chip"
            :class="{ active: venueFilter === '__all' }"
            @click="venueFilter = '__all'"
          >
            全部
          </button>
          <button
            v-for="v in venues"
            :key="v.id"
            type="button"
            class="venue-chip"
            :class="{ active: venueFilter === v.id }"
            @click="venueFilter = v.id"
          >
            <el-icon class="venue-chip-icon"><Location /></el-icon>{{ v.name }}
          </button>
        </div>

        <!-- 已选中待排课程提示条 -->
        <div v-if="selectedEntry && !movingEntry" class="hint-banner hint-blue">
          <span class="hint-strong">已选中：{{ selectedEntry.courseName }}</span>
          <span>→ 点击右侧空格排课</span>
          <el-button size="small" text class="hint-cancel" @click="selectedPendingId = null">
            <el-icon class="btn-icon"><Close /></el-icon>取消
          </el-button>
        </div>

        <!-- 移动中提示条 -->
        <div v-if="movingEntry" class="hint-banner hint-orange">
          <span class="hint-strong">正在重新排课：{{ movingEntry.courseName }}</span>
          <span>→ 点击右侧空格切换时间</span>
          <el-button size="small" text class="hint-cancel" @click="movingEntry = null">
            <el-icon class="btn-icon"><Close /></el-icon>取消
          </el-button>
        </div>

        <!-- 待排课程列表 + 可视化网格 -->
        <div class="grid-layout">
          <div class="pending-panel">
            <div class="pending-head">
              <h3 class="pending-title">待排课程 ({{ pendingEntries.length }})</h3>
              <p class="pending-sub">点击选中·再点空格排课</p>
            </div>
            <div class="pending-list">
              <div v-if="pendingEntries.length === 0" class="pending-done">
                <el-icon class="pending-done-icon"><CircleCheck /></el-icon>
                <span>全部排完</span>
              </div>
              <button
                v-for="e in pendingEntries"
                :key="e.id"
                type="button"
                class="pending-card"
                :class="{ selected: e.id === selectedPendingId }"
                @click="selectedPendingId = selectedPendingId === e.id ? null : e.id"
              >
                <div class="pending-card-head">
                  <span class="pending-course">{{ e.courseName }}</span>
                  <el-tag v-if="e.type === 'scene'" size="small" effect="plain" class="scene-tag">场景</el-tag>
                </div>
                <div class="pending-meta">第 {{ e.startWeek }}-{{ e.endWeek }} 周</div>
                <div v-if="e.teacherName" class="pending-meta">
                  <el-icon class="pending-meta-icon"><User /></el-icon>{{ e.teacherName }}
                </div>
                <div v-if="(e.classNodeIds || []).length > 0" class="pending-meta">
                  {{ (e.classNames || []).slice(0, 2).join('、') }}等{{ (e.classNodeIds || []).length }}班
                </div>
                <div class="pending-action">{{ selectedPendingId === e.id ? '已选中·点空格排课' : '点击选中' }}</div>
              </button>
            </div>
          </div>

          <div class="grid-panel">
            <ScheduleGrid
              :entries="filteredSchedules"
              :period-slots="periodSlots"
              :loading="loading"
              always-show
              empty-text="点击左侧课程后点此处空格"
              :editable="true"
              :movable="true"
              :clickable="!!selectedEntry || !!movingEntry"
              :moving-entry="movingEntry"
              @entry-click="handleEditClick"
              @cell-click="handleCellClick"
              @entry-move="handleEntryMove"
            />
          </div>
        </div>

        <!-- 排课列表（保留原有列表/编辑/删除能力） -->
        <el-collapse v-model="listOpen" class="list-collapse">
          <el-collapse-item name="list">
            <template #title>
              <span class="collapse-title">排课列表（{{ schedules.length }} 条）</span>
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
              <el-table-column label="操作" width="130" align="right">
                <template #default="{ row }">
                  <el-button size="small" @click="openEdit(row)">编辑</el-button>
                  <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>

        <!-- 完善排课信息弹窗（选中待排课程后点空格） -->
        <el-dialog v-model="preConfigOpen" title="完善排课信息" width="480px">
          <p class="pre-config-desc">
            「{{ preConfigEntry?.courseName || '' }}」排课前需配置完整：班级、教师、场地均为必填
          </p>
          <el-form label-width="90px">
            <el-form-item label="授课班级" required>
              <el-tree-select
                v-model="preClassIds"
                :data="classTreeData"
                node-key="value"
                :props="{ label: 'label', children: 'children' }"
                multiple
                check-strictly
                placeholder="选择授课班级"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="授课教师" required>
              <el-select v-model="preTeacherId" filterable placeholder="选择教师" style="width: 100%">
                <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="场地" required>
              <el-select v-model="preVenueId" filterable placeholder="选择场地" style="width: 100%">
                <el-option v-for="v in venues" :key="v.id" :label="`${v.name}（${v.type}）`" :value="v.id" />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="preConfigOpen = false">取消</el-button>
            <el-button
              type="primary"
              :loading="preConfigSaving"
              :disabled="preClassIds.length === 0 || !preTeacherId || !preVenueId"
              @click="handlePreConfigSave"
            >
              保存并排课
            </el-button>
          </template>
        </el-dialog>
      </template>
    </template>

    <!-- ============ 课表视图与发布：班级/教师双视角周课表 ============ -->
    <TimetableViewTab
      v-else
      :term="timetableTerm"
      :class-tree-data="classTreeData"
      :teachers="teachers"
    />

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
        <div>拖拽或点击上传 .xlsx 文件（可先「导出排课」作为模板）</div>
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
        <el-button v-if="editing" size="small" type="danger" text class="dialog-delete" @click="confirmDelete(editing)">取消排课</el-button>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CircleCheck, Close, Location, User } from '@element-plus/icons-vue';
import { teachingPlanApi, scheduleApi, venueApi, periodSlotApi, termApi } from '@/api/affairs';
import { organizationApi, orgTypeApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { importExportApi, type ImportPreviewResult } from '@/api/import-export';
import type { AffairsTerm, TeachingPlanDetail, TeachingPlanEntry, ScheduleEntry, Venue, PeriodSlot } from '@/types/affairs';
import ScheduleGrid from './schedule-grid.vue';
import TimetableViewTab, { type ClassTreeNode } from './timetable-view-tab.vue';

const step = ref<'grid' | 'timetable'>('grid');
const plans = ref<TeachingPlanDetail[]>([]);
const planId = ref('');
const planEntries = ref<TeachingPlanEntry[]>([]);
const schedules = ref<ScheduleEntry[]>([]);
const venues = ref<Venue[]>([]);
const periodSlots = ref<PeriodSlot[]>([]);
const teachers = ref<{ id: string; name: string; workId?: string }[]>([]);
const classTreeData = ref<ClassTreeNode[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialog = ref(false);
const editing = ref<ScheduleEntry | null>(null);
const importDialog = ref(false);
const importFile = ref<File | null>(null);
const importFileList = ref<any[]>([]);
const importPreview = ref<ImportPreviewResult | null>(null);

// ===== 可视化网格状态（对齐 React schedule-grid-tab.tsx） =====
const venueFilter = ref<string>('__all');
const selectedPendingId = ref<string | null>(null);
const movingEntry = ref<ScheduleEntry | null>(null);
const preConfigOpen = ref(false);
const preConfigEntry = ref<TeachingPlanEntry | null>(null);
const preConfigDay = ref(0);
const preConfigPeriod = ref('');
const preClassIds = ref<string[]>([]);
const preTeacherId = ref('');
const preVenueId = ref('');
const preConfigSaving = ref(false);
const listOpen = ref<string[]>(['list']);

const form = reactive({
  courseName: '', classNodeId: '', teacherId: '', dayOfWeek: 1,
  periods: [] as string[], startWeek: 1, endWeek: 16, venueId: ''
});

const selectedPlan = computed(() => plans.value.find((p) => p.id === planId.value) || null);
const pendingEntries = computed(() => planEntries.value.filter((e) => e.status === 'planned'));
const scheduledCount = computed(() => planEntries.value.filter((e) => e.status === 'scheduled').length);
const selectedEntry = computed(
  () => pendingEntries.value.find((e) => e.id === selectedPendingId.value) || null
);
const filteredSchedules = computed(() =>
  venueFilter.value === '__all'
    ? schedules.value
    : schedules.value.filter((e) => e.venueId === venueFilter.value)
);

// 课表视图使用的学期（选中计划变化时拉取完整 term 的周数/日期）
const selectedTerm = ref<AffairsTerm | null>(null);
const timetableTerm = computed<AffairsTerm | null>(() => {
  if (!selectedPlan.value) return null;
  return (
    selectedTerm.value ?? {
      id: selectedPlan.value.termId,
      name: selectedPlan.value.termName || '',
      startDate: '',
      endDate: '',
      weeksCount: 16,
      isCurrent: false,
      createdAt: ''
    }
  );
});

watch(
  selectedPlan,
  async (plan) => {
    if (!plan?.termId) {
      selectedTerm.value = null;
      return;
    }
    try {
      const res = await termApi.list({ search: plan.termId, limit: 50 });
      selectedTerm.value = (res.items || []).find((x) => x.id === plan.termId) || null;
    } catch {
      selectedTerm.value = null;
    }
  },
  { immediate: true }
);

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
    teachers.value = (teacherRes.items || []).map((u) => ({ id: u.id, name: u.name, workId: u.workId }));
    const classTypeIds = new Set((orgTypeRes.items || []).filter((t) => t.name === '班级').map((t) => t.id));
    const buildTree = (nodes: any[]): ClassTreeNode[] =>
      nodes.map((n) => ({ value: n.id, label: n.name, typeId: n.typeId, children: n.children ? buildTree(n.children) : [] }));
    const fullTree = buildTree(orgRes.items || []);
    const filterClassTree = (nodes: ClassTreeNode[]): ClassTreeNode[] =>
      nodes.map((n) => ({ ...n, children: filterClassTree(n.children || []) }))
        .filter((n) => (n.children && n.children.length > 0) || (n.typeId ? classTypeIds.has(n.typeId) : false));
    classTreeData.value = filterClassTree(fullTree);
  } catch {
    /* ignore */
  }
}

async function onPlanChange() {
  if (!planId.value) return;
  selectedPendingId.value = null;
  movingEntry.value = null;
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
    // 网格为草稿编辑区，只展示草稿（已发布是发布时的快照，在课表视图中查看）
    const res = await scheduleApi.list({ termId: selectedPlan.value?.termId, status: 'draft', limit: 200 });
    schedules.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载排课失败');
    schedules.value = [];
  } finally {
    loading.value = false;
  }
}

async function reloadAll() {
  await loadSchedules();
  await onPlanChange();
}

// ===== 网格交互（对齐 React schedule-grid-tab.tsx） =====

async function handleCellClick(dayOfWeek: number, periodKey: string) {
  if (!selectedEntry.value) return;
  const classIds =
    selectedEntry.value.classNodeIds || (selectedEntry.value.classNodeId ? [selectedEntry.value.classNodeId] : []);
  // 场地必须在排课时指定（教学计划条目不含场地），因此始终要求弹窗配置班级/教师/场地
  // 若顶部场地筛选已切换到具体场地，则自动带入弹窗场地字段
  preConfigEntry.value = selectedEntry.value;
  preConfigDay.value = dayOfWeek;
  preConfigPeriod.value = periodKey;
  preClassIds.value = classIds;
  preTeacherId.value = selectedEntry.value.teacherId || '';
  preVenueId.value = venueFilter.value === '__all' ? '' : venueFilter.value;
  preConfigOpen.value = true;
}

async function doCreateSchedule(
  entry: TeachingPlanEntry,
  day: number,
  period: string,
  classIds: string[],
  teacherId: string,
  venueId: string
): Promise<{ created: number; lastErr: string }> {
  try {
    await scheduleApi.create({
      termId: selectedPlan.value?.termId || '',
      planEntryId: entry.id,
      courseName: entry.courseName,
      courseCode: entry.courseCode || undefined,
      courseId: entry.courseId || undefined,
      type: entry.type || 'traditional',
      classNodeId: classIds[0] || '',
      classNodeIds: classIds,
      teacherId: teacherId || undefined,
      dayOfWeek: day,
      periods: [period],
      startWeek: entry.startWeek || 1,
      endWeek: entry.endWeek || 1,
      weekPattern: entry.weekPattern || 'all',
      venueId: venueId || undefined,
      scenarioId: entry.scenarioId || undefined
    });
    return { created: 1, lastErr: '' };
  } catch (err) {
    return { created: 0, lastErr: (err as Error)?.message || '' };
  }
}

async function handlePreConfigSave() {
  if (!preConfigEntry.value) return;
  preConfigSaving.value = true;
  try {
    const { created, lastErr } = await doCreateSchedule(
      preConfigEntry.value,
      preConfigDay.value,
      preConfigPeriod.value,
      preClassIds.value,
      preTeacherId.value,
      preVenueId.value
    );
    if (created > 0) {
      ElMessage.success(`「${preConfigEntry.value.courseName}」已排入周${preConfigDay.value} ${preConfigPeriod.value}`);
      selectedPendingId.value = null;
      preConfigEntry.value = null;
      preConfigOpen.value = false;
      await reloadAll();
    } else if (lastErr) {
      ElMessage.error(lastErr);
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '排课失败');
  } finally {
    preConfigSaving.value = false;
  }
}

async function handleEntryMove(entry: ScheduleEntry, dayOfWeek: number, periodKey: string) {
  try {
    await scheduleApi.update(entry.id, {
      termId: entry.termId,
      planEntryId: entry.planEntryId,
      courseName: entry.courseName,
      courseCode: entry.courseCode || undefined,
      courseId: entry.courseId || undefined,
      type: entry.type,
      classNodeId: entry.classNodeId,
      // 多班级条目必须回传完整班级列表，否则后端回退仅主班级、其余班级丢失
      classNodeIds: entry.classNodeIds || (entry.classNodeId ? [entry.classNodeId] : []),
      teacherId: entry.teacherId || undefined,
      dayOfWeek,
      periods: [periodKey],
      startWeek: entry.startWeek,
      endWeek: entry.endWeek,
      weekPattern: entry.weekPattern,
      venueId: entry.venueId || undefined,
      scenarioId: entry.scenarioId || undefined
    });
    ElMessage.success('排课已调整');
    movingEntry.value = null;
    await reloadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '调整失败');
  }
}

function handleEditClick(entry: ScheduleEntry) {
  movingEntry.value = null;
  openEdit(entry);
}

// ===== 新增/编辑弹窗（保留原有能力） =====
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
    await reloadAll();
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
  try {
    await ElMessageBox.confirm(`确定删除「${row.courseName}」的排课吗？`, '确认删除', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await scheduleApi.delete(row.id);
    ElMessage.success('删除成功');
    dialog.value = false;
    await reloadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function autoSchedule() {
  if (!planId.value) return;
  try {
    const res = await scheduleApi.autoSchedule({ termId: selectedPlan.value?.termId || '', planId: planId.value });
    ElMessage.success(`自动排课完成：成功 ${res.success} 条，失败 ${res.failed} 条`);
    await reloadAll();
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

// ===== 导入（保留原有能力） =====
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
    await reloadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败');
  } finally {
    saving.value = false;
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
.grid-empty { background: #fff; border: 1px solid #e4e7ed; border-radius: 8px; padding: 48px 0; }

/* 工具栏 */
.grid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.toolbar-stats { font-size: 14px; color: #606266; }

/* 场地筛选 */
.venue-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.venue-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 9999px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.venue-chip:hover { border-color: #a0cfff; color: #409eff; }
.venue-chip.active { background: #409eff; color: #fff; border-color: #409eff; }
.venue-chip-icon { font-size: 12px; }

/* 提示条 */
.hint-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}
.hint-blue { background: #ecf5ff; border: 1px solid #b3d8ff; color: #409eff; }
.hint-orange { background: #fdf6ec; border: 1px solid #faecd8; color: #e6a23c; }
.hint-strong { font-weight: 500; }
.hint-cancel { margin-left: auto; color: inherit; }

/* 网格布局 */
.grid-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}
@media (min-width: 1024px) {
  .grid-layout {
    flex-direction: row;
    align-items: stretch;
  }
}
.pending-panel {
  width: 100%;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 560px;
}
@media (min-width: 1024px) {
  .pending-panel { width: 300px; }
}
.pending-head {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
}
.pending-title { font-size: 14px; font-weight: 600; color: #303133; margin: 0; }
.pending-sub { font-size: 12px; color: #909399; margin: 2px 0 0; }
.pending-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pending-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 0;
  color: #c0c4cc;
  font-size: 14px;
}
.pending-done-icon { font-size: 28px; color: #67c23a; }
.pending-card {
  width: 100%;
  text-align: left;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}
.pending-card:hover { border-color: #a0cfff; background: rgba(64, 158, 255, 0.04); }
.pending-card.selected { border-color: #409eff; background: #ecf5ff; }
.pending-card-head { display: flex; align-items: center; gap: 6px; }
.pending-course {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.scene-tag { flex-shrink: 0; }
.pending-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.pending-meta-icon { font-size: 12px; }
.pending-action { margin-top: 6px; font-size: 12px; font-weight: 500; color: #409eff; }
.grid-panel {
  min-width: 0;
  flex: 1;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
}

/* 排课列表 */
.list-collapse { background: #fff; border: 1px solid #e4e7ed; border-radius: 8px; }
.collapse-title { font-size: 14px; font-weight: 600; color: #303133; }

/* 完善排课信息弹窗 */
.pre-config-desc {
  font-size: 13px;
  color: #606266;
  margin: 0 0 12px;
  line-height: 1.6;
}

/* 弹窗删除按钮 */
.dialog-delete { margin-right: auto; }

.import-file { padding: 12px; border: 1px dashed #dcdfe6; border-radius: 8px; color: #606266; font-size: 13px; margin-bottom: 12px; }
.preview p { font-size: 13px; color: #606266; }
.preview-row { display: flex; gap: 8px; font-size: 12px; padding: 4px 0; color: #303133; }
.preview-row .err { color: #f56c6c; }
.week-row { display: flex; align-items: center; gap: 8px; }
.btn-icon { margin-right: 2px; }
</style>
