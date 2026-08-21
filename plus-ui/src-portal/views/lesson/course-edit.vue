<template>
  <div class="edit-page">
    <!-- ========== 顶部操作栏 ========== -->
    <div class="editor-header">
      <div class="header-left">
        <el-button size="small" @click="onBack">
          <el-icon><Close /></el-icon>
          取消
        </el-button>
        <h1 class="header-title">{{ isEdit ? '编辑体系课' : '新建体系课' }}</h1>
      </div>
      <div class="header-right">
        <el-button size="small" :loading="saving" @click="handleSave">保存草稿</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="handleFinish">完成配置</el-button>
      </div>
    </div>

    <!-- ========== 全局课程信息（可折叠） ========== -->
    <div class="global-card" v-loading="loading">
      <div class="global-header" @click="globalInfoOpen = !globalInfoOpen">
        <div class="global-title">
          <el-icon color="#409eff"><Reading /></el-icon>
          <span class="global-title-text">全局课程信息</span>
          <span class="global-sub">{{ courseName ? `《${courseName}》` : '未填写课程名称' }}</span>
          <el-tag v-if="major" size="small" type="info" disable-transitions>{{ majorName }}</el-tag>
        </div>
        <div class="global-toggle">
          <span class="toggle-text">{{ globalInfoOpen ? '收起' : '展开编辑' }}</span>
          <el-icon><ArrowDown v-if="globalInfoOpen" /><ArrowRight v-else /></el-icon>
        </div>
      </div>
      <p v-if="!globalInfoOpen && courseDescription" class="global-desc">{{ courseDescription }}</p>

      <div v-if="globalInfoOpen" class="global-body">
        <!-- 左：名称 + 简介 -->
        <div class="global-left">
          <div class="form-field">
            <label class="field-label">课程名称</label>
            <el-input v-model="courseName" placeholder="请输入课程名称" />
          </div>
          <div class="form-field">
            <label class="field-label">课程简介</label>
            <DescriptionEditor
              v-model:value="courseDescription"
              v-model:pdf-url="courseDescriptionPdf"
              placeholder="请输入课程简介..."
              :min-height="280"
              rich-text-label="自定义编辑"
              pdf-tab-label="上传自定义文件"
              upload-hint="点击或拖拽上传课程说明书"
            />
          </div>
        </div>
        <!-- 右：封面 + 专业/批次 + 能力点 -->
        <div class="global-right">
          <div class="cover-field">
            <label class="field-label">课程封面</label>
            <div class="cover-box" @click="!coverUploading && coverInput?.click()">
              <input ref="coverInput" type="file" accept="image/*" class="hidden-input" @change="onCoverSelect" />
              <img v-if="coverImage" :src="coverImage" alt="课程封面" class="cover-img" />
              <div v-if="coverImage" class="cover-overlay">
                <el-button size="small" :disabled="coverUploading" @click.stop="coverInput?.click()">
                  <el-icon v-if="coverUploading" class="is-loading"><Loading /></el-icon>
                  <template v-else>更换封面</template>
                </el-button>
                <el-button size="small" :disabled="coverUploading" @click.stop="coverImage = ''">移除封面</el-button>
              </div>
              <div v-else class="cover-placeholder">
                <el-icon :size="28" color="#c0c4cc">
                  <Loading v-if="coverUploading" class="is-loading" />
                  <UploadFilled v-else />
                </el-icon>
                <span class="cover-text">{{ coverUploading ? '上传中...' : '点击上传课程封面' }}</span>
              </div>
            </div>
          </div>
          <div class="two-col">
            <div class="form-field">
              <label class="field-label">适用专业</label>
              <el-select v-model="major" clearable placeholder="请选择适用专业" style="width: 100%">
                <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </div>
            <div class="form-field">
              <label class="field-label">所属批次</label>
              <el-select v-model="batchId" clearable placeholder="请选择批次" style="width: 100%">
                <el-option label="不关联批次" value="" />
                <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">关联能力点（用于岗位能力汇聚）</label>
            <AbilityPointSelector
              :selected="abilityPoints"
              :pool="abilityPool"
              @change="(v) => (abilityPoints = v)"
              @add-custom="onAddAbilityCustom"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 三栏布局 ========== -->
    <div class="layout">
      <!-- 左：课程节点树 -->
      <SystemCourseTree
        :nodes="nodes"
        :selected-node-id="selectedNodeId"
        @select="(id) => (selectedNodeId = id)"
        @add-node="handleAddNode"
        @update-node="handleUpdateNode"
        @delete-node="handleDeleteNode"
        @reorder-nodes="handleReorderNodes"
      />

      <!-- 中：内容模块 -->
      <main class="center">
        <!-- 引用模式提示 -->
        <div v-if="selectedNode?.type === 'original'" class="original-banner">
          <div class="banner-icon"><el-icon color="#409eff"><MagicStick /></el-icon></div>
          <p class="banner-text">当前节点的课程内容将被纳入颗粒课管理体系，支持跨课程复用。</p>
        </div>

        <div v-if="!selectedNode" class="no-node">
          <el-icon :size="32" color="#c0c4cc"><InfoFilled /></el-icon>
          <p>请从左侧目录选择一个节点进行编辑</p>
        </div>

        <!-- 选择编辑方式 -->
        <div
          v-else-if="selectedNode.type !== 'original' && !nodeModes[selectedNode.id]"
          class="module-card"
        >
          <div class="module-head">
            <el-icon color="#409eff"><Reading /></el-icon>
            <span class="module-title">选择编辑方式</span>
          </div>
          <div class="mode-grid">
            <div class="mode-card upload" @click="handleSelectUploadMode">
              <div class="mode-icon"><el-icon :size="24" color="#fff"><Upload /></el-icon></div>
              <p class="mode-label">自定义编排节点资源</p>
              <p class="mode-desc">自行上传并编辑课程资源</p>
            </div>
            <div class="mode-card clone" @click="openGrainSelector('clone')">
              <div class="mode-icon"><el-icon :size="24" color="#fff"><CopyDocument /></el-icon></div>
              <p class="mode-label">克隆颗粒课</p>
              <p class="mode-desc">复制颗粒课内容生成独立节点</p>
            </div>
            <div class="mode-card quote" @click="openGrainSelector('quote')">
              <div class="mode-icon"><el-icon :size="24" color="#fff"><Link /></el-icon></div>
              <p class="mode-label">引用已有颗粒课</p>
              <p class="mode-desc">引用颗粒课内容，关联可同步编辑</p>
            </div>
          </div>
        </div>

        <!-- 节点编辑模块 -->
        <template v-else>
          <!-- Module 1: 基本信息 -->
          <div class="module-card">
            <div class="module-head">
              <el-icon color="#409eff"><Reading /></el-icon>
              <span class="module-title">基本信息配置</span>
              <span v-if="isQuoteMode" class="quote-hint">（引用模式，不可编辑）</span>
            </div>
            <fieldset :disabled="isQuoteMode" class="fieldset" :class="{ disabled: isQuoteMode }">
              <div class="two-col">
                <div class="form-field">
                  <label class="field-label">内容名称</label>
                  <el-input :model-value="selectedNode.name || ''" placeholder="请输入内容名称" @update:model-value="onNodeNameInput" />
                </div>
                <div class="form-field">
                  <label class="field-label">节点编码</label>
                  <el-input :model-value="contentCode" disabled class="code-input" />
                  <p class="field-tip">系统自动生成，不可修改</p>
                </div>
              </div>
              <div class="form-field task-field">
                <div class="task-row">
                  <div class="task-half">
                    <label class="field-label">课时数</label>
                    <el-input-number v-model="hours" :min="0" :controls="false" style="width: 100%" placeholder="课时数" />
                  </div>
                  <div class="task-half">
                    <label class="field-label">难度</label>
                    <div class="stars">
                      <el-icon
                        v-for="n in 5"
                        :key="n"
                        :size="22"
                        :color="n <= difficulty ? '#e6a23c' : '#dcdfe6'"
                        class="star"
                        @click="difficulty = n"
                      >
                        <StarFilled />
                      </el-icon>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">节点详细说明</label>
                <DescriptionEditor
                  v-model:value="detailedDescription"
                  v-model:pdf-url="learningGoalPdf"
                  rich-text-label="富文本编辑"
                  pdf-tab-label="上传任务说明书"
                  upload-hint="点击或拖拽上传任务说明书"
                  text-hint="可编写详细的操作手册（当前为纯文本模式，支持 Markdown 语法）"
                  :min-height="300"
                />
              </div>
            </fieldset>
          </div>

          <!-- Module 2: 关联知识点 -->
          <div class="module-card">
            <div class="module-head">
              <el-icon color="#409eff"><GraduationCap /></el-icon>
              <span class="module-title">关联知识点</span>
            </div>
            <fieldset :disabled="isQuoteMode" class="fieldset" :class="{ disabled: isQuoteMode }">
              <KnowledgeSelector
                :selected="knowledgePoints"
                :pool="knowledgePool"
                @change="(v) => (knowledgePoints = v)"
                @add-custom="onAddCustomKp"
              />
            </fieldset>
          </div>

          <!-- Module 3: 配置课程资源 -->
          <div class="module-card">
            <div class="module-head">
              <el-icon color="#409eff"><Reading /></el-icon>
              <span class="module-title">配置课程资源</span>
            </div>
            <fieldset :disabled="isQuoteMode" class="fieldset" :class="{ disabled: isQuoteMode }">
              <ResourceSelector
                :pool="resourcePool"
                :selected-ids="selectedResourceIds"
                :course-id="courseId || editId || ''"
                :node-id="selectedNodeId || ''"
                @change="(v) => (selectedResourceIds = v)"
                @upload="onResourceUpload"
              />
            </fieldset>
          </div>

          <!-- Module 4: 配置节点测评（始终可编辑） -->
          <div class="module-card">
            <div class="module-head">
              <el-icon color="#409eff"><Tickets /></el-icon>
              <span class="module-title">配置节点测评</span>
            </div>
            <EvalMethodConfig
              :value="nodeEvalRuleConfig"
              :knowledge-points="knowledgePoints"
              :ability-points="abilityPoints"
              @change="(v) => (nodeEvalRuleConfig = v)"
            />
          </div>
        </template>

        <div class="bottom-space" />
      </main>

      <!-- 右：发布检查 -->
      <PublishCheckPanel :node="currentCheckNode" />
    </div>

    <!-- ========== 颗粒课选择对话框（克隆/引用） ========== -->
    <el-dialog
      v-model="showGrainSelector"
      :title="grainSelectorMode === 'clone' ? '选择要克隆的颗粒课' : '选择要引用的颗粒课'"
      width="600px"
      top="8vh"
      append-to-body
    >
      <el-input v-model="grainSearch" placeholder="搜索颗粒课名称、来源..." clearable class="grain-search">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div class="grain-list">
        <el-empty v-if="filteredGrainCourses.length === 0" description="未找到匹配的颗粒课" :image-size="56" />
        <div
          v-for="g in filteredGrainCourses"
          :key="g.id"
          class="grain-item"
          :class="{ selected: grainSelectedId === g.id }"
          @click="grainSelectedId = g.id"
        >
          <div class="grain-head">
            <el-icon class="grain-check" :color="grainSelectedId === g.id ? '#409eff' : '#c0c4cc'">
              <CircleCheck v-if="grainSelectedId === g.id" />
              <CircleCheckFilled v-else class="unchecked" />
            </el-icon>
            <span class="grain-name">{{ g.name }}</span>
            <el-tag size="small" type="info" disable-transitions>{{ g.source }}</el-tag>
          </div>
          <p class="grain-desc">{{ g.description }}</p>
          <p class="grain-duration">{{ g.duration }} 课时</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showGrainSelector = false">取消</el-button>
        <el-button type="primary" :disabled="!grainSelectedId" @click="handleGrainConfirm">确认选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { request } from '@/api/http';
