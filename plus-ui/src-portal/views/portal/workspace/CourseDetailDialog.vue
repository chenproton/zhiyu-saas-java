<!--
  课程/节次数据弹窗：教学进展（tracking）/ 测评进展（assessment）/ 课程期末总评（final）。
  对齐原 React 版 teacher-courses-tab.tsx 的
  CourseDetailDialog + TrackingView / AssessmentView / FinalView。

  数据说明：React 侧三视图数据全部来自 _data/workspace-teacher-types.ts 的占位常量
  （已清空为 0 / 空数组，等真实接口），Vue 侧同源保持空值与 0，展示结构一一对位；
  React 用 recharts 画的柱状/折线图，Vue 门户不引入新依赖，空数据下按「暂无数据」占位。
-->
<template>
  <el-dialog
    :model-value="open"
    width="65%"
    top="4vh"
    class="course-detail-dialog"
    @update:model-value="(v: boolean) => emit('update:open', v)"
  >
    <template #header>
      <div class="dlg-title">
        <el-icon><Reading /></el-icon>
        <span class="course-name">{{ course?.name }}</span>
        <el-tag v-if="course?.className" size="small" effect="plain">{{ course?.className }}</el-tag>
        <el-tag size="small" type="info" effect="light">{{ course?.students ?? 0 }}人</el-tag>
        <el-tag size="small" type="primary" effect="light">{{ viewTitle }}</el-tag>
      </div>
    </template>

    <el-scrollbar max-height="70vh">
      <!-- ===== 节次教学进展 ===== -->
      <div v-if="tab === 'tracking'" class="view-body">
        <div class="metric-grid five">
          <div class="metric-card blue">
            <el-icon><UserFilled /></el-icon>
            <div>
              <p class="metric-label">应到人数</p>
              <p class="metric-value">{{ signInData.total }}</p>
            </div>
          </div>
          <div class="metric-card green">
            <el-icon><CircleCheck /></el-icon>
            <div>
              <p class="metric-label">实到/迟到/缺勤</p>
              <p class="metric-value">
                {{ signInData.present }}
                <span class="metric-sub">/{{ signInData.late }}/{{ signInData.absent }}</span>
              </p>
            </div>
          </div>
          <div class="metric-card purple">
            <el-icon><Tickets /></el-icon>
            <div>
              <p class="metric-label">随堂测验均分</p>
              <p class="metric-value">{{ quizAvgScore }}</p>
            </div>
          </div>
          <div class="metric-card amber">
            <el-icon><Lightning /></el-icon>
            <div>
              <p class="metric-label">抢答参与率</p>
              <p class="metric-value">0%</p>
            </div>
          </div>
          <div class="metric-card cyan">
            <el-icon><ChatDotSquare /></el-icon>
            <div>
              <p class="metric-label">课堂互动次数</p>
              <p class="metric-value">{{ CLASS_INTERACTION_COUNT }}</p>
            </div>
          </div>
        </div>

        <div class="panel-grid">
          <div class="panel">
            <h4 class="panel-title">每日签到统计</h4>
            <div v-if="signInDaily.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="d in signInDaily" :key="d.date" class="bar-row">
                <span class="bar-label">{{ d.date }}</span>
                <span class="bar-value">实到 {{ d.present }} · 迟到 {{ d.late }} · 缺勤 {{ d.absent }}</span>
              </div>
            </div>
          </div>
          <div class="panel">
            <h4 class="panel-title">出勤率趋势</h4>
            <div v-if="attendanceRateData.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="a in attendanceRateData" :key="a.name" class="progress-row">
                <div class="progress-head">
                  <span>{{ a.name }}</span>
                  <span class="progress-num">{{ a.rate }}%</span>
                </div>
                <el-progress :percentage="a.rate" :show-text="false" :stroke-width="6" />
              </div>
            </div>
          </div>
        </div>

        <div class="panel-grid">
          <div class="panel">
            <h4 class="panel-title">课堂抢答排行</h4>
            <div v-if="rushAnswerRanking.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="rank-list">
              <div v-for="r in rushAnswerRanking" :key="r.rank" class="rank-row">
                <div class="rank-left">
                  <span class="rank-no" :class="{ top: r.rank <= 3 }">
                    <el-icon v-if="r.rank === 1"><Trophy /></el-icon>
                    <template v-else>{{ r.rank }}</template>
                  </span>
                  <span class="rank-name">{{ r.name }}</span>
                  <el-tag v-if="r.badge" size="small" type="info" effect="light">{{ r.badge }}</el-tag>
                </div>
                <span class="rank-meta">正确 {{ r.correctCount }} 题 · {{ r.avgTime }}</span>
              </div>
            </div>
          </div>
          <div class="panel">
            <h4 class="panel-title">课堂互动参与度</h4>
            <div v-if="classInteraction.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="item in classInteraction" :key="item.name" class="progress-row">
                <div class="progress-head">
                  <span>{{ item.name }}</span>
                  <span class="progress-num">{{ item.active }}/{{ item.total }} 次</span>
                </div>
                <el-progress
                  :percentage="item.total > 0 ? Math.round((item.active / item.total) * 100) : 0"
                  :show-text="false"
                  :stroke-width="6"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="panel table-panel">
          <h4 class="panel-title">学生课中学习明细</h4>
          <el-table :data="studentDetails.slice(0, 6)" size="small" empty-text="暂无数据">
            <el-table-column prop="name" label="姓名" min-width="90" />
            <el-table-column label="出勤率" min-width="90">
              <template #default="{ row }">{{ row.attendance }}%</template>
            </el-table-column>
            <el-table-column prop="quizAvg" label="测验均分" min-width="90" />
            <el-table-column prop="interaction" label="互动次数" min-width="90" />
            <el-table-column prop="praise" label="表扬次数" min-width="90" />
            <el-table-column label="综合评价" min-width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="gradeTagType(row.grade)" effect="light">
                  {{ row.grade }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- ===== 节次测评进展 ===== -->
      <div v-else-if="tab === 'assessment'" class="view-body">
        <div class="panel-grid">
          <div class="panel">
            <h4 class="panel-title">课后作业提交</h4>
            <div v-if="homeworkSubmissions.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="hw in homeworkSubmissions" :key="hw.id" class="progress-row">
                <div class="progress-head">
                  <span class="progress-name">{{ hw.name }}</span>
                  <el-tag size="small" :type="rateTagType(hw.submitRate)" effect="light">
                    {{ hw.submitRate }}%
                  </el-tag>
                </div>
                <el-progress :percentage="hw.submitRate" :show-text="false" :stroke-width="6" />
                <div class="progress-foot">
                  <span>已提交 {{ Math.round((hw.total * hw.submitRate) / 100) }}/{{ hw.total }} 人</span>
                  <span v-if="hw.submitRate >= 70">均分 {{ hw.avgScore }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="panel">
            <h4 class="panel-title">作业提交率趋势</h4>
            <div v-if="homeworkTrend.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="t in homeworkTrend" :key="t.week" class="progress-row">
                <div class="progress-head">
                  <span>{{ t.week }}</span>
                  <span class="progress-num">{{ t.rate }}%</span>
                </div>
                <el-progress :percentage="t.rate" :show-text="false" :stroke-width="6" />
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h4 class="panel-title">单元测验分数分布</h4>
          <div v-if="scoredHomework.length === 0" class="empty-line">暂无数据</div>
          <div v-else class="dist-grid">
            <div v-for="hw in scoredHomework" :key="hw.id" class="dist-card">
              <h5 class="dist-title">{{ hw.name }}</h5>
              <div class="dist-line"><span>提交率</span><span class="strong">{{ hw.submitRate }}%</span></div>
              <div class="dist-line">
                <span>平均分</span><span class="strong primary">{{ hw.avgScore }}/100</span>
              </div>
              <div class="dist-bars">
                <div v-for="seg in SCORE_SEGMENTS" :key="seg.label" class="dist-bar-row">
                  <span class="dist-bar-label">{{ seg.label }}</span>
                  <span class="dist-bar-track">
                    <span
                      class="dist-bar-fill"
                      :style="{ width: `${seg.width}%`, backgroundColor: seg.color }"
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h4 class="panel-title">互评互判统计</h4>
          <div class="metric-grid three">
            <div class="stat-tile blue">
              <div class="stat-value">{{ peerReviewStats.totalGroups }}</div>
              <div class="stat-label">总小组数</div>
            </div>
            <div class="stat-tile green">
              <div class="stat-value">{{ peerReviewStats.avgPeerScore }}</div>
              <div class="stat-label">平均互评得分</div>
            </div>
            <div class="stat-tile purple">
              <div class="stat-value">{{ peerReviewStats.completionRate }}%</div>
              <div class="stat-label">完成率</div>
            </div>
          </div>
          <div v-if="peerReviewStats.steps.length === 0" class="empty-line">暂无互评环节数据</div>
          <div v-else class="bar-list step-list">
            <div v-for="step in peerReviewStats.steps" :key="step.name" class="progress-row">
              <div class="progress-head">
                <span>{{ step.name }}</span>
                <span class="progress-num">权重 {{ step.weight }}% · 均分 {{ step.avgScore }}</span>
              </div>
              <el-progress :percentage="step.avgScore" :show-text="false" :stroke-width="6" />
            </div>
          </div>
        </div>

        <div class="panel table-panel">
          <h4 class="panel-title">实训报告统计</h4>
          <el-table :data="trainingReports" size="small" empty-text="暂无数据">
            <el-table-column prop="name" label="报告名称" min-width="140" />
            <el-table-column label="已提交/总数" min-width="110">
              <template #default="{ row }">{{ row.submitted }}/{{ row.total }}</template>
            </el-table-column>
            <el-table-column label="提交率" min-width="90">
              <template #default="{ row }">{{ row.rate }}%</template>
            </el-table-column>
            <el-table-column label="平均分" min-width="90">
              <template #default="{ row }">{{ row.avgScore > 0 ? row.avgScore : '-' }}</template>
            </el-table-column>
            <el-table-column label="评价" min-width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="ratingTagType(row.rating)" effect="light">
                  {{ row.rating }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- ===== 课程期末总评 ===== -->
      <div v-else class="view-body">
        <div class="metric-grid six">
          <div class="stat-tile blue">
            <div class="stat-value">{{ semesterSummary.totalSessions }}</div>
            <div class="stat-label">课程节次</div>
          </div>
          <div class="stat-tile green">
            <div class="stat-value">{{ semesterSummary.avgAttendance }}%</div>
            <div class="stat-label">平均出勤率</div>
          </div>
          <div class="stat-tile purple">
            <div class="stat-value">{{ semesterSummary.compositeAvgScore }}</div>
            <div class="stat-label">综合评测均分</div>
          </div>
          <div class="stat-tile amber">
            <div class="stat-value">{{ semesterSummary.totalStudents }}</div>
            <div class="stat-label">总学生数</div>
          </div>
          <div class="stat-tile cyan">
            <div class="stat-value">{{ semesterSummary.dataCollectionRate }}%</div>
            <div class="stat-label">数据采集率</div>
          </div>
          <div class="stat-tile rose">
            <div class="stat-value">{{ semesterSummary.needAttention }}</div>
            <div class="stat-label">需关注学生</div>
          </div>
        </div>

        <div class="panel-grid">
          <div class="panel">
            <h4 class="panel-title">过程性考核维度</h4>
            <div v-if="assessmentDimensions.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="dim in assessmentDimensions.slice(0, 6)" :key="dim.id" class="progress-row">
                <div class="progress-head">
                  <span>
                    {{ dim.name }}
                    <el-tag size="small" effect="plain">{{ dim.category }}</el-tag>
                  </span>
                  <span class="progress-num">{{ dim.avgScore > 0 ? dim.avgScore : '-' }}</span>
                </div>
                <el-progress :percentage="dim.avgScore" :show-text="false" :stroke-width="6" />
              </div>
            </div>
          </div>
          <div class="panel">
            <h4 class="panel-title">综合成绩分布</h4>
            <div v-if="compositeDistribution.length === 0" class="empty-line">暂无数据</div>
            <div v-else class="bar-list">
              <div v-for="c in compositeDistribution" :key="c.range" class="bar-row">
                <span class="bar-label">{{ c.range }}</span>
                <span class="bar-value">{{ c.count }} 人</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel table-panel">
          <h4 class="panel-title">学生综合排名</h4>
          <el-table :data="studentRanking" size="small" empty-text="暂无数据">
            <el-table-column prop="rank" label="排名" width="70" align="center" />
            <el-table-column prop="name" label="姓名" min-width="90" />
            <el-table-column label="出勤" min-width="80">
              <template #default="{ row }">{{ row.attendance }}%</template>
            </el-table-column>
            <el-table-column prop="inClassQuiz" label="随堂测验" min-width="90" />
            <el-table-column prop="homework" label="课后作业" min-width="90" />
            <el-table-column prop="peerReview" label="互评" min-width="80" />
            <el-table-column prop="report" label="实训报告" min-width="90" />
            <el-table-column label="总评" min-width="80">
              <template #default="{ row }"><span class="total-score">{{ row.total }}</span></template>
            </el-table-column>
            <el-table-column label="等级" min-width="80">
              <template #default="{ row }">
                <span class="grade-chip" :style="gradeChipStyle(row.grade)">{{ row.grade }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-scrollbar>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  ChatDotSquare,
  CircleCheck,
  Lightning,
  Reading,
  Tickets,
  Trophy,
  UserFilled
} from '@element-plus/icons-vue';
import {
  CLASS_INTERACTION_COUNT,
  GRADE_COLOR_MAP,
  assessmentDimensions,
  attendanceRateData,
  classInteraction,
  compositeDistribution,
  homeworkSubmissions,
  homeworkTrend,
  peerReviewStats,
  quizResults,
  rushAnswerRanking,
  semesterSummary,
  signInData,
  signInDaily,
  studentDetails,
  studentRanking,
  trainingReports
} from './workspace-teacher-types';
import type { CourseDetailTab, CourseDetailTarget } from './workspace-teacher-types';

const props = defineProps<{
  open: boolean;
  course: CourseDetailTarget | null;
  tab: CourseDetailTab;
}>();

const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const TITLE_MAP: Record<string, string> = {
  tracking: '节次教学进展',
  assessment: '节次测评进展',
  final: '课程教学进展分析'
};

/** 单元测验分数分布分段（对齐 React 内联占位分段） */
const SCORE_SEGMENTS = [
  { label: '90-100', width: 35, color: '#22c55e' },
  { label: '80-89', width: 30, color: '#3b82f6' },
  { label: '70-79', width: 20, color: '#f59e0b' },
  { label: '60-69', width: 10, color: '#f97316' },
  { label: '<60', width: 5, color: '#ef4444' }
];

const viewTitle = computed(() => TITLE_MAP[props.tab] || '');

const quizAvgScore = computed(() =>
  quizResults.length > 0
    ? Math.round(quizResults.reduce((s, q) => s + q.avgScore, 0) / quizResults.length)
    : 0
);

const scoredHomework = computed(() => homeworkSubmissions.filter((hw) => hw.avgScore > 0));

function gradeTagType(grade: string): 'primary' | 'info' | 'danger' {
  if (grade === '优秀') return 'primary';
  if (grade === '良好') return 'info';
  return 'danger';
}

function rateTagType(rate: number): 'primary' | 'info' | 'danger' {
  if (rate >= 90) return 'primary';
  if (rate >= 70) return 'info';
  return 'danger';
}

function ratingTagType(rating: string): 'primary' | 'info' | 'danger' {
  if (rating === '良好') return 'primary';
  if (rating === '待提交') return 'danger';
  return 'info';
}

function gradeChipStyle(grade: string) {
  const conf = GRADE_COLOR_MAP[grade] || { color: '#374151', bg: '#f3f4f6' };
  return { color: conf.color, backgroundColor: conf.bg };
}
</script>

<style scoped>
.dlg-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.dlg-title :deep(.el-icon) {
  color: var(--el-color-primary);
}
.course-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.view-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 8px;
}

/* 指标卡 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 768px) {
  .metric-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric-grid.five { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .metric-grid.six { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
.metric-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid;
}
.metric-card.blue { background: #eff6ff; border-color: #dbeafe; color: #2563eb; }
.metric-card.green { background: #f0fdf4; border-color: #dcfce7; color: #16a34a; }
.metric-card.purple { background: #f5f3ff; border-color: #ede9fe; color: #7c3aed; }
.metric-card.amber { background: #fffbeb; border-color: #fef3c7; color: #d97706; }
.metric-card.cyan { background: #ecfeff; border-color: #cffafe; color: #0891b2; }
.metric-label {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.metric-value {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}
.metric-sub {
  font-size: 13px;
  font-weight: 400;
  color: #9ca3af;
}

/* 面板 */
.panel-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 1024px) {
  .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.panel {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}
.panel.table-panel {
  padding: 16px 0 0;
  overflow: hidden;
}
.panel-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.panel.table-panel .panel-title {
  padding: 0 16px;
}
.empty-line {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
.bar-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #374151;
}
.bar-label {
  color: #6b7280;
}
.bar-value {
  font-weight: 500;
}
.progress-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}
.progress-name {
  font-weight: 500;
}
.progress-num {
  font-size: 12px;
  color: #9ca3af;
}
.progress-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #9ca3af;
}
.step-list {
  margin-top: 12px;
}

