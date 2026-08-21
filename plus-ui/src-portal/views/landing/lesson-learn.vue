<template>
  <div class="landing">
    <!-- ===== 加载中 ===== -->
    <template v-if="loading">
      <div class="skeleton-block skeleton-header" />
      <div class="ll-body">
        <div class="skeleton-block ll-skeleton-side" />
        <div class="skeleton-block ll-skeleton-main" />
      </div>
    </template>

    <!-- ===== 课程不存在 ===== -->
    <div v-else-if="!course" class="ll-empty">
      <el-icon :size="64" class="ll-empty-icon"><Reading /></el-icon>
      <p class="ll-empty-title">课程不存在</p>
      <router-link to="/lesson/landing" class="ll-empty-link">返回课程列表</router-link>
    </div>

    <template v-else>
      <!-- ===== 头部 ===== -->
      <header class="ll-header">
        <div class="ll-header-inner">
          <div class="ll-header-row">
            <router-link :to="`/lesson/landing/${course.id}${versionQuery}`" replace class="ll-back">
              <span class="ll-back-icon"><el-icon><ArrowLeft /></el-icon></span>
              <span class="ll-back-name">{{ course.name }}</span>
            </router-link>
            <div class="ll-header-chips">
              <template v-if="activeUnit">
                <span class="ll-chip ll-chip-primary">
                  <el-icon><TrendCharts /></el-icon>
                  {{ diffLabel }}
                </span>
                <span class="ll-chip ll-chip-primary">
                  <el-icon><Clock /></el-icon>
                  {{ activeUnit.estimatedHours || 0 }} 课时
                </span>
              </template>
              <span class="ll-chip">
                <el-icon><List /></el-icon>
                {{ units.length }} 个节点
              </span>
              <span class="ll-chip">
                <el-icon><Clock /></el-icon>
                {{ totalHours }} 课时
              </span>
            </div>
          </div>
          <div v-if="activeUnit?.background" class="ll-header-bg">{{ activeUnit.background }}</div>
        </div>
      </header>

      <!-- ===== 主体 ===== -->
      <div class="ll-body">
        <!-- 左侧节点列表 -->
        <aside class="ll-sidebar" :class="{ collapsed: sidebarCollapsed }">
          <div class="ll-sidebar-head">
            <template v-if="!sidebarCollapsed">
              <span class="ll-sidebar-count"><el-icon><Files /></el-icon>{{ units.length }} 个节点</span>
              <span class="ll-sidebar-count"><el-icon><Clock /></el-icon>{{ totalHours }} 课时</span>
            </template>
            <button
              type="button"
              class="ll-sidebar-toggle"
              :title="sidebarCollapsed ? '展开节点列表' : '折叠节点列表'"
              @click="sidebarCollapsed = !sidebarCollapsed"
            >
              <el-icon><component :is="sidebarCollapsed ? Expand : Fold" /></el-icon>
            </button>
          </div>

          <div class="ll-unit-list">
            <!-- 折叠态：数字徽标 -->
            <template v-if="sidebarCollapsed">
              <div v-for="(unit, idx) in units" :key="unit.id" class="ll-unit-badge-wrap">
                <button
                  type="button"
                  :class="['ll-unit-badge', { active: activeNodeId === unit.id }]"
                  :title="`${idx + 1}. ${unit.name} (${unitDiffLabel(unit)}, ${unit.estimatedHours || 0}h)`"
                  @click="setActiveNodeId(unit.id)"
                >
                  {{ idx + 1 }}
                </button>
              </div>
            </template>
            <!-- 展开态：完整条目 -->
            <button
              v-for="(unit, idx) in units"
              v-else
              :key="unit.id"
              type="button"
              :class="['ll-unit', { active: activeNodeId === unit.id }]"
              @click="setActiveNodeId(unit.id)"
            >
              <span v-if="activeNodeId === unit.id" class="ll-unit-indicator" />
              <span :class="['ll-unit-index', { active: activeNodeId === unit.id }]">{{ idx + 1 }}</span>
              <span class="ll-unit-body">
                <span :class="['ll-unit-name', { active: activeNodeId === unit.id }]">{{ unit.name }}</span>
                <span class="ll-unit-meta">
                  <span class="ll-unit-meta-item"><el-icon><Clock /></el-icon>{{ unit.estimatedHours || 0 }}h</span>
                  <span class="ll-unit-meta-item" :style="{ color: unitDiff(unit).color }">
                    <el-icon><TrendCharts /></el-icon>{{ unitDiff(unit).label }}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </aside>

        <!-- 主区 -->
        <main class="ll-main">
          <div v-if="!activeUnit" class="ll-main-empty">
            <div class="ll-main-empty-icon"><el-icon :size="48"><Reading /></el-icon></div>
            <p class="ll-main-empty-title">选择一个节点开始学习</p>
            <p class="ll-main-empty-hint">从左侧节点列表中点击节点</p>
          </div>

          <!-- 混合课：模块视图 -->
          <template v-else-if="isHybrid">
            <HybridModulesView
              :node="activeUnit"
              :modules="hybridModulesByNode.get(activeUnit.id) || []"
              :course-id="course.id"
              :my-results="myResults"
              :submitted-keys="hybridSubmittedKeys"
              @eval-action="handleHybridEvalAction"
            />
          </template>

          <template v-else>
            <!-- 节点说明书 -->
            <div class="ll-card">
              <div class="ll-card-head">
                <div class="ll-card-head-icon"><el-icon><Document /></el-icon></div>
                <span class="ll-card-title">节点说明书</span>
                <button
                  v-if="activeUnit.descriptionPdf"
                  type="button"
                  class="ll-card-pdf-btn"
                  @click="openPdfPreview(activeUnit)"
                >
                  <el-icon><View /></el-icon>查看 PDF
                </button>
              </div>
              <div class="ll-card-body">
                <div v-if="activeUnit.description" class="ll-desc-text">{{ activeUnit.description }}</div>
                <p v-else class="ll-no-desc">暂无节点说明书</p>
              </div>
            </div>

            <!-- 节点测评 -->
            <div class="ll-eval-section">
              <div class="ll-eval-head">
                <div class="ll-eval-title-wrap">
                  <div class="ll-card-head-icon"><el-icon><Tickets /></el-icon></div>
                  <h3 class="ll-eval-title">节点测评</h3>
                  <div v-if="evalMethods.length > 0" class="ll-eval-summary">
                    <span class="ll-eval-count">已评分 {{ aggregate.evaluatedCount }}/{{ aggregate.totalMethods }}</span>
                    <span v-if="aggregate.evaluatedCount > 0" class="ll-eval-score">
                      综合 {{ aggregate.score }}/{{ aggregate.maxScore }}
                    </span>
                  </div>
                </div>
              </div>

              <div v-if="evalMethods.length > 0" class="ll-eval-grid">
                <EvalMethodCard
                  v-for="method in evalMethodViews"
                  :key="method.methodKey"
                  :method="method"
                  :result="methodResult(method.methodKey)"
                  :exam-href="getExamHref(method)"
                  @action="openSubmitDialog(method)"
                />
              </div>
              <div v-else class="ll-eval-empty">
                <div class="ll-eval-empty-icon"><el-icon :size="24"><Tickets /></el-icon></div>
                <div class="ll-eval-empty-title">该节点暂未设置评价方式</div>
                <div class="ll-eval-empty-hint">教师配置后，测评入口将显示在此处</div>
              </div>
            </div>
          </template>
        </main>

        <!-- 右侧面板（桌面折叠态）：知识点 / 资源 -->
        <div v-if="!isHybrid && sidebarCollapsed && activeUnit" class="ll-right">
          <div class="ll-right-head">
            <button
              v-for="tab in rightTabs"
              :key="tab.value"
              type="button"
              :class="['ll-right-tab', { active: rightTab === tab.value }]"
              @click="rightTab = tab.value"
            >
              <el-icon><component :is="tab.icon" /></el-icon>{{ tab.label }}
            </button>
          </div>
          <div class="ll-right-body">
            <template v-if="rightTab === 'knowledge'">
              <div v-if="activeUnit.knowledgePoints?.length" class="ll-kp-list">
                <div
                  v-for="(kp, i) in activeUnit.knowledgePoints"
                  :key="kp.id"
                  class="ll-kp-item"
                  @click="openKpDialog(kp)"
                >
                  <span class="ll-kp-index">{{ i + 1 }}</span>
                  <span class="ll-kp-info">
                    <span class="ll-kp-name">{{ kp.name }}</span>
                    <span v-if="kp.description" class="ll-kp-desc">{{ kp.description }}</span>
                  </span>
                </div>
              </div>
              <div v-else class="ll-right-empty">暂无知识点</div>
            </template>
            <template v-else>
              <div v-if="activeUnit.resources?.length" class="ll-res-list">
                <div
                  v-for="r in activeUnit.resources"
                  :key="r.id"
                  class="ll-res-item"
                  @click="openPreview(r)"
                >
                  <span class="ll-res-icon"><el-icon><Document /></el-icon></span>
                  <span class="ll-res-info">
                    <span class="ll-res-name">{{ r.name }}</span>
                    <span class="ll-res-meta">
                      {{ RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type }}
                      <template v-if="r.size"> · {{ formatSize(r.size) }}</template>
                    </span>
                  </span>
                </div>
              </div>
              <div v-else class="ll-right-empty">暂无资源</div>
            </template>
          </div>
        </div>
      </div>

      <!-- ===== 测评提交弹窗（对齐 React EvalMethodSubmitDialog） ===== -->
      <el-dialog v-model="submitDialogOpen" width="520px" top="6vh" class="ll-dialog" :close-on-click-modal="false">
        <template #header>
          <div class="ll-dialog-head">
            <div class="ll-dialog-icon" :style="{ color: activeSubmitMethod?.color, borderColor: `${activeSubmitMethod?.color}30` }">
              <el-icon><component :is="activeSubmitMethod?.icon" /></el-icon>
            </div>
            <div>
              <div class="ll-dialog-title">{{ activeSubmitMethod?.label }}</div>
              <div class="ll-dialog-sub">
                {{ isTeacherLedMethod(activeSubmitMethod?.methodKey) ? '确认参加本次测评，后续由教师进行现场评价' : '按测评要求提交材料后等待教师评分' }}
              </div>
            </div>
          </div>
        </template>

        <div v-if="submitSubmitted" class="ll-submit-success">
          <div class="ll-submit-success-icon"><el-icon :size="32"><CircleCheck /></el-icon></div>
          <h4 class="ll-submit-success-title">提交成功</h4>
          <p class="ll-submit-success-sub">等待教师评分后可在学习页查看成绩</p>
        </div>

        <template v-else>
          <!-- 测评要求 -->
          <div class="ll-dialog-box">
            <h5 class="ll-dialog-box-title"><el-icon><Tickets /></el-icon>测评要求</h5>
            <p v-if="!requiresMaterial" class="ll-dialog-text">本测评无需在线提交材料。</p>
            <template v-else>
              <p v-if="activeSubmitMethod?.resourceConfig?.submitFormatDesc" class="ll-dialog-text pre-line">
                {{ activeSubmitMethod.resourceConfig.submitFormatDesc }}
              </p>
              <p v-else class="ll-dialog-text">请按照教师要求准备材料</p>
            </template>
            <p v-if="activeSubmitMethod?.resourceConfig?.venueResources" class="ll-dialog-text pre-line">
              <span class="ll-dialog-strong">场地/环境：</span>{{ activeSubmitMethod.resourceConfig.venueResources }}
            </p>
            <p v-if="activeSubmitMethod?.resourceConfig?.deadlineDays != null" class="ll-dialog-text">
              <span class="ll-dialog-strong">预计提交天数：</span>{{ activeSubmitMethod.resourceConfig.deadlineDays }} 天
            </p>
            <p v-if="activeSubmitMethod?.resourceConfig?.allowResubmit !== undefined" class="ll-dialog-text">
              <span class="ll-dialog-strong">允许重新提交：</span>
              {{ activeSubmitMethod.resourceConfig.allowResubmit ? '是' : '否' }}
            </p>
          </div>

          <!-- 评审流程（review） -->
          <div v-if="activeSubmitMethod?.methodKey === 'review' && reviewStepsEnabled.length > 0" class="ll-dialog-box">
            <h5 class="ll-dialog-box-title"><el-icon><Tickets /></el-icon>评审流程</h5>
            <div class="ll-review-steps">
              <div v-for="(s, idx) in reviewStepsEnabled" :key="s.id || idx" class="ll-review-step">
                <span class="ll-review-no" :style="{ backgroundColor: activeSubmitMethod?.color }">{{ idx + 1 }}</span>
                <div>
                  <p class="ll-review-label">{{ s.label }}</p>
                  <p v-if="s.description" class="ll-review-desc">{{ s.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 材料提交（outcome/homework） -->
          <div v-if="isManualSubmitMethod(activeSubmitMethod?.methodKey) && requiresMaterial" class="ll-dialog-form">
            <div class="ll-form-field">
              <label class="ll-form-label">文字说明</label>
              <el-input
                v-model="submitText"
                type="textarea"
                :rows="4"
                placeholder="描述你的成果/作业内容..."
                class="ll-form-textarea"
              />
            </div>
            <div class="ll-form-field">
              <label class="ll-form-label">上传文件</label>
              <div v-if="submitFiles.length > 0" class="ll-file-list">
                <div v-for="(f, i) in submitFiles" :key="i" class="ll-file-item">
                  <el-icon><Document /></el-icon>
                  <span class="ll-file-name">{{ f.name }}</span>
                  <button type="button" class="ll-file-remove" @click="submitFiles.splice(i, 1)">
                    <el-icon><Close /></el-icon>
                  </button>
                </div>
              </div>
              <div class="ll-file-upload-row">
                <label class="ll-file-upload-btn">
                  <el-icon><Upload /></el-icon>选择文件
                  <input
                    type="file"
                    class="ll-file-input"
                    :disabled="fileUploading"
                    @change="handleFileUpload"
                  />
                </label>
                <span v-if="fileUploading" class="ll-file-uploading">上传中...</span>
              </div>
            </div>
          </div>

          <!-- 教师主导确认（random_draw/review） -->
          <div v-if="isTeacherLedMethod(activeSubmitMethod?.methodKey)" class="ll-teacher-led">
            <p class="ll-teacher-led-text">
              {{
                activeSubmitMethod?.methodKey === 'random_draw'
                  ? '请确认参加本次现场问答，具体题目由教师在评分时抽取。'
                  : '请确认参加本次现场评审，具体评价步骤由教师选择执行。'
              }}
            </p>
          </div>

          <p v-if="submitError" class="ll-submit-error">{{ submitError }}</p>
        </template>

        <template #footer>
          <template v-if="!submitSubmitted">
            <el-button class="ll-dialog-cancel" @click="submitDialogOpen = false">取消</el-button>
            <el-button
              type="primary"
              class="ll-dialog-submit"
              :style="{ backgroundColor: activeSubmitMethod?.color, borderColor: activeSubmitMethod?.color }"
              :loading="submitting"
              :disabled="
                submitting ||
                (isManualSubmitMethod(activeSubmitMethod?.methodKey) &&
                  requiresMaterial &&
                  !submitText &&
                  submitFiles.length === 0)
              "
              @click="handleSubmit"
            >
              {{ isTeacherLedMethod(activeSubmitMethod?.methodKey) ? '确认参加' : '提交测评' }}
            </el-button>
          </template>
          <el-button
            v-else
            type="primary"
            class="ll-dialog-submit"
            :style="{ backgroundColor: activeSubmitMethod?.color, borderColor: activeSubmitMethod?.color }"
            @click="submitDialogOpen = false"
          >
            知道了
          </el-button>
        </template>
      </el-dialog>

      <!-- ===== 知识点详情弹窗 ===== -->
      <el-dialog v-model="kpDialogOpen" width="520px" class="ll-dialog">
        <template #header>
          <div class="ll-dialog-head">
            <div class="ll-dialog-icon primary"><el-icon><Connection /></el-icon></div>
            <div>
              <div class="ll-dialog-title">{{ activeKp?.name }}</div>
              <div v-if="activeKp?.code" class="ll-dialog-sub">编码：{{ activeKp.code }}</div>
            </div>
          </div>
        </template>
        <div class="ll-kp-dialog-body">
          <div>
            <p class="ll-kp-dialog-label">描述</p>
            <p class="ll-kp-dialog-text">{{ activeKp?.description || '暂无描述' }}</p>
          </div>
          <div>
            <p class="ll-kp-dialog-label">关联颗粒课（{{ kpCourses.length }}）</p>
            <div v-if="kpCourses.length > 0" class="ll-kp-courses">
              <router-link
                v-for="c in kpCourses"
                :key="c.id"
                :to="`/lesson/landing/${c.id}`"
                class="ll-kp-course"
              >
                <span class="ll-kp-course-icon"><el-icon><Reading /></el-icon></span>
                <span class="ll-kp-course-info">
                  <span class="ll-kp-course-name">{{ c.name }}</span>
                  <span class="ll-kp-course-sub">{{ c.code ? `${c.code} · ` : '' }}颗粒课</span>
                </span>
                <el-icon class="ll-kp-course-arrow"><ArrowRight /></el-icon>
              </router-link>
            </div>
            <p v-else class="ll-kp-no-courses">暂无关联颗粒课</p>
          </div>
        </div>
      </el-dialog>

      <!-- ===== 资源预览弹窗 ===== -->
      <el-dialog v-model="previewOpen" width="860px" top="6vh" class="ll-dialog">
        <template #header>
          <div class="ll-dialog-head">
            <span class="ll-dialog-title">{{ previewResource?.name || '资源预览' }}</span>
            <a
              v-if="previewResource && isSafeExternalUrl(previewResource.url)"
              :href="previewResource.url"
              target="_blank"
              rel="noopener noreferrer"
              class="ll-dialog-link"
            >
              <el-icon><TopRight /></el-icon>新窗口打开
            </a>
          </div>
        </template>
        <div class="ll-preview-body">
          <img
            v-if="previewResource?.type === 'image' && previewDisplaySrc"
            :src="previewDisplaySrc"
            :alt="previewResource.name"
            class="ll-preview-img"
          />
          <video
            v-else-if="previewResource?.type === 'video' && previewDisplaySrc"
            :src="previewDisplaySrc"
            controls
            class="ll-preview-media"
          />
          <audio
            v-else-if="previewResource?.type === 'audio' && previewDisplaySrc"
            :src="previewDisplaySrc"
            controls
            class="ll-preview-audio"
          />
          <iframe
            v-else-if="previewIframeSrc"
            :src="previewIframeSrc"
            :title="previewResource?.name"
            class="ll-preview-iframe"
            allowfullscreen
          />
          <div v-else-if="previewResource && isSafeExternalUrl(previewResource.url)" class="ll-preview-external">
            <el-icon :size="40" class="ll-preview-external-icon"><Link /></el-icon>
            <p>该链接无法内嵌预览，请点击右上角「新窗口打开」</p>
          </div>
          <div v-else class="ll-preview-external">
            <el-icon :size="40" class="ll-preview-external-icon"><Document /></el-icon>
            <p>加载中…</p>
          </div>
        </div>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import type { Component, PropType } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Clock,
  Close,
  Collection,
  Connection,
  Document,
  Expand,
  Files,
  Fold,
  FolderOpened,
  Link,
  List,
  MagicStick,
  Message,
  Monitor,
  Notebook,
  Opportunity,
  Reading,
  Search,
  Tickets,
  TopRight,
  TrendCharts,
  Upload,
  View
} from '@element-plus/icons-vue';
import { courseApi, courseNodeApi, knowledgeApi, nodeEvaluationResultApi } from '@/api/lesson';
import { authedFetch, request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { Course, KnowledgePoint, NodeEvaluationResult } from '@/types/lesson';
import {
  EVAL_METHOD_COLORS,
  EVAL_METHOD_LABELS,
  RESOURCE_TYPE_SHORT_LABELS,
  SCENE_DIFFICULTY,
  courseSnapshotGet,
  courseSnapshotHybridModules,
  courseSnapshotNodes,
  evalRuleConfigToMethods,
  examHref,
  formatSize,
  hybridModuleList,
  mergeCourseSnapshot,
  nodeEvaluationResultSubmit,
  snapshotKnowledgeMap
} from './lesson-landing-types';
import type { CourseSnapshotHybridModule, EvalMethodViewModel, LessonNode, LessonNodeResource } from './lesson-landing-types';

/** 教师/管理员预览 draft 走 live 多接口；学生等角色走单次快照 bundle（对齐 React） */
const EDITOR_PREVIEW_ROLES = ['teacher', 'school_admin', 'platform_admin'];

// ===== 测评方法展示常量（对齐 React eval-method-card.tsx） =====
const EXAM_METHODS = ['paper', 'question_bank', 'quiz'];
const TEACHER_LED_METHODS = ['random_draw', 'review'];
const MANUAL_SUBMIT_METHODS = ['outcome', 'homework'];

const METHOD_ICONS: Record<string, Component> = {
  paper: Document,
  question_bank: Collection,
  quiz: Tickets,
  random_draw: MagicStick,
  review: View,
  outcome: FolderOpened,
  homework: Opportunity
};
const METHOD_ACTION_TEXT: Record<string, string> = {
  paper: '开始答题',
  question_bank: '开始答题',
  quiz: '开始答题',
  random_draw: '开始答题',
  review: '上传材料',
  outcome: '上传成果',
  homework: '上传作业'
};
const METHOD_DESC: Record<string, string> = {
  paper: '在线试卷答题',
  question_bank: '题库抽题作答',
  quiz: '随堂测验',
  random_draw: '随机抽题测评',
  review: '提交材料进行评审',
  outcome: '上传成果材料',
  homework: '上传作业材料'
};
const METHOD_BG: Record<string, string> = {
  paper: '#f0f9ff',
  question_bank: '#faf5ff',
  quiz: '#f0fdfa',
  random_draw: '#eef2ff',
  review: '#fff1f2',
  outcome: '#f0fdf4',
  homework: '#fffbeb'
};
const METHOD_BORDER: Record<string, string> = {
  paper: '#bae6fd',
  question_bank: '#ddd6fe',
  quiz: '#99f6e4',
  random_draw: '#c7d2fe',
  review: '#fecdd3',
  outcome: '#bbf7d0',
  homework: '#fde68a'
};

function methodColor(key: string): string {
  return EVAL_METHOD_COLORS[key] || '#94a3b8';
}
function methodLabel(key: string): string {
  return EVAL_METHOD_LABELS[key] || key;
}
function methodDesc(key: string): string {
  return METHOD_DESC[key] || '进入测评';
}
function methodAction(key: string): string {
  return METHOD_ACTION_TEXT[key] || '开始测评';
}
function methodIcon(key: string): Component {
  return METHOD_ICONS[key] || Tickets;
}
function methodBg(key: string): string {
  return METHOD_BG[key] || '#f8fafc';
}
function methodBorder(key: string): string {
  return METHOD_BORDER[key] || '#e2e8f0';
}

// ===== 混合课模块常量（对齐 React hybrid-modules-view.tsx） =====
const HYBRID_EVAL_MODULE_LABELS: Record<string, string> = {
  preQuizzes: '课前测验',
  inClassQuizzes: '随堂测验',
  homeworks: '课后作业'
};
const MODULE_LABELS: Record<string, string> = {
  prePreview: '课前预习',
  preResources: '学习资源',
  preTasks: '课前任务',
  preQuizzes: '课前测验',
  lecture: '课堂讲授',
  inClassTasks: '课堂任务',
  inClassQuizzes: '随堂测验',
  classQuestions: '课堂提问',
  practiceTasks: '实践任务',
  homeworks: '课后作业',
  extensionMaterials: '拓展资料',
  trainingReports: '实训报告'
};
const ACTIVITY_ORDER: string[] = [
  'prePreview',
  'preResources',
  'preTasks',
  'preQuizzes',
  'lecture',
  'inClassTasks',
  'inClassQuizzes',
  'classQuestions',
  'practiceTasks',
  'homeworks',
  'extensionMaterials',
  'trainingReports'
];
const MODULE_ICONS: Record<string, Component> = {
  prePreview: Reading,
  preResources: FolderOpened,
  preTasks: Tickets,
  preQuizzes: Tickets,
  lecture: Monitor,
  inClassTasks: Tickets,
  inClassQuizzes: Tickets,
  classQuestions: Message,
  practiceTasks: Document,
  homeworks: Document,
  extensionMaterials: FolderOpened,
  trainingReports: Document
};
const MODULE_ICON_CLASSES: Record<string, string[]> = {
  prePreview: ['bg-sky-soft', 'text-sky-strong', 'border-sky-soft-2'],
  preResources: ['bg-green-soft', 'text-green-strong', 'border-green-soft-2'],
  preTasks: ['bg-cyan-soft', 'text-cyan-strong', 'border-cyan-soft-2'],
  preQuizzes: ['bg-blue-soft', 'text-blue-strong', 'border-blue-soft-2'],
  lecture: ['bg-violet-soft', 'text-violet-strong', 'border-violet-soft-2'],
  inClassTasks: ['bg-indigo-soft', 'text-indigo-strong', 'border-indigo-soft-2'],
  inClassQuizzes: ['bg-purple-soft', 'text-purple-strong', 'border-purple-soft-2'],
  classQuestions: ['bg-pink-soft', 'text-pink-strong', 'border-pink-soft-2'],
  practiceTasks: ['bg-amber-soft', 'text-amber-strong', 'border-amber-soft-2'],
  homeworks: ['bg-green-soft', 'text-green-strong', 'border-green-soft-2'],
  extensionMaterials: ['bg-teal-soft', 'text-teal-strong', 'border-teal-soft-2'],
  trainingReports: ['bg-orange-soft', 'text-orange-strong', 'border-orange-soft-2']
};
const PHASES: { key: string; label: string; keys: string[] }[] = [
  { key: 'pre', label: '课前', keys: ['prePreview', 'preResources', 'preTasks', 'preQuizzes'] },
  { key: 'in', label: '课中', keys: ['lecture', 'inClassTasks', 'inClassQuizzes', 'classQuestions'] },
  { key: 'post', label: '课后', keys: ['practiceTasks', 'homeworks', 'extensionMaterials', 'trainingReports'] }
];

// ===== 路由与登录态 =====
const route = useRoute();
const auth = useAuthStore();
const id = computed(() => String(route.params.id || ''));
const targetNodeId = computed(() => (route.query.node as string) || undefined);
const versionParam = computed(() => (route.query.v as string) || undefined);

const isEditorPreview = computed(() => {
  const user = auth.user;
  if (!user) return false;
  const roles = user.roles || (user.role ? [user.role] : []);
  return roles.some((r) => EDITOR_PREVIEW_ROLES.includes(r));
});

// ===== 数据状态 =====
const course = ref<Course | null>(null);
const nodes = ref<LessonNode[]>([]);
const loading = ref(true);
const activeNodeId = ref<string | null>(null);
const hybridModules = ref<CourseSnapshotHybridModule[]>([]);
const myResults = ref<NodeEvaluationResult[]>([]);
const knowledgeMap = ref<Map<string, KnowledgePoint>>(new Map());
const granularCourseMap = ref<Map<string, Course>>(new Map());
const nodeResultSeq = ref(0);

// ===== 快照 bundle 路径（学生等） =====
watch(
  [id, isEditorPreview, versionParam, targetNodeId],
  async ([val, editor, version]) => {
    if (!val || editor) return;
    loading.value = true;
    try {
      const snap = await courseSnapshotGet(val, { version });
      course.value = mergeCourseSnapshot(null, snap.course);
      const list = courseSnapshotNodes(snap).sort((a, b) => (a.order || 0) - (b.order || 0));
      nodes.value = list;
      knowledgeMap.value = snapshotKnowledgeMap(snap.knowledge_points);
      if (snap.course.type === 'hybrid') {
        hybridModules.value = courseSnapshotHybridModules(snap);
      }
      activeNodeId.value = resolveInitialNode(list, activeNodeId.value);
    } catch {
      course.value = null;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

// ===== live 路径（教师/管理员预览） =====
watch(
  [id, isEditorPreview],
  async ([val, editor]) => {
    if (!val || !editor) return;
    loading.value = true;
    try {
      const c = await courseApi.get(val);
      course.value = c;
    } catch {
      course.value = null;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

watch(
  [id, course, isEditorPreview, targetNodeId],
  ([val, c, editor]) => {
    if (!val || !c || !editor) return;
    courseNodeApi
      .list({ courseId: val, limit: 1000 })
      .then((res) => {
        const list = (res.items || []).sort((a: LessonNode, b: LessonNode) => (a.order || 0) - (b.order || 0));
        nodes.value = list;
        activeNodeId.value = resolveInitialNode(list, activeNodeId.value);
      })
      .catch(() => {
        nodes.value = [];
      });
    if (c.type === 'hybrid') {
      hybridModuleList({ courseId: val, limit: 1000 })
        .then((res) => {
          hybridModules.value = (res.items || []).map((m) => ({
            ...m,
            node_id: m.node_id,
            module_key: m.module_key
          }));
        })
        .catch(() => {
          hybridModules.value = [];
        });
    }
  },
  { immediate: true }
);

// ===== 混合模块按节点分组 =====
const hybridModulesByNode = computed(() => {
  const map = new Map<string, CourseSnapshotHybridModule[]>();
  hybridModules.value.forEach((m) => {
    const list = map.get(m.node_id) || [];
    list.push(m);
    map.set(m.node_id, list);
  });
  return map;
});

const activeUnit = computed(() => units.value.find((n) => n.id === activeNodeId.value) || null);

// ===== 测评方法（对齐 React evalMethods：evalRuleConfigToMethods 过滤启用项） =====
const evalMethods = computed(() => {
  const config = (activeUnit.value?.evalData as any)?.evalRuleConfig;
  if (!config || !Array.isArray(config.evaluationMethods)) return [];
  try {
    return evalRuleConfigToMethods(config).filter((m) => m.isEnabled !== false);
  } catch {
    return [];
  }
});

// 我的测评结果（快速切换节点时丢弃过期响应）
watch(
  [activeNodeId, () => auth.user?.id],
  ([nodeId, uid]) => {
    if (!nodeId) return;
    const seq = ++nodeResultSeq.value;
    nodeEvaluationResultApi
      .list({ nodeId, evaluateeId: uid, limit: 50 })
      .then((res) => {
        if (seq !== nodeResultSeq.value) return;
        myResults.value = res.items || [];
      })
      .catch((err) => {
        if (seq !== nodeResultSeq.value) return;
        console.error('加载我的测评结果', err);
        ElMessage.error('测评结果加载失败');
      });
  },
  { immediate: true }
);

// ===== 编辑器路径补充：知识点 + 颗粒课映射 =====
watch(
  [id, course, isEditorPreview],
  ([val, c, editor]) => {
    if (!val || !c || !editor || c.type === 'hybrid') return;
    Promise.all([
      fetchAllPages((page, pageSize) => knowledgeApi.list({ limit: pageSize, offset: page * pageSize })).catch(
        () => [] as KnowledgePoint[]
      ),
      courseApi.list({ type: 'granular', limit: 1000 }).catch(() => ({ items: [] as Course[], total: 0 }))
    ])
      .then(([kRes, gRes]) => {
        const kMap = new Map<string, KnowledgePoint>();
        (kRes || []).forEach((k: KnowledgePoint) => kMap.set(k.id, k));
        knowledgeMap.value = kMap;
        const gMap = new Map<string, Course>();
        (gRes.items || []).forEach((gc: Course) => gMap.set(gc.id, gc));
        granularCourseMap.value = gMap;
      })
      .catch((err) => {
        console.error('加载知识点/颗粒课数据', err);
        ElMessage.error('部分数据加载失败');
      });
  },
  { immediate: true }
);

async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<ListResponse<T>>,
  pageSize = 200,
  maxPages = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    if (page >= maxPages) throw new Error(`fetchAllPages: 超过最大页数 ${maxPages}`);
    const res = await fetcher(page, pageSize);
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

// ===== 派生 =====
const isHybrid = computed(() => course.value?.type === 'hybrid');
const totalHours = computed(() => nodes.value.reduce((s, n) => s + (n.estimatedHours || 0), 0));

/** 学习单元（课程节点）归一化视图模型（对齐 React LearnUnit） */
interface LearnUnit {
  id: string;
  name: string;
  difficulty: number;
  estimatedHours?: number;
  background?: string;
  descriptionPdf?: string;
  description?: string;
  knowledgePoints: KnowledgePoint[];
  resources: LessonNodeResource[];
  evalData?: Record<string, unknown>;
  type: string;
}

const units = computed<LearnUnit[]>(() =>
  nodes.value.map((n) => ({
    id: n.id,
    name: n.name,
    difficulty: n.difficulty ?? 3,
    estimatedHours: n.estimatedHours,
    background: n.background,
    descriptionPdf: n.descriptionPdf,
    description: n.detailedDescription,
    knowledgePoints: (n.knowledgePoints || []).map(
      (kp) =>
        knowledgeMap.value.get(kp.id) ||
        ({ ...kp, granularLessonIds: [] } as unknown as KnowledgePoint)
    ),
    resources: (n.resources || []) as LessonNodeResource[],
    evalData: n.evalData,
    type: n.type
  }))
);

/** 初始选中节点：?node= 优先，其次列表第一个（对齐 React setActiveNodeId 函数式更新） */
function resolveInitialNode(list: LessonNode[], prev: string | null): string | null {
  if (targetNodeId.value && list.find((n) => n.id === targetNodeId.value)) {
    return targetNodeId.value;
  }
  if (list.length > 0 && !prev) return list[0].id;
  return prev;
}

function unitDiff(unit: { difficulty?: number }) {
  return SCENE_DIFFICULTY[unit.difficulty ?? 3] || SCENE_DIFFICULTY[3];
}
function unitDiffLabel(unit: { difficulty?: number; name: string; estimatedHours?: number }): string {
  return unitDiff(unit).label;
}
const diffLabel = computed(() => (activeUnit.value ? unitDiff(activeUnit.value).label : ''));

const evalMethodViews = computed<EvalMethodViewModel[]>(() =>
  evalMethods.value.map((m) => ({
    methodKey: m.methodKey,
    weight: m.weight,
    resourceConfig: m.resourceConfig,
    reviewSteps: m.reviewSteps,
    evalPoints: m.evalPoints
  }))
);

// 聚合分数（对齐 React aggregate）
const aggregate = computed(() => {
  let totalScore = 0;
  let totalWeight = 0;
  let evaluatedCount = 0;
  for (const m of evalMethods.value) {
    const weight = m.weight || 0;
    totalWeight += weight;
    const r = myResults.value.find((x) => x.methodKey === m.methodKey);
    if (r?.status === 'evaluated' && (r.maxScore ?? 0) > 0) {
      totalScore += ((r.totalScore || 0) / (r.maxScore ?? 1)) * weight;
      evaluatedCount++;
    }
  }
  return {
    score: totalWeight > 0 ? Math.round(totalScore * 100) / 100 : 0,
    maxScore: totalWeight,
    evaluatedCount,
    totalMethods: evalMethods.value.length
  };
});

function methodResult(methodKey: string) {
  const r = myResults.value.find((x) => x.methodKey === methodKey);
  if (!r) return undefined;
  return { status: r.status, totalScore: r.totalScore, maxScore: r.maxScore };
}

// ===== 考试链接 =====
function getExamHref(m: EvalMethodViewModel): string | undefined {
  const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(m.methodKey);
  if (!isExamMethod) return undefined;
  const examId = m.methodKey === 'paper' ? m.resourceConfig?.paperId : m.resourceConfig?.examId;
  const usageId = m.resourceConfig?.usageId;
  if (!examId) return undefined;
  return examHref(examId, { node: activeNodeId.value, method: m.methodKey, usage: usageId, course: id.value });
}

// ===== 页面加载版本（URL ?v= 优先；提交时作 expectedVersion） =====
const pageVersion = computed(() => versionParam.value || course.value?.version || undefined);
const versionQuery = computed(() => (pageVersion.value ? `?v=${encodeURIComponent(pageVersion.value)}` : ''));

// ===== 提交 =====
const submitDialogOpen = ref(false);
const activeMethod = ref<EvalMethodViewModel | null>(null);
const hybridActiveModuleKey = ref<string | null>(null);
const submittedMethodKeys = ref<Set<string>>(new Set());
const hybridSubmittedKeys = ref<Set<string>>(new Set());

const submitText = ref('');
const submitFiles = ref<{ name: string; url: string; size: number }[]>([]);
const fileUploading = ref(false);
const submitting = ref(false);
const submitSubmitted = ref(false);
const submitError = ref<string | null>(null);

function openSubmitDialog(method: EvalMethodViewModel) {
  activeMethod.value = method;
  hybridActiveModuleKey.value = null;
  resetSubmitDialog();
  submitDialogOpen.value = true;
}

function handleHybridEvalAction(moduleKey: string, method: EvalMethodViewModel) {
  activeMethod.value = { ...method, label: `${HYBRID_EVAL_MODULE_LABELS[moduleKey] || moduleKey} · ${methodLabel(method.methodKey)}` };
  hybridActiveModuleKey.value = moduleKey;
  resetSubmitDialog();
  submitDialogOpen.value = true;
}

function resetSubmitDialog() {
  submitText.value = '';
  submitFiles.value = [];
  submitSubmitted.value = false;
  submitError.value = null;
}

const activeSubmitMethod = computed(() => {
  const m = activeMethod.value;
  if (!m) return null;
  return {
    methodKey: m.methodKey,
    label: m.label || methodLabel(m.methodKey),
    color: methodColor(m.methodKey),
    icon: methodIcon(m.methodKey),
    resourceConfig: m.resourceConfig || {}
  };
});

const requiresMaterial = computed(() => {
  const m = activeMethod.value;
  if (!m) return false;
  return m.resourceConfig?.requiresMaterial !== false;
});

const reviewStepsEnabled = computed(() => {
  const m = activeMethod.value;
  if (!m) return [];
  return (m.reviewSteps || []).filter((s) => s.enabled);
});

function isTeacherLedMethod(key?: string): boolean {
  return !!key && TEACHER_LED_METHODS.includes(key);
}
function isManualSubmitMethod(key?: string): boolean {
  return !!key && MANUAL_SUBMIT_METHODS.includes(key);
}

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileUploading.value = true;
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch('/files/upload', { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const uploaded = (await res.json()) as { url: string; name?: string; size?: number };
    submitFiles.value.push({ name: uploaded.name || file.name, url: uploaded.url, size: uploaded.size || file.size });
  } catch (err) {
    ElMessage.error(`上传失败：${(err as Error).message || '请重试'}`);
  } finally {
    fileUploading.value = false;
    input.value = '';
  }
}

async function handleSubmit() {
  const m = activeMethod.value;
  if (!m || !auth.user?.id || !activeNodeId.value) return;
  submitting.value = true;
  submitError.value = null;
  try {
    const payload: EvalMethodSubmitPayload = {
      methodKey: m.methodKey,
      maxScore: Number(m.resourceConfig?.maxScore) || 100
    };
    if (isManualSubmitMethod(m.methodKey)) {
      payload.subjectiveContent = { text: submitText.value, files: submitFiles.value, attempts: 1 };
    } else if (isTeacherLedMethod(m.methodKey)) {
      payload.subjectiveContent = { attended: true, attempts: 1 };
    } else {
      payload.subjectiveContent = {};
    }
    await doSubmit(payload);
    submitSubmitted.value = true;
  } catch (err) {
    submitError.value = (err as Error).message || '提交失败';
  } finally {
    submitting.value = false;
  }
}

async function doSubmit(payload: EvalMethodSubmitPayload) {
  if (!auth.user?.id || !activeNodeId.value) return;
  const methodKey = hybridActiveModuleKey.value
    ? `${hybridActiveModuleKey.value}:${payload.methodKey}`
    : payload.methodKey;
  await nodeEvaluationResultSubmit({
    nodeId: activeNodeId.value,
    expectedVersion: pageVersion.value,
    methodKey,
    evaluateeId: auth.user.id,
    maxScore: payload.maxScore,
    subjectiveContent: payload.subjectiveContent
  });
  if (hybridActiveModuleKey.value) {
    const compositeKey = `${hybridActiveModuleKey.value}:${payload.methodKey}`;
    hybridSubmittedKeys.value = new Set([...Array.from(hybridSubmittedKeys.value), compositeKey]);
  } else {
    submittedMethodKeys.value = new Set([...Array.from(submittedMethodKeys.value), payload.methodKey]);
  }
}

// ===== 侧边栏与右侧面板 =====
const sidebarCollapsed = ref(false);
const rightTab = ref('knowledge');
const rightTabs = [
  { value: 'knowledge', label: '知识点', icon: Connection },
  { value: 'resource', label: '资源', icon: FolderOpened }
];

function setActiveNodeId(nodeId: string) {
  activeNodeId.value = nodeId;
}

// ===== 知识点弹窗 =====
const kpDialogOpen = ref(false);
const activeKp = ref<KnowledgePoint | null>(null);
const kpCourses = computed(() => {
  if (!activeKp.value) return [];
  return (activeKp.value.granularLessonIds || [])
    .map((cid) => granularCourseMap.value.get(cid))
    .filter(Boolean) as Course[];
});

function openKpDialog(kp: KnowledgePoint) {
  activeKp.value = kp;
  kpDialogOpen.value = true;
}

// ===== 资源预览 =====
const previewOpen = ref(false);
const previewResource = ref<LessonNodeResource | null>(null);
const previewDisplaySrc = ref<string | null>(null);

function buildKkFileViewUrl(fileUrl: string): string {
  const origin = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`;
}

function isSafeExternalUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function openPreview(r: LessonNodeResource) {
  previewResource.value = r;
  previewDisplaySrc.value = null;
  previewOpen.value = true;
  if (!r.url) return;
  if (r.url.startsWith('/uploads/')) {
    try {
      const res = await request<{ url: string }>(`/files/sign-url?name=${encodeURIComponent(r.url)}`);
      previewDisplaySrc.value = res.url;
    } catch {
      previewDisplaySrc.value = r.url;
    }
  } else {
    previewDisplaySrc.value = r.url;
  }
}

function openPdfPreview(unit: { descriptionPdf?: string; id: string }) {
  if (!unit.descriptionPdf) return;
  openPreview({
    id: `pdf-${Date.now()}`,
    nodeId: unit.id,
    url: unit.descriptionPdf,
    name: '节点说明书 PDF',
    type: 'pdf'
  });
}

const previewIframeSrc = computed(() => {
  const src = previewDisplaySrc.value;
  if (!src) return null;
  const r = previewResource.value;
  if (!r) return null;
  if (r.type === 'image' || r.type === 'video' || r.type === 'audio') return null;
  if (src.startsWith('/uploads/')) return buildKkFileViewUrl(src);
  if (isSafeExternalUrl(src)) return null;
  return src;
});

interface EvalMethodSubmitPayload {
  methodKey: string;
  subjectiveContent?: Record<string, any>;
  maxScore?: number;
}

// ===== 测评卡片（对齐 React EvalMethodCard） =====
const EvalMethodCard = defineComponent({
  name: 'EvalMethodCard',
  props: {
    method: { type: Object as PropType<EvalMethodViewModel>, required: true },
    result: {
      type: Object as PropType<{ status: string; totalScore?: number; maxScore?: number } | undefined>,
      default: undefined
    },
    examHref: { type: String, default: undefined }
  },
  emits: ['action'],
  setup(props, { emit }) {
    return () => {
      const m = props.method;
      const color = methodColor(m.methodKey);
      const bg = methodBg(m.methodKey);
      const border = methodBorder(m.methodKey);
      const label = m.label || methodLabel(m.methodKey);
      const Icon = methodIcon(m.methodKey);
      const weight = m.weight || 0;
      const description = m.description || methodDesc(m.methodKey);
      const isExamMethod = EXAM_METHODS.includes(m.methodKey);
      const isManualSubmit = MANUAL_SUBMIT_METHODS.includes(m.methodKey);

      return h(
        'div',
        { class: 'll-eval-card', style: { backgroundColor: bg, border: `1px solid ${border}` } },
        [
          h('div', { class: 'll-eval-card-body' }, [
            h('div', { class: 'll-eval-card-top' }, [
              h(
                'div',
                { class: 'll-eval-card-icon', style: { color, border: `1px solid ${border}` } },
                [h(Icon, { size: 20 })]
              ),
              h('div', { class: 'll-eval-card-info' }, [
                h('div', { class: 'll-eval-card-title-row' }, [
                  h('h4', { class: 'll-eval-card-name' }, label),
                  h(
                    'span',
                    { class: 'll-eval-card-weight', style: { borderColor: border } },
                    `权重 ${Math.round(weight)}%`
                  )
                ]),
                h('p', { class: 'll-eval-card-desc' }, description)
              ])
            ]),
            h('div', { class: 'll-eval-card-footer' }, [
              props.result
                ? h(
                    'span',
                    {
                      class:
                        props.result.status === 'evaluated'
                          ? 'll-result-badge evaluated'
                          : 'll-result-badge pending'
                    },
                    props.result.status === 'evaluated'
                      ? `得分 ${props.result.totalScore ?? 0}/${props.result.maxScore ?? 0}`
                      : '待评分'
                  )
                : isExamMethod
                  ? h(
                      'a',
                      {
                        href: props.examHref || '#',
                        class: 'll-eval-card-btn',
                        style: { pointerEvents: props.examHref ? 'auto' : 'none', opacity: props.examHref ? 1 : 0.5 }
                      },
                      [
                        h('span', { class: 'll-btn-play' }),
                        props.examHref ? methodAction(m.methodKey) : '未配置'
                      ]
                    )
                  : h(
                      'button',
                      { type: 'button', class: 'll-eval-card-btn', onClick: () => emit('action') },
                      [
                        isManualSubmit ? h(Upload, { size: 14 }) : h('span', { class: 'll-btn-play' }),
                        methodAction(m.methodKey)
                      ]
                    )
            ])
          ])
        ]
      );
    };
  }
});

// ===== 混合课模块视图（对齐 React HybridModulesView，简化渲染） =====
const HybridModulesView = defineComponent({
  name: 'HybridModulesView',
  props: {
    node: { type: Object as PropType<LearnUnit>, required: true },
    modules: { type: Object as PropType<CourseSnapshotHybridModule[]>, required: true },
    courseId: { type: String, required: true },
    myResults: { type: Object as PropType<NodeEvaluationResult[]>, required: true },
    submittedKeys: { type: Object as PropType<Set<string>>, required: true }
  },
  emits: ['evalAction'],
  setup(props, { emit }) {
    const activePhase = ref('pre');

    const designModule = computed(() => props.modules.find((m) => m.module_key === 'teachingDesign'));
    const reviewModule = computed(() => props.modules.find((m) => m.module_key === 'postLessonReview'));
    const activityModules = computed(() =>
      [...props.modules]
        .filter((m) => ACTIVITY_ORDER.includes(m.module_key))
        .sort((a, b) => ACTIVITY_ORDER.indexOf(a.module_key) - ACTIVITY_ORDER.indexOf(b.module_key))
    );

    const phaseModules = computed(() => {
      const map = new Map<string, CourseSnapshotHybridModule[]>();
      for (const p of PHASES) {
        map.set(p.key, activityModules.value.filter((m) => p.keys.includes(m.module_key)));
      }
      return map;
    });

    const effectivePhase = computed(() => {
      if ((phaseModules.value.get(activePhase.value) || []).length > 0) return activePhase.value;
      return PHASES.find((p) => (phaseModules.value.get(p.key) || []).length > 0)?.key ?? 'pre';
    });

    return () => {
      const node = props.node;
      return h('div', { class: 'hm-wrap' }, [
        // 教学设计
        h('div', { class: 'll-card' }, [
          h('div', { class: 'll-card-head' }, [
            h('div', { class: 'll-card-head-icon gradient' }, [h(Reading, { size: 18 })]),
            h('span', { class: 'll-card-title' }, '教学设计')
          ]),
          h('div', { class: 'll-card-body' }, [
            designModule.value?.data?.content
              ? h('div', { class: 'll-desc-text' }, designModule.value.data.content)
              : h('p', { class: 'll-no-desc' }, '暂无教学设计')
          ])
        ]),

        // 教学过程
        h('div', { class: 'll-card' }, [
          h('div', { class: 'll-card-head' }, [
            h('div', { class: 'll-card-head-icon gradient' }, [h(Monitor, { size: 18 })]),
            h('span', { class: 'll-card-title' }, '教学过程'),
            activityModules.value.length > 0
              ? h('span', { class: 'hm-count' }, `${activityModules.value.length} 个教学活动`)
              : null
          ]),
          h('div', { class: 'll-card-body' }, [
            activityModules.value.length === 0
              ? h('p', { class: 'll-no-desc' }, '该节点暂无教学活动')
              : [
                  h(
                    'div',
                    { class: 'hm-phases' },
                    PHASES.map((p) => {
                      const count = (phaseModules.value.get(p.key) || []).length;
                      return h(
                        'button',
                        {
                          key: p.key,
                          type: 'button',
                          class: ['hm-phase', { active: effectivePhase.value === p.key }],
                          onClick: () => (activePhase.value = p.key)
                        },
                        [
                          h('span', p.label),
                          count > 0
                            ? h('span', { class: 'hm-phase-count' }, String(count))
                            : null
                        ]
                      );
                    })
                  ),
                  PHASES.map((p) => {
                    const modules = phaseModules.value.get(p.key) || [];
                    if (effectivePhase.value !== p.key) return null;
                    return h(
                      'div',
                      { key: p.key, class: 'hm-modules' },
                      modules.length > 0
                        ? modules.map((m) =>
                            h('div', { key: m.module_key, class: 'hm-module' }, [
                              h(
                                'div',
                                { class: ['hm-module-icon', ...(MODULE_ICON_CLASSES[m.module_key] || ['bg-gray-soft', 'text-gray-strong', 'border-gray-soft-2'])] },
                                [h(MODULE_ICONS[m.module_key] || Opportunity, { size: 16 })]
                              ),
                              h('div', { class: 'hm-module-body' }, [
                                h('div', { class: 'hm-module-title-row' }, [
                                  h('span', { class: 'hm-module-name' }, MODULE_LABELS[m.module_key] || m.module_key),
                                  h(
                                    'span',
                                    { class: ['hm-module-mode', m.mode === 'online' ? 'online' : 'offline'] },
                                    m.mode === 'online' ? '线上' : '线下'
                                  )
                                ]),
                                h('div', { class: 'hm-module-content' }, [
                                  renderModuleContent(m, node, props.courseId, props.myResults, props.submittedKeys, emit)
                                ])
                              ])
                            ])
                          )
                        : h('div', { class: 'hm-phase-empty' }, '该阶段暂无教学活动')
                    );
                  })
                ]
          ])
        ]),

        // 课后复盘
        h('div', { class: 'll-card' }, [
          h('div', { class: 'll-card-head' }, [
            h('div', { class: 'll-card-head-icon gradient' }, [h(Tickets, { size: 18 })]),
            h('span', { class: 'll-card-title' }, '课后复盘')
          ]),
          h('div', { class: 'll-card-body' }, [
            reviewModule.value?.data?.content
              ? h('div', { class: 'll-desc-text' }, reviewModule.value.data.content)
              : h('p', { class: 'll-no-desc' }, '暂无课后复盘')
          ])
        ]),

        h(
          'router-link',
          { to: `/lesson/landing/${props.courseId}`, class: 'hm-back-link' },
          '返回课程详情'
        )
      ]);
    };
  }
});

// 混合模块内容渲染（对齐 React renderModuleContent）
function renderModuleContent(
  m: CourseSnapshotHybridModule,
  node: { id: string },
  courseId: string,
  myResults: NodeEvaluationResult[],
  submittedKeys: Set<string>,
  emit: (e: 'evalAction', moduleKey: string, method: EvalMethodViewModel) => void
) {
  const data = m.data || {};
  const label = HYBRID_EVAL_MODULE_LABELS[m.module_key];

  if (label) {
    // 测评模块：解析 evalRules 并渲染测评卡片
    const ruleConfig = (data as any).evalRules || {};
    let methods: any[] = [];
    try {
      methods = evalRuleConfigToMethods(ruleConfig).filter((mm) => mm.isEnabled !== false);
    } catch {
      methods = [];
    }
    if (methods.length === 0) return null;

    return h('div', { class: 'hm-eval-module' }, [
      h('div', { class: 'hm-eval-module-head' }, [
        h('div', { class: 'hm-eval-module-icon' }, [h(Tickets, { size: 16 })]),
        h('h4', { class: 'hm-eval-module-title' }, label)
      ]),
      h(
        'div',
        { class: 'll-eval-grid' },
        methods.map((mm) => {
          const compositeKey = `${m.module_key}:${mm.methodKey}`;
          const result = myResults.find((r) => r.methodKey === compositeKey);
          const overridden = submittedKeys.has(compositeKey)
            ? { status: 'pending' }
            : result
              ? { status: result.status, totalScore: result.totalScore, maxScore: result.maxScore }
              : undefined;
          const view: EvalMethodViewModel = {
            methodKey: mm.methodKey,
            label: `${label} · ${methodLabel(mm.methodKey)}`,
            weight: mm.weight,
            resourceConfig: mm.resourceConfig,
            reviewSteps: mm.reviewSteps,
            evalPoints: mm.evalPoints
          };
          const examHrefVal = (() => {
            const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(mm.methodKey);
            if (!isExamMethod) return undefined;
            const examId = mm.methodKey === 'paper' ? mm.resourceConfig?.paperId : mm.resourceConfig?.examId;
            const usageId = mm.resourceConfig?.usageId;
            if (!examId) return undefined;
            return examHref(examId, {
              node: node.id,
              method: compositeKey,
              usage: usageId,
              course: courseId
            });
          })();
          return h(EvalMethodCard, {
            key: compositeKey,
            method: view,
            result: overridden,
            examHref: examHrefVal,
            onAction: () => emit('evalAction', m.module_key, {
              methodKey: mm.methodKey,
              weight: mm.weight,
              resourceConfig: mm.resourceConfig,
              reviewSteps: mm.reviewSteps,
              evalPoints: mm.evalPoints
            })
          });
        })
      )
    ]);
  }

  // 普通教学活动模块
  const preview = (url: string, name: string, type?: string) => {
    openPreview({ id: `attachment-${url}`, nodeId: node.id, url, name, type: type || 'file' });
  };

  const attachmentList = (items?: { name?: string; file?: string }[]) => {
    if (!items || items.length === 0) return null;
    return h(
      'div',
      { class: 'hm-attachments' },
      items.map((att, i) =>
        att.file
          ? h(
              'button',
              { key: i, type: 'button', class: 'hm-attachment', onClick: () => preview(att.file!, att.name || '附件') },
              [h(Document, { size: 14 }), att.name || '附件']
            )
          : h('span', { key: i, class: 'hm-attachment-tag' }, att.name || '附件')
      )
    );
  };

  const resourceList = (items?: { name?: string; url?: string; type?: string }[]) => {
    if (!items || items.length === 0) return null;
    return h(
      'div',
      { class: 'hm-attachments' },
      items.map((r, i) =>
        r.url
          ? h(
              'button',
              { key: i, type: 'button', class: 'hm-attachment', onClick: () => preview(r.url!, r.name || '资源', r.type) },
              [h(FolderOpened, { size: 14 }), r.name || '资源', r.type ? h('span', { class: 'hm-attach-type' }, `(${r.type})`) : null]
            )
          : h('span', { key: i, class: 'hm-attachment-tag' }, r.name || '资源')
      )
    );
  };

  const taskList = (items?: { name?: string; requirement?: string }[]) => {
    if (!items || items.length === 0) return null;
    return h(
      'div',
      { class: 'hm-tasks' },
      items.map((task, i) =>
        h('div', { key: i, class: 'hm-task' }, [
          h('div', { class: 'hm-task-name' }, task.name || `任务 ${i + 1}`),
          task.requirement ? h('p', { class: 'hm-task-req' }, task.requirement) : null
        ])
      )
    );
  };

  const sections = (items?: any[]) =>
    (items || []).map((s, i) =>
      h('div', { key: i, class: 'hm-task' }, [
        h('div', { class: 'hm-task-name' }, s.name || `环节 ${i + 1}`),
        s.content ? h('p', { class: 'hm-task-req' }, s.content) : null,
        attachmentList(s.attachments)
      ])
    );

  switch (m.module_key) {
    case 'prePreview':
      return h('div', { class: 'll-desc-text' }, [
        data.content ? h('p', { class: 'hm-mb' }, data.content) : null,
        attachmentList(data.attachments)
      ]);
    case 'preResources':
      return resourceList(data.resources);
    case 'preTasks':
      return taskList(data.tasks);
    case 'lecture':
      return h('div', {}, [
        data.content ? h('p', { class: 'll-desc-text hm-mb' }, data.content) : null,
        ...sections(data.sections),
        resourceList(data.resources)
      ]);
    case 'inClassTasks':
      return taskList(data.tasks);
    case 'classQuestions':
      return h(
        'div',
        { class: 'hm-tasks' },
        (data.questions || []).map((q: any, i: number) =>
          h('div', { key: i, class: 'hm-task' }, [
            h('div', { class: 'hm-task-name' }, [h(Message, { size: 14 }), ' ', q.stem]),
            q.answer ? h('p', { class: 'hm-task-req' }, `参考答案：${q.answer}`) : null
          ])
        )
      );
    case 'practiceTasks':
      return taskList(data.tasks);
    case 'extensionMaterials':
      return resourceList(data.resources);
    case 'trainingReports':
      return h(
        'div',
        { class: 'hm-tasks' },
        (data.reports || []).map((r: any, i: number) =>
          h('div', { key: i, class: 'hm-task' }, [
            h('div', { class: 'hm-task-name' }, [h(Document, { size: 14 }), ' ', r.name || `报告 ${i + 1}`, r.required ? h('span', { class: 'hm-required' }, '必修') : null]),
            r.template ? h('p', { class: 'hm-task-req' }, r.template) : null,
            r.requirement ? h('p', { class: 'hm-task-req' }, r.requirement) : null,
            attachmentList(r.attachments)
          ])
        )
      );
    case 'homeworks':
      return taskList(
        (data.items || []).map((hItem: any) => ({ name: hItem.name || '作业要求', requirement: hItem.requirement }))
      );
    default:
      return null;
  }
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f1faff;
}

/* ===== 骨架屏 ===== */
.skeleton-block {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  animation: pulse 1.6s ease-in-out infinite;
}
.skeleton-header {
  height: 96px;
  border-radius: 0;
  border-left: none;
  border-right: none;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.ll-skeleton-side {
  height: 400px;
  width: 300px;
  flex-shrink: 0;
}
.ll-skeleton-main {
  flex: 1;
  min-height: 400px;
}

/* ===== 课程不存在 ===== */
.ll-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  min-height: 60vh;
}
.ll-empty-icon {
  color: #94a3b8;
  margin-bottom: 16px;
  opacity: 0.5;
}
.ll-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 12px;
}
.ll-empty-link {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
}
.ll-empty-link:hover {
  text-decoration: underline;
}

/* ===== 头部 ===== */
.ll-header {
  background: #fff;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  position: sticky;
  top: 0;
  z-index: 30;
}
.ll-header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ll-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ll-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  text-decoration: none;
  font-size: 14px;
  min-width: 0;
}
.ll-back:hover {
  color: var(--el-color-primary);
}
.ll-back-icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ll-back:hover .ll-back-icon {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.ll-back-name {
  font-weight: 600;
  color: #1e293b;
  max-width: 520px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ll-back:hover .ll-back-name {
  color: var(--el-color-primary);
}
.ll-header-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ll-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background: #f8fafc;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.8);
}
.ll-chip-primary {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}
.ll-header-bg {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
}

/* ===== 主体 ===== */
.ll-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
  align-items: stretch;
}
@media (min-width: 1024px) {
  .ll-body {
    flex-direction: row;
    align-items: flex-start;
  }
}

/* ===== 侧边栏 ===== */
.ll-sidebar {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  width: auto;
  max-height: 50vh;
}
@media (min-width: 1024px) {
  .ll-sidebar {
    position: sticky;
    top: 112px;
    max-height: calc(100vh - 8rem);
    width: 300px;
    flex-shrink: 0;
  }
  .ll-sidebar.collapsed {
    width: 68px;
  }
}
.ll-sidebar-head {
  position: relative;
  border-bottom: 1px solid #f1f5f9;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 16px;
}
.ll-sidebar-head::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-1));
}
.ll-sidebar-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
}
.ll-sidebar-toggle {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.ll-sidebar-toggle:hover {
  background: #f1f5f9;
  color: var(--el-color-primary);
}
.ll-sidebar.collapsed .ll-sidebar-toggle {
  margin-left: auto;
  margin-right: auto;
}
.ll-unit-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.ll-unit {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}
.ll-unit:hover {
  background: #f8fafc;
}
.ll-unit.active {
  background: linear-gradient(90deg, var(--el-color-primary-light-9), var(--el-color-primary-light-9), transparent);
}
.ll-unit-indicator {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: linear-gradient(180deg, var(--el-color-primary), var(--el-color-primary-light-1));
  border-radius: 0 4px 4px 0;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}
.ll-unit-index {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 0.2s;
}
.ll-unit:hover .ll-unit-index {
  background: #e2e8f0;
}
.ll-unit-index.active {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
}
.ll-unit-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ll-unit-name {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ll-unit-name.active {
  color: var(--el-color-primary);
}
.ll-unit-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ll-unit-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #94a3b8;
}
.ll-unit-badge-wrap {
  display: flex;
  justify-content: center;
  padding: 6px 0;
}
.ll-unit-badge {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.ll-unit-badge:hover {
  background: #e2e8f0;
}
.ll-unit-badge.active {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

/* ===== 主区 ===== */
.ll-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ll-main-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
}
.ll-main-empty-icon {
  position: relative;
  width: 112px;
  height: 112px;
  margin-bottom: 24px;
  color: #94a3b8;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ll-main-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 6px;
}
.ll-main-empty-hint {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

/* ===== 卡片 ===== */
.ll-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.ll-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
}
.ll-card-head-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  flex-shrink: 0;
}
.ll-card-head-icon.gradient {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  border: none;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}
.ll-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}
.ll-card-pdf-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  padding: 8px 14px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}
.ll-card-pdf-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}
.ll-card-body {
  padding: 24px 32px;
}
.ll-desc-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.9;
  white-space: pre-line;
}
.ll-no-desc {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

/* ===== 测评区 ===== */
.ll-eval-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ll-eval-head {
  display: flex;
  align-items: center;
  padding: 0 4px;
}
.ll-eval-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ll-eval-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}
.ll-eval-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}
.ll-eval-count {
  font-size: 12px;
  color: #64748b;
}
.ll-eval-score {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
}
.ll-eval-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .ll-eval-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.ll-eval-card {
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s;
}
.ll-eval-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}
.ll-eval-card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 132px;
}
.ll-eval-card-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.ll-eval-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.ll-eval-card-info {
  flex: 1;
  min-width: 0;
}
.ll-eval-card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ll-eval-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}
.ll-eval-card-weight {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid;
  color: #475569;
  flex-shrink: 0;
}
.ll-eval-card-desc {
  font-size: 12px;
  color: #475569;
  margin: 4px 0 0;
}
.ll-eval-card-footer {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}
.ll-eval-card-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: rgba(255, 255, 255, 0.8);
  color: #475569;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}
.ll-eval-card-btn:hover {
  background: #fff;
  border-color: #94a3b8;
  color: #1e293b;
}
.ll-btn-play {
  width: 0;
  height: 0;
  border-left: 6px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
}
.ll-result-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
}
.ll-result-badge.evaluated {
  color: #16a34a;
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.ll-result-badge.pending {
  color: #d97706;
  background: #fffbeb;
  border-color: #fde68a;
}
.ll-eval-empty {
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed #e2e8f0;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  color: #94a3b8;
}
.ll-eval-empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}
.ll-eval-empty-title {
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}
.ll-eval-empty-hint {
  font-size: 12px;
  margin-top: 4px;
}

/* ===== 右侧面板 ===== */
.ll-right {
  width: 100%;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 50vh;
}
@media (min-width: 1024px) {
  .ll-right {
    width: 360px;
    flex-shrink: 0;
    position: sticky;
    top: 112px;
    max-height: calc(100vh - 8rem);
  }
}
.ll-right-head {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.ll-right-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border: none;
  background: none;
  border-radius: 10px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}
.ll-right-tab.active {
  background: linear-gradient(90deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  color: var(--el-color-primary);
  font-weight: 500;
}
.ll-right-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.ll-kp-list,
.ll-res-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ll-kp-item,
.ll-res-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.2s;
}
.ll-kp-item:hover,
.ll-res-item:hover {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}
.ll-kp-index {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.ll-kp-info,
.ll-res-info {
  flex: 1;
  min-width: 0;
}
.ll-kp-name,
.ll-res-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ll-kp-desc {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ll-res-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: #f8fafc;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ll-res-meta {
  font-size: 11px;
  color: #94a3b8;
}
.ll-right-empty {
  text-align: center;
  padding: 32px 0;
  font-size: 13px;
  color: #94a3b8;
}

/* ===== 提交弹窗 ===== */
.ll-dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ll-dialog-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ll-dialog-icon.primary {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-7);
}
.ll-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.ll-dialog-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}
.ll-dialog-box {
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 16px;
  margin-bottom: 16px;
}
.ll-dialog-box-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 10px;
}
.ll-dialog-text {
  font-size: 13px;
  color: #475569;
  margin: 6px 0 0;
}
.pre-line {
  white-space: pre-wrap;
  line-height: 1.7;
}
.ll-dialog-strong {
  font-weight: 500;
  color: #334155;
}
.ll-review-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ll-review-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.ll-review-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 2px;
}
.ll-review-label {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  margin: 0;
}
.ll-review-desc {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0;
  line-height: 1.6;
}
.ll-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}
.ll-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ll-form-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.ll-form-textarea :deep(.el-textarea__inner) {
  font-size: 13px;
  resize: none;
}
.ll-file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ll-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  padding: 8px 12px;
  border-radius: 8px;
}
.ll-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ll-file-remove {
  border: none;
  background: none;
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
}
.ll-file-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ll-file-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
}
.ll-file-upload-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.ll-file-input {
  display: none;
}
.ll-file-uploading {
  font-size: 12px;
  color: #94a3b8;
}
.ll-teacher-led {
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  padding: 12px;
  margin-bottom: 16px;
}
.ll-teacher-led-text {
  font-size: 13px;
  color: var(--el-color-primary);
  margin: 0;
  line-height: 1.7;
}
.ll-submit-error {
  font-size: 12px;
  color: #ef4444;
  margin: 0 0 12px;
}
.ll-submit-success {
  text-align: center;
  padding: 32px 0;
}
.ll-submit-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #dcfce7;
  color: #16a34a;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}
.ll-submit-success-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px;
}
.ll-submit-success-sub {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}
.ll-dialog-cancel {
  border-radius: 8px;
}
.ll-dialog-submit {
  border-radius: 8px;
}

/* ===== 知识点弹窗 ===== */
.ll-kp-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ll-kp-dialog-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 6px;
}
.ll-kp-dialog-text {
  font-size: 13px;
  color: #334155;
  line-height: 1.8;
  margin: 0;
  white-space: pre-line;
}
.ll-kp-courses {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ll-kp-course {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  text-decoration: none;
  transition: all 0.2s;
}
.ll-kp-course:hover {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}
.ll-kp-course-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981, #14b8a6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ll-kp-course-info {
  flex: 1;
  min-width: 0;
}
.ll-kp-course-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ll-kp-course-sub {
  font-size: 11px;
  color: #94a3b8;
}
.ll-kp-course-arrow {
  color: #cbd5e1;
  flex-shrink: 0;
}
.ll-kp-no-courses {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

/* ===== 预览弹窗 ===== */
.ll-dialog-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
  flex-shrink: 0;
  margin-left: auto;
}
.ll-preview-body {
  height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
}
.ll-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.ll-preview-media {
  max-width: 100%;
  max-height: 100%;
}
.ll-preview-audio {
  width: 80%;
}
.ll-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
.ll-preview-external {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 13px;
}
.ll-preview-external-icon {
  opacity: 0.5;
}

/* ===== 混合课模块视图 ===== */
.hm-wrap {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hm-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  padding: 2px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
}
.hm-phases {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 20px;
}
.hm-phase {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: none;
  background: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}
.hm-phase.active {
  background: #fff;
  color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.hm-phase-count {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
}
.hm-phase.active .hm-phase-count {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.hm-modules {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hm-module {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.hm-module-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hm-module-body {
  flex: 1;
  min-width: 0;
}
.hm-module-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hm-module-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}
.hm-module-mode {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  font-weight: 500;
}
.hm-module-mode.online {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}
.hm-module-mode.offline {
  background: #fffbeb;
  color: #d97706;
  border-color: #fde68a;
}
.hm-module-content {
  margin-top: 8px;
}
.hm-phase-empty {
  text-align: center;
  padding: 40px 0;
  font-size: 12px;
  color: #94a3b8;
}
.hm-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
}
.hm-back-link:hover {
  opacity: 0.8;
}
.hm-eval-module {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hm-eval-module-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hm-eval-module-icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
}
.hm-eval-module-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}
.hm-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hm-attachment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.hm-attachment:hover {
  background: var(--el-color-primary-light-8);
}
.hm-attach-type {
  color: #94a3b8;
}
.hm-attachment-tag {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 6px 12px;
}
.hm-tasks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hm-task {
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 14px;
}
.hm-task-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}
.hm-task-req {
  font-size: 12px;
  color: #475569;
  margin: 6px 0 0;
  line-height: 1.7;
  white-space: pre-line;
}
.hm-mb {
  margin-bottom: 8px;
}
.hm-required {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  margin-left: 4px;
}

/* ===== 混合模块图标配色 ===== */
.bg-sky-soft { background: #f0f9ff; }
.text-sky-strong { color: #0284c7; }
.border-sky-soft-2 { border-color: #bae6fd; }
.bg-green-soft { background: #f0fdf4; }
.text-green-strong { color: #16a34a; }
.border-green-soft-2 { border-color: #bbf7d0; }
.bg-cyan-soft { background: #ecfeff; }
.text-cyan-strong { color: #0891b2; }
.border-cyan-soft-2 { border-color: #a5f3fc; }
.bg-blue-soft { background: #eff6ff; }
.text-blue-strong { color: #2563eb; }
.border-blue-soft-2 { border-color: #bfdbfe; }
.bg-violet-soft { background: #f5f3ff; }
.text-violet-strong { color: #7c3aed; }
.border-violet-soft-2 { border-color: #ddd6fe; }
.bg-indigo-soft { background: #eef2ff; }
.text-indigo-strong { color: #4f46e5; }
.border-indigo-soft-2 { border-color: #c7d2fe; }
.bg-purple-soft { background: #faf5ff; }
.text-purple-strong { color: #9333ea; }
.border-purple-soft-2 { border-color: #e9d5ff; }
.bg-pink-soft { background: #fdf2f8; }
.text-pink-strong { color: #db2777; }
.border-pink-soft-2 { border-color: #fbcfe8; }
.bg-amber-soft { background: #fffbeb; }
.text-amber-strong { color: #d97706; }
.border-amber-soft-2 { border-color: #fde68a; }
.bg-teal-soft { background: #f0fdfa; }
.text-teal-strong { color: #0d9488; }
.border-teal-soft-2 { border-color: #99f6e4; }
.bg-orange-soft { background: #fff7ed; }
.text-orange-strong { color: #ea580c; }
.border-orange-soft-2 { border-color: #fed7aa; }
.bg-gray-soft { background: #f1f5f9; }
.text-gray-strong { color: #64748b; }
.border-gray-soft-2 { border-color: #e2e8f0; }
</style>