import { courseApi, courseNodeApi, knowledgeApi, lessonBatchApi } from '@/api/lesson';
import { majorApi } from '@/api/system';
import { abilityApi } from '@/api/job';
import { resourceLibraryApi } from '@/api/library';
import { fileApi } from '@/api/import-export';
import SystemCourseTree from './system-course-tree.vue';
import KnowledgeSelector from './knowledge-selector.vue';
import AbilityPointSelector from './ability-point-selector.vue';
import ResourceSelector from './resource-selector.vue';
import EvalMethodConfig from './eval-method-config.vue';
import DescriptionEditor from './description-editor.vue';
import PublishCheckPanel from './publish-check-panel.vue';
import {
  fetchAllPages,
  uid,
  clone,
  buildNodeSavePayload,
  resolveKnowledgePointIds,
  resolveResourceIds,
  wouldCreateCycle,
  type SysNode,
  type NodeDraft,
  type KnowledgePointItem,
  type ResourceItem,
  type NodeResourceItem,
  type AbilityPointItem,
  type EvalRuleConfig
} from './lesson-edit-utils';

/* ---------- 路由 ---------- */

const route = useRoute();
const router = useRouter();
const editId = ((route.query.id as string) || (route.params.id as string) || '').toString();
const isEdit = !!editId;
const isNewCourse = route.query.new === 'true' || !editId;

