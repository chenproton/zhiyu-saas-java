<template>
  <div class="landing">
    <!-- ===== 加载中（对齐 React Skeleton：头部 + 内容块） ===== -->
    <template v-if="loading">
      <div class="skeleton-block skeleton-header" />
      <main class="jd-main">
        <div class="skeleton-block" />
      </main>
    </template>

    <!-- ===== 岗位不存在 ===== -->
    <div v-else-if="!position" class="jd-empty">
      <el-icon :size="64" class="jd-empty-icon"><Briefcase /></el-icon>
      <p class="jd-empty-title">岗位不存在或暂未公开</p>
      <router-link to="/job/landing" class="jd-empty-link">返回岗位列表</router-link>
    </div>

    <template v-else>
      <!-- ===== 岗位头部（对齐 React PositionHeader） ===== -->
      <header class="jd-header">
        <div class="jd-header-inner">
          <button type="button" class="jd-back" @click="goBack">
            <el-icon><ArrowLeft /></el-icon> 返回上一页
          </button>

          <div class="jd-cover-card">
            <div class="jd-cover" :style="coverStyle">
              <span v-if="!position.coverImage" class="jd-cover-letter">{{ displayTitle.charAt(0) }}</span>
              <span class="jd-cover-version">{{ position.version }}</span>
              <span class="jd-cover-id">{{ position.id.slice(0, 8) }}</span>
            </div>

            <div class="jd-info">
              <div class="jd-title-row">
                <h1 class="jd-name">{{ position.name }}</h1>
                <span class="jd-salary">{{ salaryText }}</span>
              </div>
              <p v-if="position.shortName && position.shortName !== position.name" class="jd-alias">
                别名：{{ position.shortName }}
              </p>

              <div class="jd-tags">
                <span class="jd-tag jd-tag-industry">
                  <el-icon><Briefcase /></el-icon>
                  面向行业：{{ industryName || (position.positionType === 'enterprise' ? '企业' : '教学') }}
                </span>
                <span class="jd-tag jd-tag-major">
                  <el-icon><School /></el-icon>
                  适用专业：{{ majorsText }}
                </span>
              </div>

              <div class="jd-meta">
                <span class="jd-meta-item">
                  <el-icon><User /></el-icon>创建人：{{ creatorName }}
                </span>
                <span class="jd-meta-item">
                  <el-icon><UserFilled /></el-icon>共建人：{{ coBuilderNames }}
                </span>
              </div>
              <div class="jd-meta">
                <span class="jd-meta-item">
                  <el-icon><Calendar /></el-icon>创建时间：{{ formatDate(position.createdAt) }}
                </span>
                <span class="jd-meta-item">
                  <el-icon><EditPen /></el-icon>更新时间：{{ formatDate(position.updatedAt) }}
                </span>
              </div>

              <div class="jd-actions">
                <el-button type="primary" class="jd-btn-learn" @click="handleStartLearning">
                  <el-icon><VideoPlay /></el-icon>开始学习
                </el-button>
                <el-button :class="['jd-btn-fav', { active: isHeart }]" :loading="favLoading" @click="toggleHeart">
                  <el-icon><Star :class="{ filled: isHeart }" /></el-icon>
                  {{ isHeart ? '已收藏岗位' : '收藏岗位' }}
                  <span v-if="favoriteCount > 0" class="jd-fav-count">({{ favoriteCount }})</span>
                </el-button>
                <el-button class="jd-btn-share" @click="copyShareLink">
                  <el-icon><Share /></el-icon>分享岗位
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="jd-main">
        <!-- ===== 统计条（对齐 React StatsBox） ===== -->
        <div class="jd-stats">
          <div v-for="s in stats" :key="s.label" class="jd-stat">
            <div class="jd-stat-value">{{ s.value.toLocaleString() }}</div>
            <div class="jd-stat-label">
              <el-icon><component :is="s.icon" /></el-icon>{{ s.label }}
            </div>
          </div>
        </div>

        <!-- ===== Tab 卡片（对齐 React TABS） ===== -->
        <div class="jd-tabs-card">
          <el-tabs v-model="activeTab" class="jd-tabs">
            <!-- 岗位概况 -->
            <el-tab-pane name="overview">
              <template #label>
                <span class="jd-tab-label"><el-icon><Document /></el-icon>岗位概况</span>
              </template>
              <div class="tab-overview">
                <div class="tab-section">
                  <h3 class="tab-section-title">
                    <el-icon><InfoFilled /></el-icon>岗位简介
                  </h3>
                  <p class="tab-section-text">{{ position.description || '暂无岗位介绍' }}</p>
                </div>
                <div v-if="position.careerPath" class="tab-section">
                  <h3 class="tab-section-title">
                    <el-icon><Guide /></el-icon>职业发展路线
                  </h3>
                  <div class="tab-section-box">{{ position.careerPath }}</div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 岗位职责 -->
            <el-tab-pane name="duties">
              <template #label>
                <span class="jd-tab-label"><el-icon><List /></el-icon>岗位职责</span>
              </template>
              <div class="duty-wrap">
                <div class="tab-section">
                  <h4 class="tab-sub-title">
                    <el-icon><List /></el-icon>
                    岗位职责(<strong class="primary-text">{{ responsibilities.length || position.requirements.length }}</strong>项)
                  </h4>
                  <el-table v-if="responsibilities.length > 0" :data="dutyRows" class="duty-table">
                    <el-table-column label="编号" width="110">
                      <template #default="{ $index }">
                        <span class="duty-no">T-{{ String($index + 1).padStart(3, '0') }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="职责描述">
                      <template #default="{ row }">
                        <span class="duty-name">{{ row.responsibility.name }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="关联能力点" width="170">
                      <template #default="{ row }">
                        <span class="primary-text">{{ row.abilities.length }} 个</span>
                        <el-button size="small" class="duty-detail-btn" @click="openDutyModal(row.responsibility)">
                          查看详情
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="empty-mini">暂无岗位职责数据</div>
                </div>

                <div class="tab-section">
                  <h4 class="tab-sub-title">
                    <el-icon><List /></el-icon>
                    任职要求(<strong class="primary-text">{{ position.requirements.length }}</strong>项)
                  </h4>
                  <div class="req-box">
                    <ul class="req-list">
                      <li v-for="(req, i) in position.requirements" :key="i" class="req-item">
                        <span class="req-num">{{ i + 1 }}</span>
                        {{ req }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 涉及证书 -->
            <el-tab-pane name="certs">
              <template #label>
                <span class="jd-tab-label"><el-icon><Medal /></el-icon>涉及证书</span>
              </template>
              <div v-if="certificates.length === 0" class="empty-big">暂无相关证书</div>
              <div v-else class="cert-wrap">
                <div class="cert-count">共涉及 {{ certificates.length }} 个相关证书</div>
                <div class="cert-grid">
                  <div v-for="(cert, i) in certificates" :key="cert.id" class="cert-card">
                    <div class="cert-cover" :style="certCoverStyle(cert, i)" @click="cert.imageUrl && (previewImage = cert.imageUrl)">
                      <span v-if="cert.imageUrl" class="cert-zoom">
                        <el-icon><ZoomIn /></el-icon>点击放大
                      </span>
                      <el-icon v-else :size="56" class="cert-icon"><Medal /></el-icon>
                    </div>
                    <div class="cert-body">
                      <div class="cert-name">{{ cert.name }}</div>
                      <div class="cert-org">
                        <el-icon><OfficeBuilding /></el-icon>{{ cert.description ? cert.description.slice(0, 20) : '官方认证' }}
                      </div>
                      <div v-if="cert.description" class="cert-desc-wrap">
                        <p :class="['cert-desc', { clamp: !certExpanded[cert.id] }]">{{ cert.description }}</p>
                        <button type="button" class="cert-toggle" @click="toggleCert(cert.id)">
                          <el-icon v-if="!certExpanded[cert.id]"><CaretBottom /></el-icon>
                          <el-icon v-else><CaretTop /></el-icon>
                          {{ certExpanded[cert.id] ? '收起' : '展示' }}
                        </button>
                      </div>
                      <a v-if="cert.url" :href="cert.url" target="_blank" rel="noreferrer" class="cert-link">
                        <el-icon><Link /></el-icon>查看证书详情
                      </a>
                      <span v-else class="cert-link disabled">
                        <el-icon><Link /></el-icon>暂无详情链接
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 证书图片放大预览 -->
                <div v-if="previewImage" class="cert-preview" @click="previewImage = null">
                  <button type="button" class="cert-preview-close" @click="previewImage = null">
                    <el-icon><Close /></el-icon>
                  </button>
                  <img :src="previewImage" alt="证书放大图" class="cert-preview-img" @click.stop />
                </div>
              </div>
            </el-tab-pane>

            <!-- 能力模型（登录可见） -->
            <el-tab-pane name="ability">
              <template #label>
                <span class="jd-tab-label"><el-icon><Collection /></el-icon>能力模型</span>
              </template>
              <LoginPrompt v-if="!loggedIn" text="能力模型需登录后查看" desc="登录账号后可查看岗位的职责与能力点要求" />
              <template v-else>
                <div v-if="abilityGroups.length === 0" class="empty-big">暂无能力模型数据</div>
                <div v-else class="ability-wrap">
                  <div class="ability-intro">
                    <div class="ability-intro-title">
                      <el-icon><MagicStick /></el-icon>能力模型说明
                    </div>
                    <p class="ability-intro-text">
                      本岗位基于真实企业岗位标准，拆解为若干能力领域，每个领域下关联对应的能力点与胜任等级，帮助学生明确学习目标。
                    </p>
                  </div>
                  <div class="ability-count">共 {{ abilityGroups.length }} 个能力领域，{{ bindings.length }} 个能力点</div>
                  <div class="ability-grid">
                    <div v-for="g in abilityGroups" :key="g.domain" class="ability-domain">
                      <div class="ability-domain-head">
                        <el-icon><Aim /></el-icon>{{ g.domain }}
                      </div>
                      <div class="ability-domain-body">
                        <div
                          v-for="ab in g.items"
                          :key="ab.id"
                          class="ability-item"
                          role="button"
                          tabindex="0"
                          @click="selectedAbility = { binding: ab, abilityPoint: abilityMap[ab.abilityPointId] }"
                          @keydown.enter="selectedAbility = { binding: ab, abilityPoint: abilityMap[ab.abilityPointId] }"
                        >
                          <div class="ability-item-name">
                            <span class="ability-item-name-text">{{ abilityMap[ab.abilityPointId]?.name || ab.abilityName || ab.domain || '未命名能力' }}</span>
                            <span
                              v-for="attr in (abilityMap[ab.abilityPointId]?.attributes || [])"
                              :key="attr"
                              class="attr-badge"
                              :style="attrStyle(attr)"
                            >
                              {{ attr }}
                            </span>
                          </div>
                          <span v-if="abilityMap[ab.abilityPointId]?.code" class="ability-item-code">
                            编码：{{ abilityMap[ab.abilityPointId]?.code }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </el-tab-pane>

            <!-- 胜任标准（登录可见） -->
            <el-tab-pane name="competency">
              <template #label>
                <span class="jd-tab-label"><el-icon><Aim /></el-icon>胜任标准</span>
              </template>
              <LoginPrompt v-if="!loggedIn" text="胜任标准需登录后查看" desc="登录账号后可查看岗位能力点的目标等级" />
              <template v-else>
                <div v-if="compGroups.length === 0" class="empty-big">暂无胜任标准数据</div>
                <div v-else class="comp-wrap">
                  <div class="comp-head">
                    <span class="comp-summary">全览岗位 {{ bindings.length }} 个关键能力点胜任标准</span>
                  </div>
                  <div class="comp-layout">
                    <!-- 桌面侧栏 -->
                    <div class="comp-side">
                      <button
                        v-for="g in compGroups"
                        :key="g.id"
                        type="button"
                        :class="['comp-side-btn', { active: compActiveId === g.id }]"
                        @click="compScrollTo(g.id)"
                      >
                        {{ g.name }}
                      </button>
                    </div>

                    <!-- 移动端横向章节导航 -->
                    <div class="comp-mobile-nav">
                      <button
                        v-for="g in compGroups"
                        :key="g.id"
                        type="button"
                        :class="['comp-chip', { active: compActiveId === g.id }]"
                        @click="compScrollTo(g.id)"
                      >
                        {{ g.name }}
                      </button>
                    </div>

                    <!-- 内容 -->
                    <div ref="compContentRef" class="comp-content" @scroll="onCompScroll">
                      <div v-for="g in compGroups" :key="g.id" :id="`comp-sec-${g.id}`" class="comp-section">
                        <div class="comp-section-title">
                          <el-icon><Aim /></el-icon>{{ g.name }}
                        </div>
                        <div class="comp-items">
                          <div v-for="item in g.items" :key="item.id" class="comp-item">
                            <div class="comp-item-name">{{ item.name }}</div>

                            <div class="level-track">
                              <div class="level-track-bg" />
                              <div class="level-track-fill" :style="{ width: `calc(${(Math.max(0, resolveLevelIndex(item.requiredLevel)) / (LEVELS.length - 1)) * 100}% - 10px)` }" />
                              <div class="level-dots">
                                <span
                                  v-for="(lvl, li) in LEVELS"
                                  :key="lvl.value"
                                  :class="['level-dot', { target: li === resolveLevelIndex(item.requiredLevel), reached: li <= resolveLevelIndex(item.requiredLevel) }]"
                                />
                              </div>
                              <div class="level-labels">
                                <span
                                  v-for="(lvl, li) in LEVELS"
                                  :key="lvl.value"
                                  :class="['level-label', { target: li === resolveLevelIndex(item.requiredLevel), reached: li <= resolveLevelIndex(item.requiredLevel) }]"
                                >
                                  {{ lvl.label }}
                                </span>
                              </div>
                            </div>

                            <div class="comp-item-level">
                              <el-icon><Aim /></el-icon>目标等级：
                              <span class="comp-level-badge">{{ LEVELS[resolveLevelIndex(item.requiredLevel)]?.label || item.requiredLevel }}</span>
                            </div>

                            <div v-if="item.rubricDescription" class="comp-rubric">{{ item.rubricDescription }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </el-tab-pane>

            <!-- 知识图谱（登录可见） -->
            <el-tab-pane name="graph">
              <template #label>
                <span class="jd-tab-label"><el-icon><Connection /></el-icon>知识图谱</span>
              </template>
              <LoginPrompt v-if="!loggedIn" text="知识图谱需登录后查看" desc="登录账号后可查看岗位知识图谱" />
              <template v-else>
                <div v-if="graphData.nodes.length === 0" class="empty-big">暂无图谱数据</div>
                <div v-else class="kg-wrap">
                  <div class="kg-head">
                    <h3 class="kg-title">
                      <el-icon><Connection /></el-icon>知识图谱
                    </h3>
                    <p class="kg-desc">
                      岗位→能力领域→能力点→知识点→颗粒课的完整关联网络（知识点经任务绑定关联能力点，颗粒课经知识点绑定关联）
                    </p>
                    <div class="kg-legend">
                      <span v-for="t in TYPE_ORDER" :key="t" class="kg-legend-item">
                        <i class="kg-legend-dot" :style="{ background: TYPE_META[t].color }" />{{ TYPE_META[t].label }}
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
                        :style="{ left: GRAPH_LAYER_X[typeIndexOf(layer.type)] + 'px' }"
                      >
                        <div
                          v-for="(node, ni) in layer.items"
                          :key="node.id"
                          class="kg-node"
                          :style="{ top: GRAPH_TOP + ni * GRAPH_NODE_GAP + 'px', ...nodeStyle(node) }"
                          :title="node.label"
                          @click="graphNodeDialog = node"
                        >
                          {{ node.label }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </el-tab-pane>

            <!-- 实践场景 -->
            <el-tab-pane name="scenes">
              <template #label>
                <span class="jd-tab-label"><el-icon><Reading /></el-icon>实践场景</span>
              </template>
              <div v-if="scenes.length === 0" class="empty-big">暂无关联实践场景</div>
              <div v-else class="scene-wrap">
                <div class="scene-head">
                  <span class="scene-summary">
                    共关联 {{ scenes.length }} 个实践场景，{{ scenarioTasks.length }} 个任务，合计 {{ sceneTotalHours }} 课时
                  </span>
                  <div class="scene-tools">
                    <button type="button" class="scene-tool-btn" @click="expandAllScenes">
                      <el-icon><Expand /></el-icon>全部展开
                    </button>
                    <button type="button" class="scene-tool-btn" @click="sceneExpanded = {}">
                      <el-icon><Fold /></el-icon>全部收起
                    </button>
                  </div>
                </div>
                <div class="scene-list">
                  <div v-for="(scene, idx) in scenes" :key="scene.id" class="scene-item">
                    <div class="scene-item-head" @click="toggleScene(idx)">
                      <div class="scene-item-icon" :style="{ background: SCENE_COLORS[idx % SCENE_COLORS.length] }">
                        <el-icon><component :is="SCENE_ICONS[idx % SCENE_ICONS.length]" /></el-icon>
                      </div>
                      <div class="scene-item-info">
                        <div class="scene-item-name">{{ scene.name }}</div>
                        <div class="scene-item-meta">{{ sceneTaskCount(scene.id) }}个任务 · {{ sceneHours(scene.id) }}课时</div>
                      </div>
                      <div class="scene-item-right">
                        <button type="button" class="scene-learn-btn" @click.stop="goScene(scene.id)">
                          <el-icon><VideoPlay /></el-icon>去学习
                        </button>
                        <el-icon :class="['scene-chevron', { open: sceneExpanded[idx] }]"><CaretBottom /></el-icon>
                      </div>
                    </div>
                    <div v-if="sceneExpanded[idx]" class="scene-item-body">
                      <div v-if="sceneTaskCount(scene.id) === 0" class="scene-no-tasks">暂无任务</div>
                      <div v-for="(task, ti) in (sceneTaskMap.get(scene.id) || [])" :key="task.id" class="scene-task">
                        <div class="scene-task-left">
                          <div class="scene-task-no">{{ ti + 1 }}</div>
                          <div>
                            <div class="scene-task-name">{{ task.name }}</div>
                            <div class="scene-task-tags">
                              <span class="task-tag">{{ task.taskType === 'assessment' ? '测评任务' : '训练任务' }}</span>
                              <span v-for="name in (task.abilityPointNames || []).slice(0, 7)" :key="name" class="task-tag">{{ name }}</span>
                              <span v-if="(task.abilityPointNames || []).length > 7" class="task-tag">
                                +{{ (task.abilityPointNames || []).length - 7 }}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span class="scene-task-hours">{{ task.estimatedHours }}课时</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </main>
    </template>

    <!-- ===== 职责关联能力点弹窗（对齐 React DutyTable Dialog） ===== -->
    <el-dialog v-model="dutyModalOpen" width="1000px" top="6vh" class="jd-dialog">
      <template #header>
        <div>
          <div class="dialog-title">职责关联能力点</div>
          <div class="dialog-sub">正在查看：{{ modalDuty?.name }}</div>
        </div>
      </template>
      <div v-if="modalAbilities.length === 0" class="empty-mini tall">该职责暂无关联能力点</div>
      <template v-else>
        <div class="ap-grid">
          <AbilityPointCard
            v-for="(ab, idx) in dutyPageItems"
            :key="ab.id"
            :binding="ab"
            :ability-point="abilityMap[ab.abilityPointId]"
            :index="dutyPage * DUTY_PER_PAGE + idx"
          />
        </div>
        <div v-if="dutyTotalPages > 1" class="dots-pager">
          <button type="button" class="dot-page-btn" :disabled="dutyPage <= 0" @click="dutyPage--">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <button
            v-for="i in dutyTotalPages"
            :key="i"
            type="button"
            :class="['dot', { active: dutyPage === i - 1 }]"
            @click="dutyPage = i - 1"
          />
          <button type="button" class="dot-page-btn" :disabled="dutyPage >= dutyTotalPages - 1" @click="dutyPage++">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
        <p class="dots-tip">
          <el-icon><Star /></el-icon>共 {{ modalAbilities.length }} 个能力点
        </p>
      </template>
    </el-dialog>

    <!-- ===== 能力点详情弹窗（对齐 React AbilityTree Dialog） ===== -->
    <el-dialog v-model="abilityDialogOpen" width="520px" class="jd-dialog">
      <template #header>
        <div class="dialog-title">能力点详情</div>
      </template>
      <AbilityPointCard
        v-if="selectedAbility"
        :binding="selectedAbility.binding"
        :ability-point="selectedAbility.abilityPoint"
      />
    </el-dialog>

    <!-- ===== 图谱节点详情弹窗 ===== -->
    <el-dialog v-model="graphNodeDialogOpen" width="420px" class="jd-dialog">
      <template #header>
        <div class="dialog-title">节点详情</div>
      </template>
      <div v-if="graphNodeDialog" class="graph-node-detail">
        <span class="graph-node-badge" :style="nodeStyle(graphNodeDialog)">{{ TYPE_META[graphNodeDialog.type].label }}</span>
        <div class="graph-node-name">{{ graphNodeDialog.label }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, ref, watch } from 'vue';
import type { Component, PropType } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElIcon, ElMessage } from 'element-plus';
import {
  Aim,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  CaretBottom,
  CaretTop,
  Clock,
  Close,
  Collection,
  Connection,
  Document,
  EditPen,
  Expand,
  Fold,
  Guide,
  InfoFilled,
  Lightning,
  Link,
  List,
  Lock,
  MagicStick,
  Medal,
  Memo,
  OfficeBuilding,
  Reading,
  School,
  Share,
  Star,
  User,
  UserFilled,
  VideoPlay,
  View,
  ZoomIn
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  abilityApi,
  learnRoadApi,
  positionApi,
  positionCertificateApi,
  positionResponsibilityApi,
  publicPositionApi
} from '@/api/job';
import { scenarioApi, taskApi } from '@/api/scene';
import { knowledgeApi, courseApi } from '@/api/lesson';
import { industryApi } from '@/api/system';
import { formatDate } from './evaluation-types';
import type { CareerPosition, PositionResponsibility, PositionCertificate, AbilityPoint, PositionAbilityBinding, AbilityDomain, LearnRoad } from '@/types/job';
import type { Scenario, ScenarioTask } from '@/types/scene';
import type { Course, KnowledgePoint } from '@/types/lesson';

// ===== 常量 =====
const TABS = [
  { value: 'overview', label: '岗位概况', icon: Document },
  { value: 'duties', label: '岗位职责', icon: List },
  { value: 'certs', label: '涉及证书', icon: Medal },
  { value: 'ability', label: '能力模型', icon: Collection },
  { value: 'competency', label: '胜任标准', icon: Aim },
  { value: 'graph', label: '知识图谱', icon: Connection },
  { value: 'scenes', label: '实践场景', icon: Reading }
] satisfies { value: string; label: string; icon: Component }[];

const DUTY_PER_PAGE = 6;

// 实践场景图标与颜色（对齐 React SceneList SCENE_ICONS/SCENE_COLORS）
const SCENE_ICONS = [Reading, Aim, Collection, Clock, VideoPlay] as Component[];
const SCENE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#7c3aed', '#14b8a6', '#ec4899'];

// 能力点卡片领域/等级配色（对齐 React ability-point-card）
const DOMAIN_COLORS: Record<string, [string, string]> = {
  专业工具: ['#3b82f6', '#60a5fa'],
  团队协作: ['#10b981', '#34d399'],
  通用素质: ['#f59e0b', '#fbbf24'],
  业务洞察: ['#8b5cf6', '#a78bfa'],
  创新思维: ['#ec4899', '#f472b6']
};
const LEVEL_LABELS: Record<string, string> = {
  understand: '了解',
  comprehend: '理解',
  master: '掌握',
  proficient: '熟练',
  expert: '精通'
};
const LEVEL_COLORS: Record<string, string> = {
  了解: '#94a3b8',
  理解: '#60a5fa',
  掌握: '#34d399',
  熟练: '#fbbf24',
  精通: '#f87171'
};

// 胜任标准等级（对齐 React CompetencyStandards LEVELS）
const LEVELS = [
  { label: '了解', value: '了解', en: 'understand' },
  { label: '理解', value: '理解', en: 'comprehend' },
  { label: '掌握', value: '掌握', en: 'master' },
  { label: '熟练', value: '熟练', en: 'proficient' },
  { label: '精通', value: '精通', en: 'expert' }
];

// 能力属性徽标配色（对齐 React AbilityTree ATTRIBUTE_COLORS）
const ATTRIBUTE_COLORS: Record<string, [string, string]> = {
  知识: ['#3b82f6', '#60a5fa'],
  素养: ['#f59e0b', '#fbbf24'],
  技能: ['#10b981', '#34d399']
};

// 知识图谱节点类型（对齐 React knowledge-graph-view TYPE_META/TYPE_ORDER）
const TYPE_ORDER = ['position', 'domain', 'unit', 'knowledge', 'course'] as const;
type GraphNodeType = (typeof TYPE_ORDER)[number];
const TYPE_META: Record<GraphNodeType, { label: string; color: string; bg: string }> = {
  position: { label: '岗位', color: '#2563eb', bg: '#eff6ff' },
  domain: { label: '能力领域', color: '#b91c1c', bg: '#fee2e2' },
  unit: { label: '能力点', color: '#0e7490', bg: '#cffafe' },
  knowledge: { label: '知识点', color: '#15803d', bg: '#dcfce7' },
  course: { label: '颗粒课', color: '#b45309', bg: '#fef3c7' }
};
interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
}
interface GraphEdge {
  source: string;
  target: string;
}
// 静态分层布局参数
const GRAPH_LAYER_X = [100, 320, 540, 760, 980];
const GRAPH_NODE_GAP = 64;
const GRAPH_NODE_H = 44;
const GRAPH_TOP = 40;

// ===== 路由与登录态 =====
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loggedIn = computed(() => auth.isLoggedIn);
const id = computed(() => String(route.params.id || ''));

// ===== 数据状态 =====
const position = ref<CareerPosition | null>(null);
const loading = ref(true);
const activeTab = ref('overview');

const responsibilities = ref<PositionResponsibility[]>([]);
const bindings = ref<PositionAbilityBinding[]>([]);
const abilityPoints = ref<AbilityPoint[]>([]);
const abilityDomains = ref<AbilityDomain[]>([]);
const certificates = ref<PositionCertificate[]>([]);
const allPositions = ref<CareerPosition[]>([]);
const scenarios = ref<Scenario[]>([]);
const scenarioTasks = ref<ScenarioTask[]>([]);
const roads = ref<LearnRoad[]>([]);
const industryMap = ref<Map<string, string>>(new Map());

// 岗位详情加载请求序号：快速切换 id 时丢弃过期响应
const detailSeq = ref(0);
// 关联数据加载序号（与 detailSeq 互不抢占，避免 loading 永不复位）
const loadSeq = ref(0);

// ===== 详情加载（对齐 React 详情 effect） =====
watch(
  id,
  async (val) => {
    if (!val) return;
    const seq = ++detailSeq.value;
    loading.value = true;
    try {
      const pos = await publicPositionApi.get(val);
      if (seq !== detailSeq.value) return;
      position.value = pos;
    } catch {
      if (seq !== detailSeq.value) return;
      position.value = null;
    } finally {
      if (seq === detailSeq.value) loading.value = false;
    }
  },
  { immediate: true }
);

// ===== 关联数据加载（对齐 React 关联数据 effect，登录门槛一致） =====
watch(
  [id, position, loggedIn],
  async ([val, pos, lg]) => {
    if (!val || !pos) return;
    const seq = ++loadSeq.value;

    publicPositionApi
      .list({ status: 'published', limit: 20 })
      .then((res) => {
        if (seq === loadSeq.value) allPositions.value = res.items || [];
      })
      .catch(() => {
        if (seq === loadSeq.value) allPositions.value = [];
      });

    scenarioApi
      .list({ careerPositionId: val, status: 'published', limit: 1000 })
      .then(async (res) => {
        const scens = res.items || [];
        // 逐任务加载，单个场景任务失败只记录错误，不清空已加载的数据
        const allTasks: ScenarioTask[] = [];
        await Promise.all(
          scens.map(async (s: Scenario) => {
            try {
              const r = await taskApi.list({ scenarioId: s.id, limit: 1000 });
              allTasks.push(...(r.items || []));
            } catch (err) {
              console.error(`加载场景任务（${s.id}）`, err);
            }
          })
        );
        if (seq !== loadSeq.value) return;
        scenarios.value = scens;
        scenarioTasks.value = allTasks;
      })
      .catch((err) => {
        // 场景列表本身加载失败时保留已加载部分，不清空整体
        console.error('加载场景列表', err);
        ElMessage.error('部分数据加载失败');
      });

    // 学习路径/职责/能力/证书仅登录用户可读（/job/learn-roads 等菜单授权）；
    // 与 React 行为一致：未登录时职责/证书等数据不加载
    if (!lg) return;

    learnRoadApi
      .list({ limit: 100 })
      .then((roadRes) => {
        if (seq !== loadSeq.value) return;
        roads.value = (roadRes.items || []).filter((r: LearnRoad) => r.positionIds?.includes(val));
      })
      .catch((err) => {
        if (seq !== loadSeq.value) return;
        console.error('加载学习路径数据', err);
      });

    // 复用上方 seq：再次递增会让前两个请求的响应被判为过期而丢弃
    Promise.all([
      positionResponsibilityApi.list({ careerPositionId: val }),
      abilityApi.listBindings({ careerPositionId: val }),
      abilityApi.list({ limit: 1000 }),
      abilityApi.listDomains(val),
      positionCertificateApi.list({ careerPositionId: val })
    ])
      .then(([respRes, bindingRes, abilityRes, domainRes, certRes]) => {
        if (seq !== loadSeq.value) return;
        responsibilities.value = respRes.items || [];
        bindings.value = bindingRes.items || [];
        abilityPoints.value = abilityRes.items || [];
        abilityDomains.value = domainRes.items || [];
        certificates.value = certRes.items || [];
      })
      .catch((err) => {
        console.error('加载岗位详情数据', err);
        ElMessage.error('部分数据加载失败');
      });
  },
  { immediate: true }
);

// ===== 行业字典（对齐 React useIndustryMap） =====
onMounted(async () => {
  try {
    const res = await industryApi.list({ limit: 500 });
    const map = new Map<string, string>();
    (res.items || []).forEach((i: { id: string; name: string }) => map.set(i.id, i.name));
    industryMap.value = map;
  } catch {
    /* 行业字典加载失败仅影响头部行业标签展示 */
  }
});

// ===== 收藏（对齐 React PositionHeader toggleHeart） =====
const isHeart = ref(false);
const favoriteCount = ref(0);
const favLoading = ref(false);

watch(
  [loggedIn, position],
  async ([lg, pos]) => {
    if (!pos) return;
    favoriteCount.value = pos.favoriteCount ?? 0;
    if (!lg) {
      isHeart.value = false;
      return;
    }
    try {
      const res = await positionApi.getFavorite(pos.id);
      isHeart.value = res.isFavorite;
      favoriteCount.value = res.favoriteCount;
    } catch {
      /* 收藏状态读取失败忽略 */
    }
  },
  { immediate: true }
);

async function toggleHeart() {
  if (!loggedIn.value) {
    ElMessage.warning('请先登录后再收藏岗位');
    return;
  }
  if (favLoading.value || !position.value) return;
  favLoading.value = true;
  try {
    const res = await positionApi.favorite(position.value.id);
    isHeart.value = res.isFavorite;
    favoriteCount.value = res.favoriteCount;
    ElMessage.success(res.isFavorite ? '已收藏' : '已取消收藏');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败，请稍后再试');
  } finally {
    favLoading.value = false;
  }
}

// ===== 分享（对齐 exam-detail copyShareLink；React 为移动端访问二维码弹窗） =====
async function copyShareLink() {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  } catch {
    ElMessage.info(`当前页面链接：${url}`);
  }
}

// ===== 头部信息 =====
function formatSalary(min?: number | null, max?: number | null): string {
  if ((min ?? 0) > 0 && (max ?? 0) > 0) {
    return `${Math.floor(min! / 1000)}K-${Math.floor(max! / 1000)}K`;
  }
  if ((min ?? 0) > 0) return `${Math.floor(min! / 1000)}K起`;
  if ((max ?? 0) > 0) return `${Math.floor(max! / 1000)}K以内`;
  return '面议';
}

const displayTitle = computed(() => position.value?.shortName || position.value?.name || '');
const salaryText = computed(() => formatSalary(position.value?.salaryMin, position.value?.salaryMax));
const majorsText = computed(() => position.value?.majorNames?.filter(Boolean).join('、') || '未分类');
const creatorName = computed(() => position.value?.createdByName || position.value?.createdBy || '-');
const coBuilderNames = computed(() => position.value?.collaboratorNames?.filter(Boolean).join(', ') || '-');
const industryName = computed(() =>
  position.value?.industryId ? industryMap.value.get(position.value.industryId) : undefined
);
const coverStyle = computed(() =>
  position.value?.coverImage ? { backgroundImage: `url('${position.value.coverImage}')` } : undefined
);

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/job/landing');
  }
}

function handleStartLearning() {
  router.push(`/job/landing/${id.value}/learn`);
}

// ===== 统计条 =====
const scenarioCount = computed(() => scenarios.value.length);
const taskCount = computed(() => scenarioTasks.value.length);
const abilityPointCount = computed(
  () => new Set(bindings.value.map((b) => b.abilityPointId).filter(Boolean)).size
);
const stats = computed(
  () =>
    [
      { icon: Collection, value: scenarioCount.value, label: '关联场景数' },
      { icon: Memo, value: taskCount.value, label: '涉及任务数' },
      { icon: Lightning, value: abilityPointCount.value, label: '能力点数' },
      { icon: View, value: position.value?.viewCount ?? 0, label: '岗位浏览量' },
      { icon: Star, value: position.value?.favoriteCount ?? 0, label: '岗位收藏量' }
    ] satisfies { icon: Component; value: number; label: string }[]
);

// ===== 场景排序（对齐 React lib/learn-road-order.ts，两页共用同一规则） =====
function orderScenariosByLearnRoad(roads: LearnRoad[], scens: Scenario[]): Scenario[] {
  if (!scens.length) return [];
  const road = roads[0];
  if (!road?.steps?.length) return scens;
  const scenarioMap = new Map(scens.map((s) => [s.id, s]));
  const usedIds = new Set<string>();
  const result: Scenario[] = [];
  for (const step of road.steps) {
    if (step.scenarioId && scenarioMap.has(step.scenarioId) && !usedIds.has(step.scenarioId)) {
      const sc = scenarioMap.get(step.scenarioId)!;
      result.push(sc);
      usedIds.add(sc.id);
      continue;
    }
    // 兼容旧数据：按名称匹配
    const matched = scens.find((s) => s.name === step.name && !usedIds.has(s.id));
    if (matched) {
      result.push(matched);
      usedIds.add(matched.id);
    }
  }
  for (const sc of scens) {
    if (!usedIds.has(sc.id)) result.push(sc);
  }
  return result;
}

const scenes = computed(() => orderScenariosByLearnRoad(roads.value, scenarios.value));

// ===== 职责表（对齐 React DutyTable） =====
const dutyRows = computed(() => {
  const map = new Map<string, PositionAbilityBinding[]>();
  responsibilities.value.forEach((r) => map.set(r.id, []));
  bindings.value.forEach((b) => {
    const list = map.get(b.responsibilityId) || [];
    list.push(b);
    map.set(b.responsibilityId, list);
  });
  return responsibilities.value.map((r) => ({
    responsibility: r,
    abilities: map.get(r.id) || []
  }));
});

const dutyModalOpen = ref(false);
const modalDuty = ref<PositionResponsibility | null>(null);
const dutyPage = ref(0);
const modalAbilities = computed(() => {
  if (!modalDuty.value) return [];
  return dutyRows.value.find((g) => g.responsibility.id === modalDuty.value!.id)?.abilities || [];
});
const dutyTotalPages = computed(() => Math.max(1, Math.ceil(modalAbilities.value.length / DUTY_PER_PAGE)));
const dutyPageItems = computed(() =>
  modalAbilities.value.slice(dutyPage.value * DUTY_PER_PAGE, (dutyPage.value + 1) * DUTY_PER_PAGE)
);

function openDutyModal(resp: PositionResponsibility) {
  modalDuty.value = resp;
  dutyPage.value = 0;
  dutyModalOpen.value = true;
}

// ===== 证书（对齐 React CertCards） =====
const CERT_GRADIENTS = [
  'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ffc53d 100%)'
];
const certExpanded = ref<Record<string, boolean>>({});
const previewImage = ref<string | null>(null);

function certCoverStyle(cert: PositionCertificate, i: number) {
  return cert.imageUrl
    ? { backgroundImage: `url('${cert.imageUrl}')` }
    : { background: CERT_GRADIENTS[i % CERT_GRADIENTS.length] };
}
function toggleCert(id: string) {
  certExpanded.value = { ...certExpanded.value, [id]: !certExpanded.value[id] };
}

// ===== 能力模型（对齐 React AbilityTree） =====
const abilityMap = computed(() => {
  const map: Record<string, AbilityPoint> = {};
  abilityPoints.value.forEach((a) => {
    map[a.id] = a;
  });
  return map;
});

const abilityGroups = computed(() => {
  const groups = new Map<string, PositionAbilityBinding[]>();
  if (abilityDomains.value.length > 0) {
    abilityDomains.value.forEach((d) => groups.set(d.name, []));
    bindings.value.forEach((b) => {
      const domain =
        abilityDomains.value.find((d) => (d.bindingIds || []).includes(b.id))?.name || b.domain || '其他';
      const list = groups.get(domain) || [];
      list.push(b);
      groups.set(domain, list);
    });
  } else {
    bindings.value.forEach((b) => {
      const domain = b.domain || '综合能力';
      const list = groups.get(domain) || [];
      list.push(b);
      groups.set(domain, list);
    });
  }
  return Array.from(groups.entries())
    .map(([domain, items]) => ({ domain, items }))
    .filter((g) => g.items.length > 0);
});

const selectedAbility = ref<{ binding: PositionAbilityBinding; abilityPoint?: AbilityPoint } | null>(null);
const abilityDialogOpen = ref(false);
watch(selectedAbility, (v) => {
  abilityDialogOpen.value = Boolean(v);
});

function attrStyle(attr: string) {
  const colors = ATTRIBUTE_COLORS[attr] || ['#64748b', '#94a3b8'];
  return {
    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
    borderColor: colors[0]
  };
}

// ===== 胜任标准（对齐 React CompetencyStandards） =====
const abilityNameMap = computed(() => {
  const map: Record<string, string> = {};
  abilityPoints.value.forEach((a) => {
    map[a.id] = a.name;
  });
  return map;
});

const compGroups = computed(() => {
  // 以职责 id 作为分组 key（name 仅作展示），避免同名职责被合并、DOM id 重复导致滚动定位错乱
  const map = new Map<string, { id: string; name: string; items: (PositionAbilityBinding & { name: string })[] }>();
  responsibilities.value.forEach((r) => map.set(r.id, { id: r.id, name: r.name, items: [] }));
  bindings.value.forEach((b) => {
    const resp = responsibilities.value.find((r) => r.id === b.responsibilityId);
    const fallbackName = b.domain || '其他';
    const key = resp ? resp.id : `fallback-${fallbackName}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { id: key, name: resp ? resp.name : fallbackName, items: [] };
      map.set(key, entry);
    }
    entry.items.push({
      ...b,
      name: abilityNameMap.value[b.abilityPointId] || b.abilityName || '未命名能力'
    });
  });
  return Array.from(map.values()).filter((g) => g.items.length > 0);
});

function resolveLevelIndex(level?: string): number {
  if (!level) return 2;
  const normalized = level.trim().toLowerCase();
  const idx = LEVELS.findIndex((l) => l.value === level || l.en === normalized);
  return idx >= 0 ? idx : 2;
}

const compContentRef = ref<HTMLElement | null>(null);
const compActiveId = ref('');

watch(
  compGroups,
  (groups) => {
    if (groups.length > 0 && !compActiveId.value) {
      nextTick(() => {
        compActiveId.value = groups[0].id;
      });
    }
  },
  { immediate: true }
);

function onCompScroll() {
  const el = compContentRef.value;
  if (!el) return;
  let current = '';
  compGroups.value.forEach((g) => {
    const sec = document.getElementById(`comp-sec-${g.id}`);
    if (sec) {
      const top = sec.offsetTop - el.offsetTop;
      if (el.scrollTop >= top - 50) current = g.id;
    }
  });
  if (current) compActiveId.value = current;
}

function compScrollTo(id: string) {
  const sec = document.getElementById(`comp-sec-${id}`);
  const container = compContentRef.value;
  if (sec && container) {
    container.scrollTo({ top: sec.offsetTop - container.offsetTop, behavior: 'smooth' });
  }
}

// ===== 知识图谱（对齐 React KnowledgeGraph 数据构建；渲染为静态分层图，无图引擎依赖） =====
const knowledgeMap = ref<Map<string, KnowledgePoint>>(new Map());
const courseMap = ref<Map<string, Course>>(new Map());
let graphLoaded = false;

watch(
  activeTab,
  async (tab) => {
    if (tab !== 'graph' || graphLoaded || !loggedIn.value) return;
    graphLoaded = true;
    const [kRes, cRes] = await Promise.all([
      knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
      courseApi.list({ type: 'granular', limit: 1000 }).catch(() => ({ items: [], total: 0 }))
    ]);
    const kMap = new Map<string, KnowledgePoint>();
    (kRes.items || []).forEach((k: KnowledgePoint) => kMap.set(k.id, k));
    knowledgeMap.value = kMap;
    const cMap = new Map<string, Course>();
    (cRes.items || []).forEach((c: Course) => cMap.set(c.id, c));
    courseMap.value = cMap;
  },
  { immediate: true }
);

const graphData = computed(() => {
  const graphNodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const pushEdge = (source: string, target: string) => {
    const key = `${source}->${target}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    graphEdges.push({ source, target });
  };
  const pos = position.value;
  if (!pos) return { nodes: graphNodes, edges: graphEdges };

  // 岗位
  graphNodes.push({ id: pos.id, label: pos.shortName || pos.name, type: 'position' });

  // 合并真实能力领域 + 从 binding.domain 生成的兜底领域
  const domainByName = new Map<string, AbilityDomain>();
  abilityDomains.value.forEach((d) => domainByName.set(d.name, d));
  const coveredBindingIds = new Set<string>();
  abilityDomains.value.forEach((d) =>
    (d.bindingIds || []).forEach((bid: string) => coveredBindingIds.add(bid))
  );
  const fallbackDomains: AbilityDomain[] = [];
  bindings.value.forEach((b) => {
    if (coveredBindingIds.has(b.id)) return;
    const name = b.domain || '综合能力';
    if (!domainByName.has(name)) {
      domainByName.set(name, {
        id: `domain-fallback-${name}`,
        careerPositionId: pos.id,
        name,
        bindingIds: [],
        sortOrder: 0
      });
      fallbackDomains.push(domainByName.get(name)!);
    }
  });
  const allDomains = [...abilityDomains.value, ...fallbackDomains];

  // 能力领域节点
  allDomains.forEach((domain) => {
    graphNodes.push({ id: domain.id, label: domain.name, type: 'domain' });
    pushEdge(pos.id, domain.id);
  });

  // 能力点：通过 binding 关联到领域
  const unitNodeIds = new Set<string>();
  allDomains.forEach((domain) => {
    const domainBindingIds = new Set(domain.bindingIds || []);
    const hasExplicitBindings = domainBindingIds.size > 0;
    bindings.value
      .filter((b) => {
        if (hasExplicitBindings) return domainBindingIds.has(b.id);
        return (b.domain || '综合能力') === domain.name;
      })
      .forEach((b) => {
        const abilityPoint = abilityMap.value[b.abilityPointId];
        const unitId = abilityPoint?.id || b.abilityPointId || b.id;
        const unitLabel = abilityPoint?.name || b.abilityName || b.domain || '未命名能力';
        if (!unitNodeIds.has(unitId)) {
          unitNodeIds.add(unitId);
          graphNodes.push({ id: unitId, label: unitLabel, type: 'unit' });
        }
        pushEdge(domain.id, unitId);
      });
  });

  // 能力点 → 知识点：同一任务同时关联能力点与知识点即视为关联
  const unitKnowledgeIds = new Map<string, Set<string>>();
  scenarioTasks.value.forEach((t) => {
    (t.abilityPointIds || []).forEach((aid) => {
      (t.knowledgePointIds || []).forEach((kid) => {
        let set = unitKnowledgeIds.get(aid);
        if (!set) {
          set = new Set();
          unitKnowledgeIds.set(aid, set);
        }
        set.add(kid);
      });
    });
  });

  const knowledgeNodeIds = new Set<string>();
  unitNodeIds.forEach((unitId) => {
    (unitKnowledgeIds.get(unitId) || []).forEach((kid) => {
      const kp = knowledgeMap.value.get(kid);
      if (!kp) return;
      if (!knowledgeNodeIds.has(kid)) {
        knowledgeNodeIds.add(kid);
        graphNodes.push({ id: kid, label: kp.name, type: 'knowledge' });
      }
      pushEdge(unitId, kid);
    });
  });

  // 知识点 → 颗粒课：知识点绑定的颗粒课
  const courseNodeIds = new Set<string>();
  knowledgeNodeIds.forEach((kid) => {
    const kp = knowledgeMap.value.get(kid);
    (kp?.granularLessonIds || []).forEach((cid) => {
      const course = courseMap.value.get(cid);
      if (!course) return;
      if (!courseNodeIds.has(cid)) {
        courseNodeIds.add(cid);
        graphNodes.push({ id: cid, label: course.name, type: 'course' });
      }
      pushEdge(kid, cid);
    });
  });

  return { nodes: graphNodes, edges: graphEdges };
});

const graphLayout = computed(() => {
  const layers: { type: GraphNodeType; items: GraphNode[] }[] = TYPE_ORDER.map((type) => ({
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
      return {
        x1: s.x,
        y1: s.y + GRAPH_NODE_H / 2,
        x2: t.x,
        y2: t.y + GRAPH_NODE_H / 2
      };
    })
    .filter((e): e is { x1: number; y1: number; x2: number; y2: number } => e !== null);
  const maxRows = Math.max(...layers.map((l) => l.items.length), 1);
  const height = GRAPH_TOP + maxRows * GRAPH_NODE_GAP + 40;
  const width = GRAPH_LAYER_X[GRAPH_LAYER_X.length - 1] + 220;
  return { layers, edges, height, width };
});

function typeIndexOf(type: GraphNodeType): number {
  return TYPE_ORDER.indexOf(type);
}
function nodeStyle(node: GraphNode) {
  const meta = TYPE_META[node.type];
  return { borderColor: meta.color, color: meta.color, background: meta.bg };
}

const graphNodeDialog = ref<GraphNode | null>(null);
const graphNodeDialogOpen = ref(false);
watch(graphNodeDialog, (v) => {
  graphNodeDialogOpen.value = Boolean(v);
});

// ===== 实践场景（对齐 React SceneList） =====
const sceneExpanded = ref<Record<number, boolean>>({ 0: true });
const sceneTaskMap = computed(() => {
  const map = new Map<string, ScenarioTask[]>();
  scenarioTasks.value.forEach((t) => {
    const list = map.get(t.scenarioId) || [];
    list.push(t);
    map.set(t.scenarioId, list);
  });
  return map;
});
const sceneTotalHours = computed(() =>
  scenarioTasks.value.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
);

function sceneTaskCount(scenarioId: string): number {
  return sceneTaskMap.value.get(scenarioId)?.length || 0;
}
function sceneHours(scenarioId: string): number {
  return (sceneTaskMap.value.get(scenarioId) || []).reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
}
function toggleScene(idx: number) {
  sceneExpanded.value = { ...sceneExpanded.value, [idx]: !sceneExpanded.value[idx] };
}
function expandAllScenes() {
  const all: Record<number, boolean> = {};
  scenes.value.forEach((_, i) => {
    all[i] = true;
  });
  sceneExpanded.value = all;
}
function goScene(scenarioId: string) {
  // 场景落地页详情/学习路由由后续对齐任务补齐，此处保持与 React 一致的跳转目标
  router.push(`/scene/landing/${scenarioId}`);
}

// ===== 本地小组件 =====

// 能力点卡片（对齐 React ability-point-card.tsx；两处弹窗共用）
const AbilityPointCard = defineComponent({
  name: 'AbilityPointCard',
  props: {
    binding: { type: Object as PropType<PositionAbilityBinding>, required: true },
    abilityPoint: { type: Object as PropType<AbilityPoint | undefined>, default: undefined },
    index: { type: Number, default: undefined }
  },
  setup(props) {
    return () => {
      const { binding, abilityPoint, index } = props;
      const attributes = binding.attributes?.length
        ? binding.attributes
        : abilityPoint?.attributes || [];
      const domainColors = DOMAIN_COLORS[binding.domain || '专业工具'] || DOMAIN_COLORS['专业工具'];
      const levelLabel = LEVEL_LABELS[binding.requiredLevel] || binding.requiredLevel;
      const levelColor = LEVEL_COLORS[levelLabel] || '#94a3b8';
      return h('div', { class: 'ap-card' }, [
        h('div', { class: 'ap-card-top' }),
        h('div', { class: 'ap-card-head' }, [
          typeof index === 'number'
            ? h(
                'div',
                {
                  class: 'ap-card-index',
                  style: { background: `linear-gradient(135deg, ${domainColors[0]}, ${domainColors[1]})` }
                },
                String(index + 1)
              )
            : null,
          h('div', { class: 'ap-card-title' }, [
            abilityPoint?.name || binding.abilityName || binding.domain || '未命名能力'
          ])
        ]),
        h('div', { class: 'ap-card-body' }, [
          h('div', { class: 'ap-card-row' }, [
            h('span', { class: 'ap-label' }, '能力领域：'),
            h('span', { class: 'ap-value' }, binding.domain || '专业工具')
          ]),
          h('div', { class: 'ap-card-row' }, [
            h('span', { class: 'ap-label' }, '能力属性：'),
            h('span', { class: 'ap-value' }, attributes.length ? attributes.join('、') : '未配置属性')
          ]),
          h('div', { class: 'ap-card-row' }, [
            h('span', { class: 'ap-label' }, '胜任要求：'),
            h(
              'span',
              {
                class: 'ap-level',
                style: {
                  color: levelColor,
                  background: `rgba(${hexToRgb(levelColor)},0.12)`,
                  borderColor: `rgba(${hexToRgb(levelColor)},0.25)`
                }
              },
              levelLabel
            )
          ]),
          h('div', { class: 'ap-card-row' }, [
            h('span', { class: 'ap-label' }, '胜任要求描述：'),
            h('div', { class: 'ap-rubric' }, binding.rubricDescription || '暂无胜任标准描述')
          ])
        ])
      ]);
    };
  }
});

// 登录提示（对齐 React LoginPrompt）
const LoginPrompt = defineComponent({
  name: 'LoginPrompt',
  props: {
    text: { type: String, required: true },
    desc: { type: String, required: true }
  },
  setup(props) {
    return () =>
      h('div', { class: 'login-prompt' }, [
        h(ElIcon, { size: 48, class: 'login-prompt-icon' }, () => h(Lock)),
        h('p', { class: 'login-prompt-title' }, props.text),
        h('p', { class: 'login-prompt-desc' }, props.desc)
      ]);
  }
});

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '148, 163, 184';
}
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

/* ===== 岗位不存在 ===== */
.jd-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  min-height: 60vh;
}
.jd-empty-icon {
  color: #94a3b8;
  margin-bottom: 16px;
  opacity: 0.5;
}
.jd-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 12px;
}
.jd-empty-link {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
}
.jd-empty-link:hover {
  text-decoration: underline;
}

