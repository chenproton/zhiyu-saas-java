<template>
  <div class="landing">
    <!-- ===== 加载中（对齐 React Skeleton：头部 + 内容块） ===== -->
    <template v-if="loading">
      <div class="skeleton-block skeleton-header" />
      <main class="ld-main">
        <div class="skeleton-block" />
      </main>
    </template>

    <!-- ===== 课程不存在 ===== -->
    <div v-else-if="!course" class="ld-empty">
      <el-icon :size="64" class="ld-empty-icon"><Reading /></el-icon>
      <p class="ld-empty-title">课程不存在或暂未公开</p>
      <router-link to="/lesson/landing" class="ld-empty-link">返回课程列表</router-link>
    </div>

    <template v-else>
      <!-- ===== 课程头部（对齐 React CourseDetailPage header） ===== -->
      <header class="ld-header">
        <div class="ld-header-inner">
          <div class="ld-breadcrumb">
            <button type="button" class="ld-back" @click="goBack">
              <span class="ld-back-icon">←</span> 返回上一页
            </button>
            <span class="ld-sep">/</span>
            <router-link to="/lesson/landing" class="ld-crumb hidden-sm">课程列表</router-link>
            <span class="ld-sep hidden-sm">/</span>
            <span class="ld-crumb-current">{{ course.name }}</span>
          </div>

          <div class="ld-flex">
            <div class="ld-main-card">
              <div class="ld-cover-card">
                <div class="ld-cover" :style="coverStyle">
                  <el-icon v-if="!course.coverImage" :size="64" class="ld-cover-icon"><Reading /></el-icon>
                  <span class="ld-cover-version">{{ course.version || 'V1.0' }}</span>
                </div>

                <div class="ld-info">
                  <div class="ld-title-row">
                    <h1 class="ld-name">{{ course.name }}</h1>
                    <span class="ld-type-badge">{{ typeLabel }}</span>
                  </div>

                  <div class="ld-meta">
                    <span class="ld-meta-item">创建人：{{ creatorName }}</span>
                    <span class="ld-meta-item">
                      <el-icon><Clock /></el-icon>更新于 {{ formatDate(course.updatedAt) }}
                    </span>
                    <span class="ld-meta-item">
                      <el-icon><Files /></el-icon>{{ course.nodeCount }} 节点
                    </span>
                  </div>

                  <p v-if="course.description" class="ld-desc">{{ course.description }}</p>

                  <div class="ld-tags">
                    <div v-if="course.majorName" class="ld-tag-row">
                      <span class="ld-tag-label">适用专业：</span>
                      <span class="ld-tag ld-tag-major">{{ course.majorName }}</span>
                    </div>
                    <div v-if="course.difficulty" class="ld-tag-row">
                      <span class="ld-tag-label">难度等级：</span>
                      <span class="ld-tag ld-tag-diff" :style="diffStyle">{{ diffLabel }}</span>
                    </div>
                  </div>

                  <div class="ld-actions">
                    <router-link
                      v-if="!isGranular"
                      :to="`/lesson/landing/${course.id}/learn${versionQuery}`"
                      class="ld-btn-learn"
                    >
                      <el-icon><VideoPlay /></el-icon>开始学习
                    </router-link>
                    <el-button :class="['ld-btn-fav', { active: isFavorite }]" :loading="favLoading" @click="toggleFavorite">
                      <el-icon><Star :class="{ filled: isFavorite }" /></el-icon>
                      {{ isFavorite ? '已收藏课程' : '收藏课程' }}
                      <span v-if="favoriteCount > 0" class="ld-fav-count">({{ favoriteCount }})</span>
                    </el-button>
                    <el-button class="ld-btn-share" @click="copyShareLink">
                      <el-icon><Share /></el-icon>分享课程
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 课程统计（对齐 React StatsBox） -->
            <div class="ld-stats-card">
              <div class="ld-stats-head">
                <div class="ld-stats-icon"><el-icon><Files /></el-icon></div>
                <span class="ld-stats-title">课程统计</span>
              </div>
              <div class="ld-stats-body">
                <div class="ld-stat-row">
                  <span class="ld-stat-label">课程节点</span>
                  <span class="ld-stat-value">{{ nodes.length }}</span>
                </div>
                <div class="ld-stat-row">
                  <span class="ld-stat-label">教学资源</span>
                  <span class="ld-stat-value">{{ totalResources }}</span>
                </div>
                <div class="ld-stat-row">
                  <span class="ld-stat-label">知识点</span>
                  <span class="ld-stat-value">{{ courseKnowledgeList.length }}</span>
                </div>
                <div class="ld-stat-row">
                  <span class="ld-stat-label">线上课时</span>
                  <span class="ld-stat-value">{{ course.onlineHours || 0 }}h</span>
                </div>
                <div class="ld-stat-row">
                  <span class="ld-stat-label">线下课时</span>
                  <span class="ld-stat-value">{{ course.offlineHours || 0 }}h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- ===== Tab 区 ===== -->
      <main class="ld-main">
        <div class="ld-tabs-card">
          <!-- 移动端下拉 -->
          <div class="ld-tabs-mobile">
            <el-select v-model="activeTab" class="ld-tabs-select">
              <el-option v-for="tab in tabs" :key="tab.value" :label="tab.label" :value="tab.value" />
            </el-select>
          </div>

          <!-- 桌面 Tab 条 -->
          <div class="ld-tabs-bar">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              type="button"
              :class="['ld-tab', { active: effectiveTab === tab.value }]"
              @click="activeTab = tab.value"
            >
              <el-icon><component :is="tab.icon" /></el-icon>
              {{ tab.label }}
              <span
                v-if="tabCount(tab.value) > 0"
                :class="['ld-tab-count', { active: effectiveTab === tab.value }]"
              >
                {{ tabCount(tab.value) }}
              </span>
              <span v-if="effectiveTab === tab.value" class="ld-tab-underline" />
            </button>
          </div>

          <div class="ld-tab-content">
            <!-- 课程目录 -->
            <template v-if="effectiveTab === 'nodes'">
              <div v-if="nodes.length === 0" class="ld-empty-tab">
                <div class="ld-empty-tab-icon"><el-icon :size="32"><List /></el-icon></div>
                <div class="ld-empty-tab-title">暂无课程节点</div>
                <div class="ld-empty-tab-hint">该课程暂未配置章节节点</div>
              </div>
              <div v-else class="ld-tree">
                <div v-for="item in tree" :key="item.node.id">
                  <TreeNodeView
                    :item="item"
                    :collapsed-ids="collapsedIds"
                    :highlight-id="highlightNodeId"
                    :flat-indexes="flatIndexes"
                    @toggle="toggleCollapse"
                  />
                </div>
              </div>
            </template>

            <!-- 资源中心 -->
            <template v-else-if="effectiveTab === 'resources'">
              <div class="ld-res-count">
                共 <strong class="primary-text">{{ totalResources }}</strong> 个资源
              </div>
              <div v-if="totalResources === 0" class="ld-empty-tab">
                <div class="ld-empty-tab-icon"><el-icon :size="32"><FolderOpened /></el-icon></div>
                <div class="ld-empty-tab-title">暂无关联资源</div>
                <div class="ld-empty-tab-hint">该课程暂未配置学习资源</div>
              </div>
              <div v-else class="ld-res-groups">
                <div v-for="group in resourceGroups" :key="group.nodeId" class="ld-res-group">
                  <div class="ld-res-group-head">
                    <el-icon><Reading /></el-icon>
                    {{ group.nodeName }}
                    <span class="ld-res-group-count">({{ group.items.length }})</span>
                  </div>
                  <div class="ld-res-grid">
                    <div v-for="r in group.items" :key="r.id" class="ld-res-item">
                      <div class="ld-res-item-top">
                        <div class="ld-res-item-info">
                          <div class="ld-res-item-name">{{ r.name }}</div>
                          <div class="ld-res-item-meta">
                            <span :class="['ld-res-badge', ...resBadgeClass(r.type)]">
                              {{ RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type }}
                            </span>
                            <span v-if="r.size">{{ formatSize(r.size) }}</span>
                          </div>
                        </div>
                        <button
                          v-if="r.url"
                          type="button"
                          class="ld-res-preview-btn"
                          title="预览资源"
                          @click="openPreview(r)"
                        >
                          <el-icon><View /></el-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 评价标准 -->
            <template v-else-if="effectiveTab === 'evaluation'">
              <div v-if="evalNodes.length === 0" class="ld-empty-tab">
                <div class="ld-empty-tab-icon"><el-icon :size="32"><Aim /></el-icon></div>
                <div class="ld-empty-tab-title">暂未配置评价标准</div>
                <div class="ld-empty-tab-hint">该课程暂未设置评价方式</div>
              </div>
              <template v-else>
                <div class="ld-eval-count">
                  共 <strong class="primary-text">{{ evalNodes.length }}</strong> 个节点配置了评价标准
                </div>
                <div class="ld-eval-grid">
                  <div v-for="node in evalNodes" :key="node.id" class="ld-eval-card">
                    <div class="ld-eval-head">
                      <div class="ld-eval-icon"><el-icon><Aim /></el-icon></div>
                      <div class="ld-eval-info">
                        <div class="ld-eval-name">{{ node.name }}</div>
                        <span class="ld-eval-sub">{{ node.duration ? `${node.duration} 课时` : '未配置课时' }}</span>
                      </div>
                    </div>
                    <div class="ld-eval-methods">
                      <span
                        v-for="m in getNodeEvalRule(node)"
                        :key="m.key"
                        class="ld-eval-method-badge"
                        :style="{ backgroundColor: EVAL_METHOD_COLORS[m.key] || '#94a3b8' }"
                      >
                        {{ EVAL_METHOD_LABELS[m.key] || m.key }}
                      </span>
                    </div>
                    <div v-for="m in getNodeEvalRule(node)" :key="`w-${m.key}`" class="ld-eval-bar-row">
                      <span class="ld-eval-bar-label">{{ EVAL_METHOD_LABELS[m.key] || m.key }}</span>
                      <div class="ld-eval-bar">
                        <div
                          class="ld-eval-bar-fill"
                          :style="{ width: `${Math.round(m.weight || 0)}%`, backgroundColor: EVAL_METHOD_COLORS[m.key] || '#94a3b8' }"
                        />
                      </div>
                      <span class="ld-eval-bar-value">{{ Math.round(m.weight || 0) }}%</span>
                    </div>
                  </div>
                </div>
              </template>
            </template>

            <!-- 知识图谱 -->
            <template v-else-if="effectiveTab === 'knowledge'">
              <div v-if="graphData.nodes.length === 0" class="ld-empty-tab">
                <div class="ld-empty-tab-icon"><el-icon :size="32"><Connection /></el-icon></div>
                <div class="ld-empty-tab-title">暂无图谱数据</div>
              </div>
              <div v-else class="kg-wrap">
                <div class="kg-head">
                  <h3 class="kg-title">
                    <el-icon><Connection /></el-icon>知识图谱
                  </h3>
                  <p class="kg-desc">{{ isGranular ? '课程 → 知识点的关联网络' : '课程 → 节点 → 知识点的关联网络' }}</p>
                  <div class="kg-legend">
                    <span v-for="t in GRAPH_TYPES" :key="t" class="kg-legend-item">
                      <i class="kg-legend-dot" :style="{ background: GRAPH_META[t].color }" />{{ GRAPH_META[t].label }}
                    </span>
                  </div>
                </div>
                <div class="kg-canvas-wrap">
                  <div class="kg-canvas" :style="{ width: graphLayout.width + 'px', height: graphLayout.height + 'px' }">
                    <svg class="kg-svg" :width="graphLayout.width" :height="graphLayout.height">
                      <line
                        v-for="(e, i) in graphLayout.edges"
                        :key="i"
                        :x1="e.x1"
                        :y1="e.y1"
                        :x2="e.x2"
                        :y2="e.y2"
                        class="kg-edge"
                      />
                    </svg>
                    <div
                      v-for="layer in graphLayout.layers"
                      :key="layer.type"
                      class="kg-layer"
                      :style="{ left: GRAPH_LAYER_X[graphTypeIndex(layer.type)] + 'px' }"
                    >
                      <div
                        v-for="(node, ni) in layer.items"
                        :key="node.id"
                        class="kg-node"
                        :style="{ top: GRAPH_TOP + ni * GRAPH_NODE_GAP + 'px', ...kgNodeStyle(node) }"
                        :title="node.label"
                      >
                        {{ node.label }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </main>
    </template>

    <!-- ===== 资源预览弹窗（对齐 React ResourcePreviewModal 简化版） ===== -->
    <el-dialog v-model="previewOpen" width="860px" top="6vh" class="ld-dialog">
      <template #header>
        <div class="ld-dialog-head">
          <span class="ld-dialog-title">{{ previewResource?.name || '资源预览' }}</span>
          <a
            v-if="previewResource && isSafeExternalUrl(previewResource.url)"
            :href="previewResource.url"
            target="_blank"
            rel="noopener noreferrer"
            class="ld-dialog-link"
          >
            <el-icon><TopRight /></el-icon>新窗口打开
          </a>
        </div>
      </template>
      <div class="ld-preview-body">
        <img
          v-if="previewResource && previewResource.type === 'image' && previewDisplaySrc"
          :src="previewDisplaySrc"
          :alt="previewResource.name"
          class="ld-preview-img"
        />
        <video
          v-else-if="previewResource && previewResource.type === 'video' && previewDisplaySrc"
          :src="previewDisplaySrc"
          controls
          class="ld-preview-media"
        />
        <audio
          v-else-if="previewResource && previewResource.type === 'audio' && previewDisplaySrc"
          :src="previewDisplaySrc"
          controls
          class="ld-preview-audio"
        />
        <iframe
          v-else-if="previewIframeSrc"
          :src="previewIframeSrc"
          :title="previewResource?.name"
          class="ld-preview-iframe"
          allowfullscreen
        />
        <div
          v-else-if="previewResource && isSafeExternalUrl(previewResource.url)"
          class="ld-preview-external"
        >
          <el-icon :size="40" class="ld-preview-external-icon"><Link /></el-icon>
          <p>该链接无法内嵌预览，请点击右上角「新窗口打开」</p>
        </div>
        <div v-else class="ld-preview-loading">
          <el-icon :size="40" class="ld-preview-external-icon"><Document /></el-icon>
          <p>加载中…</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, ref, watch } from 'vue';
