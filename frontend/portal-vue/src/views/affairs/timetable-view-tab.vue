<template>
  <div class="tt-page">
    <el-empty
      v-if="!term"
      description="请先在顶部选择学期（无学期时请先在「教务基础配置」中创建）"
      :image-size="80"
      class="tt-empty"
    />

    <template v-else>
      <!-- 工具行 -->
      <div class="tt-toolbar">
        <div class="tt-tools">
          <!-- 视角切换 -->
          <div class="tt-switch-group">
            <button
              v-for="m in viewModes"
              :key="m.key"
              type="button"
              class="tt-switch-btn"
              :class="{ active: viewMode === m.key }"
              @click="viewMode = m.key"
            >
              {{ m.label }}
            </button>
          </div>

          <!-- 状态切换：草稿 / 已发布 -->
          <div class="tt-switch-group">
            <button
              v-for="s in viewStatuses"
              :key="s.key"
              type="button"
              class="tt-switch-btn"
              :class="{ active: viewStatus === s.key }"
              @click="viewStatus = s.key"
            >
              {{ s.label }}
            </button>
          </div>

          <!-- 班级 / 教师选择 -->
          <el-tree-select
            v-if="viewMode === 'class'"
            v-model="classNodeId"
            :data="classTreeData"
            node-key="value"
            :props="{ label: 'label', children: 'children' }"
            check-strictly
            placeholder="选择班级"
            style="width: 220px"
            clearable
          />
          <el-select v-else v-model="teacherId" placeholder="选择教师" style="width: 220px" clearable>
            <el-option v-for="t in teachers" :key="t.id" :label="t.workId ? `${t.name}（${t.workId}）` : t.name" :value="t.id" />
          </el-select>

          <!-- 周次筛选 -->
          <el-select v-model="week" style="width: 130px">
            <el-option label="全部周次" value="all" />
            <el-option v-for="w in term.weeksCount || 16" :key="w" :label="`第 ${w} 周`" :value="String(w)" />
          </el-select>

          <span v-if="version != null" class="tt-version-badge">已发布版本 v{{ version }}</span>
        </div>

        <el-button type="primary" @click="publishOpen = true">
          <el-icon class="btn-icon"><Promotion /></el-icon>发布课表
        </el-button>
      </div>

      <!-- 课表网格（只读） -->
      <div class="tt-grid-card">
        <ScheduleGrid
          :entries="entries"
          :period-slots="periodSlots"
          :week="week && week !== 'all' ? Number(week) : undefined"
          :loading="loading"
          :empty-text="gridEmptyText"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Promotion } from '@element-plus/icons-vue';
import { periodSlotApi, scheduleApi } from '@/api/affairs';
import type { AffairsTerm, PeriodSlot, ScheduleEntry } from '@/types/affairs';
import ScheduleGrid from './schedule-grid.vue';

// 班级/教师双视角周课表（对齐 React scheduling/_components/timetable-view-tab.tsx）

export interface ClassTreeNode {
  value: string;
  label: string;
  typeId?: string;
  children?: ClassTreeNode[];
}

const props = defineProps<{
  term: AffairsTerm | null;
  classTreeData: ClassTreeNode[];
  teachers: { id: string; name: string; workId?: string }[];
}>();

type ViewMode = 'class' | 'teacher';
type ViewStatus = 'draft' | 'published';

const viewModes: { key: ViewMode; label: string }[] = [
  { key: 'class', label: '班级视图' },
  { key: 'teacher', label: '教师视图' }
];
const viewStatuses: { key: ViewStatus; label: string }[] = [
  { key: 'draft', label: '草稿' },
  { key: 'published', label: '已发布' }
];

const viewMode = ref<ViewMode>('class');
const viewStatus = ref<ViewStatus>('draft');
const classNodeId = ref<string | undefined>(undefined);
const teacherId = ref('');
const week = ref('all');
const entries = ref<ScheduleEntry[]>([]);
const version = ref<number | null>(null);
const loading = ref(false);
const periodSlots = ref<PeriodSlot[]>([]);
const publishOpen = ref(false);
const publishing = ref(false);

