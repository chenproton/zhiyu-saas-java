<!--
  我的场景/课程 Tab（教师）。
  对齐原 React 版 teacher-courses-tab.tsx（1176 行）：
  - 数据源：GET /portal/workspace/dashboard?role=teacher（classPlans / classSessions）；
  - 顶部学期切换（classPlans.term 去重，默认第一个学期）；
  - 左侧课程/场景导航（首字方块 + 班级徽标 + 混合课程/实践场景徽标 + 节次数），默认选中首个；
  - 右侧「节次列表」：课程头（班级 / 状态 / 类型徽标 / 人数·学期·任课教师 + 课程期末总评）+
    节次卡网格（已上/未上、周次、节次、场地、点击查看操作）；
  - 节次气泡：已关联节次/任务 + 修改关联、前往备课·导学准备、上课·前往导学、前往评分、教学进展/测评进展；
  - 弹窗：课程数据（CourseDetailDialog）、关联备课（PrepAssociateDialog）、混合课评分（HybridGradingDialog）。
-->
<template>
  <div class="teacher-courses">
    <!-- 学期切换 -->
    <div v-if="semesters.length > 0" class="term-bar">
      <el-radio-group v-model="selectedTerm" size="default">
        <el-radio-button v-for="term in semesters" :key="term" :value="term">
          <el-icon><Calendar /></el-icon>
          {{ term }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="courses-grid">
      <!-- 左侧课程/场景导航 -->
      <div class="nav-col">
        <div class="nav-panel">
          <div class="nav-head">
            <h3 class="nav-title">课程/场景</h3>
            <p class="nav-sub">共 {{ termPlans.length }} 个</p>
          </div>
          <el-scrollbar class="nav-list">
            <button
              v-for="plan in termPlans"
              :key="plan.id"
              type="button"
              class="nav-item"
              :class="{ active: selectedPlanId === plan.id }"
              @click="selectedPlanId = plan.id"
            >
              <span class="nav-avatar" :class="planIsHybrid(plan) ? 'hybrid' : 'scene'">
                {{ plan.course.charAt(0) }}
              </span>
              <span class="nav-text">
                <span class="nav-course">{{ plan.course }}</span>
                <span class="nav-badges">
                  <el-tag size="small" effect="plain">{{ plan.name }}</el-tag>
                  <el-tag
                    size="small"
                    :type="planIsHybrid(plan) ? 'primary' : 'success'"
                    effect="dark"
                  >
                    {{ planIsHybrid(plan) ? '混合课程' : '实践场景' }}
                  </el-tag>
                </span>
                <span class="nav-meta">{{ sessionsOf(plan.id).length }} 个节次</span>
              </span>
            </button>
            <div v-if="termPlans.length === 0" class="empty-line">当前学期暂无课程/场景</div>
          </el-scrollbar>
        </div>
      </div>

      <!-- 右侧节次内容 -->
      <div class="main-col">
        <SectionCard title="节次列表" :icon="Calendar" icon-color="blue">
          <div v-if="!selectedPlan" class="empty-block">
            <el-icon :size="44"><Reading /></el-icon>
            <p>请从左侧选择课程/场景</p>
          </div>

          <div v-else class="plan-card" :class="planIsHybrid(selectedPlan) ? 'hybrid' : 'scene'">
            <!-- 课程头部 -->
            <div class="plan-head">
              <div class="plan-head-left">
                <span class="plan-avatar" :class="planIsHybrid(selectedPlan) ? 'hybrid' : 'scene'">
                  {{ selectedPlan.course.charAt(0) }}
                </span>
                <div class="plan-info">
                  <div class="plan-title-row">
                    <h3 class="plan-course">{{ selectedPlan.course }}</h3>
                    <el-tag size="small" effect="plain">{{ selectedPlan.name }}</el-tag>
                    <span class="status-chip" :style="statusStyle(selectedPlan.status)">
                      {{ selectedPlan.status === 'active' ? '已开课' : '待开课' }}
                    </span>
                    <el-tag
                      size="small"
                      :type="planIsHybrid(selectedPlan) ? 'primary' : 'success'"
                      effect="dark"
                    >
                      {{ planIsHybrid(selectedPlan) ? '混合课程' : '实践场景' }}
                    </el-tag>
                  </div>
                  <p class="plan-meta">
                    {{ selectedPlan.students }}人 · {{ selectedPlan.term }} · 任课教师：{{
                      selectedPlan.teacher
                    }}
                  </p>
                </div>
              </div>
              <el-button
                size="small"
                :type="planIsHybrid(selectedPlan) ? 'primary' : 'success'"
                @click="openCourseDetail(selectedPlan, 'final')"
              >
                <el-icon><TrendCharts /></el-icon>课程期末总评
              </el-button>
            </div>

            <!-- 节次列表 -->
            <div v-if="selectedSessions.length > 0" class="session-block">
              <div class="session-summary">
                <span class="dot done" />已上 {{ doneCount }} 节
                <span class="dot pending" />未上 {{ pendingCount }} 节
                <span class="sep">·</span>
                共 {{ selectedSessions.length }} 个节次
              </div>

              <div class="session-grid">
                <el-popover
                  v-for="session in selectedSessions"
                  :key="session.id"
                  placement="right"
                  trigger="click"
                  :width="288"
                  :show-arrow="false"
                  popper-class="teacher-session-popover"
                >
                  <template #reference>
                    <div
                      class="session-card"
                      :class="[
                        planIsHybrid(selectedPlan) ? 'hybrid' : 'scene',
                        session.status === 'associated' ? 'done' : 'pending'
                      ]"
                    >
                      <div class="session-top">
                        <span class="session-badge">
                          {{ session.status === 'associated' ? '已上' : '未上' }}
                        </span>
                        <span class="session-weekday">{{ session.weekday }}</span>
                      </div>
                      <div class="session-week">第 {{ session.week }} 周</div>
                      <div class="session-period">{{ shortPeriod(session.period) }}</div>
                      <div v-if="session.venue" class="session-venue">
                        <el-icon><Location /></el-icon>{{ session.venue }}
                      </div>
                      <div class="session-hint">点击查看操作</div>
                    </div>
                  </template>

                  <!-- 节次气泡 -->
                  <div class="pop-body">
                    <div class="pop-head">
                      <span class="pop-title">
                        第 {{ session.week }} 周 · {{ session.weekday }} {{ session.period }}
                      </span>
                      <el-tag
                        size="small"
                        :type="session.status === 'associated' ? 'primary' : 'info'"
                        effect="light"
                      >
                        {{ session.status === 'associated' ? '已上' : '未上' }}
                      </el-tag>
                    </div>
                    <div class="pop-venue">
                      <el-icon><Location /></el-icon><span>{{ session.venue }}</span>
                    </div>

                    <div
                      v-if="prepAssociations[session.id]?.subItems.length"
                      class="assoc-block"
                    >
                      <span class="assoc-title">
                        {{ planIsHybrid(selectedPlan) ? '已关联节次' : '已关联任务' }}（{{
                          prepAssociations[session.id].subItems.length
                        }}）
                      </span>
                      <div class="assoc-list">
                        <div
                          v-for="si in prepAssociations[session.id].subItems"
                          :key="si.id"
                          class="assoc-item"
                        >
                          {{ si.name }}
                        </div>
                      </div>
                      <el-button link size="small" @click="openPrepDialog(selectedPlan, session)">
                        修改关联
                      </el-button>
                    </div>

                    <span class="pop-label">操作</span>
                    <div class="pop-actions">
                      <el-button
                        size="small"
                        :class="planIsHybrid(selectedPlan) ? 'act-primary' : 'act-emerald'"
                        @click="openPrepDialog(selectedPlan, session)"
                      >
                        <el-icon><Link /></el-icon>
                        {{ planIsHybrid(selectedPlan) ? '前往备课' : '导学准备' }}
                      </el-button>
                      <el-button
                        size="small"
                        :class="planIsHybrid(selectedPlan) ? 'act-primary' : 'act-emerald'"
                        :disabled="!planLearnUrl(selectedPlan)"
                        @click="goLearn(selectedPlan)"
                      >
                        <el-icon><VideoPlay /></el-icon>
                        {{ planIsHybrid(selectedPlan) ? '上课' : '前往导学' }}
                      </el-button>
                      <el-button size="small" class="act-amber" @click="goGrade(selectedPlan, session)">
                        <el-icon><School /></el-icon>前往评分
                      </el-button>
                    </div>

                    <div class="pop-foot">
                      <span class="pop-label">数据查看</span>
                      <div class="pop-actions">
                        <el-button
                          link
                          size="small"
                          :class="planIsHybrid(selectedPlan) ? 'link-primary' : 'link-emerald'"
                          @click="openCourseDetail(selectedPlan, 'tracking')"
                        >
                          <el-icon><TrendCharts /></el-icon>教学进展
                        </el-button>
                        <el-button
                          link
                          size="small"
                          class="link-primary"
                          @click="openCourseDetail(selectedPlan, 'assessment')"
                        >
                          <el-icon><DocumentChecked /></el-icon>测评进展
                        </el-button>
                      </div>
                    </div>
                  </div>
                </el-popover>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>

    <CourseDetailDialog
      v-model:open="courseDialogOpen"
      :course="courseDetailTarget"
      :tab="courseDetailTab"
    />
    <PrepAssociateDialog
      v-model:open="prepDialogOpen"
      :plan-id="prepPlanId"
      :plan-name="prepPlanName"
      :is-hybrid="prepIsHybrid"
      :current-sub-item-ids="prepAssociations[prepSessionId]?.subItems.map((s) => s.id)"
      :prep-url="prepUrl"
      @confirm="handlePrepConfirm"
    />
    <HybridGradingDialog
      v-model:open="hybridGradeDialogOpen"
      :session-title="hybridGradeSessionTitle"
      :class-name="hybridGradeClassName"
      :course-id="hybridGradeCourseId"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Calendar,
  DocumentChecked,
  Link,
  Location,
  Reading,
  School,
  TrendCharts,
  VideoPlay
} from '@element-plus/icons-vue';
import { courseApi } from '@/api/lesson';
import SectionCard from './SectionCard.vue';
import CourseDetailDialog from './CourseDetailDialog.vue';
import PrepAssociateDialog from './PrepAssociateDialog.vue';
import HybridGradingDialog from './HybridGradingDialog.vue';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspaceClassPlan, WorkspaceClassSession } from './workspace-api';
import type {
  CourseDetailTab,
  CourseDetailTarget,
  PrepAssociationRecord,
  PrepSubItem
} from './workspace-teacher-types';
import { HYBRID_PREP_URL, SCENE_PREP_URL } from './workspace-teacher-types';
import { getStatusConfig, lessonLandingHref, sceneLandingHref } from './workspace-utils';