import type { Component, PropType, VNode } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Aim,
  Clock,
  Collection,
  Connection,
  Document,
  Files,
  FolderOpened,
  Link,
  List,
  Reading,
  Share,
  Star,
  TopRight,
  VideoPlay,
  View
} from '@element-plus/icons-vue';
import { courseApi, courseNodeApi, knowledgeApi } from '@/api/lesson';
import { favoriteApi } from '@/api/portal';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { Course, KnowledgePoint } from '@/types/lesson';
import {
  EVAL_METHOD_COLORS,
  EVAL_METHOD_LABELS,
  RESOURCE_TYPE_SHORT_LABELS,
  SCENE_DIFFICULTY,
  coverGradientFor,
  courseResourceList,
  courseSnapshotCourseResources,
  courseSnapshotGet,
  courseSnapshotNodes,
  formatDate,
  formatSize,
  mergeCourseSnapshot,
  snapshotKnowledgeMap
} from './lesson-landing-types';
import type { LessonNode, LessonNodeResource } from './lesson-landing-types';

/** 教师/管理员读 landing 仍为 live（可预览 draft）；学生等角色走快照 bundle（对齐 React 文档 8.5） */
const EDITOR_PREVIEW_ROLES = ['teacher', 'school_admin', 'platform_admin'];