// 默认填充：未选择班级/教师时自动选中第一个班级节点或第一位教师，保证课表有数据可看
// （classTreeData 已由父级过滤为仅含班级节点或其祖先，叶子即班级）
const firstClassNodeId = computed<string | undefined>(() => {
  const walk = (nodes: ClassTreeNode[]): string | undefined => {
    for (const node of nodes) {
      if (!node.children || node.children.length === 0) return node.value;
      const found = walk(node.children);
      if (found) return found;
    }
    return undefined;
  };
  return walk(props.classTreeData);
});

watch(
  [() => props.term, viewMode, classNodeId, teacherId, () => props.teachers],
  () => {
    if (!props.term) return;
    if (viewMode.value === 'class' && !classNodeId.value && firstClassNodeId.value) {
      classNodeId.value = firstClassNodeId.value;
    }
    if (viewMode.value === 'teacher' && !teacherId.value && props.teachers.length > 0) {
      teacherId.value = props.teachers[0].id;
    }
  },
  { immediate: true }
);

async function loadTimetable() {
  if (!props.term) return;
  const params =
    viewMode.value === 'class'
      ? classNodeId.value
        ? { termId: props.term.id, classNodeId: classNodeId.value, status: viewStatus.value }
        : null
      : teacherId.value
        ? { termId: props.term.id, teacherId: teacherId.value, status: viewStatus.value }
        : null;
  if (!params) {
    entries.value = [];
    version.value = null;
    return;
  }
  loading.value = true;
  try {
    const res = await scheduleApi.timetable(params);
    entries.value = res.items ?? [];
    version.value = res.version ?? null;
  } catch (e) {
    ElMessage.error((e as Error).message || '查询课表失败');
  } finally {
    loading.value = false;
  }
}

watch(
  [() => props.term, viewMode, viewStatus, classNodeId, teacherId],
  () => {
    void loadTimetable();
  },
  { immediate: true }
);

async function loadPeriodSlots() {
  try {
    const res = await periodSlotApi.list({ limit: 100 });
    periodSlots.value = res.items;
  } catch {
    // 节次缺失时网格自动从排课数据推导行，无需提示
  }
}
void loadPeriodSlots();

const gridEmptyText = computed(() => {
  if (viewMode.value === 'class') {
    return classNodeId.value ? '该班级当前学期暂无已发布课表' : '请选择班级查看课表';
  }
  return teacherId.value ? '该教师当前学期暂无已发布课表' : '请选择教师查看课表';
});

async function handlePublish() {
  if (!props.term) return;
  publishing.value = true;
  try {
    const res = await scheduleApi.publish(props.term.id);
    ElMessage.success(`已发布 ${res.published} 条排课（版本 v${res.version}），学生/教师工作台已可见`);
    publishOpen.value = false;
    await loadTimetable();
  } catch (e) {
    ElMessage.error((e as Error).message || '发布课表失败');
  } finally {
    publishing.value = false;
  }
}

async function confirmPublish() {
  if (!props.term) return;
  try {
    await ElMessageBox.confirm(
      `确定发布「${props.term.name}」的全部草稿排课吗？发布后版本号 +1，学生/教师工作台即可查看。`,
      '发布课表',
      { type: 'warning', confirmButtonText: '确认发布' }
    );
  } catch {
    return;
  }
  await handlePublish();
}
</script>

<style scoped>
.tt-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tt-empty {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 48px 0;
}
.tt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.tt-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.tt-switch-group {
  display: flex;
  align-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 2px;
  background: #fff;
}
.tt-switch-btn {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}
.tt-switch-btn:hover {
  color: #303133;
}
.tt-switch-btn.active {
  background: #409eff;
  color: #fff;
}
.tt-version-badge {
  background: rgba(64, 158, 255, 0.08);
  color: #409eff;
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.tt-grid-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
}
.btn-icon {
  margin-right: 4px;
}
</style>