withDefaults(defineProps<{ prepAssociations?: Record<string, PrepAssociationRecord> }>(), {
  prepAssociations: () => ({})
});

const emit = defineEmits<{ associate: [sessionId: string, record: PrepAssociationRecord] }>();

const router = useRouter();

const classPlans = ref<WorkspaceClassPlan[]>([]);
const classSessions = ref<WorkspaceClassSession[]>([]);
const selectedTerm = ref('');
const selectedPlanId = ref<string | null>(null);

/* 弹窗状态 */
const courseDialogOpen = ref(false);
const courseDetailTarget = ref<CourseDetailTarget | null>(null);
const courseDetailTab = ref<CourseDetailTab>('tracking');

const prepDialogOpen = ref(false);
const prepPlanId = ref('');
const prepSessionId = ref('');
const prepPlanName = ref('');
const prepIsHybrid = ref(true);
const prepUrl = ref('');

const hybridGradeDialogOpen = ref(false);
const hybridGradeSessionTitle = ref('');
const hybridGradeClassName = ref('');
const hybridGradeCourseId = ref<string | undefined>(undefined);

const semesters = computed(() =>
  Array.from(new Set(classPlans.value.map((p) => p.term).filter(Boolean)))
);

const termPlans = computed(() => classPlans.value.filter((p) => p.term === selectedTerm.value));