/* ===== 头部 ===== */
.jd-header {
  background: #fff;
  border-bottom: 1px solid #e7e5e4;
}
.jd-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px;
  box-sizing: border-box;
}
.jd-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 16px;
}
.jd-back:hover {
  color: var(--el-color-primary);
}
.jd-cover-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(69, 26, 3, 0.06);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (min-width: 1024px) {
  .jd-cover-card { flex-direction: row; }
}
.jd-cover {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-4));
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
@media (min-width: 1024px) {
  .jd-cover { width: 280px; }
}
.jd-cover-letter {
  color: rgba(255, 255, 255, 0.5);
  font-size: 48px;
  font-weight: 700;
  user-select: none;
}
.jd-cover-version {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}
.jd-cover-id {
  position: absolute;
  bottom: 12px;
  right: 0;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px 0 0 6px;
  font-size: 12px;
}
.jd-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.jd-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
}
.jd-name {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.jd-salary {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-primary);
  line-height: 1;
}
.jd-alias {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 12px;
}
.jd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.jd-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid;
}
.jd-tag-industry {
  background: #fff7ed;
  border-color: #ffedd5;
  color: #c2410c;
}
.jd-tag-major {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #15803d;
}
.jd-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #64748b;
}
.jd-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.jd-meta-item .el-icon {
  color: #94a3b8;
}
.jd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
  padding-top: 8px;
}
.jd-btn-learn {
  height: 40px;
  padding: 0 24px;
  font-weight: 500;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-1));
  border: none;
}
.jd-btn-learn:hover {
  opacity: 0.9;
}
.jd-btn-fav,
.jd-btn-share {
  height: 40px;
  border-radius: 8px;
}
.jd-btn-fav.active {
  border-color: #f43f5e;
  color: #e11d48;
  background: #fff1f2;
}
.jd-btn-fav.active:hover {
  background: #ffe4e6;
}
.jd-fav-count {
  margin-left: 4px;
  font-size: 12px;
  opacity: 0.8;
}
.jd-btn-fav .el-icon :deep(.filled) {
  color: #e11d48;
}