/** 资源类型徽章配色（对齐 React RESOURCE_TYPE_COLORS） */
const RES_TYPE_STYLES: Record<string, string[]> = {
  document: ['bg-primary-soft', 'text-primary', 'border-primary-soft-2'],
  video: ['bg-primary-soft', 'text-primary', 'border-primary-soft-2'],
  link: ['bg-purple-soft', 'text-purple-strong', 'border-purple-soft-2'],
  file: ['bg-primary-soft', 'text-primary', 'border-primary-soft-2']
};

const SYSTEM_TABS = [
  { value: 'nodes', label: '课程目录', icon: List },
  { value: 'resources', label: '资源中心', icon: FolderOpened },
  { value: 'evaluation', label: '评价标准', icon: Aim },
  { value: 'knowledge', label: '知识图谱', icon: Connection }
];
const GRANULAR_TABS = [
  { value: 'resources', label: '资源中心', icon: FolderOpened },
  { value: 'knowledge', label: '知识图谱', icon: Connection }
];

const COURSE_TYPE_LABELS: Record<string, string> = {
  system: '体系课',
  granular: '颗粒课',
  hybrid: '混合课'
};

// 知识图谱节点类型（课程/节点/知识点 3 层，对齐 React LessonKnowledgeGraph + 静态分层布局）
const GRAPH_TYPES = ['course', 'node', 'knowledge'] as const;
type GraphType = (typeof GRAPH_TYPES)[number];
const GRAPH_META: Record<GraphType, { label: string; color: string; bg: string }> = {
  course: { label: '课程', color: '#2563eb', bg: '#eff6ff' },
  node: { label: '节点', color: '#0e7490', bg: '#cffafe' },
  knowledge: { label: '知识点', color: '#15803d', bg: '#dcfce7' }
};
interface GraphNode {
  id: string;
  label: string;
  type: GraphType;
}
interface GraphEdge {
  source: string;
  target: string;
}
const GRAPH_LAYER_X = [100, 340, 580];
const GRAPH_NODE_GAP = 64;
const GRAPH_NODE_H = 44;
const GRAPH_TOP = 40;