const selectedPlan = computed(
  () => termPlans.value.find((p) => p.id === selectedPlanId.value) || null
);

const selectedSessions = computed(() =>
  selectedPlan.value ? sessionsOf(selectedPlan.value.id) : []
);

const doneCount = computed(
  () => selectedSessions.value.filter((s) => s.status === 'associated').length
);
const pendingCount = computed(
  () => selectedSessions.value.filter((s) => s.status === 'pending').length
);

// 学期集合到位后默认选中第一个学期（对齐 React semesters effect）
watch(semesters, (list) => {
  if (list.length > 0 && !list.includes(selectedTerm.value)) selectedTerm.value = list[0];
});

// 学期或计划集合变化后保持/回落选中项（对齐 React termPlans effect）
watch(
  termPlans,
  (list) => {
    if (selectedPlanId.value && list.some((p) => p.id === selectedPlanId.value)) return;
    selectedPlanId.value = list[0]?.id || null;
  },
  { immediate: true }
);

function sessionsOf(planId: string): WorkspaceClassSession[] {
  return classSessions.value.filter((s) => s.courseId === planId).sort((a, b) => a.week - b.week);
}

function planIsHybrid(plan: WorkspaceClassPlan): boolean {
  return !!plan.courseId;
}

/** WorkspaceClassPlan 上游无资源版本字段，链接不带 v（最新快照语义） */
function planLearnUrl(plan: WorkspaceClassPlan): string {
  if (plan.courseId) return lessonLandingHref(plan.courseId);
  return plan.scenarioId ? sceneLandingHref(plan.scenarioId) : '';
}