type AddMode = 'upload' | 'clone' | 'quote';

/* ---------- 全局配置 ---------- */

const globalInfoOpen = ref(false);
const courseId = ref(editId);
const courseName = ref('');
const contentCode = ref(`CNT-${Date.now().toString(36).toUpperCase()}`);
const major = ref('');
const majors = ref<{ id: string; name: string }[]>([]);
const courseDescription = ref('');
const coverImage = ref('');
const coverUploading = ref(false);
const batchId = ref('');
const batches = ref<{ id: string; name: string }[]>([]);
const originalStatus = ref('draft');
const courseDescriptionPdf = ref<string | null>(null);
const existingCourseEvalData = ref<Record<string, any>>({});
const loading = ref(false);
const hasSaved = ref(false);

const majorName = computed(() => majors.value.find((m) => m.id === major.value)?.name || major.value);

/* ---------- 课程节点树 ---------- */

const nodes = ref<SysNode[]>([]);
const selectedNodeId = ref<string | null>(null);
const nodeModes = ref<Record<string, AddMode>>({});
const resourcePool = ref<ResourceItem[]>([]);

const selectedNodeIdRef = ref<string | null>(null);
watch(selectedNodeId, (v) => (selectedNodeIdRef.value = v), { immediate: true });

/* ---------- 能力点（课程级） ---------- */

const abilityPoints = ref<AbilityPointItem[]>([]);
const abilityPool = ref<AbilityPointItem[]>([]);
const abilityPoolRef = ref<AbilityPointItem[]>([]);
watch(abilityPool, (v) => (abilityPoolRef.value = v), { immediate: true });

/* ---------- 节点测评配置 ---------- */

const nodeEvalRuleConfig = ref<EvalRuleConfig | undefined>(undefined);
const nodeEvalMethods = computed<string[]>(() => nodeEvalRuleConfig.value?.evaluationMethods || []);

/* ---------- 草稿缓存 ---------- */

const nodeDrafts = ref<Record<string, NodeDraft>>({});
const nodeDraftsRef = ref<Record<string, NodeDraft>>({});
const nodesRef = ref<SysNode[]>([]);
watch(nodeDrafts, (v) => (nodeDraftsRef.value = v), { immediate: true });
watch(nodes, (v) => (nodesRef.value = v), { immediate: true });

/* ---------- 节点表单状态 ---------- */

const hours = ref('');
const learningGoal = ref('');
const learningGoalPdf = ref<string | null>(null);
const detailedDescription = ref('');
const background = ref('');
const estimatedHours = ref('');
const knowledgePoints = ref<KnowledgePointItem[]>([]);
const knowledgePool = ref<KnowledgePointItem[]>([]);
const selectedResourceIds = ref<string[]>([]);
const difficulty = ref(0);

/* ---------- 加载：能力点池 / 专业 / 批次 / 颗粒课 / 知识点池 / 课程 ---------- */

