<!--
  我的学生 Tab（教师）。
  对齐原 React 版 teacher-portraits-tab.tsx（524 行）：
  - 数据源：GET /evaluation/job-ability/results（page/limit 分页，page 从 1 起），全量分页拉取避免 >200 截断；
    同一学生保留达成率最高的一条；
  - 顶部三卡：总学生数 / 当前筛选（班级）/ 匹配结果人数；
  - 左侧导航：搜索（专业/班级/姓名/学号）+「全部班级」+ 按专业分组的班级列表（含人数）；
  - 右侧列表：搜索（姓名/学号）+ 学生卡（等级色条 + 头像 + 等级徽标 + 学号/班级/专业/达成率）
    与三个操作：查看画像（内嵌学生画像）/ 学业成绩（成绩单弹窗）/ 能力档案（能力报告弹窗）；
  - 「查看画像」进入后展示「返回学生列表」+ PortraitTab（同 React 复用学生画像组件）。
-->
<template>
  <!-- 查看某个学生画像 -->
  <div v-if="selectedUserId" class="portrait-wrap">
    <el-button link class="back-btn" @click="selectedUserId = null">
      <el-icon><ArrowLeft /></el-icon>返回学生列表
    </el-button>
    <PortraitTab :user-id="selectedUserId" />
  </div>

  <!-- 加载态 -->
  <SectionCard v-else-if="loading" title="我的学生" :icon="User" icon-color="blue">
    <div class="loading-block">
      <el-icon class="is-loading" :size="28"><Loading /></el-icon>
      <span>正在加载学生数据...</span>
    </div>
  </SectionCard>

  <template v-else>
    <SectionCard title="我的学生" :icon="User" icon-color="blue">
      <!-- 概览三卡 -->
      <div class="stat-grid">
        <div class="stat-card primary">
          <span class="stat-icon primary"><el-icon :size="20"><UserFilled /></el-icon></span>
          <div>
            <p class="stat-label">总学生数</p>
            <p class="stat-value">{{ students.length }}</p>
          </div>
        </div>
        <div class="stat-card primary">
          <span class="stat-icon primary"><el-icon :size="20"><School /></el-icon></span>
          <div>
            <p class="stat-label">当前筛选</p>
            <p class="stat-value">{{ selectedClassName }}</p>
          </div>
        </div>
        <div class="stat-card amber">
          <span class="stat-icon amber"><el-icon :size="20"><Histogram /></el-icon></span>
          <div>
            <p class="stat-label">匹配结果</p>
            <p class="stat-value">{{ filteredStudents.length }} 人</p>
          </div>
        </div>
      </div>

      <div class="portraits-grid">
        <!-- 左侧班级导航 -->
        <div class="nav-col">
          <div class="nav-panel">
            <div class="nav-head">
              <el-input
                v-model="navSearch"
                size="small"
                placeholder="搜索姓名或学号..."
                clearable
                :prefix-icon="Search"
              />
            </div>
            <el-scrollbar class="nav-list">
              <button
                type="button"
                class="nav-all"
                :class="{ active: selectedClass === 'all' }"
                @click="selectedClass = 'all'"
              >
                <span class="nav-dot" :class="{ active: selectedClass === 'all' }" />
                <span>全部班级</span>
                <span class="nav-count">{{ students.length }}</span>
              </button>
              <div class="nav-groups">
                <div v-for="group in groupedByClass" :key="group.major" class="nav-group">
                  <div class="nav-group-title">{{ group.major }}</div>
                  <div class="nav-group-body">
                    <button
                      v-for="cls in group.classes"
                      :key="cls.className"
                      type="button"
                      class="nav-class"
                      :class="{ active: selectedClass === cls.className }"
                      @click="selectedClass = cls.className"
                    >
                      <span class="nav-class-left">
                        <span class="nav-dot" :class="{ active: selectedClass === cls.className }" />
                        <span>{{ cls.className }}</span>
                      </span>
                      <span class="nav-count">{{ cls.count }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </div>

        <!-- 右侧学生列表 -->
        <div class="list-col">
          <el-input
            v-model="searchTerm"
            class="list-search"
            placeholder="搜索姓名或学号..."
            clearable
            :prefix-icon="Search"
          />

          <div v-if="filteredStudents.length === 0" class="empty-block">
            <el-icon :size="44"><Search /></el-icon>
            <p class="empty-title">暂无匹配的学生</p>
            <p class="empty-sub">请尝试调整搜索条件或筛选班级</p>
          </div>

          <el-scrollbar v-else max-height="60vh">
            <div class="student-list">
              <div v-for="student in filteredStudents" :key="student.userId" class="student-card">
                <span class="grade-bar" :style="{ background: gradeBar(student.grade) }" />
                <div class="student-body">
                  <span class="student-avatar">{{ student.name.charAt(0) }}</span>
                  <div class="student-main">
                    <div class="student-row-top">
                      <div class="student-name-row">
                        <span class="student-name">{{ student.name }}</span>
                        <span
                          v-if="student.grade"
                          class="grade-chip"
                          :style="gradeChipStyle(student.grade)"
                        >
                          {{ student.grade }}
                        </span>
                      </div>
                      <div class="student-actions">
                        <el-button size="small" type="primary" @click="selectedUserId = student.userId">
                          <el-icon><View /></el-icon>查看画像
                        </el-button>
                        <el-button size="small" class="act-amber" @click="openGradeReport(student)">
                          <el-icon><Document /></el-icon>学业成绩
                        </el-button>
                        <el-button size="small" class="act-primary" @click="openAbilityProfile(student)">
                          <el-icon><Aim /></el-icon>能力档案
                        </el-button>
                      </div>
                    </div>
                    <div class="student-meta">
                      <el-tag size="small" effect="plain">{{ student.studentNo }}</el-tag>
                      <span class="meta-sep">|</span>
                      <span>{{ student.className }}</span>
                      <span class="meta-sep">|</span>
                      <span>{{ student.majorName }}</span>
                      <span class="meta-sep">|</span>
                      <span>达成率 {{ student.achievementRate.toFixed(1) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </SectionCard>

    <!-- 成绩单弹窗 -->
    <el-dialog v-model="gradeReportOpen" width="520px">
      <template #header>
        <div class="dlg-head">
          <span class="dlg-title amber"><el-icon><Document /></el-icon>查看学生成绩单</span>
          <p class="dlg-desc">
            {{ activeStudent?.name }} · {{ activeStudent?.studentNo }} · {{ activeStudent?.className }}
          </p>
        </div>
      </template>
      <el-table :data="gradeReportRows" size="small">
        <el-table-column prop="label" label="指标" min-width="140" />
        <el-table-column label="数值" min-width="140">
          <template #default="{ row }">
            <span
              v-if="row.label === '认定等级'"
              class="grade-chip"
              :style="gradeChipStyle(activeStudent?.grade)"
            >
              {{ activeStudent?.grade || '-' }}
            </span>
            <template v-else>{{ row.value }}</template>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 能力报告弹窗 -->
    <el-dialog v-model="abilityProfileOpen" width="480px">
      <template #header>
        <div class="dlg-head">
          <span class="dlg-title"><el-icon><Aim /></el-icon>查看学生能力报告</span>
          <p class="dlg-desc">
            {{ activeStudent?.name }} · {{ activeStudent?.majorName }} · {{ activeStudent?.className }}
          </p>
        </div>
      </template>
      <div class="ability-body">
        <template v-if="activeStudent?.abilities?.length">
          <div v-for="(a, i) in activeStudent.abilities" :key="i" class="ability-row">
            <div class="ability-head">
              <span class="ability-name">{{ a.name }}</span>
              <span class="ability-score">{{ a.score.toFixed(1) }}/100</span>
            </div>
            <el-progress :percentage="Math.min(a.score, 100)" :show-text="false" :stroke-width="8" />
          </div>
        </template>
        <p v-else class="empty-line">暂无能力点数据</p>
        <div class="ability-foot">
          <span class="ability-foot-label">综合评级</span>
          <span class="grade-chip" :style="gradeChipStyle(activeStudent?.grade)">
            {{ activeStudent?.grade || '-' }}
          </span>
        </div>
      </div>
    </el-dialog>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Aim,
  ArrowLeft,
  Document,
  Histogram,
  Loading,
  School,
  Search,
  User,
  UserFilled,
  View
} from '@element-plus/icons-vue';
import { jobAbilityResultApi } from '@/api/evaluation';
import type { JobAbilityResult } from '@/types/evaluation';
import SectionCard from './SectionCard.vue';
import PortraitTab from './PortraitTab.vue';

interface StudentRow {
  userId: string;
  name: string;
  studentNo: string;
  className: string;
  majorName: string;
  grade?: string;
  achievementRate: number;
  totalPoints: number;
  achievedPoints: number;
  abilities: { name: string; score: number }[];
}

/** 等级 → 徽标配色（对齐 React gradeColorMap） */
const GRADE_CHIP: Record<string, { color: string; bg: string; border: string }> = {
  卓越: { color: '#047857', bg: '#d1fae5', border: '#a7f3d0' },
  优秀: { color: '#047857', bg: '#d1fae5', border: '#a7f3d0' },
  良好: { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  达标: { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  未达标: { color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
};

/** 等级 → 卡片左侧色条（对齐 React gradeBgMap） */
const GRADE_BAR: Record<string, string> = {
  卓越: 'linear-gradient(180deg, #10b981, #059669)',
  优秀: 'linear-gradient(180deg, #10b981, #059669)',
  良好: 'linear-gradient(180deg, #3b82f6, #2563eb)',
  达标: 'linear-gradient(180deg, #3b82f6, #2563eb)',
  未达标: 'linear-gradient(180deg, #f59e0b, #d97706)'
};

const PAGE_SIZE = 200;
const MAX_PAGES = 1000;

const searchTerm = ref('');
const navSearch = ref('');
const selectedClass = ref<string>('all');
const selectedUserId = ref<string | null>(null);
const gradeReportOpen = ref(false);
const abilityProfileOpen = ref(false);
const activeStudent = ref<StudentRow | null>(null);
const allResults = ref<JobAbilityResult[]>([]);
const loading = ref(true);

const students = computed<StudentRow[]>(() => {
  const map = new Map<string, StudentRow>();
  allResults.value.forEach((r) => {
    const uid = r.userId;
    if (!uid) return;
    const existing = map.get(uid);
    if (existing && existing.achievementRate >= r.achievementRate) return;
    const abilities = Array.isArray(r.abilityPointDetails)
      ? r.abilityPointDetails.map((a) => ({ name: a.abilityPointName || '', score: a.score || 0 }))
      : [];
    map.set(uid, {
      userId: uid,
      name: r.studentName,
      studentNo: r.studentId || '',
      className: r.className || '',
      majorName: r.majorName || '',
      grade: r.grade || undefined,
      achievementRate: r.achievementRate,
      totalPoints: r.totalAbilityPoints,
      achievedPoints: r.achievedAbilityPoints,
      abilities
    });
  });
  return Array.from(map.values());
});

const groupedByClass = computed(() => {
  const majorMap = new Map<string, Map<string, string[]>>();
  students.value.forEach((s) => {
    const major = s.majorName || '未分类';
    if (!majorMap.has(major)) majorMap.set(major, new Map());
    const gradeMap = majorMap.get(major)!;
    const cls = s.className || '未分班';
    if (!gradeMap.has(cls)) gradeMap.set(cls, []);
    const q = navSearch.value.trim().toLowerCase();
    if (
      q &&
      !major.toLowerCase().includes(q) &&
      !cls.toLowerCase().includes(q) &&
      !s.name.toLowerCase().includes(q) &&
      !s.studentNo.toLowerCase().includes(q)
    )
      return;
    gradeMap.get(cls)!.push(s.userId);
  });
  const result: { major: string; classes: { className: string; count: number }[] }[] = [];
  majorMap.forEach((classMap, major) => {
    const classes = Array.from(classMap.entries())
      .map(([className, userIds]) => ({ className, count: userIds.length }))
      .sort((a, b) => a.className.localeCompare(b.className));
    if (classes.length > 0) result.push({ major, classes });
  });
  return result.sort((a, b) => a.major.localeCompare(b.major));
});

const filteredStudents = computed(() => {
  let list = students.value;
  if (selectedClass.value !== 'all') {
    list = list.filter((s) => s.className === selectedClass.value);
  }
  if (searchTerm.value) {
    const q = searchTerm.value.toLowerCase();
    list = list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.studentNo.toLowerCase().includes(q)
    );
  }
  return list;
});

const selectedClassName = computed(() =>
  selectedClass.value === 'all' ? '全部班级' : selectedClass.value
);

const gradeReportRows = computed(() => [
  { label: '总能力点', value: activeStudent.value?.totalPoints ?? '-' },
  { label: '已达成能力点', value: activeStudent.value?.achievedPoints ?? '-' },
  {
    label: '达标率',
    value:
      activeStudent.value != null ? `${activeStudent.value.achievementRate.toFixed(1)}%` : '-'
  },
  { label: '认定等级', value: activeStudent.value?.grade || '-' }
]);

function gradeChipStyle(grade?: string) {
  const conf = GRADE_CHIP[grade || ''] || { color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' };
  return { color: conf.color, backgroundColor: conf.bg, borderColor: conf.border };
}

function gradeBar(grade?: string): string {
  return GRADE_BAR[grade || ''] || 'linear-gradient(180deg, #9ca3af, #6b7280)';
}

function openGradeReport(student: StudentRow) {
  activeStudent.value = student;
  gradeReportOpen.value = true;
}

function openAbilityProfile(student: StudentRow) {
  activeStudent.value = student;
  abilityProfileOpen.value = true;
}

/** 全量分页拉取（对齐 React fetchAllPages：page 从 1 起，页满则继续，超页数熔断） */
async function loadAllResults(): Promise<JobAbilityResult[]> {
  const all: JobAbilityResult[] = [];
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) {
      throw new Error(`分页拉取超过最大页数 ${MAX_PAGES}，疑似分页未生效，已中止`);
    }
    const res = await jobAbilityResultApi.list({ page: page + 1, limit: PAGE_SIZE });
    const items = res.items || [];
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return all;
}

onMounted(async () => {
  try {
    allResults.value = await loadAllResults();
  } catch (e) {
    allResults.value = [];
    ElMessage.error((e as Error).message || '加载学生能力数据失败');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.portrait-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.back-btn {
  align-self: flex-start;
  font-size: 14px;
  color: #6b7280;
}
.back-btn:hover {
  color: #111827;
}
.loading-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 0;
  font-size: 14px;
  color: #6b7280;
}
.loading-block :deep(.el-icon) {
  color: var(--el-color-primary);
}

/* 概览三卡 */
.stat-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
@media (min-width: 640px) {
  .stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid;
  border-radius: 8px;
}
.stat-card.primary {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}
.stat-card.amber {
  border-color: #fde68a;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
}
.stat-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.stat-icon.primary {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
}
.stat-icon.amber {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}
.stat-label {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--el-color-primary);
}
.stat-card.amber .stat-label {
  color: #d97706;
}
.stat-value {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-primary);
}
.stat-card.amber .stat-value {
  color: #b45309;
}

/* 主体两栏 */
.portraits-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}
@media (min-width: 1024px) {
  .portraits-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .nav-col { grid-column: span 3; }
  .list-col { grid-column: span 9; }
}
.nav-panel {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.nav-head {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(90deg, #f9fafb, #fff);
}
.nav-list {
  max-height: calc(100vh - 520px);
  min-height: 240px;
  padding: 8px;
}
.nav-all,
.nav-class {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: #4b5563;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}
.nav-all:hover,
.nav-class:hover {
  background: #f9fafb;
  color: #111827;
}
.nav-all.active,
.nav-class.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
  font-weight: 600;
}
.nav-class {
  justify-content: space-between;
}
.nav-class-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d1d5db;
  flex-shrink: 0;
}
.nav-dot.active {
  background: var(--el-color-primary);
}
.nav-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
}
.nav-all.active .nav-count,
.nav-class.active .nav-count {
  color: var(--el-color-primary);
}
.nav-groups {
  margin-top: 4px;
  border-top: 1px solid #f3f4f6;
  padding-top: 4px;
}
.nav-group {
  margin-bottom: 2px;
}
.nav-group-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}
.nav-group-body {
  margin-left: 12px;
  padding-left: 8px;
  border-left: 2px solid #f3f4f6;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 学生列表 */
.list-search {
  margin-bottom: 16px;
}
.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 64px 0;
  color: #9ca3af;
}
.empty-block :deep(.el-icon) {
  color: #e5e7eb;
  margin-bottom: 8px;
}
.empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
.empty-sub {
  margin: 0;
  font-size: 12px;
}
.empty-line {
  padding: 16px 0;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
}
.student-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
.student-card {
  position: relative;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.student-card:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.grade-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}
.student-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 16px 16px 20px;
}
.student-avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.student-main {
  flex: 1;
  min-width: 0;
}
.student-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.student-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.student-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.grade-chip {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}
.student-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.student-actions :deep(.el-button) {
  margin-left: 0;
}
.act-amber {
  border-color: #fde68a;
  color: #d97706;
}
.act-primary {
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}
.student-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}
.meta-sep {
  color: #d1d5db;
}

/* 弹窗 */
.dlg-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dlg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.dlg-title :deep(.el-icon) {
  color: var(--el-color-primary);
}
.dlg-title.amber :deep(.el-icon) {
  color: #d97706;
}
.dlg-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.ability-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ability-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ability-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.ability-name {
  font-weight: 500;
  color: #4b5563;
}
.ability-score {
  font-weight: 600;
  color: #111827;
}
.ability-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
  font-size: 14px;
}
.ability-foot-label {
  color: #6b7280;
}
</style>