function shortPeriod(period: string): string {
  return period.replace('上午 ', '上').replace('下午 ', '下');
}

function statusStyle(status: string) {
  const conf = getStatusConfig(status === 'active' ? 'published' : 'pending');
  return { color: conf.color, backgroundColor: conf.bg };
}

function openCourseDetail(plan: WorkspaceClassPlan, tab: CourseDetailTab) {
  courseDetailTarget.value = {
    id: plan.id,
    name: plan.course,
    className: plan.name,
    students: plan.students
  };
  courseDetailTab.value = tab;
  courseDialogOpen.value = true;
}

function openPrepDialog(plan: WorkspaceClassPlan, session: WorkspaceClassSession) {
  prepPlanId.value = plan.id;
  prepSessionId.value = session.id;
  prepPlanName.value = plan.course;
  prepIsHybrid.value = planIsHybrid(plan);
  prepUrl.value = planIsHybrid(plan) ? HYBRID_PREP_URL : SCENE_PREP_URL;
  prepDialogOpen.value = true;
}

function handlePrepConfirm(subItems: PrepSubItem[]) {
  emit('associate', prepSessionId.value, {
    planId: prepPlanId.value,
    subItems: subItems.map((s) => ({ id: s.id, name: s.name }))
  });
}

function goLearn(plan: WorkspaceClassPlan) {
  const url = planLearnUrl(plan);
  if (url) void router.push(url);
}

async function goGrade(plan: WorkspaceClassPlan, session: WorkspaceClassSession) {
  // 场景 plan → 场景任务评价
  if (!plan.courseId && plan.scenarioId) {
    void router.push('/evaluation/scene-results');
    return;
  }
  // 有课程 id：混合课保留考勤评分，体系课/颗粒课进课程节点测评评分
  if (plan.courseId) {
    try {
      const course = await courseApi.get(plan.courseId);
      if (course.type === 'hybrid') {
        hybridGradeSessionTitle.value = `第 ${session.week} 周 · ${session.weekday} ${session.period}`;
        hybridGradeClassName.value = plan.name;
        hybridGradeCourseId.value = plan.courseId;
        hybridGradeDialogOpen.value = true;
        return;
      }
    } catch {
      // 课程查询失败按非混合课处理
    }
  }
  void router.push(
    plan.courseId
      ? `/evaluation/lesson-results?courseId=${plan.courseId}`
      : '/evaluation/lesson-results'
  );
}

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get({ role: 'teacher' });
    classPlans.value = res.classPlans || [];
    classSessions.value = res.classSessions || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载开课计划失败');
  }
});
</script>

<style scoped>
.teacher-courses {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.term-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.courses-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}
@media (min-width: 1024px) {
  .courses-grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }
  .nav-col { grid-column: span 3; }
  .main-col { grid-column: span 9; }
}