/* ===== 主区 ===== */
.jd-main {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 24px 48px;
  box-sizing: border-box;
}

/* ===== 统计条 ===== */
.jd-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
@media (min-width: 768px) {
  .jd-stats { grid-template-columns: repeat(5, 1fr); }
}
.jd-stat {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: 16px 12px;
  text-align: center;
  transition: all 0.2s;
}
.jd-stat:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.1);
}
.jd-stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
  margin-bottom: 6px;
}
.jd-stat-label {
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.jd-stat-label .el-icon {
  font-size: 14px;
}

/* ===== Tab 卡片 ===== */
.jd-tabs-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(69, 26, 3, 0.06);
  overflow: hidden;
}
.jd-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.jd-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #f5f5f4;
}
.jd-tabs :deep(.el-tabs__item) {
  padding: 0 16px;
  height: 52px;
  font-size: 14px;
  color: #64748b;
}
.jd-tabs :deep(.el-tabs__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 600;
}
.jd-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.jd-tabs :deep(.el-tabs__content) {
  padding: 20px 24px;
  min-height: 500px;
}
@media (max-width: 768px) {
  .jd-tabs :deep(.el-tabs__content) { padding: 16px; }
}

/* ===== 通用区块 ===== */
.tab-section {
  margin-bottom: 24px;
}
.tab-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px;
}
.tab-section-title .el-icon {
  color: var(--el-color-primary);
}
.tab-section-text {
  font-size: 14px;
  color: #1f2937;
  line-height: 1.8;
  white-space: pre-line;
  margin: 0;
}
.tab-section-box {
  background: #f8fafc;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.8;
  white-space: pre-line;
}
.tab-sub-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px;
}
.tab-sub-title .el-icon {
  color: var(--el-color-primary);
}
.primary-text {
  color: var(--el-color-primary);
  margin: 0 4px;
}
.empty-big {
  text-align: center;
  padding: 56px 0;
  color: #94a3b8;
  font-size: 14px;
}
.empty-mini {
  text-align: center;
  padding: 16px 0;
  color: #94a3b8;
  font-size: 13px;
}
.empty-mini.tall {
  padding: 80px 0;
}
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}
.login-prompt-icon {
  color: #94a3b8;
  opacity: 0.4;
  margin-bottom: 14px;
}
.login-prompt-title {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 6px;
}
.login-prompt-desc {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

/* ===== 职责表 ===== */
.duty-table {
  border-radius: 10px;
  border: 1px solid #f5f5f4;
}
.duty-table :deep(th.el-table__cell) {
  background: #fafafa;
  color: #64748b;
  font-weight: 500;
  font-size: 14px;
}
.duty-table :deep(td.el-table__cell) {
  border-bottom: 1px solid #f5f5f4;
}
.duty-no {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
.duty-name {
  font-size: 14px;
  color: #475569;
}
.duty-detail-btn {
  margin-left: 8px;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 6px;
}
.req-box {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 14px;
  padding: 16px 20px;
}
.req-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.req-item {
  position: relative;
  font-size: 14px;
  color: #64748b;
  line-height: 1.8;
  padding: 10px 0 10px 32px;
  border-bottom: 1px solid #f5f5f4;
}
.req-item:last-child {
  border-bottom: none;
}
.req-num {
  position: absolute;
  left: 0;
  top: 10px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f5f5f4;
  color: #999;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

/* ===== 职责弹窗能力点卡片网格 ===== */
.ap-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .ap-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .ap-grid { grid-template-columns: repeat(3, 1fr); }
}
.ap-card {
  position: relative;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ap-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.ap-card-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-5));
}
.ap-card-head {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.ap-card-index {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.ap-card-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}
.ap-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}
.ap-card-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.ap-label {
  font-weight: 500;
  color: #94a3b8;
  flex-shrink: 0;
}
.ap-value {
  color: #475569;
}
.ap-level {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11px;
}
.ap-rubric {
  color: #64748b;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dots-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}
.dot-page-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.dot-page-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.dot-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}
.dot.active {
  background: var(--el-color-primary);
  width: 20px;
  border-radius: 4px;
}
.dots-tip {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  margin: 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
.dialog-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

/* ===== 证书 ===== */
.cert-count {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 16px;
}
.cert-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .cert-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .cert-grid { grid-template-columns: repeat(3, 1fr); }
}
.cert-card {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.25s;
}
.cert-card:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-color: #d9d9d9;
}
.cert-cover {
  position: relative;
  height: 160px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}