interface TreeItem {
  node: LessonNode;
  level: number;
  children: TreeItem[];
}

function buildTree(nodes: LessonNode[]): TreeItem[] {
  const map = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];
  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  sorted.forEach((node) => {
    map.set(node.id, { node, level: 0, children: [] });
  });
  sorted.forEach((node) => {
    const item = map.get(node.id)!;
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      item.level = parent.level + 1;
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
}

// ===== 路由与登录态 =====
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const id = computed(() => String(route.params.id || ''));
const versionParam = computed(() => (route.query.v as string) || undefined);
const highlightNodeId = computed(() => (route.query.node as string) || undefined);

const isEditorPreview = computed(() => {
  const user = auth.user;
  if (!user) return false;
  const roles = user.roles || (user.role ? [user.role] : []);
  return roles.some((r) => EDITOR_PREVIEW_ROLES.includes(r));
});

// ===== 数据状态 =====
const course = ref<Course | null>(null);
const loading = ref(true);
const activeTab = ref('nodes');
const nodes = ref<LessonNode[]>([]);
const resources = ref<LessonNodeResource[]>([]);
const knowledgeMap = ref<Map<string, KnowledgePoint>>(new Map());
const collapsedIds = ref<Set<string>>(new Set());
const detailSeq = ref(0);

// ===== 详情加载（快照 bundle 路径学生等 / live 路径教师管理员，对齐 React 双 effect） =====
watch(
  id,
  async (val) => {
    if (!val) return;
    const seq = ++detailSeq.value;
    loading.value = true;
    try {
      if (isEditorPreview.value) {
        const c = await courseApi.get(val);
        if (seq !== detailSeq.value) return;
        course.value = c;
      } else {
        const [snap, live] = await Promise.all([
          courseSnapshotGet(val, { version: versionParam.value }),
          courseApi.get(val).catch(() => null)
        ]);
        if (seq !== detailSeq.value) return;
        course.value = mergeCourseSnapshot(live, snap.course);
        nodes.value = courseSnapshotNodes(snap);
        resources.value = courseSnapshotCourseResources(snap);
        knowledgeMap.value = snapshotKnowledgeMap(snap.knowledge_points);
      }
    } catch {
      if (seq !== detailSeq.value) return;
      course.value = null;
    } finally {
      if (seq === detailSeq.value) loading.value = false;
    }
  },
  { immediate: true }
);

// ===== live 关联数据加载（教师/管理员预览路径，对齐 React 多接口组装） =====
watch(
  [id, course, isEditorPreview],
  ([val, c, editor]) => {
    if (!val || !c || !editor) return;
    const seq = ++detailSeq.value;
    fetchAllPages((page, pageSize) =>
      courseNodeApi.list({ courseId: val, limit: pageSize, offset: page * pageSize })
    )
      .then((res) => {
        if (seq === detailSeq.value) nodes.value = res;
      })
      .catch(() => {
        if (seq === detailSeq.value) nodes.value = [];
      });
    fetchAllPages((page, pageSize) => courseResourceList({ courseId: val, limit: pageSize, offset: page * pageSize }))
      .then((res) => {
        if (seq === detailSeq.value) resources.value = res || [];
      })
      .catch(() => {
        if (seq === detailSeq.value) resources.value = [];
      });
    fetchAllPages((page, pageSize) => knowledgeApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((res) => {
        if (seq !== detailSeq.value) return;
        const m = new Map<string, KnowledgePoint>();
        res.forEach((k: KnowledgePoint) => m.set(k.id, k));
        knowledgeMap.value = m;
      })
      .catch(() => {
        if (seq !== detailSeq.value) knowledgeMap.value = new Map();
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

// 从考试页返回时高亮并定位到对应节点
watch(
  [highlightNodeId, nodes],
  ([hid]) => {
    if (!hid) return;
    nextTick(() => {
      const el = document.getElementById(`course-node-${hid}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  },
  { immediate: true }
);

// ===== 派生数据 =====
const allResources = computed(() => {
  const items: LessonNodeResource[] = [];
  nodes.value.forEach((n) => {
    (n.resources || []).forEach((r) => items.push({ ...r, nodeId: n.id }));
  });
  resources.value.forEach((r) => items.push({ ...r, nodeId: 'course' }));
  return items;
});

const totalResources = computed(() => allResources.value.length);

const courseKnowledgeList = computed(() => {
  const ids = new Set<string>();
  const kps: KnowledgePoint[] = [];
  course.value?.knowledgePointIds?.forEach((kid) => {
    if (ids.has(kid)) return;
    ids.add(kid);
    const kp = knowledgeMap.value.get(kid);
    if (kp) kps.push(kp);
  });
  nodes.value.forEach((n) => {
    (n.knowledgePoints || []).forEach((kp) => {
      if (ids.has(kp.id)) return;
      ids.add(kp.id);
      kps.push(kp as unknown as KnowledgePoint);
    });
  });
  return kps;
});

const tree = computed(() => buildTree(nodes.value));
const isGranular = computed(() => course.value?.type === 'granular');
const tabs = computed(() => (isGranular.value ? GRANULAR_TABS : SYSTEM_TABS));
const effectiveTab = computed(() =>
  tabs.value.some((t) => t.value === activeTab.value) ? activeTab.value : tabs.value[0].value
);

const diff = computed(() => SCENE_DIFFICULTY[course.value?.difficulty ?? 3] || SCENE_DIFFICULTY[3]);
const typeLabel = computed(() => COURSE_TYPE_LABELS[course.value?.type || ''] || course.value?.type || '');
const creatorName = computed(() => course.value?.creatorName || course.value?.creatorId?.slice(0, 8) || '-');
const coverStyle = computed(() =>
  course.value?.coverImage ? { backgroundImage: `url('${course.value.coverImage}')` } : { background: coverGradientFor(course.value!.id) }
);
const diffLabel = computed(() => diff.value.label);
const diffStyle = computed(() => ({
  backgroundColor: diff.value.color + '15',
  color: diff.value.color,
  borderColor: diff.value.color + '30'
}));
const versionQuery = computed(() => (versionParam.value ? `?v=${encodeURIComponent(versionParam.value)}` : ''));

const flatIndexes = computed(() => {
  const map = new Map<string, number>();
  [...nodes.value]
    .sort((a, b) => a.order - b.order)
    .forEach((n, i) => map.set(n.id, i));
  return map;
});

function tabCount(value: string): number {
  if (value === 'nodes') return nodes.value.length;
  if (value === 'resources') return totalResources.value;
  if (value === 'knowledge') return courseKnowledgeList.value.length;
  return 0;
}

// ===== 评价规则解析（对齐 React getNodeEvalMethods / getNodeEvalRule） =====
function getNodeEvalMethods(node: LessonNode): string[] {
  const evalData = (node.evalData as any) || {};
  const methods: string[] = [];
  const evalRuleConfig = evalData.evalRuleConfig;
  if (evalRuleConfig?.evaluationMethods) {
    methods.push(...evalRuleConfig.evaluationMethods);
  }
  const hybridRules = evalData.hybridEvalRules;
  if (hybridRules) {
    ['preQuiz', 'inClassQuiz', 'homework'].forEach((moduleKey) => {
      const part = hybridRules[moduleKey];
      const mrc = part?.evalRuleConfig;
      if (mrc?.evaluationMethods) {
        methods.push(...mrc.evaluationMethods);
      }
    });
  }
  return methods;
}

function getNodeEvalRule(node: LessonNode): { key: string; weight: number }[] {
  const evalData = (node.evalData as any) || {};
  const methods: { key: string; weight: number }[] = [];
  const collect = (rc: any) => {
    if (!rc?.evaluationMethods) return;
    (rc.evaluationMethods as string[]).forEach((m: string) => {
      methods.push({ key: m, weight: rc.methodWeights?.[m] || 0 });
    });
  };
  collect(evalData.evalRuleConfig);
  const hybridRules = evalData.hybridEvalRules;
  if (hybridRules) {
    ['preQuiz', 'inClassQuiz', 'homework'].forEach((moduleKey) => {
      collect(hybridRules[moduleKey]?.evalRuleConfig);
    });
  }
  return methods;
}

const evalNodes = computed(() => nodes.value.filter((n) => getNodeEvalMethods(n).length > 0));

// ===== 资源分组 =====
const resourceGroups = computed(() => {
  const nodeMap = new Map<string, string>();
  nodes.value.forEach((n) => nodeMap.set(n.id, n.name));
  const byNode = new Map<string, LessonNodeResource[]>();
  allResources.value.forEach((r) => {
    const nid = r.nodeId || 'course';
    const list = byNode.get(nid) || [];
    list.push(r);
    byNode.set(nid, list);
  });
  return Array.from(byNode.entries()).map(([nid, items]) => ({
    nodeId: nid,
    nodeName: nid === 'course' ? '课程全局资源' : nodeMap.get(nid) || nid,
    items
  }));
});

function resBadgeClass(type: string): string[] {
  return RES_TYPE_STYLES[type] || ['bg-slate-soft', 'text-slate-strong', 'border-slate-soft-2'];
}

// ===== 折叠 =====
function toggleCollapse(nodeId: string) {
  const next = new Set(collapsedIds.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsedIds.value = next;
}

// ===== 知识图谱（静态分层布局，无图引擎依赖，对齐 job-detail 做法） =====
const graphData = computed(() => {
  const graphNodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  const c = course.value;
  if (!c) return { nodes: graphNodes, edges: graphEdges };

  const pushKnowledge = (targetId: string, kp: KnowledgePoint) => {
    graphNodes.push({ id: kp.id, label: kp.name || kp.code || '知识点', type: 'knowledge' });
    graphEdges.push({ source: targetId, target: kp.id });
  };

  graphNodes.push({ id: c.id, label: c.name || '课程', type: 'course' });

  (c.knowledgePointIds || []).forEach((kid) => {
    const kp = knowledgeMap.value.get(kid);
    if (kp) pushKnowledge(c.id, kp);
  });

  if (!isGranular.value) {
    nodes.value.forEach((node) => {
      graphNodes.push({ id: node.id, label: node.name || '节点', type: 'node' });
      graphEdges.push({ source: c.id, target: node.id });
      (node.knowledgePoints || []).forEach((kp) => pushKnowledge(node.id, kp as unknown as KnowledgePoint));
    });
  }
  return { nodes: graphNodes, edges: graphEdges };
});

const graphLayout = computed(() => {
  const layers: { type: GraphType; items: GraphNode[] }[] = GRAPH_TYPES.map((type) => ({
    type,
    items: graphData.value.nodes.filter((n) => n.type === type)
  }));
  const posMap = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, li) => {
    layer.items.forEach((node, ni) => {
      posMap.set(node.id, { x: GRAPH_LAYER_X[li], y: GRAPH_TOP + ni * GRAPH_NODE_GAP });
    });
  });
  const edges = graphData.value.edges
    .map((e) => {
      const s = posMap.get(e.source);
      const t = posMap.get(e.target);
      if (!s || !t) return null;
      return { x1: s.x, y1: s.y + GRAPH_NODE_H / 2, x2: t.x, y2: t.y + GRAPH_NODE_H / 2 };
    })
    .filter((e): e is { x1: number; y1: number; x2: number; y2: number } => e !== null);
  const maxRows = Math.max(...layers.map((l) => l.items.length), 1);
  const height = GRAPH_TOP + maxRows * GRAPH_NODE_GAP + 40;
  const width = GRAPH_LAYER_X[GRAPH_LAYER_X.length - 1] + 220;
  return { layers, edges, height, width };
});

function graphTypeIndex(type: GraphType): number {
  return GRAPH_TYPES.indexOf(type);
}
function kgNodeStyle(node: GraphNode) {
  const meta = GRAPH_META[node.type];
  return { borderColor: meta.color, color: meta.color, background: meta.bg };
}

// ===== 资源预览（对齐 React ResourcePreviewModal 的 kkfileview 路径，简化交互） =====
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
  // 本系统上传文件先换取短时签名 URL（kkFileView 服务端抓取无登录态），失败回退原 URL
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

// ===== 收藏（对齐 React FavoriteButton） =====
const isFavorite = ref(false);
const favoriteCount = ref(0);
const favLoading = ref(false);

watch(
  [() => auth.isLoggedIn, id],
  async ([loggedIn]) => {
    if (!id.value) return;
    favoriteCount.value = course.value?.viewCount ? 0 : favoriteCount.value;
    if (!loggedIn) {
      isFavorite.value = false;
      return;
    }
    try {
      const res = await favoriteApi.get('course', id.value);
      isFavorite.value = res.isFavorite;
      favoriteCount.value = res.favoriteCount;
    } catch {
      /* 收藏状态读取失败忽略 */
    }
  },
  { immediate: true }
);

async function toggleFavorite() {
  if (!auth.isLoggedIn) {
    ElMessage.warning('请先登录后再收藏课程');
    return;
  }
  if (favLoading.value || !course.value) return;
  favLoading.value = true;
  try {
    const res = await favoriteApi.toggle('course', course.value.id);
    isFavorite.value = res.isFavorite;
    favoriteCount.value = res.favoriteCount;
    ElMessage.success(res.isFavorite ? '已收藏' : '已取消收藏');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败，请稍后再试');
  } finally {
    favLoading.value = false;
  }
}

// ===== 分享 =====
async function copyShareLink() {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  } catch {
    ElMessage.info(`当前页面链接：${url}`);
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/lesson/landing');
  }
}

// ===== 本地小组件：树节点（递归渲染，对齐 React renderTreeNodes） =====
const TreeNodeView: Component = defineComponent({
  name: 'TreeNodeView',
  props: {
    item: { type: Object as PropType<TreeItem>, required: true },
    collapsedIds: { type: Object as PropType<Set<string>>, required: true },
    highlightId: { type: String, default: undefined },
    flatIndexes: { type: Object as PropType<Map<string, number>>, required: true }
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    return (): VNode => {
      const { node, children } = props.item;
      const hasChildren = children.length > 0;
      const collapsed = props.collapsedIds.has(node.id);
      const nodeResources = node.resources || [];
      const nodeKnow = node.knowledgePoints?.length || 0;
      const evalMethods = getNodeEvalMethods(node);
      const flatIndex = props.flatIndexes.get(node.id) ?? 0;
      const isHighlight = props.highlightId === node.id;

      return h('div', { key: node.id }, [
        h(
          'div',
          {
            id: `course-node-${node.id}`,
            class: ['ld-node', { highlighted: isHighlight }]
          },
          [
            h('div', { class: 'ld-node-row' }, [
              hasChildren
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'ld-node-toggle',
                      title: collapsed ? '展开子节点' : '收起子节点',
                      onClick: () => emit('toggle', node.id)
                    },
                    [
                      h('span', { class: collapsed ? 'ld-chevron-right' : 'ld-chevron-down' })
                    ]
                  )
                : h('span', { class: 'ld-node-toggle-spacer' }),
              h('div', { class: 'ld-node-index' }, String(flatIndex + 1)),
              h('div', { class: 'ld-node-body' }, [
                h('div', { class: 'ld-node-title-row' }, [
                  h('div', { class: 'ld-node-name' }, node.name),
                  node.type === 'original'
                    ? h('span', { class: 'ld-node-ref-badge' }, '引用颗粒课')
                    : null
                ]),
                h('div', { class: 'ld-node-meta' }, [
                  h('span', { class: 'ld-node-meta-item' }, [
                    h(Clock, { size: 14 }),
                    ` ${node.duration || 0} 课时`
                  ]),
                  nodeResources.length > 0
                    ? h('span', { class: 'ld-node-meta-item' }, [
                        h(FolderOpened, { size: 14 }),
                        ` ${nodeResources.length} 个资源`
                      ])
                    : null,
                  nodeKnow > 0
                    ? h('span', { class: 'ld-node-meta-item' }, [
                        h(Collection, { size: 14 }),
                        ` ${nodeKnow} 个知识点`
                      ])
                    : null
                ]),
                evalMethods.length > 0
                  ? h(
                      'div',
                      { class: 'ld-node-evals' },
                      evalMethods.map((methodKey) =>
                        h(
                          'span',
                          {
                            key: methodKey,
                            class: 'ld-eval-method-badge',
                            style: { backgroundColor: EVAL_METHOD_COLORS[methodKey] || '#94a3b8' }
                          },
                          EVAL_METHOD_LABELS[methodKey] || methodKey
                        )
                      )
                    )
                  : null
              ])
            ])
          ]
        ),
        hasChildren && !collapsed
          ? h('div', { class: 'ld-node-children' }, [
              children.map((child) =>
                h(TreeNodeView, {
                  key: child.node.id,
                  item: child,
                  collapsedIds: props.collapsedIds,
                  highlightId: props.highlightId,
                  flatIndexes: props.flatIndexes,
                  onToggle: (nodeId: string) => emit('toggle', nodeId)
                })
              )
            ])
          : null
      ]);
    };
  }
});
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* ===== 骨架屏 ===== */
.skeleton-block {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  animation: pulse 1.6s ease-in-out infinite;
}
.skeleton-header {
  height: 320px;
  border-radius: 0;
  border-left: none;
  border-right: none;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 课程不存在 ===== */
.ld-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  min-height: 60vh;
}
.ld-empty-icon {
  color: #94a3b8;
  margin-bottom: 16px;
  opacity: 0.5;
}
.ld-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 12px;
}
.ld-empty-link {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
}
.ld-empty-link:hover {
  text-decoration: underline;
}

/* ===== 头部 ===== */
.ld-header {
  background: #fff;
  border-bottom: 1px solid #e7e5e4;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}
.ld-header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
  box-sizing: border-box;
}
.ld-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
  margin-bottom: 20px;
}
.ld-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.ld-back:hover {
  color: var(--el-color-primary);
}
.ld-back-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #f1f5f9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.ld-sep {
  color: #cbd5e1;
  flex-shrink: 0;
}
.ld-crumb {
  color: #64748b;
  text-decoration: none;
}
.ld-crumb:hover {
  color: var(--el-color-primary);
}
.ld-crumb-current {
  color: #1e293b;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
@media (max-width: 639px) {
  .hidden-sm { display: none; }
}

.ld-flex {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
}
@media (min-width: 1024px) {
  .ld-flex {
    flex-direction: row;
  }
}
.ld-main-card {
  flex: 1;
  display: flex;
  min-width: 0;
}
.ld-cover-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  width: 100%;
}
.ld-cover {
  position: relative;
  width: 100%;
  height: 190px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
.ld-cover-icon {
  color: rgba(255, 255, 255, 0.85);
  position: relative;
  z-index: 10;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
}
.ld-cover-version {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.ld-info {
  padding: 16px 20px;
}
@media (min-width: 640px) {
  .ld-cover-card {
    display: flex;
    flex-direction: row;
  }
  .ld-cover {
    width: 280px;
    height: auto;
    min-height: 190px;
    align-self: stretch;
    flex-shrink: 0;
    border-radius: 0;
  }
  .ld-info {
    flex: 1;
    min-width: 0;
    padding: 20px 24px;
  }
}
.ld-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.ld-name {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.ld-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
  border: 1px solid var(--el-color-primary-light-7);
  flex-shrink: 0;
}
.ld-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 12px;
}
.ld-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ld-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.7;
  margin: 0 0 16px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ld-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  margin-bottom: 16px;
}
.ld-tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ld-tag-label {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}
.ld-tag {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
}
.ld-tag-major {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-7);
}
.ld-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-top: 20px;
}
.ld-btn-learn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 28px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.25);
  transition: all 0.2s;
}
.ld-btn-learn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.35);
}
.ld-btn-fav :deep(.el-button__content) {
  gap: 6px;
}
.ld-btn-fav {
  height: 44px;
  border-radius: 12px;
  padding: 0 20px;
}
.ld-btn-fav.active {
  border-color: #f43f5e;
  color: #e11d48;
  background: #fff1f2;
}
.ld-btn-fav .el-icon.is-active {
  color: #f43f5e;
}
.ld-fav-count {
  font-size: 12px;
  opacity: 0.8;
}
.ld-btn-share {
  height: 44px;
  width: 44px;
  border-radius: 12px;
  padding: 0;
  font-size: 16px;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
.ld-btn-share:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-7);
}

/* ===== 课程统计 ===== */
.ld-stats-card {
  width: 100%;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  align-self: stretch;
}
@media (min-width: 1024px) {
  .ld-stats-card {
    width: 320px;
    flex-shrink: 0;
  }
}
.ld-stats-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}
.ld-stats-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
}
.ld-stats-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}
.ld-stats-body {
  padding: 20px;
}
.ld-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f8fafc;
}
.ld-stat-row:last-child {
  border-bottom: none;
}
.ld-stat-label {
  font-size: 13px;
  color: #64748b;
}
.ld-stat-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-color-primary);
}

/* ===== 主区 ===== */
.ld-main {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}
.ld-tabs-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.ld-tabs-mobile {
  padding: 12px;
}
@media (min-width: 768px) {
  .ld-tabs-mobile {
    display: none;
  }
}
.ld-tabs-select {
  width: 100%;
}
.ld-tabs-bar {
  display: none;
  overflow-x: auto;
  border-bottom: 1px solid #f1f5f9;
  padding: 0 16px;
}
@media (min-width: 768px) {
  .ld-tabs-bar {
    display: flex;
  }
}
.ld-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 14px 20px;
  font-size: 14px;
  white-space: nowrap;
  border: none;
  background: none;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}
.ld-tab:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.ld-tab.active {
  color: var(--el-color-primary);
  font-weight: 600;
}
.ld-tab-count {
  margin-left: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  background: #f1f5f9;
  color: #64748b;
}
.ld-tab-count.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.ld-tab-underline {
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background: var(--el-color-primary);
  border-radius: 999px 999px 0 0;
}
.ld-tab-content {
  padding: 16px;
  min-height: 500px;
}
@media (min-width: 640px) {
  .ld-tab-content {
    padding: 24px;
  }
}

/* ===== 空态（tab 内） ===== */
.ld-empty-tab {
  text-align: center;
  padding: 64px 0;
  color: #94a3b8;
}
.ld-empty-tab-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 16px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}
.ld-empty-tab-title {
  font-size: 15px;
  font-weight: 500;
  color: #475569;
}
.ld-empty-tab-hint {
  font-size: 13px;
  margin-top: 4px;
}

/* ===== 课程目录树 ===== */
.ld-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ld-node {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}
.ld-node:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}
.ld-node.highlighted {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}
.ld-node-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}
.ld-node-toggle {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #f1f5f9;
  border: none;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}
.ld-node-toggle:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.ld-node-toggle-spacer {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.ld-chevron-right {
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid currentColor;
}
.ld-chevron-down {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 6px solid currentColor;
}
.ld-node-index {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
}
.ld-node-body {
  flex: 1;
  min-width: 0;
}
.ld-node-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ld-node-name {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-node-ref-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 500;
  border: 1px solid var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  flex-shrink: 0;
}
.ld-node-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #94a3b8;
}
.ld-node-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.ld-node-evals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.ld-eval-method-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
  color: #fff;
}
.ld-node-children {
  margin-left: 32px;
  padding-left: 16px;
  border-left: 2px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  margin-bottom: 12px;
}

/* ===== 资源中心 ===== */
.ld-res-count {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 16px;
}
.primary-text {
  color: var(--el-color-primary);
}
.ld-res-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ld-res-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
}
.ld-res-group-head .el-icon {
  color: var(--el-color-primary);
}
.ld-res-group-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}
.ld-res-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .ld-res-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .ld-res-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.ld-res-item {
  background: #f8fafc;
  border-radius: 12px;
  padding: 14px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;
}
.ld-res-item:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
.ld-res-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.ld-res-item-info {
  flex: 1;
  min-width: 0;
}
.ld-res-item-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-res-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.ld-res-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid;
}
.bg-primary-soft { background: var(--el-color-primary-light-9); }
.text-primary { color: var(--el-color-primary); }
.border-primary-soft-2 { border-color: var(--el-color-primary-light-7); }
.bg-purple-soft { background: #faf5ff; }
.text-purple-strong { color: #9333ea; }
.border-purple-soft-2 { border-color: #e9d5ff; }
.bg-slate-soft { background: #f1f5f9; }
.text-slate-strong { color: #64748b; }
.border-slate-soft-2 { border-color: #e2e8f0; }
.ld-res-preview-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all 0.2s;
}
.ld-res-preview-btn:hover {
  background: var(--el-color-primary-light-8);
}

/* ===== 评价标准 ===== */
.ld-eval-count {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 16px;
}
.ld-eval-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 1024px) {
  .ld-eval-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.ld-eval-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}
.ld-eval-card:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.ld-eval-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.ld-eval-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ld-eval-info {
  flex: 1;
  min-width: 0;
}
.ld-eval-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-eval-sub {
  font-size: 11px;
  color: #94a3b8;
}
.ld-eval-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.ld-eval-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ld-eval-bar-label {
  font-size: 11px;
  color: #64748b;
  width: 64px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-eval-bar {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.ld-eval-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: all 0.3s;
}
.ld-eval-bar-value {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  width: 32px;
  text-align: right;
}

/* ===== 知识图谱 ===== */
.kg-wrap {
  padding: 8px 0;
}
.kg-head {
  margin-bottom: 16px;
}
.kg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px;
}
.kg-title .el-icon {
  color: var(--el-color-primary);
}
.kg-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 12px;
}
.kg-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.kg-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}
.kg-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.kg-canvas-wrap {
  overflow-x: auto;
}
.kg-canvas {
  position: relative;
  min-width: 100%;
}
.kg-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.kg-edge {
  stroke: #cbd5e1;
  stroke-width: 1.5;
}
.kg-layer {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.kg-node {
  width: 180px;
  height: 44px;
  border-radius: 10px;
  border: 1.5px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  padding: 0 10px;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}

/* ===== 预览弹窗 ===== */
.ld-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ld-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ld-dialog-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
  flex-shrink: 0;
}
.ld-preview-body {
  height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
}
.ld-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.ld-preview-media {
  max-width: 100%;
  max-height: 100%;
}
.ld-preview-audio {
  width: 80%;
}
.ld-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
.ld-preview-external,
.ld-preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 13px;
}
.ld-preview-external-icon {
  opacity: 0.5;
}
</style>