onMounted(() => {
  abilityApi
    .list({ limit: 1000 })
    .then((res) => {
      const pool = (res.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        code: a.code,
        description: a.description
      }));
      abilityPool.value = pool;
      // 能力点池晚于课程加载时，回填课程能力点名称
      abilityPoints.value = abilityPoints.value.map((ap) => {
        if (ap.name !== ap.id) return ap;
        const found = pool.find((a) => a.id === ap.id);
        return found || ap;
      });
    })
    .catch(() => {
      abilityPool.value = [];
    });

  majorApi
    .list({ limit: 1000 })
    .then((res) => {
      majors.value = (res.items || []).filter((m: any) => m.enabled);
    })
    .catch(() => {
      majors.value = [];
    });

  lessonBatchApi
    .list({ limit: 1000 })
    .then((res) => {
      batches.value = (res.items || []).map((b: any) => ({ id: b.id, name: b.name }));
    })
    .catch(() => {
      batches.value = [];
    });

  courseApi
    .list({ type: 'granular' })
    .then((res) => {
      grainCourses.value = (res.items || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || c.category || '',
        source: c.majorName || c.creatorId || 'unknown',
        duration: c.onlineHours ?? c.nodeCount ?? 0,
        difficulty: c.difficulty ?? 0
      }));
    })
    .catch(() => {
      grainCourses.value = [];
    });

  fetchAllPages(({ limit, offset }) => knowledgeApi.list({ limit, offset }))
    .then((items) => {
      const customIds = new Set<string>();
      items.forEach((k: any) => {
        if (k.sourceType === 'course' && k.sourceId === editId) {
          customIds.add(k.id);
        }
      });
      knowledgePool.value = items.map((k: any) => ({
        id: k.id,
        name: k.name,
        code: k.code,
        description: k.description,
        linked: !customIds.has(k.id)
      }));
    })
    .catch(() => {
      knowledgePool.value = [];
    });

  if (editId) {
    void loadCourse(editId);
  }
});

async function loadCourse(id: string) {
  loading.value = true;
  try {
    const [course, nodeRes, resRes] = await Promise.all([
      courseApi.get(id),
      courseNodeApi.list({ courseId: id, limit: 500 }),
      request<{ items: ResourceItem[]; total: number }>(
        `/lesson/node-resources?courseId=${encodeURIComponent(id)}&limit=200`
      )
    ]);
    courseId.value = course.id;
    courseName.value = course.name || '';
    if (course.code) contentCode.value = course.code;
    if (course.description) courseDescription.value = course.description;
    courseDescriptionPdf.value = (course.evalData as any)?.descriptionPdf || null;
    existingCourseEvalData.value = (course.evalData as Record<string, any>) || {};
    if (course.coverImage) coverImage.value = course.coverImage;
    if (course.majorId) major.value = course.majorId;
    if (course.batchId) batchId.value = course.batchId;
    originalStatus.value = course.status || 'draft';
    abilityPoints.value = (course.abilityPointIds || []).map((aId: string) => {
      const found = abilityPoolRef.value.find((a) => a.id === aId);
      return found || { id: aId, name: aId };
    });
    resourcePool.value = (resRes.items || []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      url: r.url,
      description: r.description,
      size: r.size,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt
    }));
    const loadedNodes = (nodeRes.items || []) as SysNode[];
    nodes.value = loadedNodes;
    if (loadedNodes.length > 0) {
      selectedNodeId.value = loadedNodes[0].id;
    }
    const initialModes: Record<string, AddMode> = {};
    loadedNodes.forEach((n) => {
      initialModes[n.id] = n.type === 'original' ? 'quote' : 'upload';
    });
    nodeModes.value = { ...nodeModes.value, ...initialModes };
  } catch (e) {
    ElMessage.error((e as Error).message || '加载课程失败');
  } finally {
    loading.value = false;
  }
}

/* ---------- 节点操作 ---------- */

function handleAddNode(
  parentId: string | null,
  name: string,
  order: number,
  type?: string,
  sourceId?: string,
  sourceName?: string
) {
  const newNode: SysNode = {
    id: uid('node'),
    courseId: courseId.value || 'course-1',
    parentId,
    name,
    order,
    type: (type as SysNode['type']) || 'normal',
    status: 'draft',
    sourceId,
    sourceName
  };
  nodes.value = [...nodes.value, newNode];
  selectedNodeId.value = newNode.id;
}

function handleUpdateNode(nodeId: string, updates: Partial<SysNode>) {
  nodes.value = nodes.value.map((n) => (n.id === nodeId ? { ...n, ...updates } : n));
}

function handleDeleteNode(nodeId: string) {
  const deleteIds = new Set<string>();
  const collect = (id: string) => {
    deleteIds.add(id);
    nodes.value.filter((n) => n.parentId === id).forEach((n) => collect(n.id));
  };
  collect(nodeId);
  nodes.value = nodes.value.filter((n) => !deleteIds.has(n.id));
  if (selectedNodeId.value && deleteIds.has(selectedNodeId.value)) {
    selectedNodeId.value = null;
  }
}

function handleReorderNodes(
  nodeId: string,
  targetNodeId: string,
  position: 'before' | 'after' = 'after'
) {
  const prev = nodes.value;
  const dragged = prev.find((n) => n.id === nodeId);
  const target = prev.find((n) => n.id === targetNodeId);
  if (!dragged || !target) return;
  if (wouldCreateCycle(prev, nodeId, targetNodeId)) return;
  const orderOffset = position === 'before' ? -0.5 : 0.5;
  const newNodes = prev.map((n) =>
    n.id === nodeId ? { ...n, parentId: target.parentId, order: target.order + orderOffset } : n
  );
  const siblings = newNodes
    .filter((n) => n.parentId === target.parentId)
    .sort((a, b) => a.order - b.order);
  siblings.forEach((n, idx) => {
    const idxInPrev = newNodes.findIndex((x) => x.id === n.id);
    if (idxInPrev >= 0) {
      newNodes[idxInPrev] = { ...newNodes[idxInPrev], order: idx + 1 };
    }
  });
  nodes.value = [...newNodes];
}