.cert-cover[style*="url"] {
  cursor: pointer;
}
.cert-zoom {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
}
.cert-icon {
  color: rgba(255, 255, 255, 0.4);
}
.cert-body {
  padding: 16px 20px;
}
.cert-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}
.cert-org {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}
.cert-org .el-icon {
  color: #94a3b8;
}
.cert-desc-wrap {
  margin-bottom: 12px;
}
.cert-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.7;
  margin: 0 0 4px;
}
.cert-desc.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cert-toggle {
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 0;
}
.cert-toggle:hover {
  text-decoration: underline;
}
.cert-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 13px;
  text-decoration: none;
  transition: all 0.2s;
}
.cert-link:hover {
  background: var(--el-color-primary);
  color: #fff;
}
.cert-link.disabled {
  background: #f5f5f5;
  color: #bfbfbf;
  cursor: not-allowed;
}
.cert-preview {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
.cert-preview-close {
  position: absolute;
  top: 16px;
  right: 16px;
  color: #fff;
  padding: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  cursor: pointer;
  font-size: 18px;
}
.cert-preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
.cert-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* ===== 能力模型 ===== */
.ability-intro {
  background: linear-gradient(90deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 12px;
}
.ability-intro-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-primary);
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 8px;
}
.ability-intro-text {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.7;
}
.ability-count {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}
.ability-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .ability-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .ability-grid { grid-template-columns: repeat(3, 1fr); }
}
.ability-domain {
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.ability-domain-head {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--el-color-primary-light-9);
  padding: 10px 16px;
  font-weight: 500;
  color: var(--el-color-primary);
  font-size: 14px;
}
.ability-domain-body {
  padding: 10px;
  max-height: 300px;
  overflow-y: auto;
}
.ability-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.ability-item:last-child {
  border-bottom: none;
}
.ability-item:hover {
  background: var(--el-color-primary-light-9);
}
.ability-item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.ability-item-name-text {
  font-size: 14px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attr-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  border: 1px solid;
  flex-shrink: 0;
}
.ability-item-code {
  font-size: 10px;
  color: #94a3b8;
  font-family: monospace;
}