/* 抢答排行 */
.rank-list {
  display: flex;
  flex-direction: column;
}
.rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
}
.rank-row:last-child {
  border-bottom: none;
}
.rank-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rank-no {
  width: 20px;
  font-size: 12px;
  font-weight: 700;
  color: #9ca3af;
}
.rank-no.top {
  color: #f59e0b;
}
.rank-name {
  font-size: 14px;
  color: #374151;
}
.rank-meta {
  font-size: 12px;
  color: #9ca3af;
}

/* 分数分布 */
.dist-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 768px) {
  .dist-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.dist-card {
  padding: 12px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  background: #f9fafb;
}
.dist-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.dist-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}
.dist-line .strong {
  font-weight: 600;
  color: #111827;
}
.dist-line .strong.primary {
  color: var(--el-color-primary);
}
.dist-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}
.dist-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
}
.dist-bar-label {
  width: 44px;
  color: #9ca3af;
}
.dist-bar-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #f3f4f6;
  overflow: hidden;
}
.dist-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
}

/* 统计小格 */
.stat-tile {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid;
  text-align: center;
}
.stat-tile.blue { background: #eff6ff; border-color: #dbeafe; color: #2563eb; }
.stat-tile.green { background: #f0fdf4; border-color: #dcfce7; color: #16a34a; }
.stat-tile.purple { background: #f5f3ff; border-color: #ede9fe; color: #7c3aed; }
.stat-tile.amber { background: #fffbeb; border-color: #fef3c7; color: #d97706; }
.stat-tile.cyan { background: #ecfeff; border-color: #cffafe; color: #0891b2; }
.stat-tile.rose { background: #fff1f2; border-color: #ffe4e6; color: #e11d48; }
.stat-value {
  font-size: 20px;
  font-weight: 700;
}
.stat-label {
  font-size: 11px;
  margin-top: 2px;
}
.total-score {
  font-weight: 700;
  color: var(--el-color-primary);
}
.grade-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
</style>