/* ---------- 当前节点表单 ---------- */

const selectedNode = computed<SysNode | undefined>(() =>
  nodes.value.find((n) => n.id === selectedNodeId.value)
);

const isQuoteMode = computed(
  () => nodeModes.value[selectedNodeId.value || ''] === 'quote' || selectedNode.value?.type === 'original'
);

function onNodeNameInput(v: string) {
  if (selectedNodeId.value) {
    handleUpdateNode(selectedNodeId.value, { name: v });
  }
}

function resetFormFromNode(node: SysNode | undefined) {
  if (!node) {
    hours.value = '';
    learningGoal.value = '';
    learningGoalPdf.value = null;
    knowledgePoints.value = [];
    selectedResourceIds.value = [];
    difficulty.value = 0;
    nodeEvalRuleConfig.value = undefined;
    return;
  }
  hours.value = String(node.duration || '');
  learningGoal.value = node.teachingGoals || '';
  learningGoalPdf.value = node.descriptionPdf || null;
  detailedDescription.value = node.detailedDescription || '';
  background.value = node.background || '';
  estimatedHours.value = node.estimatedHours ? String(node.estimatedHours) : '';
  knowledgePoints.value = (node.knowledgePoints || []).map((kp) => ({
    id: kp.id,
    name: kp.name,
    code: kp.code,
    description: kp.description,
    linked: true
  }));
  selectedResourceIds.value = (node.resources || []).map((r) => r.id);
  difficulty.value = node.difficulty || 0;
  const nodeEvalData = (node.evalData || {}) as { methods?: string[]; evalRuleConfig?: EvalRuleConfig };
  nodeEvalRuleConfig.value = nodeEvalData.evalRuleConfig;
}

// 切换节点时加载草稿或节点数据
watch(selectedNodeId, () => {
  const sid = selectedNodeId.value;
  const draft = sid ? nodeDraftsRef.value[sid] : undefined;
  const node = sid ? nodesRef.value.find((n) => n.id === sid) : undefined;
  if (draft) {
    hours.value = draft.hours;
    learningGoal.value = draft.learningGoal;
    learningGoalPdf.value = draft.learningGoalPdf;
    detailedDescription.value = draft.detailedDescription;
    background.value = draft.background;
    estimatedHours.value = draft.estimatedHours;
    knowledgePoints.value = [...draft.knowledgePoints];
    selectedResourceIds.value = [...draft.selectedResourceIds];
    difficulty.value = draft.difficulty;
    nodeEvalRuleConfig.value = draft.evalData?.evalRuleConfig;
  } else if (node) {
    resetFormFromNode(node);
  } else {
    resetFormFromNode(undefined);
  }
});

// 表单变化时保存草稿
watch(
  [
    selectedNodeId,
    hours,
    learningGoal,
    learningGoalPdf,
    detailedDescription,
    background,
    estimatedHours,
    knowledgePoints,
    selectedResourceIds,
    nodeEvalRuleConfig,
    difficulty
  ],
  () => {
    const sid = selectedNodeId.value;
    if (!sid) return;
    nodeDrafts.value = {
      ...nodeDrafts.value,
      [sid]: {
        hours: hours.value,
        learningGoal: learningGoal.value,
        learningGoalPdf: learningGoalPdf.value,
        detailedDescription: detailedDescription.value,
        background: background.value,
        estimatedHours: estimatedHours.value,
        knowledgePoints: [...knowledgePoints.value],
        selectedResourceIds: [...selectedResourceIds.value],
        selectedEvalMethods: [...nodeEvalMethods.value],
        evalData: {
          methods: [...nodeEvalMethods.value],
          evalRuleConfig: nodeEvalRuleConfig.value ? clone(nodeEvalRuleConfig.value) : undefined
        },
        difficulty: difficulty.value
      }
    };
  }
);

/* ---------- 节点编辑方式选择 ---------- */

const showGrainSelector = ref(false);
const grainSelectorMode = ref<AddMode>('clone');
const grainSearch = ref('');
const grainSelectedId = ref<string | null>(null);
const grainCourses = ref<GrainCourseOption[]>([]);

interface GrainCourseOption {
  id: string;
  name: string;
  description: string;
  source: string;
  duration: number;
  difficulty: number;
}

const filteredGrainCourses = computed(() => {
  const kw = grainSearch.value.trim();
  if (!kw) return grainCourses.value;
  return grainCourses.value.filter(
    (g) => g.name.includes(kw) || g.description.includes(kw) || g.source.includes(kw)
  );
});

function openGrainSelector(mode: AddMode) {
  grainSelectorMode.value = mode;
  grainSearch.value = '';
  grainSelectedId.value = null;
  showGrainSelector.value = true;
}

function handleSelectUploadMode() {
  if (!selectedNodeId.value) return;
  nodeModes.value = { ...nodeModes.value, [selectedNodeId.value]: 'upload' };
}