/* ===== 胜任标准 ===== */
.comp-summary {
  font-size: 14px;
  color: #64748b;
}
.comp-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (min-width: 768px) {
  .comp-layout { flex-direction: row; gap: 16px; height: 600px; }
}
.comp-side {
  display: none;
  width: 240px;
  flex-shrink: 0;
  background: #fafafa;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  padding: 8px;
  overflow-y: auto;
}
@media (min-width: 768px) {
  .comp-side { display: block; }
}
.comp-side-btn {
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: none;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.15s;
}
.comp-side-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.comp-side-btn.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}
.comp-mobile-nav {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
}
@media (min-width: 768px) {
  .comp-mobile-nav { display: none; }
}
.comp-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid #e7e5e4;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
}
.comp-chip.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
  border-color: var(--el-color-primary-light-7);
}
.comp-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}
.comp-section {
  margin-bottom: 32px;
  padding-top: 8px;
}
.comp-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f5f5f4;
}
.comp-section-title .el-icon {
  color: var(--el-color-primary);
}
.comp-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px) {
  .comp-items { grid-template-columns: repeat(2, 1fr); }
}
.comp-item {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}
.comp-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.comp-item-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}
.level-track {
  position: relative;
  height: 64px;
  margin: 0 4px 8px;
}
.level-track-bg {
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  height: 8px;
  background: #f5f5f4;
  border-radius: 999px;
  margin: 0 5px;
}
.level-track-fill {
  position: absolute;
  top: 8px;
  left: 0;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #6366f1, #a78bfa);
  margin-left: 5px;
  transition: all 0.3s;
}
.level-dots {
  position: absolute;
  top: 4px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 5px;
}
.level-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  background: #fff;
  transition: all 0.2s;
}
.level-dot.reached {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-7);
}
.level-dot.target {
  border-color: var(--el-color-primary);
  background: #fff;
  box-shadow: 0 0 0 4px var(--el-color-primary-light-9);
  transform: scale(1.1);
}
.level-labels {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 5px;
}
.level-label {
  font-size: 10px;
  font-weight: 500;
  color: #cbd5e1;
}
.level-label.reached {
  color: var(--el-color-primary-light-5);
}
.level-label.target {
  color: var(--el-color-primary);
}
.comp-item-level {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.comp-item-level .el-icon {
  color: var(--el-color-primary);
}
.comp-level-badge {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}
.comp-rubric {
  font-size: 12px;
  color: #64748b;
  line-height: 1.7;
  padding: 10px;
  background: #fafafa;
  border-radius: 6px;
  border-left: 3px solid var(--el-color-primary);
}

/* ===== 知识图谱（静态分层图） ===== */
.kg-head {
  margin-bottom: 16px;
}
.kg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 6px;
}
.kg-title .el-icon {
  color: var(--el-color-primary);
}
.kg-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  margin: 0 0 10px;
}
.kg-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.kg-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #475569;
}
.kg-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.kg-canvas-wrap {
  overflow: auto;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  background: #fafbfc;
  padding: 16px;
}
.kg-canvas {
  position: relative;
  margin: 0 auto;
}
.kg-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.kg-edge {
  stroke: #cbd5e1;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}
.kg-layer {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.kg-node {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 44px;
  border: 2px solid;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  padding: 0 12px;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: all 0.15s;
}
.kg-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateX(-50%) scale(1.04);
}
.graph-node-detail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.graph-node-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 12px;
}
.graph-node-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

