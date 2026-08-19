<template>
  <div class="config-page">
    <div class="page-header">
      <h2 class="page-title">场地与节次配置</h2>
      <p class="page-sub">维护学期、场地与节次，供排课使用</p>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <!-- 学期管理 -->
        <el-tab-pane label="学期管理" name="term">
          <div class="tab-actions">
            <el-button type="primary" @click="openTerm()">新增学期</el-button>
          </div>
          <el-table v-loading="loading.term" :data="terms" stripe>
            <el-table-column label="名称" prop="name" min-width="140" />
            <el-table-column label="开始日期" prop="startDate" width="120" />
            <el-table-column label="结束日期" prop="endDate" width="120" />
            <el-table-column label="周数" prop="weeksCount" width="80" />
            <el-table-column label="当前学期" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.isCurrent" type="success">当前</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="openTerm(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="delTerm(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 场地管理 -->
        <el-tab-pane label="场地管理" name="venue">
          <div class="tab-actions">
            <el-button type="primary" @click="openVenue()">新增场地</el-button>
          </div>
          <el-table v-loading="loading.venue" :data="venues" stripe>
            <el-table-column label="名称" prop="name" min-width="140" />
            <el-table-column label="类型" prop="type" width="120" />
            <el-table-column label="容量" prop="capacity" width="90">
              <template #default="{ row }">{{ row.capacity ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="130" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="openVenue(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="delVenue(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 节次管理（参数化配置 → 自动生成 → 原子替换保存，对齐 React venue-period-config-tab PeriodSlotsSection） -->
        <el-tab-pane label="节次管理" name="period">
          <div class="period-section">
            <div class="period-section-head">
              <h3 class="period-section-title">节次管理</h3>
              <p class="period-section-desc">节次作为课表网格的行，排课与导入均按节次名称匹配；右侧配置参数自动生成，预览确认后保存</p>
            </div>

            <div class="period-layout">
              <!-- 左侧：周课表预览网格 -->
              <div class="period-preview">
                <div class="period-preview-toolbar">
                  <el-button size="small" @click="periodHelpOpen = true">使用说明</el-button>
                  <div class="period-type-legend">
                    <span v-for="key in PERIOD_TYPES" :key="key" class="legend-item">
                      <span class="legend-dot" :style="{ background: PERIOD_TYPE_META[key].dot }"></span>
                      {{ PERIOD_TYPE_META[key].label }}
                    </span>
                  </div>
                </div>

                <el-table v-loading="loading.period" :data="periodRows" border size="small" class="period-grid">
                  <el-table-column label="节次" width="150" fixed>
                    <template #default="{ row }">
                      <span class="period-name">{{ row.name }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-for="d in DAY_LABELS" :key="d" :label="d" align="center" width="120">
                    <template #default="{ row }">
                      <div class="period-cell" :style="{ background: cellMeta(row).bg, borderColor: cellMeta(row).border }">
                        <span class="period-cell-label" :style="{ color: cellMeta(row).text }">{{ cellMeta(row).label }}</span>
                        <span class="period-cell-time">{{ row.startTime ? `${row.startTime}-${row.endTime || '--:--'}` : '未设置时间' }}</span>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <!-- 右侧：参数设置面板 -->
              <div class="period-settings">
                <h4 class="period-settings-title">排课节次设置</h4>
                <div v-for="item in countRows" :key="item.key" class="count-row">
                  <span class="count-label">{{ item.label }}</span>
                  <div class="count-stepper">
                    <button
                      v-for="n in 5"
                      :key="n"
                      type="button"
                      class="count-dot"
                      :class="{ active: periodSettings[item.key] >= n }"
                      @click="setPeriodCount(item.key, n)"
                    ></button>
                  </div>
                </div>

                <el-divider />

                <h4 class="period-settings-title">课程时间设置</h4>
                <div v-for="g in timeGroups" :key="g.startKey" class="time-group">
                  <p class="time-group-label">{{ g.label }}</p>
                  <div class="time-row">
                    <span class="time-row-label">开始时间</span>
                    <el-time-picker
                      :model-value="periodSettings[g.startKey]"
                      value-format="HH:mm"
                      format="HH:mm"
                      style="flex: 1"
                      size="small"
                      @update:model-value="(v: string) => updatePeriodSetting(g.startKey, v || '')"
                    />
                  </div>
                  <div class="time-row">
                    <span class="time-row-label">节次时长</span>
                    <el-input-number
                      :model-value="periodSettings[g.durationKey]"
                      :min="1"
                      size="small"
                      style="flex: 1"
                      controls-position="right"
                      @update:model-value="(v: number | undefined) => updatePeriodSetting(g.durationKey, v ?? 1)"
                    />
                    <span class="time-unit">分</span>
                  </div>
                  <div class="time-row">
                    <span class="time-row-label">课间时长</span>
                    <el-input-number
                      :model-value="periodSettings[g.breakKey]"
                      :min="0"
                      size="small"
                      style="flex: 1"
                      controls-position="right"
                      @update:model-value="(v: number | undefined) => updatePeriodSetting(g.breakKey, v ?? 0)"
                    />
                    <span class="time-unit">分</span>
                  </div>
                </div>

                <el-divider />

                <p class="period-save-hint">修改参数将重新生成全部节次，点「保存配置」一次性落库</p>
                <div class="period-save-btns">
                  <el-button size="small" @click="handlePeriodReset">恢复默认</el-button>
                  <el-button size="small" type="primary" :disabled="periodSaving || periodRows.length === 0 || !periodDirty" :loading="periodSaving" @click="handlePeriodSave">保存配置</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 学期弹窗 -->
    <el-dialog v-model="termDialog" :title="termEditing ? '编辑学期' : '新增学期'" width="460px">
      <el-form label-width="90px">
        <el-form-item label="名称" required><el-input v-model="termForm.name" /></el-form-item>
        <el-form-item label="起止日期">
          <el-date-picker v-model="termForm.range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width: 100%" />
        </el-form-item>
        <el-form-item label="周数"><span>{{ termWeeks }}</span></el-form-item>
        <el-form-item label="当前学期"><el-switch v-model="termForm.isCurrent" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="termDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTerm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 场地弹窗 -->
    <el-dialog v-model="venueDialog" :title="venueEditing ? '编辑场地' : '新增场地'" width="440px">
      <el-form label-width="90px">
        <el-form-item label="名称" required><el-input v-model="venueForm.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="venueForm.type" style="width: 100%">
            <el-option v-for="t in venueTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量"><el-input-number v-model="venueForm.capacity" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="venueDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveVenue">保存</el-button>
      </template>
    </el-dialog>

    <!-- 节次使用说明弹窗 -->
    <el-dialog v-model="periodHelpOpen" title="使用说明" width="460px">
      <div class="period-help-body">
        <p>1. 在右侧面板点击节点条设置各时段节次数量（最多 5 个），左侧课表网格会自动生成并预览。</p>
        <p>2. 可设置各时段开始时间、节次时长、课间时长，系统自动推算每个节次的起止时间。</p>
        <p>3. 点击「保存配置」一次性落库；节次按名称被排课与 Excel 导入引用，改名需同步调整排课数据。</p>
      </div>
      <template #footer>
        <el-button @click="periodHelpOpen = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { termApi, venueApi, periodSlotApi } from '@/api/affairs';
import type { AffairsTerm, Venue, PeriodSlot } from '@/types/affairs';

// ===== 节次参数化配置（对齐 React venue-period-config-tab.tsx PeriodSlotsSection） ===== 
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PERIOD_TYPES = ['morning_self', 'morning', 'afternoon', 'evening'] as const;

const PERIOD_TYPE_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  morning_self: { label: '早自习', bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', dot: '#38bdf8' },
  morning: { label: '上午', bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#fbbf24' },
  afternoon: { label: '下午', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#4ade80' },
  evening: { label: '晚自习', bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', dot: '#818cf8' }
};

function periodTypeOf(t?: string): string {
  return (PERIOD_TYPES as readonly string[]).includes(t || '') ? (t as string) : 'morning';
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 秒 → H:MM:SS / MM:SS（对齐 React lib/format-utils formatDuration） */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 预览行（工作副本，保存时才落库） */
interface PeriodRow {
  name: string;
  type: string;
  startTime: string;
  endTime: string;
}

interface PeriodSettings {
  morningSelfCount: number;
  morningClassCount: number;
  afternoonClassCount: number;
  eveningClassCount: number;
  morningSelfStart: string;
  morningStart: string;
  afternoonStart: string;
  eveningStart: string;
  morningSelfDuration: number;
  morningSelfBreak: number;
  morningClassDuration: number;
  morningBreakDuration: number;
  afternoonClassDuration: number;
  afternoonBreakDuration: number;
  eveningDuration: number;
  eveningBreak: number;
}

const defaultPeriodSettings: PeriodSettings = {
  morningSelfCount: 1,
  morningClassCount: 4,
  afternoonClassCount: 4,
  eveningClassCount: 1,
  morningSelfStart: '07:30',
  morningStart: '08:00',
  afternoonStart: '14:00',
  eveningStart: '18:30',
  morningSelfDuration: 20,
  morningSelfBreak: 10,
  morningClassDuration: 45,
  morningBreakDuration: 10,
  afternoonClassDuration: 45,
  afternoonBreakDuration: 10,
  eveningDuration: 45,
  eveningBreak: 10
};

type PeriodCountKey = 'morningSelfCount' | 'morningClassCount' | 'afternoonClassCount' | 'eveningClassCount';
type StartKey = 'morningSelfStart' | 'morningStart' | 'afternoonStart' | 'eveningStart';
type DurationKey = 'morningSelfDuration' | 'morningClassDuration' | 'afternoonClassDuration' | 'eveningDuration';
type BreakKey = 'morningSelfBreak' | 'morningBreakDuration' | 'afternoonBreakDuration' | 'eveningBreak';

const countRows: { label: string; key: PeriodCountKey }[] = [
  { label: '早自习', key: 'morningSelfCount' },
  { label: '上午', key: 'morningClassCount' },
  { label: '下午', key: 'afternoonClassCount' },
  { label: '晚自习', key: 'eveningClassCount' }
];

const timeGroups: { label: string; startKey: StartKey; durationKey: DurationKey; breakKey: BreakKey }[] = [
  { label: '早自习', startKey: 'morningSelfStart', durationKey: 'morningSelfDuration', breakKey: 'morningSelfBreak' },
  { label: '上午', startKey: 'morningStart', durationKey: 'morningClassDuration', breakKey: 'morningBreakDuration' },
  { label: '下午', startKey: 'afternoonStart', durationKey: 'afternoonClassDuration', breakKey: 'afternoonBreakDuration' },
  { label: '晚自习', startKey: 'eveningStart', durationKey: 'eveningDuration', breakKey: 'eveningBreak' }
];

/** 参数化生成全部节次：按时段顺序排列，sortOrder 即数组下标 */
function generateRows(settings: PeriodSettings): PeriodRow[] {
  const rows: PeriodRow[] = [];
  const add = (type: string, name: string, start: number, end: number) => {
    rows.push({ name, type, startTime: formatDuration(start * 60), endTime: formatDuration(end * 60) });
  };
  const group = (
    type: string,
    start: string,
    count: number,
    duration: number,
    breakMins: number,
    label: (i: number) => string
  ) => {
    if (count <= 0) return;
    let current = parseTime(start || '08:00');
    for (let i = 0; i < count; i++) {
      add(type, label(i + 1), current, current + duration);
      current += duration;
      if (i < count - 1) current += breakMins;
    }
  };
  group('morning_self', settings.morningSelfStart, settings.morningSelfCount, settings.morningSelfDuration, settings.morningSelfBreak, (i) => `早自习 ${i}`);
  group('morning', settings.morningStart, settings.morningClassCount, settings.morningClassDuration, settings.morningBreakDuration, (i) => `上午 ${i}`);
  group('afternoon', settings.afternoonStart, settings.afternoonClassCount, settings.afternoonClassDuration, settings.afternoonBreakDuration, (i) => `下午 ${i}`);
  group('evening', settings.eveningStart, settings.eveningClassCount, settings.eveningDuration, settings.eveningBreak, (i) => `晚自习 ${i}`);
  return rows;
}

function slotToRow(s: PeriodSlot): PeriodRow {
  return {
    name: s.name,
    type: periodTypeOf(s.type),
    startTime: s.startTime ? s.startTime.slice(0, 5) : '',
    endTime: s.endTime ? s.endTime.slice(0, 5) : ''
  };
}

function durationOf(row: PeriodRow): number | null {
  if (!row.startTime || !row.endTime) return null;
  return parseTime(row.endTime) - parseTime(row.startTime);
}

/** 从已有节次反推设置参数（开始时间/时长取各组首条，课间无法反推用默认值） */
function deriveSettings(items: PeriodSlot[]): PeriodSettings {
  const s = { ...defaultPeriodSettings };
  const counts: Record<string, number> = { morning_self: 0, morning: 0, afternoon: 0, evening: 0 };
  const first: Record<string, PeriodRow> = {};
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const t = periodTypeOf(it.type);
    counts[t]++;
    if (!first[t]) first[t] = slotToRow(it);
  }
  s.morningSelfCount = counts.morning_self;
  s.morningClassCount = counts.morning;
  s.afternoonClassCount = counts.afternoon;
  s.eveningClassCount = counts.evening;
  const startOf = (t: string): string | undefined => first[t]?.startTime;
  const durationOfGroup = (t: string): number | undefined => {
    const r = first[t];
    if (!r) return undefined;
    const d = durationOf(r);
    return d && d > 0 ? d : undefined;
  };
  s.morningSelfStart = startOf('morning_self') || s.morningSelfStart;
  s.morningStart = startOf('morning') || s.morningStart;
  s.afternoonStart = startOf('afternoon') || s.afternoonStart;
  s.eveningStart = startOf('evening') || s.eveningStart;
  const d1 = durationOfGroup('morning_self');
  const d2 = durationOfGroup('morning');
  const d3 = durationOfGroup('afternoon');
  const d4 = durationOfGroup('evening');
  if (d1) s.morningSelfDuration = d1;
  if (d2) s.morningClassDuration = d2;
  if (d3) s.afternoonClassDuration = d3;
  if (d4) s.eveningDuration = d4;
  return s;
}

const venueTypes = ['教室', '机房', '实训室', '实验室', '校外基地'];
const activeTab = ref('term');
const loading = reactive({ term: false, venue: false, period: false });
const saving = ref(false);

const terms = ref<AffairsTerm[]>([]);
const venues = ref<Venue[]>([]);

// 学期
const termDialog = ref(false);
const termEditing = ref<AffairsTerm | null>(null);
const termForm = reactive({ name: '', range: [] as string[], isCurrent: false });
const termWeeks = computed(() => {
  if (!termForm.range || termForm.range.length !== 2) return 0;
  const [from, to] = termForm.range.map((s) => new Date(s).getTime());
  const days = Math.round((to - from) / 86400000) + 1;
  return Math.max(1, Math.ceil(days / 7));
});

// 场地
const venueDialog = ref(false);
const venueEditing = ref<Venue | null>(null);
const venueForm = reactive({ name: '', type: '教室', capacity: undefined as number | undefined });

// 节次（参数化配置 → 自动生成 → 原子替换保存）
const periodRows = ref<PeriodRow[]>([]);
const periodSettings = ref<PeriodSettings>({ ...defaultPeriodSettings });
const periodDirty = ref(false);
const periodSaving = ref(false);
const periodHelpOpen = ref(false);

async function loadTerms() {
  loading.term = true;
  try {
    const res = await termApi.list({ limit: 500 });
    terms.value = res.items;
  } catch (e) { ElMessage.error((e as Error).message || '加载学期失败'); } finally { loading.term = false; }
}
async function loadVenues() {
  loading.venue = true;
  try {
    const res = await venueApi.list({ limit: 500 });
    venues.value = res.items;
  } catch (e) { ElMessage.error((e as Error).message || '加载场地失败'); } finally { loading.venue = false; }
}
async function loadPeriods() {
  loading.period = true;
  try {
    const res = await periodSlotApi.list({ limit: 500 });
    periodRows.value = res.items.map(slotToRow);
    periodSettings.value = deriveSettings(res.items);
    periodDirty.value = false;
  } catch (e) { ElMessage.error((e as Error).message || '加载节次失败'); } finally { loading.period = false; }
}

// 学期
function openTerm(row?: AffairsTerm) {
  termEditing.value = row || null;
  termForm.name = row?.name || '';
  termForm.range = row ? [row.startDate, row.endDate] : [];
  termForm.isCurrent = row?.isCurrent || false;
  termDialog.value = true;
}
async function saveTerm() {
  if (!termForm.name.trim()) { ElMessage.warning('名称必填'); return; }
  saving.value = true;
  try {
    const payload = {
      name: termForm.name.trim(),
      startDate: termForm.range[0] || '',
      endDate: termForm.range[1] || '',
      weeksCount: termWeeks.value,
      isCurrent: termForm.isCurrent
    };
    if (termEditing.value) await termApi.update(termEditing.value.id, payload);
    else await termApi.create(payload);
    ElMessage.success('保存成功');
    termDialog.value = false;
    loadTerms();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function delTerm(row: AffairsTerm) {
  try { await ElMessageBox.confirm(`确定删除学期「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
  try { await termApi.delete(row.id); ElMessage.success('删除成功'); loadTerms(); } catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

// 场地
function openVenue(row?: Venue) {
  venueEditing.value = row || null;
  venueForm.name = row?.name || '';
  venueForm.type = row?.type || '教室';
  venueForm.capacity = row?.capacity;
  venueDialog.value = true;
}
async function saveVenue() {
  if (!venueForm.name.trim()) { ElMessage.warning('名称必填'); return; }
  saving.value = true;
  try {
    const payload = { name: venueForm.name.trim(), type: venueForm.type, capacity: venueForm.capacity };
    if (venueEditing.value) await venueApi.update(venueEditing.value.id, payload);
    else await venueApi.create(payload);
    ElMessage.success('保存成功');
    venueDialog.value = false;
    loadVenues();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function delVenue(row: Venue) {
  try { await ElMessageBox.confirm(`确定删除场地「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
  try { await venueApi.delete(row.id); ElMessage.success('删除成功'); loadVenues(); } catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

// 节次（参数化配置 → 原子替换保存）
function cellMeta(row: PeriodRow) {
  return PERIOD_TYPE_META[row.type] || PERIOD_TYPE_META.morning;
}

function updatePeriodSetting<K extends keyof PeriodSettings>(key: K, value: PeriodSettings[K]) {
  periodSettings.value = { ...periodSettings.value, [key]: value } as PeriodSettings;
  periodRows.value = generateRows(periodSettings.value);
  periodDirty.value = true;
}

function setPeriodCount(key: PeriodCountKey, n: number) {
  const cur = periodSettings.value[key];
  updatePeriodSetting(key, cur === n ? 0 : n);
}

function handlePeriodReset() {
  periodSettings.value = { ...defaultPeriodSettings };
  periodRows.value = generateRows(periodSettings.value);
  periodDirty.value = true;
}

async function handlePeriodSave() {
  if (periodRows.value.length === 0) { ElMessage.error('至少保留一个节次'); return; }
  const names = periodRows.value.map((r) => r.name.trim());
  if (new Set(names).size !== names.length) { ElMessage.error('节次名称不能重复'); return; }
  periodSaving.value = true;
  try {
    const payload = periodRows.value.map((r, i) => ({
      name: r.name.trim(),
      type: r.type,
      sortOrder: i,
      startTime: r.startTime || undefined,
      endTime: r.endTime || undefined
    }));
    const res = await periodSlotApi.replace(payload);
    periodRows.value = res.items.map(slotToRow);
    periodSettings.value = deriveSettings(res.items);
    periodDirty.value = false;
    ElMessage.success('节次配置已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存节次失败');
  } finally {
    periodSaving.value = false;
  }
}

onMounted(() => {
  loadTerms();
  loadVenues();
  loadPeriods();
});
</script>

<style scoped>
.config-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.tab-actions { margin-bottom: 12px; display: flex; justify-content: flex-end; }

/* 节次参数化配置 */
.period-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.period-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.period-section-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}
.period-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.period-preview {
  flex: 1;
  min-width: 0;
}
.period-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.period-type-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.period-name {
  font-size: 12px;
  font-weight: 500;
}
.period-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 1px solid;
  border-radius: 4px;
  padding: 6px 4px;
}
.period-cell-label {
  font-size: 10px;
  font-weight: 500;
}
.period-cell-time {
  font-family: monospace;
  font-size: 10px;
  color: #909399;
}
.period-settings {
  width: 300px;
  flex-shrink: 0;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  padding: 16px;
}
.period-settings-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.count-label {
  width: 56px;
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
}
.count-stepper {
  display: flex;
  align-items: center;
  gap: 6px;
}
.count-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #c0c4cc;
  background: #fff;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}
.count-dot.active {
  border-color: #409eff;
  background: #409eff;
}
.count-dot:hover {
  border-color: #409eff;
}
.time-group {
  margin-bottom: 16px;
}
.time-group-label {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.time-row-label {
  width: 64px;
  flex-shrink: 0;
  font-size: 12px;
  color: #606266;
}
.time-unit {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.period-save-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}
.period-save-btns {
  display: flex;
  gap: 8px;
}
.period-save-btns .el-button {
  flex: 1;
}
.period-help-body p {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
}
.period-help-body p:last-child {
  margin-bottom: 0;
}
</style>