async function handleGrainConfirm() {
  if (!grainSelectedId.value || !selectedNodeId.value) return;
  const grain = grainCourses.value.find((g) => g.id === grainSelectedId.value);
  if (!grain) return;

  const isQuote = grainSelectorMode.value === 'quote';
  const confirmNodeId = selectedNodeId.value;
  handleUpdateNode(selectedNodeId.value, {
    name: grain.name,
    sourceId: grain.id,
    sourceName: grain.name,
    duration: grain.duration,
    difficulty: grain.difficulty,
    teachingGoals: grain.description,
    type: isQuote ? 'original' : 'normal'
  });
  nodeModes.value = { ...nodeModes.value, [selectedNodeId.value]: grainSelectorMode.value };
  hours.value = String(grain.duration);
  learningGoal.value = grain.description;
  difficulty.value = grain.difficulty;
  showGrainSelector.value = false;

  try {
    const grainFull = await courseApi.get(grain.id);
    if (confirmNodeId !== selectedNodeIdRef.value) return;
    learningGoalPdf.value = (grainFull.evalData as any)?.descriptionPdf || null;
    const grainKpIds = (grainFull.knowledgePointIds || []).filter((id): id is string => !!id);
    const grainKpNames = new Map<string, string>();
    (grainFull.knowledgePointNames || []).forEach((name, i) => {
      const id = grainKpIds[i];
      if (id && name) grainKpNames.set(id, name);
    });
    knowledgePoints.value = grainKpIds.map((id) => {
      const fromPool = knowledgePool.value.find((k) => k.id === id);
      if (fromPool) return fromPool;
      return { id, name: grainKpNames.get(id) || id, linked: true };
    });
    const grainResIds = new Set((grainFull.resourceIds || []).filter((id): id is string => !!id));
    selectedResourceIds.value = Array.from(grainResIds);
    if (grainResIds.size > 0 && !isQuote) {
      try {
        const libRes = await resourceLibraryApi.list({ limit: 1000 });
        const grainResources: ResourceItem[] = (libRes.items || [])
          .filter((r: any) => grainResIds.has(r.id))
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.resourceType,
            url: r.url,
            description: r.description,
            size: r.fileSize
          }));
        resourcePool.value = (() => {
          const existing = new Set(resourcePool.value.map((x) => x.id));
          const toAdd = grainResources.filter((r) => !existing.has(r.id));
          return [...resourcePool.value, ...toAdd];
        })();
      } catch {
        ElMessage.error('加载颗粒课资源失败');
      }
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '加载知识点失败');
    if (confirmNodeId === selectedNodeIdRef.value) {
      knowledgePoints.value = [];
      selectedResourceIds.value = [];
      nodeEvalRuleConfig.value = undefined;
    }
  }
}

/* ---------- 自定义知识点 / 能力点 ---------- */

function onAddCustomKp(_name: string, _description?: string) {
  // 选择器内部已通过 change 事件把本地 kp-custom-* 条目追加到 knowledgePoints，
  // 保存时 saveNodes 会调用 knowledgeApi.create 持久化（sourceType=course_node）。
  // 此处无需额外处理，与 React 页面行为一致（onAddCustom 仅作通知）。
}

async function onAddAbilityCustom(name: string, description?: string) {
  try {
    // 先创建真实能力点换取 ID，避免 ap-custom-* 假 ID 随 abilityPointIds 入库
    const created = await abilityApi.create({
      name,
      description,
      attributes: [],
      isPublic: false
    } as any);
    const real: AbilityPointItem = {
      id: created.id,
      name: created.name,
      code: created.code,
      description: created.description
    };
    abilityPoints.value = [...abilityPoints.value, real];
    abilityPool.value = [...abilityPool.value, real];
  } catch (e) {
    ElMessage.error((e as Error).message || '创建能力点失败');
  }
}

function onResourceUpload(r: ResourceItem) {
  resourcePool.value = resourcePool.value.some((x) => x.id === r.id)
    ? resourcePool.value
    : [r, ...resourcePool.value];
}

/* ---------- 保存 ---------- */

const saving = ref(false);