/* ===== 实践场景 ===== */
.scene-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
@media (min-width: 768px) {
  .scene-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.scene-summary {
  font-size: 14px;
  color: #64748b;
}
.scene-tools {
  display: flex;
  gap: 8px;
}
.scene-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  cursor: pointer;
}
.scene-tool-btn:hover {
  background: #f8fafc;
}
.scene-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.scene-item {
  background: #fff;
  border: 1px solid #f5f5f4;
  border-radius: 12px;
  overflow: hidden;
}
.scene-item-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s;
}
.scene-item-head:hover {
  background: #f8fafc;
}
.scene-item-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.scene-item-info {
  flex: 1;
  min-width: 0;
}
.scene-item-name {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
}
.scene-item-meta {
  font-size: 12px;
  color: #64748b;
}
.scene-item-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.scene-learn-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: #3b82f6;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.scene-learn-btn:hover {
  background: #2563eb;
}
.scene-chevron {
  color: #94a3b8;
  transition: transform 0.2s;
}
.scene-chevron.open {
  transform: rotate(180deg);
}
.scene-item-body {
  padding: 0 16px 12px;
}
.scene-no-tasks {
  font-size: 12px;
  color: #94a3b8;
  padding: 12px 0;
  border-top: 1px solid #f5f5f4;
}
.scene-task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #f5f5f4;
}
.scene-task-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.scene-task-no {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.scene-task-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}
.scene-task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.task-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}
.scene-task-hours {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}
</style>