/* 左侧导航 */
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
.nav-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.nav-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.nav-list {
  max-height: calc(100vh - 320px);
  padding: 8px;
}
.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.nav-item:hover {
  background: #f9fafb;
}
.nav-item.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.nav-avatar,
.plan-avatar {
  flex-shrink: 0;
  border-radius: 8px;
  color: #fff;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.nav-avatar {
  width: 36px;
  height: 36px;
  font-size: 14px;
}
.plan-avatar {
  width: 40px;
  height: 40px;
  font-size: 18px;
}
.nav-avatar.hybrid,
.plan-avatar.hybrid {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
}
.nav-avatar.scene,
.plan-avatar.scene {
  background: linear-gradient(135deg, #10b981, #0d9488);
}
.nav-text {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-course {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-item.active .nav-course {
  color: var(--el-color-primary);
}
.nav-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.nav-meta {
  font-size: 12px;
  color: #9ca3af;
}
.nav-item.active .nav-meta {
  color: var(--el-color-primary);
}
.empty-line {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 0;
  color: #9ca3af;
  font-size: 14px;
}
.empty-block :deep(.el-icon) {
  color: #e5e7eb;
}

/* 课程卡 */
.plan-card {
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.plan-card.hybrid {
  border-color: var(--el-color-primary-light-8);
}
.plan-card.scene {
  border-color: #d1fae5;
}
.plan-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.plan-card.hybrid .plan-head {
  background: linear-gradient(90deg, var(--el-color-primary-light-9), #fff);
}
.plan-card.scene .plan-head {
  background: linear-gradient(90deg, #ecfdf5, #f0fdfa);
}
@media (min-width: 640px) {
  .plan-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.plan-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.plan-info {
  min-width: 0;
}
.plan-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.plan-course {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.status-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.plan-meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}

/* 节次 */
.session-block {
  padding: 8px 16px 20px;
}
.session-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #9ca3af;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}
.dot.done {
  background: var(--el-color-primary);
}
.dot.pending {
  background: #d1d5db;
  margin-left: 12px;
}
.sep {
  color: #d1d5db;
  margin: 0 4px;
}
.session-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (min-width: 640px) {
  .session-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .session-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .session-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
.session-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
.session-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: scale(1.02);
}
.session-card.hybrid.done {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-8);
}
.session-card.scene.done {
  background: #ecfdf5;
  border-color: #a7f3d0;
}
.session-top {
  display: flex;
  align-items: center;
  gap: 4px;
}
.session-badge {
  font-size: 10px;
  line-height: 16px;
  padding: 0 4px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #6b7280;
  font-weight: 500;
}
.session-card.hybrid.done .session-badge {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.session-card.scene.done .session-badge {
  border-color: #6ee7b7;
  color: #059669;
}
.session-weekday,
.session-period,
.session-venue {
  font-size: 10px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-venue {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
}
.session-week {
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-hint {
  font-size: 10px;
  font-weight: 500;
  color: var(--el-color-primary);
}

/* 节次气泡 */
.pop-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pop-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}
.pop-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.pop-venue {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.assoc-block {
  border: 1px solid var(--el-color-primary-light-8);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.assoc-title {
  font-size: 10px;
  font-weight: 500;
  color: var(--el-color-primary);
}
.assoc-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 80px;
  overflow-y: auto;
}
.assoc-item {
  font-size: 12px;
  color: #374151;
  padding-left: 8px;
  border-left: 2px solid var(--el-color-primary-light-7);
}
.pop-label {
  font-size: 10px;
  color: #9ca3af;
}
.pop-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pop-actions :deep(.el-button) {
  flex: 1;
  font-size: 10px;
  margin-left: 0;
}
.act-primary {
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}
.act-emerald {
  border-color: #a7f3d0;
  color: #059669;
}
.act-amber {
  border-color: #fde68a;
  color: #d97706;
}
.pop-foot {
  border-top: 1px dashed #e5e7eb;
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.link-primary {
  color: var(--el-color-primary);
}
.link-emerald {
  color: #059669;
}
</style>