async function saveNodes(effectiveCourseId: string) {
  const allDrafts = { ...nodeDraftsRef.value };

  // 删除后端存在但本地已删除的节点
  const currentBackendNodes = await courseNodeApi.list({ courseId: effectiveCourseId, limit: 500 });
  const backendNodeIds = new Set((currentBackendNodes.items || []).map((n: any) => n.id));
  const localNodeIds = new Set(nodesRef.value.map((n) => n.id).filter((id) => !id.startsWith('node-')));
  for (const backendId of backendNodeIds) {
    if (!localNodeIds.has(backendId)) {
      try {
        await courseNodeApi.delete(backendId);
      } catch {
        // 删除多余课程节点失败不阻断主流程
      }
    }
  }

  // 父节点必须先于子节点创建（parent_id 外键）：按层级拓扑排序
  const sortedNodes = (() => {
    const all = [...nodesRef.value].sort((a, b) => a.order - b.order);
    const byId = new Map(all.map((n) => [n.id, n]));
    const out: SysNode[] = [];
    const visited = new Set<string>();
    const visit = (n: SysNode) => {
      if (visited.has(n.id)) return;
      visited.add(n.id);
      if (n.parentId && byId.has(n.parentId)) {
        visit(byId.get(n.parentId)!);
      }
      out.push(n);
    };
    all.forEach(visit);
    return out;
  })();

  // 临时 ID -> 真实 ID
  const idMapping = new Map<string, string>();

  for (const node of sortedNodes) {
    const draft = allDrafts[node.id];
    const isTempId = node.id.startsWith('node-');
    const realParentId = node.parentId ? idMapping.get(node.parentId) || node.parentId : undefined;

    // 自定义知识点：先持久化创建，用真实 ID 替换临时 ID
    const kpList: KnowledgePointItem[] = draft?.knowledgePoints || node.knowledgePoints || [];
    const kpIdMapping = new Map<string, string>();
    for (const kp of kpList) {
      if (!kp.id.startsWith('kp-custom-')) continue;
      try {
        const created = await knowledgeApi.create({
          name: kp.name,
          code: undefined,
          description: kp.description,
          linked: false,
          granularLessonIds: []
        });
        kpIdMapping.set(kp.id, created.id);
      } catch {
        throw new Error(`创建自定义知识点「${kp.name}」失败`);
      }
    }
    const knowledgePointIds = resolveKnowledgePointIds(kpList, kpIdMapping);

    // 资源：已入库的直接走绑定，本地临时资源等节点创建后再上传
    const resIds = draft?.selectedResourceIds || node.resources?.map((r) => r.id) || [];
    const { existingResourceIds, localResources } = resolveResourceIds(
      resIds,
      resourcePool.value,
      node.id
    );

    const nodePayload = buildNodeSavePayload({
      node,
      draft,
      effectiveCourseId,
      parentId: realParentId,
      contentCode: contentCode.value,
      resolvedKnowledgePointIds: knowledgePointIds,
      existingResourceIds
    });

    let realNodeId = node.id;
    if (isTempId) {
      const created = await request<any>('/lesson/nodes', {
        method: 'POST',
        body: JSON.stringify(nodePayload)
      });
      realNodeId = created.id;
      idMapping.set(node.id, created.id);
    } else {
      await request<any>(`/lesson/nodes/${node.id}`, {
        method: 'PUT',
        body: JSON.stringify(nodePayload)
      });
      idMapping.set(node.id, node.id);
    }

    // 上传本地资源并绑定到真实节点
    if (realNodeId && !realNodeId.startsWith('node-')) {
      let failedCount = 0;
      for (const localRes of localResources) {
        try {
          const created = await request<any>('/lesson/node-resources/create', {
            method: 'POST',
            body: JSON.stringify({
              nodeId: realNodeId,
              name: localRes.name,
              type: localRes.type,
              url: localRes.url || '',
              description: localRes.description,
              size: localRes.size != null ? Number(localRes.size) : undefined
            })
          });
          await request<{ id: string }>('/lesson/node-resources', {
            method: 'POST',
            body: JSON.stringify({ nodeId: realNodeId, resourceId: created.id })
          });
        } catch {
          failedCount++;
        }
      }
      if (failedCount > 0) {
        ElMessage.error(`部分资源绑定失败：${failedCount} 个资源未能绑定到节点，请重新编辑补充`);
      }
    }
  }

  // 刷新 nodes
  const refreshed = await courseNodeApi.list({ courseId: effectiveCourseId, limit: 500 });
  const refreshedNodes = (refreshed.items || []) as SysNode[];
  nodes.value = refreshedNodes;
  // 重映射选中节点：本地 temp id → 后端真实 id
  if (selectedNodeIdRef.value) {
    const mapped = idMapping.get(selectedNodeIdRef.value);
    if (mapped) selectedNodeId.value = mapped;
  }
  const newModes: Record<string, AddMode> = {};
  refreshedNodes.forEach((n) => {
    if (n.type !== 'original') newModes[n.id] = 'upload';
  });
  nodeModes.value = { ...nodeModes.value, ...newModes };
}

async function handleSave() {
  saving.value = true;
  try {
    const payload = {
      name: courseName.value,
      majorId: major.value || undefined,
      description: courseDescription.value || undefined,
      coverImage: coverImage.value || undefined,
      batchId: batchId.value || undefined,
      type: 'system' as const,
      status: 'draft' as const,
      category: 'system',
      creatorId: '',
      coCreatorIds: [] as string[],
      evalData: {
        ...existingCourseEvalData.value,
        descriptionPdf: courseDescriptionPdf.value || undefined
      },
      abilityPointIds: abilityPoints.value.map((a) => a.id)
    };
    let effectiveCourseId = courseId.value;
    if (isEdit && courseId.value) {
      await courseApi.update(courseId.value, payload as any);
      if (originalStatus.value !== 'draft') {
        await courseApi.saveDraft(courseId.value);
        originalStatus.value = 'draft';
      }
    } else {
      const created = await courseApi.create(payload as any);
      courseId.value = created.id;
      effectiveCourseId = created.id;
    }

    // 保存节点树；成功后才标记已保存（节点失败时 handleFinish 不得跳转）
    if (effectiveCourseId) {
      await saveNodes(effectiveCourseId);
    }
    hasSaved.value = true;
    ElMessage.success('草稿已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleFinish() {
  await handleSave();
  if (!hasSaved.value) return;
  router.push('/lesson/courses');
}

async function onBack() {
  if (isNewCourse && courseId.value && !hasSaved.value) {
    try {
      await courseApi.delete(courseId.value);
    } catch {
      // 删除未保存的课程草稿失败不阻断返回
    }
  }
  router.push('/lesson/courses');
}

/* ---------- 封面 ---------- */

const coverInput = ref<HTMLInputElement | null>(null);

function onCoverSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  void uploadCover(file);
}

async function uploadCover(file: File) {
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    coverImage.value = res.url;
  } catch (e) {
    ElMessage.error((e as Error).message || '封面上传失败');
  } finally {
    coverUploading.value = false;
  }
}

