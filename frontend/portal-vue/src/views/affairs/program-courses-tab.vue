<template>
  <div class="courses-tab">
    <p class="courses-summary">共 {{ courseCount }} 项，合计 {{ totalCredits }} 学分</p>

    <el-table v-loading="loading" :data="rows" row-key="key" stripe class="courses-table">
      <el-table-column label="关联对象" min-width="380">
        <template #default="{ row }">
          <!-- 岗位关联：类型 + 岗位选择 + 场景提示 -->
          <div v-if="row.linkType === 'position'" class="link-cell">
            <div class="link-row">
              <el-select
                :model-value="row.linkType"
                class="link-type-select"
                @update:model-value="(v: unknown) => onLinkTypeChange(row, v)"
              >
                <el-option label="未关联" value="none" />
                <el-option label="岗位" value="position" />
                <el-option label="体系课" value="course" />
              </el-select>
              <el-select
                :model-value="row.positionId"
                filterable
                clearable
                class="link-target-select"
                placeholder="搜索岗位..."
                @update:model-value="(v: unknown) => onPositionSelect(row, v)"
              >
                <el-option v-for="p in positions" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </div>
            <div v-if="row.positionId" class="scenario-hint">
              <span v-if="loadingPosScen[row.positionId]">加载中...</span>
              <span v-else-if="(positionScenariosMap[row.positionId] || []).length > 0">
                包含 {{ (positionScenariosMap[row.positionId] || []).length }} 个场景：{{
                  (positionScenariosMap[row.positionId] || []).map((s) => s.name).join('、')
                }}
              </span>
              <span v-else>该岗位下暂无已发布场景</span>
            </div>
          </div>
          <!-- 体系课关联：类型 + 体系课选择 -->
          <div v-else-if="row.linkType === 'course'" class="link-row">
            <el-select
              :model-value="row.linkType"
              class="link-type-select"
              @update:model-value="(v: unknown) => onLinkTypeChange(row, v)"
            >
              <el-option label="未关联" value="none" />
              <el-option label="岗位" value="position" />
              <el-option label="体系课" value="course" />
            </el-select>
            <el-select
              :model-value="row.courseId"
              filterable
              clearable
              class="link-target-select"
              placeholder="搜索体系课..."
              @update:model-value="(v: unknown) => onCourseSelect(row, v)"
            >
              <el-option v-for="c in systemCourses" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </div>
          <!-- 未关联 -->
          <div v-else class="link-row">
            <el-select
              :model-value="row.linkType"
              class="link-type-select"
              placeholder="类型"
              @update:model-value="(v: unknown) => onLinkTypeChange(row, v)"
            >
              <el-option label="未关联" value="none" />
              <el-option label="岗位" value="position" />
              <el-option label="体系课" value="course" />
            </el-select>
            <span class="none-mark">-</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="编码" width="120">
        <template #default="{ row }">
          <span class="code-text">{{ row.code || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="学分" width="90">
        <template #default="{ row }">
          <el-input
            :model-value="row.credits"
            class="cell-input"
            type="number"
            min="0"
            step="0.5"
            @update:model-value="(v: unknown) => updateRow(row.key, { credits: Number(v) || 0 })"
          />
        </template>
      </el-table-column>
      <el-table-column label="总学时" width="90">
        <template #default="{ row }">
          <el-input
            :model-value="row.hours"
            class="cell-input"
            type="number"
            min="0"
            @update:model-value="(v: unknown) => updateRow(row.key, { hours: Number(v) || 0 })"
          />
        </template>
      </el-table-column>
      <el-table-column label="性质" width="100">
        <template #default="{ row }">
          <el-select
            :model-value="row.nature"
            class="cell-select"
            @update:model-value="(v: unknown) => updateRow(row.key, { nature: v as string })"
          >
            <el-option v-for="n in NATURE_OPTIONS" :key="n" :label="n" :value="n" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="right">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="removeRow(row.key)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <span>{{ loading ? '加载中...' : '暂无，点击「添加岗位/课程」开始设置' }}</span>
      </template>
    </el-table>

    <!-- 批量导入向导：下载模板 → 上传文件 -->
    <el-dialog
      v-model="importOpen"
      title="导入方案课程"
      width="560px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @closed="resetImport"
    >
      <div v-if="importStep === 'download'" class="import-guide">
        <p class="import-guide-title">操作指引</p>
        <ol class="import-guide-list">
          <li>点击下方按钮下载最新的导入模板</li>
          <li>参照模板中 Sheet 的填写说明，填入方案课程数据</li>
          <li>完成后点击“下一步”上传文件</li>
        </ol>
        <el-button class="import-download-btn" :loading="downloading" @click="downloadTemplate">
          {{ downloading ? '下载中...' : '下载方案课程批量导入模板' }}
        </el-button>
      </div>
      <div v-else class="import-upload">
        <div v-if="importFiles.length > 0" class="import-file-list">
          <div v-for="(f, i) in importFiles" :key="i" class="import-file-item">
            <span class="import-file-name">{{ f.name }}</span>
            <el-button link type="danger" size="small" @click="removeImportFile(i)">移除</el-button>
          </div>
        </div>
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx"
          :on-change="onImportFileChange"
        >
          <div class="import-dropzone">
            <p>{{ importFiles.length > 0 ? '继续添加文件' : '点击选择已填写的 Excel (.xlsx) 文件' }}</p>
          </div>
        </el-upload>
      </div>
      <template #footer>
        <el-button :disabled="importing" @click="resetImportAndClose">取消</el-button>
        <el-button v-if="importStep === 'upload'" link @click="importStep = 'download'">上一步</el-button>
        <el-button v-if="importStep === 'download'" type="primary" @click="importStep = 'upload'">下一步</el-button>
        <el-button
          v-else
          type="primary"
          :loading="importing"
          :disabled="importFiles.length === 0"
          @click="onImportClick"
        >
          {{ importing ? '导入中...' : `开始导入（${importFiles.length} 个文件）` }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入重复确认：检测到重复记录时选择处理方式 -->
    <el-dialog
      v-model="confirmOpen"
      :title="confirmTitle"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <p class="confirm-desc">
        请确认处理方式：仅导入新数据不会覆盖已有记录；覆盖并继续会用文件内容替换已有记录。
      </p>
      <div class="confirm-stats">
        <div class="confirm-stat">
          <span class="stat-num stat-green">{{ importPreview?.created ?? 0 }}</span>
          <span class="stat-label">新增</span>
        </div>
        <div class="confirm-stat">
          <span class="stat-num stat-amber">{{ importPreview?.duplicates ?? 0 }}</span>
          <span class="stat-label">已存在</span>
        </div>
        <div class="confirm-stat">
          <span class="stat-num stat-red">{{ importPreview?.failed ?? 0 }}</span>
          <span class="stat-label">校验失败</span>
        </div>
      </div>
      <div v-if="confirmItems.length > 0" class="confirm-items">
        <p class="confirm-items-title">已存在记录示例（前 {{ confirmItems.length }} 条）</p>
        <ul class="confirm-items-list">
          <li v-for="(item, i) in confirmItems" :key="i" class="confirm-item">
            <span class="confirm-item-name">{{ item.name || item.key }}</span>
            <span v-if="item.rowNum != null" class="confirm-item-row">第 {{ item.rowNum }} 行</span>
          </li>
          <li v-if="confirmHasMore" class="confirm-item-more">等共 {{ importPreview?.duplicates ?? 0 }} 条</li>
        </ul>
      </div>
      <template #footer>
        <el-button :disabled="confirming" @click="confirmOpen = false">取消</el-button>
        <el-button type="primary" :loading="confirming" @click="onConfirmSkip">仅导入新数据</el-button>
        <el-button type="primary" :loading="confirming" @click="onConfirmOverwrite">覆盖并继续</el-button>
      </template>
    </el-dialog>

    <!-- 保存合并确认：加载时同岗位多条关联被折叠为一行，保存前提示风险 -->
    <el-dialog v-model="collapseConfirmOpen" title="保存将合并岗位课程关联" width="480px">
      <div class="collapse-confirm">
        <p>检测到以下岗位存在多条课程关联（可能由批量导入产生）：</p>
        <ul class="collapse-confirm-list">
          <li v-for="c in collapseConfirmInfo" :key="c.pid">{{ c.name || c.pid }}：{{ c.count }} 条</li>
        </ul>
        <p>保存后每个岗位的多条关联将合并为一条，其余记录的学分/学时等配置将丢失。是否继续保存？</p>
      </div>
      <template #footer>
        <el-button @click="collapseConfirmOpen = false">取消</el-button>
        <el-button type="danger" @click="confirmCollapseSave">仍要保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadFile, UploadInstance } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import { programApi } from '@/api/affairs';
import { positionApi } from '@/api/job';
import { courseApi } from '@/api/lesson';
import { scenarioApi } from '@/api/scene';
import { authedFetch } from '@/api/http';
import type { TrainingProgramCoursePayload } from '@/types/affairs';
import type { Course } from '@/types/lesson';
import type { CareerPosition } from '@/types/job';
import type { Scenario } from '@/types/scene';

const NATURE_OPTIONS = ['必修', '选修', '实践', '场景'];

type LinkType = 'none' | 'position' | 'course';

interface CourseRow {
  key: string;
  name: string;
  code: string;
  credits: number;
  hours: number;
  nature: string;
  linkType: LinkType;
  courseId: string;
  positionId: string;
}

interface ProgramCourseImportPreview {
  created: number;
  duplicates: number;
  failed: number;
  duplicateItems: { rowNum?: number; key?: string; name?: string }[];
  errors: string[];
}

function emptyRow(key: string, position = false): CourseRow {
  return {
    key,
    name: '',
    code: '',
    credits: 0,
    hours: 0,
    nature: '必修',
    linkType: position ? 'position' : 'none',
    courseId: '',
    positionId: ''
  };
}

const props = defineProps<{ programId: string }>();
const emit = defineEmits<{ 'busy-change': [state: { saving: boolean; loading: boolean }] }>();

const rows = ref<CourseRow[]>([]);
const systemCourses = ref<Course[]>([]);
const positions = ref<CareerPosition[]>([]);
const positionScenariosMap = reactive<Record<string, Scenario[]>>({});
const loadingPosScen = reactive<Record<string, boolean>>({});
const loading = ref(true);
const saving = ref(false);
// 加载时同岗位多条关联被合并为一行：记录各岗位合并前的条数，保存前提示折叠风险
const positionMergedCounts = reactive<Record<string, number>>({});
const collapseConfirmOpen = ref(false);
const collapseConfirmInfo = ref<{ pid: string; name: string; count: number }[]>([]);

// 批量导入状态
const importOpen = ref(false);
const importStep = ref<'download' | 'upload'>('download');
const importing = ref(false);
const downloading = ref(false);
const importFiles = ref<File[]>([]);
const uploadRef = ref<UploadInstance>();
const confirmOpen = ref(false);
const confirming = ref(false);
const pendingFiles = ref<File[]>([]);
const importPreview = ref<ProgramCourseImportPreview | null>(null);

watch(
  () => [saving.value, loading.value],
  () => emit('busy-change', { saving: saving.value, loading: loading.value }),
  { immediate: true }
);

// 请求序号：programId 快速切换时丢弃过期响应
let loadSeq = 0;

async function loadCourses() {
  const seq = ++loadSeq;
  // 开头置 loading：切换 programId 重载时表格立即进入加载态，避免短暂显示上一个方案的旧数据
  loading.value = true;
  try {
    const res = await programApi.listCourses(props.programId);
    const loadedRows: CourseRow[] = res.items.map((c) => ({
      key: c.id,
      name: c.name,
      code: c.code || '',
      credits: c.credits,
      hours: c.hours,
      nature: c.nature || '必修',
      linkType: c.positionId ? 'position' : c.courseId ? 'course' : 'none',
      courseId: c.courseId || '',
      positionId: c.positionId || ''
    }));
    const posIds = [...new Set(loadedRows.filter((r) => r.positionId).map((r) => r.positionId))];
    // 并行拉取各岗位场景（避免岗位多时串行逐条请求拉长加载时间）；结果统一在 seq 校验后写入，
    // 避免快速切换 programId 时旧岗位的场景数据覆盖新数据
    const scenResults = await Promise.all(
      posIds.map(async (pid) => {
        try {
          const s = await scenarioApi.list({ careerPositionId: pid, status: 'published', limit: 200 });
          return { pid, items: s.items } as const;
        } catch {
          return { pid, items: null } as const;
        }
      })
    );
    if (seq !== loadSeq) return;

    const grouped = new Map<string, CourseRow[]>();
    const regular: CourseRow[] = [];
    loadedRows.forEach((r) => {
      if (r.linkType === 'position' && r.positionId) {
        const g = grouped.get(r.positionId) || [];
        g.push(r);
        grouped.set(r.positionId, g);
      } else {
        regular.push(r);
      }
    });
    const displayRows: CourseRow[] = [];
    // 记录各岗位合并前的原始条数（>1 表示保存会折叠多条关联，需在保存前提示）
    const mergedCounts: Record<string, number> = {};
    grouped.forEach((v, pid) => {
      displayRows.push({
        ...v[0],
        key: `pos-${pid}`, // 稳定 key：避免每次加载生成新 key 导致整行 remount
        linkType: 'position',
        positionId: pid
      });
      if (v.length > 1) mergedCounts[pid] = v.length;
    });
    const scenMap: Record<string, Scenario[]> = {};
    scenResults.forEach((r) => {
      if (r.items) scenMap[r.pid] = r.items;
    });
    Object.assign(positionScenariosMap, scenMap);
    displayRows.push(...regular);
    rows.value = displayRows;
    Object.keys(positionMergedCounts).forEach((k) => delete positionMergedCounts[k]);
    Object.assign(positionMergedCounts, mergedCounts);
  } catch (e) {
    ElMessage.error((e as Error).message || '查询课程设置失败');
  } finally {
    loading.value = false;
  }
}

async function loadPositions() {
  try {
    const r = await positionApi.list({ status: 'published', limit: 200 });
    positions.value = r.items;
  } catch {
    /* 选项加载失败不阻断 */
  }
}

async function loadSystemCourses() {
  try {
    const r = await courseApi.list({ type: 'system', status: 'published', limit: 200 });
    systemCourses.value = r.items;
  } catch {
    /* 选项加载失败不阻断 */
  }
}

async function fetchPositionScenarios(positionId: string): Promise<Scenario[]> {
  if (positionScenariosMap[positionId]) return positionScenariosMap[positionId];
  loadingPosScen[positionId] = true;
  try {
    const res = await scenarioApi.list({ careerPositionId: positionId, status: 'published', limit: 200 });
    positionScenariosMap[positionId] = res.items || [];
    return res.items || [];
  } catch {
    return [];
  } finally {
    delete loadingPosScen[positionId];
  }
}

function updateRow(key: string, patch: Partial<CourseRow>) {
  rows.value = rows.value.map((r) => (r.key === key ? { ...r, ...patch } : r));
}

function addRow() {
  rows.value = [emptyRow(`new-${Date.now()}-${rows.value.length}`, true), ...rows.value];
}

function removeRow(key: string) {
  rows.value = rows.value.filter((r) => r.key !== key);
}

function onLinkTypeChange(row: CourseRow, v: unknown) {
  updateRow(row.key, { linkType: v as LinkType, positionId: '', courseId: '' });
}

function onPositionSelect(row: CourseRow, v: unknown) {
  void handlePositionChange(row.key, String(v || ''));
}

async function handlePositionChange(rowKey: string, newPositionId: string) {
  if (!newPositionId || newPositionId === 'none') {
    updateRow(rowKey, { positionId: '' });
    return;
  }
  updateRow(rowKey, { positionId: newPositionId });
  void fetchPositionScenarios(newPositionId);
}

function onCourseSelect(row: CourseRow, v: unknown) {
  const cid = String(v || '');
  const course = systemCourses.value.find((c) => c.id === cid);
  updateRow(row.key, {
    courseId: cid,
    name: course ? course.name : row.name,
    code: course ? course.code || '' : row.code,
    hours: course ? course.onlineHours || 0 : row.hours
  });
}

const courseCount = computed(() => {
  let n = 0;
  rows.value.forEach((r) => {
    if (r.linkType === 'position' && r.positionId) {
      n += (positionScenariosMap[r.positionId] || []).length;
    } else if (r.linkType !== 'none' && (r.courseId || r.positionId)) {
      n++;
    }
  });
  return n;
});

const totalCredits = computed(() => {
  let s = 0;
  rows.value.forEach((r) => {
    s +=
      (r.credits || 0) *
      (r.linkType === 'position' && r.positionId
        ? (positionScenariosMap[r.positionId] || []).length || 1
        : 1);
  });
  return s;
});

async function performSave() {
  saving.value = true;
  try {
    const payloads: TrainingProgramCoursePayload[] = [];
    rows.value.forEach((r, i) => {
      if (r.linkType === 'position' && r.positionId) {
        payloads.push({
          name: '',
          credits: r.credits || 0,
          hours: r.hours || 0,
          semester: 1,
          nature: r.nature,
          positionId: r.positionId,
          courseId: undefined,
          sortOrder: i * 1000
        });
      } else if (r.linkType === 'course' && r.courseId) {
        payloads.push({
          name: '',
          code: (r.code || '').trim() || undefined,
          credits: r.credits || 0,
          hours: r.hours || 0,
          semester: 1,
          nature: r.nature,
          positionId: undefined,
          courseId: r.courseId,
          sortOrder: i * 1000
        });
      }
    });
    await programApi.saveCourses(props.programId, payloads);
    ElMessage.success('已保存');
    await loadCourses();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存课程设置失败');
  } finally {
    saving.value = false;
  }
}

async function handleSave() {
  // 保存前区分原有分组行与新分组行：加载时同岗位多条关联被合并为一行，
  // 直接保存会把多条折叠为一条，其余记录的学分/学时等配置丢失 —— 先提示确认
  const affected = rows.value.filter(
    (r) => r.linkType === 'position' && r.positionId && (positionMergedCounts[r.positionId] || 0) > 1
  );
  const unique = [...new Map(affected.map((r) => [r.positionId as string, r])).values()];
  if (unique.length > 0) {
    collapseConfirmInfo.value = unique.map((r) => ({
      pid: r.positionId as string,
      name: positions.value.find((p) => p.id === r.positionId)?.name || r.name,
      count: positionMergedCounts[r.positionId as string] || 0
    }));
    collapseConfirmOpen.value = true;
    return;
  }
  await performSave();
}

async function confirmCollapseSave() {
  collapseConfirmOpen.value = false;
  await performSave();
}

// ---------- 批量导入 ----------

async function downloadTemplate() {
  downloading.value = true;
  try {
    const res = await authedFetch('/templates/program-courses');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      ElMessage.error((data as { error?: string }).error || `下载失败（${res.status}）`);
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '方案课程批量导入模板.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    ElMessage.error((e as Error).message || '模板下载失败');
  } finally {
    downloading.value = false;
  }
}

function onImportFileChange(file: UploadFile) {
  const raw = file.raw;
  if (!raw) return;
  const dup = importFiles.value.some((f) => f.name + '_' + f.size === raw.name + '_' + raw.size);
  if (!dup) importFiles.value = [...importFiles.value, raw];
}

function removeImportFile(index: number) {
  importFiles.value = importFiles.value.filter((_, i) => i !== index);
  uploadRef.value?.clearFiles();
}

function resetImport() {
  importStep.value = 'download';
  importFiles.value = [];
  pendingFiles.value = [];
  importPreview.value = null;
  uploadRef.value?.clearFiles();
}

function resetImportAndClose() {
  importOpen.value = false;
  resetImport();
}

async function onImportClick() {
  if (importFiles.value.length === 0) return;
  importing.value = true;
  try {
    const ok = await handleImport(importFiles.value);
    if (ok) {
      importOpen.value = false;
      resetImport();
    }
  } finally {
    importing.value = false;
  }
}

async function handleImport(files: File[]): Promise<boolean> {
  if (files.length === 0) return false;
  try {
    const form = new FormData();
    files.forEach((f) => form.append('file', f));
    const previewRes = await authedFetch(
      `/import/program-courses/preview?programId=${encodeURIComponent(props.programId)}`,
      { method: 'POST', body: form }
    );
    if (!previewRes.ok) {
      // 预览失败时提示真实的服务端错误，不静默降级到直接导入
      const data = await previewRes.json().catch(() => ({}));
      ElMessage.error((data as { error?: string }).error || '预览失败：请检查文件格式');
      return false;
    }
    const preview = (await previewRes.json()) as ProgramCourseImportPreview;
    if (preview.duplicates > 0) {
      pendingFiles.value = files;
      importPreview.value = preview;
      confirmOpen.value = true;
      return false;
    }
    return await doImport(files, false);
  } catch (e) {
    ElMessage.error((e as Error).message || '请检查文件格式');
    return false;
  }
}

async function doImport(files: File[], overwrite: boolean): Promise<boolean> {
  const form = new FormData();
  files.forEach((f) => form.append('file', f));
  try {
    const res = await authedFetch(
      `/import/program-courses/excel?programId=${encodeURIComponent(props.programId)}&overwrite=${overwrite}`,
      { method: 'POST', body: form }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const created = (data as { created?: number }).created || 0;
      const failed = (data as { failed?: number }).failed || 0;
      ElMessage.success(`导入成功：共导入 ${created} 门课程${failed ? `，${failed} 条失败` : ''}`);
      await loadCourses();
      return true;
    }
    ElMessage.error((data as { error?: string }).error || '导入失败：请检查文件格式');
    return false;
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败：请检查文件格式');
    return false;
  }
}

async function onConfirmOverwrite() {
  confirmOpen.value = false;
  const ok = await doImport(pendingFiles.value, true);
  if (ok) {
    pendingFiles.value = [];
    importPreview.value = null;
    importOpen.value = false;
    resetImport();
  }
}

async function onConfirmSkip() {
  confirmOpen.value = false;
  const ok = await doImport(pendingFiles.value, false);
  if (ok) {
    pendingFiles.value = [];
    importPreview.value = null;
    importOpen.value = false;
    resetImport();
  }
}

const confirmTitle = computed(() => `检测到 ${importPreview.value?.duplicates ?? 0} 条已存在方案课程`);
const confirmItems = computed(() => importPreview.value?.duplicateItems?.slice(0, 10) || []);
const confirmHasMore = computed(() => (importPreview.value?.duplicateItems?.length || 0) > 10);

onMounted(() => {
  loadCourses();
  loadPositions();
  loadSystemCourses();
});

defineExpose({
  handleSave,
  addRow,
  openImport: () => {
    importOpen.value = true;
  }
});
</script>

<style scoped>
.courses-tab { width: 100%; }
.courses-summary { margin: 0 0 12px; font-size: 13px; color: #909399; }
.courses-table { width: 100%; }
.link-cell { display: flex; flex-direction: column; gap: 4px; }
.link-row { display: flex; align-items: center; gap: 8px; }
.link-type-select { width: 88px; flex-shrink: 0; }
.link-target-select { flex: 1; min-width: 0; }
.none-mark { color: #909399; font-size: 13px; }
.scenario-hint { padding-left: 4px; font-size: 12px; color: #909399; line-height: 1.5; }
.code-text { font-size: 13px; color: #909399; }
.cell-input { width: 70px; }
.cell-select { width: 100%; }

.import-guide-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.import-guide-list { margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #606266; line-height: 1.8; }
.import-download-btn { width: 100%; }
.import-file-list { margin-bottom: 12px; }
.import-file-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border: 1px solid #e4e7ed; border-radius: 4px; margin-bottom: 8px;
}
.import-file-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.import-dropzone {
  border: 1px dashed #dcdfe6; border-radius: 4px; padding: 24px; text-align: center;
  color: #909399; font-size: 13px; cursor: pointer;
}
.import-dropzone:hover { border-color: #409eff; color: #409eff; }

.confirm-desc { margin: 0 0 12px; font-size: 13px; color: #606266; line-height: 1.6; }
.confirm-stats { display: flex; gap: 12px; margin-bottom: 12px; }
.confirm-stat {
  flex: 1; border: 1px solid #e4e7ed; border-radius: 4px; padding: 10px; text-align: center;
}
.stat-num { display: block; font-size: 16px; font-weight: 600; }
.stat-label { font-size: 12px; color: #909399; }
.stat-green { color: #67c23a; }
.stat-amber { color: #e6a23c; }
.stat-red { color: #f56c6c; }
.confirm-items-title { margin: 0 0 8px; font-size: 13px; color: #909399; }
.confirm-items-list {
  margin: 0; padding: 8px 12px; border: 1px solid #e4e7ed; border-radius: 4px;
  max-height: 160px; overflow-y: auto; list-style: none;
}
.confirm-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f2f3f5;
}
.confirm-item:last-child { border-bottom: none; }
.confirm-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
.confirm-item-row { font-size: 12px; color: #909399; flex-shrink: 0; margin-left: 8px; }
.confirm-item-more { padding: 6px 0; font-size: 12px; color: #909399; text-align: center; }

.collapse-confirm { font-size: 13px; color: #606266; line-height: 1.8; }
.collapse-confirm p { margin: 0 0 8px; }
.collapse-confirm-list { margin: 0 0 8px; padding-left: 20px; }
</style>