/* ---------- 发布检查 ---------- */

const currentCheckNode = computed<SysNode | undefined>(() => {
  if (!selectedNodeId.value) return undefined;
  const node = nodes.value.find((n) => n.id === selectedNodeId.value);
  if (!node) return undefined;

  const kpForCheck = knowledgePoints.value.map((kp) => ({
    id: kp.id,
    name: kp.name,
    linked: kp.linked ?? false
  }));

  const resForCheck: NodeResourceItem[] = selectedResourceIds.value
    .map((id) => resourcePool.value.find((x) => x.id === id))
    .filter((r): r is NodeResourceItem => !!r)
    .map((r) => ({ id: r.id, name: r.name, type: r.type, size: 0, url: r.url }));

  const nodeEvalMethodsForCheck =
    nodeEvalMethods.value.length > 0
      ? nodeEvalMethods.value
      : ((node.evalData as { methods?: string[] } | undefined)?.methods) || [];
  const quizzesForCheck =
    nodeEvalMethodsForCheck.length > 0
      ? nodeEvalMethodsForCheck.map((method, i) => ({
          id: `qz-${i}`,
          title:
            method === 'exam' || method === 'homework'
              ? '作业测评'
              : method === 'question_bank'
                ? '题库测验'
                : method === 'paper'
                  ? '试卷测验'
                  : '现场问答',
          type: method === 'question_bank' ? 'question_bank' : 'paper',
          questions: []
        }))
      : [];

  return {
    ...node,
    name: node.name,
    teachingGoals: learningGoal.value || node.teachingGoals,
    duration: parseInt(hours.value) || node.duration || 0,
    knowledgePoints: kpForCheck.length > 0 ? kpForCheck : node.knowledgePoints,
    resources: resForCheck.length > 0 ? resForCheck : node.resources,
    quizzes: quizzesForCheck.length > 0 ? quizzesForCheck : node.quizzes
  };
});
</script>

<style scoped>
.edit-page {
  padding: 16px;
  max-width: 1600px;
  margin: 0 auto;
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
.header-right {
  display: flex;
  gap: 8px;
}

/* ---------- 全局课程信息 ---------- */
.global-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  margin-bottom: 16px;
}
.global-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
}
.global-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.global-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.global-sub {
  font-size: 12px;
  color: #c0c4cc;
}
.global-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #c0c4cc;
  font-size: 12px;
}
.global-desc {
  font-size: 12px;
  color: #c0c4cc;
  margin: 0 16px 12px 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.global-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 0 16px 16px;
}
.global-left,
.global-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 12px;
  color: #606266;
}
.field-tip {
  font-size: 10px;
  color: #c0c4cc;
  margin: 4px 0 0;
}
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cover-field {
  max-width: 420px;
}
.cover-box {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #f5f7fa;
  border: 2px dashed #e4e7ed;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s;
}
.cover-box:hover {
  border-color: #a0cfff;
}
.hidden-input {
  display: none;
}
.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}
.cover-box:hover .cover-overlay {
  opacity: 1;
}
.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.cover-text {
  font-size: 13px;
  color: #909399;
}

/* ---------- 布局 ---------- */
.layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 250px;
  gap: 16px;
  align-items: start;
}
.center {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.original-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(90deg, #ecf5ff, #d9ecff);
  border: 1px solid #d9ecff;
  border-radius: 12px;
  padding: 12px 16px;
}
.banner-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #d9ecff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.banner-text {
  font-size: 13px;
  color: #1d6fb8;
  margin: 0;
}
.no-node {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 48px;
  text-align: center;
  color: #c0c4cc;
  font-size: 14px;
}
.module-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 16px;
}
.module-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.module-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.quote-hint {
  font-size: 12px;
  color: #c0c4cc;
  margin-left: 8px;
}
.fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fieldset.disabled {
  opacity: 0.7;
}
.code-input :deep(input) {
  background: #f5f7fa;
  color: #909399;
}
.task-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.task-half {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stars {
  display: flex;
  gap: 4px;
  align-items: center;
  padding-top: 2px;
}
.star {
  cursor: pointer;
}

/* ---------- 编辑方式选择 ---------- */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 12px;
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background: #fff;
}
.mode-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.mode-card.upload:hover {
  border-color: #409eff;
}
.mode-card.clone:hover {
  border-color: #e6a23c;
}
.mode-card.quote:hover {
  border-color: #9c27b0;
}
.mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}
.mode-card.upload .mode-icon {
  background: #409eff;
}
.mode-card.clone .mode-icon {
  background: #e6a23c;
}
.mode-card.quote .mode-icon {
  background: #9c27b0;
}
.mode-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
.mode-desc {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
.bottom-space {
  height: 48px;
}

/* ---------- 颗粒课选择 ---------- */
.grain-search {
  margin-bottom: 12px;
}
.grain-list {
  max-height: 300px;
  overflow-y: auto;
}
.grain-item {
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.grain-item:hover {
  border-color: #a0cfff;
}
.grain-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.grain-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grain-check {
  flex-shrink: 0;
}
.grain-check .unchecked {
  color: #dcdfe6;
}
.grain-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grain-desc {
  font-size: 12px;
  color: #909399;
  margin: 6px 0 4px 24px;
}
.grain-duration {
  font-size: 10px;
  color: #c0c4cc;
  margin: 0 0 0 24px;
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .global-body {
    grid-template-columns: 1fr;
  }
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
