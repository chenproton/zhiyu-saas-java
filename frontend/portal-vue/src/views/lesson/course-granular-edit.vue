<template>
  <div class="granular-edit-page">
    <!-- 顶部操作栏（对应 React EditorShell fullscreen） -->
    <div class="shell-header">
      <div class="shell-header-left">
        <el-button @click="onCancel">
          <el-icon><Close /></el-icon>
          <span>取消</span>
        </el-button>
        <h1 class="shell-title">{{ editId ? '编辑颗粒课' : '新建颗粒课' }}</h1>
      </div>
      <div class="shell-header-right">
        <el-button :loading="saving" @click="handleSave">
          <el-icon><DocumentAdd /></el-icon>
          <span>保存草稿</span>
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleFinish">
          <el-icon><Check /></el-icon>
          <span>完成配置</span>
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="loading-box">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else class="shell-body">
      <main class="main-col">
        <!-- Module 1: 基本信息配置 -->
        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="section-title">
              <el-icon class="section-icon"><Reading /></el-icon>
              <span>基本信息配置</span>
            </div>
          </template>
          <div class="basic-grid">
            <div class="basic-left">
              <el-form label-position="top">
                <el-form-item label="课程名称">
                  <el-input v-model="courseName" placeholder="请输入课程名称" />
                </el-form-item>
                <el-form-item label="所属批次">
                  <el-select v-model="batchModel" placeholder="请选择批次" style="width: 100%">
                    <el-option label="不关联批次" value="__none__" />
                    <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="所属专业">
                  <el-select
                    v-model="majorId"
                    placeholder="请选择适用专业"
                    clearable
                    filterable
                    style="width: 100%"
                    @change="onMajorChange"
                  >
                    <el-option
                      v-for="m in majors"
                      :key="m.id"
                      :label="m.code ? `${m.name}（${m.code}）` : m.name"
                      :value="m.id"
                    />
                  </el-select>
                </el-form-item>
              </el-form>
            </div>

            <div class="basic-right">
              <div class="field-label">课程封面</div>
              <div
                class="cover-box"
                :class="{ 'has-image': !!coverImage }"
                @click="triggerCoverUpload"
              >
                <img v-if="coverImage" :src="coverImage" class="cover-img" alt="课程封面" />
                <template v-else>
                  <el-icon v-if="!coverUploading" class="cover-icon"><Upload /></el-icon>
                  <el-icon v-else class="cover-icon is-loading"><Loading /></el-icon>
                  <p class="cover-text">{{ coverUploading ? '上传中...' : '点击上传课程封面' }}</p>
                </template>
                <div v-if="coverImage" class="cover-hover">
                  <el-button
                    size="small"
                    class="cover-hover-btn"
                    :disabled="coverUploading"
                    @click.stop="triggerCoverUpload"
                  >
                    {{ coverUploading ? '上传中...' : '更换封面' }}
                  </el-button>
                  <el-button
                    size="small"
                    class="cover-hover-btn"
                    :disabled="coverUploading"
                    @click.stop="removeCover"
                  >
                    移除封面
                  </el-button>
                </div>
                <input
                  ref="coverInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden-input"
                  @change="onCoverFileChange"
                />
              </div>
            </div>

            <div class="basic-span2">
              <div class="task-info-grid">
                <div>
                  <div class="field-label">预估学时 <span class="field-hint">课时数</span></div>
                  <el-input-number v-model="hoursNum" :min="0" :controls="false" style="width: 100%" />
                </div>
                <div>
                  <div class="field-label">难度</div>
                  <el-rate v-model="difficulty" :max="5" />
                </div>
              </div>
            </div>

            <div class="basic-span2">
              <div class="field-label">学习目标</div>
              <el-radio-group v-model="goalMode" size="small" class="goal-tabs">
                <el-radio-button value="rich_text">自定义编辑</el-radio-button>
                <el-radio-button value="pdf">上传自定义文件</el-radio-button>
              </el-radio-group>
              <div v-if="goalMode === 'rich_text'">
                <p class="field-hint">可编写详细的学习目标（纯文本）</p>
                <el-input
                  v-model="learningGoal"
                  type="textarea"
                  :rows="10"
                  :placeholder="goalPlaceholder"
                  resize="none"
                />
                <div class="editor-footer">
                  <span>纯文本模式</span>
                  <span>{{ learningGoal.length }} 字符</span>
                </div>
              </div>
              <div v-else>
                <div
                  class="pdf-dropzone"
                  :class="{ 'pdf-dropzone-uploading': pdfUploading }"
                  @click="triggerPdfUpload"
                  @dragover.prevent
                  @drop.prevent="onPdfDrop"
                >
                  <template v-if="!learningGoalPdf">
                    <el-icon v-if="!pdfUploading" class="pdf-upload-icon"><Upload /></el-icon>
                    <el-icon v-else class="pdf-upload-icon is-loading"><Loading /></el-icon>
                    <div>
                      <p class="pdf-drop-text">点击或拖拽上传课程说明书</p>
                      <p class="pdf-drop-tip">支持 PDF 格式，最大 10MB</p>
                    </div>
                  </template>
                  <template v-else>
                    <div class="pdf-file-box">
                      <el-icon class="pdf-file-icon"><Document /></el-icon>
                      <span class="pdf-file-name">{{ pdfFileName }}</span>
                    </div>
                  </template>
                  <input
                    ref="pdfInputRef"
                    type="file"
                    accept="application/pdf"
                    class="hidden-input"
                    @change="onPdfFileChange"
                  />
                </div>
                <div v-if="learningGoalPdf" class="pdf-actions">
                  <el-button size="small" @click="pdfPreviewOpen = true">
                    <el-icon><View /></el-icon>
                    <span>预览</span>
                  </el-button>
                  <el-button size="small" :disabled="pdfUploading" @click="triggerPdfUpload">
                    <el-icon><Refresh /></el-icon>
                    <span>重新上传</span>
                  </el-button>
                  <el-button size="small" @click="learningGoalPdf = null">
                    <el-icon><Delete /></el-icon>
                    <span>移除文件</span>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- Module 2: 关联知识点 -->
        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="section-title">
              <el-icon class="section-icon"><Medal /></el-icon>
              <span>关联知识点</span>
            </div>
          </template>

          <div v-if="knowledgePoints.length" class="tag-list">
            <el-tag
              v-for="kp in knowledgePoints"
              :key="kp.id"
              closable
              :type="kp.linked ? 'info' : 'primary'"
              class="kp-tag"
              @close="removeKp(kp.id)"
            >
              {{ kp.name }}
            </el-tag>
          </div>

          <el-button class="dashed-add" @click="kpDialogOpen = true">
            <el-icon><Plus /></el-icon>
            <span>添加知识点</span>
          </el-button>

          <!-- 知识点选择弹窗 -->
          <el-dialog v-model="kpDialogOpen" title="添加知识点" width="1120px" top="3vh">
            <div class="kp-selector">
              <div class="kp-left">
                <div class="kp-toolbar">
                  <el-input
                    v-model="kpSearch"
                    placeholder="搜索知识点名称、描述或编码..."
                    clearable
                    class="kp-search"
                  >
                    <template #prefix><el-icon><Search /></el-icon></template>
                  </el-input>
                  <el-button type="primary" @click="openAddKp">
                    <el-icon><Plus /></el-icon>
                    <span>新增知识点</span>
                  </el-button>
                </div>
                <div class="kp-filter-row">
                  <span class="filter-label">筛选</span>
                  <el-radio-group v-model="filterMode" size="small" @change="handleFilterModeChange">
                    <el-radio-button value="all">全部</el-radio-button>
                    <el-radio-button value="scene">按场景/任务</el-radio-button>
                    <el-radio-button value="position">按岗位</el-radio-button>
                  </el-radio-group>
                  <span v-if="filterActive && !filterLoading" class="filter-count">
                    筛选出 {{ filtered.length }} 条知识点
                  </span>
                </div>
                <div v-if="!isSearching && filterMode === 'scene'" class="kp-filter-row">
                  <span class="filter-label">场景</span>
                  <el-select
                    v-model="selectedSceneId"
                    size="small"
                    style="width: 170px"
                    @change="handleSceneChange"
                  >
                    <el-option label="全部场景" value="all" />
                    <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
                  </el-select>
                  <template v-if="selectedSceneId !== 'all'">
                    <span class="filter-label">任务</span>
                    <el-select
                      v-model="selectedTaskId"
                      size="small"
                      style="width: 170px"
                      @change="handleTaskChange"
                    >
                      <el-option label="全部任务" value="all" />
                      <el-option v-for="t in sceneTasks" :key="t.id" :label="t.name" :value="t.id" />
                    </el-select>
                  </template>
                </div>
                <div v-if="!isSearching && filterMode === 'position'" class="kp-filter-row">
                  <span class="filter-label">岗位</span>
                  <el-select
                    v-model="selectedPositionId"
                    size="small"
                    style="width: 190px"
                    @change="handlePositionChange"
                  >
                    <el-option label="全部岗位" value="all" />
                    <el-option v-for="p in positions" :key="p.id" :label="p.name" :value="p.id" />
                  </el-select>
                  <span class="filter-hint">聚合该岗位下所有场景任务的知识点</span>
                </div>

                <div class="kp-list-wrap">
                  <el-empty
                    v-if="!isSearching && !filterActive && filtered.length === 0"
                    description="请输入关键词搜索知识点"
                    :image-size="64"
                  />
                  <div v-else-if="!isSearching && filterActive && filterLoading" class="kp-loading">
                    <el-icon class="is-loading"><Loading /></el-icon>
                    <p>筛选加载中...</p>
                  </div>
                  <el-empty
                    v-else-if="!isSearching && filterActive && !filterLoading && filtered.length === 0"
                    description="该筛选条件下暂无知识点"
                    :image-size="64"
                  />
                  <div v-else-if="isSearching && searchLoading" class="kp-loading">
                    <el-icon class="is-loading"><Loading /></el-icon>
                    <p>搜索中...</p>
                  </div>
                  <el-empty
                    v-else-if="isSearching && !searchLoading && !hasResults"
                    :description="`未找到 &quot;${kpSearch}&quot; 相关的知识点`"
                    :image-size="64"
                  >
                    <el-button size="small" @click="openAddKp">
                      <el-icon><Plus /></el-icon>
                      <span>新增此知识点</span>
                    </el-button>
                  </el-empty>
                  <el-table v-else :data="filtered" height="400" size="small" class="kp-table">
                    <el-table-column label="知识点名称" min-width="140">
                      <template #default="{ row }">
                        <span class="kp-name">{{ row.name }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="知识点编码" width="110">
                      <template #default="{ row }">
                        <el-tag v-if="row.code" size="small" type="info" class="kp-code-tag">
                          {{ row.code }}
                        </el-tag>
                        <span v-else class="muted-text">-</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="知识点描述" min-width="160" show-overflow-tooltip>
                      <template #default="{ row }">
                        <span class="kp-desc">{{ row.description || '-' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="180" align="right">
                      <template #default="{ row }">
                        <el-button link size="small" @click="openKpDetail(row.id)">详情</el-button>
                        <template v-if="isKpSelected(row.id)">
                          <el-button size="small" @click="removeKp(row.id)">取消</el-button>
                        </template>
                        <template v-else>
                          <el-button size="small" type="primary" @click="referenceKp(row)">引用</el-button>
                          <el-button size="small" @click="openCloneKp(row)">克隆</el-button>
                        </template>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>

              <div class="kp-right">
                <p class="kp-right-title">已选择知识点 ({{ knowledgePoints.length }})</p>
                <div class="kp-right-list">
                  <el-empty
                    v-if="knowledgePoints.length === 0"
                    description="从左侧搜索并选择知识点"
                    :image-size="56"
                  />
                  <div v-else class="kp-card-grid">
                    <div
                      v-for="kp in knowledgePoints"
                      :key="kp.id"
                      class="kp-card"
                      :class="kp.linked ? 'kp-card-ref' : 'kp-card-custom'"
                      @click="onKpCardClick(kp)"
                    >
                      <div class="kp-card-head">
                        <span class="kp-card-name">{{ kp.name }}</span>
                        <el-icon class="kp-card-remove" @click.stop="removeKp(kp.id)"><Close /></el-icon>
                      </div>
                      <p class="kp-card-desc">{{ kp.description }}</p>
                      <div v-if="kpGlNames(kp).length" class="kp-card-gl">
                        <el-tag
                          v-for="(name, i) in kpGlNames(kp).slice(0, 2)"
                          :key="i"
                          size="small"
                          type="info"
                          class="kp-gl-tag"
                        >
                          {{ name }}
                        </el-tag>
                        <span v-if="kpGlNames(kp).length > 2" class="kp-gl-more">
                          +{{ kpGlNames(kp).length - 2 }}
                        </span>
                      </div>
                      <div v-if="kp.linked" class="kp-ref-badge">引用</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <template #footer>
              <el-button @click="kpDialogOpen = false">关闭</el-button>
            </template>
          </el-dialog>
        </el-card>

        <!-- Module 3: 配置课程资源 -->
        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="section-title">
              <el-icon class="section-icon"><Collection /></el-icon>
              <span>配置课程资源</span>
            </div>
          </template>

          <div v-if="selectedResourceIds.length" class="tag-list">
            <el-tag
              v-for="rid in selectedResourceIds"
              :key="rid"
              closable
              type="primary"
              class="kp-tag"
              @close="removeResource(rid)"
            >
              {{ resourceName(rid) }}
            </el-tag>
          </div>

          <el-button class="dashed-add" @click="resourceDialogOpen = true">
            <el-icon><Plus /></el-icon>
            <span>添加课程资源</span>
          </el-button>

          <!-- 资源选择弹窗 -->
          <el-dialog v-model="resourceDialogOpen" title="添加课程资源" width="1080px" top="3vh" @closed="clearAllPreviews">
            <div class="res-selector">
              <div class="res-toolbar">
                <div class="res-type-buttons">
                  <el-button
                    v-for="t in ALL_TYPE_OPTIONS"
                    :key="t"
                    size="small"
                    :type="resType === t ? 'primary' : ''"
                    class="res-type-btn"
                    @click="resType = t"
                  >
                    {{ RESOURCE_TYPE_SHORT_LABELS[t] || t }}
                  </el-button>
                </div>
                <div class="res-search-row">
                  <el-input
                    v-model="resSearchName"
                    placeholder="搜索资源名称..."
                    clearable
                    class="res-search"
                  >
                    <template #prefix><el-icon><Search /></el-icon></template>
                  </el-input>
                  <el-input
                    v-model="resSearchProvider"
                    placeholder="搜索资源提供者..."
                    clearable
                    class="res-search"
                  >
                    <template #prefix><el-icon><User /></el-icon></template>
                  </el-input>
                  <el-button size="small" @click="resetResFilters">
                    <el-icon><Refresh /></el-icon>
                    <span>重置</span>
                  </el-button>
                  <el-button size="small" type="primary" @click="openUploadTypePicker">
                    <el-icon><Upload /></el-icon>
                    <span>上传资源</span>
                  </el-button>
                </div>
              </div>

              <div class="res-panels">
                <div class="res-left">
                  <div class="res-left-head">
                    <p class="res-left-title">资源列表 ({{ filteredRes.length }})</p>
                  </div>
                  <div class="res-grid-wrap">
                    <el-empty
                      v-if="filteredRes.length === 0"
                      description="未找到匹配的资源"
                      :image-size="80"
                    />
                    <div v-else class="res-grid">
                      <div
                        v-for="r in filteredRes"
                        :key="r.id"
                        class="res-card"
                        :class="{ 'res-card-selected': selectedResourceIds.includes(r.id) }"
                        @click="toggleResource(r.id)"
                      >
                        <div class="res-card-thumb">
                          <img
                            v-if="r.thumbnail && r.type === 'image'"
                            :src="r.thumbnail"
                            :alt="r.name"
                            class="res-thumb-img"
                          />
                          <div v-else class="res-thumb-icon" :style="{ background: TYPE_BG_MAP[r.type] }">
                            <el-icon :style="{ color: TYPE_COLOR_MAP[r.type] }">
                              <component :is="typeIcon(r.type)" />
                            </el-icon>
                          </div>
                          <div v-if="selectedResourceIds.includes(r.id)" class="res-selected-mark">
                            <el-icon><Check /></el-icon>
                          </div>
                          <el-tag
                            size="small"
                            class="res-type-tag"
                            :style="{ color: TYPE_COLOR_MAP[r.type], borderColor: TYPE_COLOR_MAP[r.type] }"
                            effect="plain"
                          >
                            {{ RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type }}
                          </el-tag>
                        </div>
                        <div class="res-card-body">
                          <p class="res-card-name" :title="r.name">{{ r.name }}</p>
                          <p class="res-card-provider">{{ r.uploadedBy || '-' }}</p>
                        </div>
                        <div class="res-card-actions">
                          <el-button
                            link
                            size="small"
                            class="res-action-btn"
                            @click.stop="r.url && openPreview(r)"
                          >
                            <el-icon><View /></el-icon>
                            <span>预览</span>
                          </el-button>
                          <el-button
                            size="small"
                            :type="selectedResourceIds.includes(r.id) ? '' : 'primary'"
                            class="res-action-btn"
                            @click.stop="toggleResource(r.id)"
                          >
                            {{ selectedResourceIds.includes(r.id) ? '已选择' : '选择' }}
                          </el-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="res-right">
                  <div class="res-right-head">
                    <p class="res-right-title">已选资源</p>
                    <el-tag size="small">{{ selectedResourceIds.length }}</el-tag>
                  </div>
                  <div class="res-right-list">
                    <el-empty
                      v-if="selectedResourceIds.length === 0"
                      description="请从左侧选择资源"
                      :image-size="56"
                    />
                    <template v-else>
                      <div
                        v-for="rid in selectedResourceIds"
                        :key="rid"
                        class="res-selected-item"
                      >
                      <div
                        class="res-selected-icon"
                        :style="{ background: TYPE_BG_MAP[selectedResource(rid)?.type || 'other'] }"
                      >
                        <el-icon :style="{ color: TYPE_COLOR_MAP[selectedResource(rid)?.type || 'other'] }">
                          <component :is="typeIcon(selectedResource(rid)?.type)" />
                        </el-icon>
                      </div>
                      <div class="res-selected-info">
                        <p class="res-selected-name" :title="selectedResource(rid)?.name">
                          {{ selectedResource(rid)?.name }}
                        </p>
                        <p class="res-selected-provider">{{ selectedResource(rid)?.uploadedBy || '-' }}</p>
                      </div>
                      <el-icon class="res-selected-remove" @click="removeResource(rid)"><Close /></el-icon>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <template #footer>
              <el-button type="primary" @click="resourceDialogOpen = false">确认</el-button>
            </template>
          </el-dialog>
        </el-card>

        <div class="bottom-space" />
      </main>

      <aside class="check-panel">
        <div class="check-box">
          <div class="check-head">
            <h3 class="check-title">
              <el-icon class="check-icon"><CircleCheck /></el-icon>
              发布检查
            </h3>
            <span class="check-total">共 {{ checkTotal }} 项</span>
          </div>
          <div class="check-items">
            <div
              v-for="item in checkResults"
              :key="item.key"
              class="check-item"
              :class="{ 'check-item-warn': !item.passed }"
            >
              <span class="check-dot" :class="item.passed ? 'check-dot-ok' : 'check-dot-warn'">
                <el-icon v-if="item.passed"><CircleCheckFilled /></el-icon>
                <el-icon v-else><WarningFilled /></el-icon>
              </span>
              <div class="check-item-body">
                <p class="check-item-label">{{ item.label }}</p>
                <p class="check-item-status" :class="item.passed ? 'status-ok' : 'status-warn'">
                  {{ item.statusText }}
                </p>
              </div>
            </div>
          </div>
          <div class="check-progress">
            <div class="check-progress-head">
              <span class="check-progress-dot" :class="checkAllDone ? 'dot-ok' : 'dot-warn'" />
              <span class="check-progress-text">{{ checkCompleted }}/{{ checkTotal }} 项已完成</span>
            </div>
            <el-progress
              :percentage="checkPercent"
              :show-text="false"
              :stroke-width="6"
              :color="checkAllDone ? '#67c23a' : '#e6a23c'"
            />
            <p class="check-progress-hint">
              {{
                checkAllDone
                  ? '💡 所有检查项已完成，可以发布课程'
                  : `💡 建议完善${checkEmptyFields.join('、')}，提升课程规划准确性`
              }}
            </p>
          </div>
        </div>
      </aside>
    </div>

    <!-- ==================== 知识点子弹窗 ==================== -->

    <!-- 新增/克隆/编辑知识点 -->
    <el-dialog v-model="kpActionOpen" :title="kpActionTitle" width="520px">
      <el-form label-position="top">
        <el-form-item label="知识点名称">
          <el-input v-model="newKpForm.name" placeholder="输入知识点名称" @input="kpNameError = ''" />
          <p v-if="kpNameError" class="form-error">{{ kpNameError }}</p>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="newKpForm.description"
            type="textarea"
            :rows="3"
            placeholder="输入知识点描述"
          />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="newKpForm.code" :disabled="kpActionMode !== 'edit'" />
          <p class="field-hint">
            {{ kpActionMode === 'edit' ? '可修改编码' : '系统自动生成，不可修改' }}
          </p>
        </el-form-item>
        <el-form-item label="关联颗粒课">
          <div v-if="newKpForm.granularLessons.length" class="gl-badge-list">
            <el-tag
              v-for="gid in newKpForm.granularLessons"
              :key="gid"
              closable
              size="small"
              @close="removeGlFromNewKp(gid)"
            >
              {{ glName(gid) }}
            </el-tag>
          </div>
          <el-button size="small" class="gl-pick-btn" @click="openGlSelectForNewKp">
            <el-icon><Plus /></el-icon>
            <span>选择颗粒课</span>
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="kpActionOpen = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!newKpForm.name.trim() || !!kpNameError"
          @click="handleSaveKp"
        >
          {{ kpActionConfirmText }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 选择颗粒课 -->
    <el-dialog v-model="glSelectOpen" :title="glSelectTitle" width="820px" top="8vh">
      <div class="gl-selector">
        <div class="gl-left">
          <el-input v-model="glSearch" placeholder="搜索颗粒课名称或编码..." clearable class="gl-search">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div class="gl-list">
            <div
              v-for="gl in glFiltered"
              :key="gl.id"
              class="gl-item"
              :class="{ 'gl-item-selected': glSelectedIds.includes(gl.id) }"
              @click="toggleGlFor(gl.id)"
            >
              <div class="gl-check" :class="{ 'gl-check-on': glSelectedIds.includes(gl.id) }">
                <el-icon v-if="glSelectedIds.includes(gl.id)"><Check /></el-icon>
              </div>
              <div class="gl-item-body">
                <div class="gl-item-head">
                  <span class="gl-item-name">{{ gl.name }}</span>
                  <el-tag v-if="gl.code" size="small" type="info">{{ gl.code }}</el-tag>
                </div>
                <p class="gl-item-desc">{{ gl.description }}</p>
              </div>
            </div>
            <el-empty v-if="glFiltered.length === 0" description="未找到匹配的颗粒课" :image-size="64" />
          </div>
        </div>
        <div class="gl-right">
          <p class="gl-right-title">已选择 ({{ glSelectedIds.length }})</p>
          <div class="gl-right-list">
            <el-empty
              v-if="glSelectedIds.length === 0"
              description="从左侧选择颗粒课"
              :image-size="56"
            />
            <template v-else>
              <div v-for="gid in glSelectedIds" :key="gid" class="gl-selected-item">
                <span class="gl-selected-name" :title="glName(gid)">{{ glName(gid) }}</span>
                <el-icon class="gl-selected-remove" @click="toggleGlFor(gid)"><Close /></el-icon>
              </div>
            </template>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="glSelectOpen = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 知识点详情 -->
    <el-dialog v-model="kpDetailOpen" title="知识点详情" width="480px">
      <template v-if="detailKp">
        <div class="kp-detail-head">
          <span class="field-label">知识点名称</span>
          <el-tag v-if="detailKp.linked" size="small" type="info">引用（不可编辑）</el-tag>
          <el-tag v-else size="small" type="primary" effect="plain">自定义（可编辑）</el-tag>
        </div>
        <p class="kp-detail-name">{{ detailKp.name }}</p>
        <div>
          <span class="field-label">知识点描述</span>
          <p class="kp-detail-text">{{ detailKp.description || '-' }}</p>
        </div>
        <div v-if="detailKp.code">
          <span class="field-label">编码</span>
          <p class="kp-detail-text">{{ detailKp.code }}</p>
        </div>
        <div>
          <div class="kp-detail-gl-head">
            <span class="field-label">关联颗粒课</span>
            <el-button
              v-if="!detailKp.linked"
              link
              size="small"
              type="primary"
              @click="openGlSelectFromDetail(detailKp.id)"
            >
              引用颗粒课
            </el-button>
          </div>
          <div v-if="detailGranularLessons.length" class="gl-badge-list">
            <el-tag v-for="gl in detailGranularLessons" :key="gl.id" size="small" type="info">
              {{ gl.name }}
            </el-tag>
          </div>
          <p v-else class="kp-detail-text">暂无关联颗粒课</p>
        </div>
      </template>
      <template #footer>
        <el-button @click="kpDetailOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 资源子弹窗 ==================== -->

    <!-- 上传类型选择 -->
    <el-dialog v-model="uploadTypePickerOpen" title="选择资源类型" width="560px">
      <p class="field-hint" style="margin-bottom: 12px">请选择要上传的资源类型</p>
      <div class="upload-type-grid">
        <div
          v-for="t in RESOURCE_TYPE_KEYS"
          :key="t"
          class="upload-type-item"
          @click="pickUploadType(t)"
        >
          <div class="upload-type-icon" :style="{ background: TYPE_BG_MAP[t] }">
            <el-icon :style="{ color: TYPE_COLOR_MAP[t] }"><component :is="typeIcon(t)" /></el-icon>
          </div>
          <span class="upload-type-name">{{ RESOURCE_TYPE_SHORT_LABELS[t] || t }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 上传资源 -->
    <el-dialog v-model="uploadOpen" title="上传资源" width="520px">
      <el-form label-position="top">
        <el-form-item label="资源名称">
          <el-input v-model="newResName" placeholder="输入资源名称" />
        </el-form-item>

        <el-form-item v-if="newResType === 'link'" label="URL 地址">
          <el-input v-model="newResUrl" placeholder="https://..." />
        </el-form-item>

        <template v-if="newResType === 'venue'">
          <el-form-item label="场地地址">
            <el-input v-model="newResAddress" placeholder="输入场地详细地址" />
          </el-form-item>
          <el-form-item label="开放时间">
            <el-input v-model="newResOpenTime" placeholder="例如：周一至周五 09:00-18:00" />
          </el-form-item>
          <div class="form-two-col">
            <el-form-item label="容纳人数">
              <el-input v-model="newResCapacity" placeholder="例如：50人" />
            </el-form-item>
            <el-form-item label="联系人/电话">
              <el-input v-model="newResContact" placeholder="输入联系人或电话" />
            </el-form-item>
          </div>
        </template>

        <template v-if="newResType === 'facility'">
          <el-form-item label="所在位置">
            <el-input v-model="newResLocation" placeholder="输入设施所在位置" />
          </el-form-item>
          <div class="form-two-col">
            <el-form-item label="数量">
              <el-input v-model="newResQuantity" placeholder="输入设施数量" />
            </el-form-item>
            <el-form-item label="联系人/电话">
              <el-input v-model="newResContact" placeholder="输入联系人或电话" />
            </el-form-item>
          </div>
        </template>

        <template v-if="newResType === 'software'">
          <el-form-item label="版本号">
            <el-input v-model="newResVersion" placeholder="例如：v2.1.0" />
          </el-form-item>
          <el-form-item label="下载链接">
            <el-input v-model="newResUrl" placeholder="https://..." />
          </el-form-item>
          <el-form-item label="授权信息">
            <el-input v-model="newResLicense" placeholder="例如：MIT / 商业授权 / 校内授权" />
          </el-form-item>
        </template>

        <el-form-item label="资源描述">
          <el-input
            v-model="newResDescription"
            type="textarea"
            :rows="2"
            placeholder="输入资源简介、用途说明等"
          />
        </el-form-item>

        <el-form-item v-if="FILE_UPLOAD_TYPES.includes(newResType)" label="上传文件">
          <el-upload
            ref="resourceUploadRef"
            drag
            :auto-upload="false"
            :show-file-list="false"
            :on-change="onResourceFileChange"
            :accept="resourceTypeAccept[newResType]"
            class="res-uploader"
          >
            <template v-if="!newResFile">
              <el-icon v-if="!newResUploading" class="pdf-upload-icon"><Upload /></el-icon>
              <el-icon v-else class="pdf-upload-icon is-loading"><Loading /></el-icon>
              <div class="el-upload__text">点击或拖拽上传文件</div>
              <div class="el-upload__tip">
                {{
                  resourceTypeAccept[newResType]
                    ? `支持 ${resourceTypeAccept[newResType]}，最大 10MB`
                    : '支持多种格式，最大 10MB'
                }}
              </div>
            </template>
            <template v-else>
              <div class="pdf-file-box">
                <el-icon class="pdf-file-icon"><Document /></el-icon>
                <div>
                  <p class="pdf-file-name">{{ newResFile.name }}</p>
                  <p class="res-file-size">{{ formatSize(newResFile.size) }}</p>
                </div>
              </div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeUploadDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="newResUploading"
          :disabled="uploadConfirmDisabled"
          @click="handleUpload"
        >
          上传并选中
        </el-button>
      </template>
    </el-dialog>

    <!-- 资源预览 -->
    <el-dialog v-model="previewOpen" :title="previewResource?.name || '资源预览'" width="960px" top="6vh">
      <div class="preview-frame">
        <template v-if="previewLoading">
          <div class="preview-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中…</span>
          </div>
        </template>
        <template v-else-if="previewResource?.url">
          <iframe
            v-if="previewIframeSrc"
            :src="previewIframeSrc"
            :title="previewResource.name"
            class="preview-iframe"
            allowfullscreen
          />
          <img
            v-else-if="previewKind === 'image'"
            :src="previewSrc || previewResource.url"
            :alt="previewResource.name"
            class="preview-media"
          />
          <video
            v-else-if="previewKind === 'video'"
            :src="previewSrc || previewResource.url"
            controls
            class="preview-media"
          />
          <audio
            v-else-if="previewKind === 'audio'"
            :src="previewSrc || previewResource.url"
            controls
            class="preview-audio"
          />
          <iframe
            v-else-if="previewKind === 'text' || previewKind === 'pdf'"
            :src="previewSrc || previewResource.url"
            :title="previewResource.name"
            class="preview-iframe"
          />
          <div v-else-if="isSafeLinkUrl(previewResource.url)" class="preview-hint">
            <span>该链接无法内嵌预览，请点击右上角「新窗口打开」</span>
          </div>
          <div v-else class="preview-loading">
            <span>加载中…</span>
          </div>
        </template>
        <div v-else class="preview-loading">
          <span>暂无预览内容</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="previewOpen = false">关闭</el-button>
        <el-button v-if="isSafeLinkUrl(previewResource?.url)" @click="openExternal(previewResource!.url!)">
          <el-icon><Link /></el-icon>
          <span>新窗口打开</span>
        </el-button>
      </template>
    </el-dialog>

    <!-- PDF 预览 -->
    <el-dialog v-model="pdfPreviewOpen" :title="pdfFileName || '文件预览'" width="900px" top="6vh">
      <iframe v-if="learningGoalPdf" :src="learningGoalPdf" class="preview-iframe" />
      <div v-else class="preview-loading">暂无文件</div>
      <template #footer>
        <el-button @click="pdfPreviewOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { UploadFile } from 'element-plus';
import {
  Box,
  Check,
  CircleCheck,
  CircleCheckFilled,
  Close,
  Collection,
  DataAnalysis,
  Delete,
  Document,
  DocumentAdd,
  Headset,
  Link as LinkIcon,
  Loading,
  Medal,
  Monitor,
  OfficeBuilding,
  Picture,
  Plus,
  QuestionFilled,
  Reading,
  Refresh,
  Search,
  Tools,
  Upload,
  User,
  VideoCamera,
  View,
  WarningFilled
} from '@element-plus/icons-vue';
import { courseApi, knowledgeApi, lessonBatchApi } from '@/api/lesson';
import { resourceLibraryApi } from '@/api/library';
import { majorApi } from '@/api/system';
import { positionApi } from '@/api/job';
import { scenarioApi, taskApi } from '@/api/scene';
import { fileApi } from '@/api/import-export';
import { buildQuery, request } from '@/api/http';
import { formatSize, isSafeLinkUrl } from '@/utils/format';
import type { Course, KnowledgePoint } from '@/types/lesson';
import { RESOURCE_TYPE_SHORT_LABELS } from '@/types/library';
import type { ResourceKind } from '@/types/library';
import type { Major } from '@/types/system';

/* ==================== 类型 ==================== */

interface KpItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  linked: boolean;
  granularLessons?: string[];
}

interface ResourceItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  description?: string;
  size?: string | number;
  uploadedBy?: string;
  uploadedAt?: string;
  thumbnail?: string;
}

interface ScenarioLite {
  id: string;
  name: string;
  careerPositionId?: string;
}

interface TaskLite {
  id: string;
  name: string;
  knowledgePointIds?: string[];
}

interface PositionLite {
  id: string;
  name: string;
}

interface BatchLite {
  id: string;
  name: string;
}

interface CheckNode {
  id: string;
  courseId: string;
  parentId: string | null;
  name: string;
  order: number;
  type: string;
  status: string;
  teachingGoals?: string;
  descriptionPdf?: string;
  detailedDescription?: string;
  duration: number;
  knowledgePoints: { id: string; name: string; linked: boolean }[];
  resources: { id: string; name: string; type: string; size: number; url?: string }[];
  quizzes: unknown[];
  evalData: Record<string, unknown>;
}

/* ==================== 常量（资源类型 / 扩展名，对齐 React lib/resource-type-constants） ==================== */

const RESOURCE_TYPE_KEYS: ResourceKind[] = [
  'document',
  'spreadsheet',
  'image',
  'link',
  'audio',
  'video',
  'archive',
  'venue',
  'facility',
  'software',
  'other'
];

const ALL_TYPE_OPTIONS = ['all', ...RESOURCE_TYPE_KEYS];

const TYPE_ICON_MAP: Record<string, Component> = {
  document: Document,
  spreadsheet: DataAnalysis,
  image: Picture,
  link: LinkIcon,
  audio: Headset,
  video: VideoCamera,
  archive: Box,
  venue: OfficeBuilding,
  facility: Tools,
  software: Monitor,
  other: QuestionFilled
};

const TYPE_COLOR_MAP: Record<string, string> = {
  document: '#f97316',
  spreadsheet: '#22c55e',
  image: '#a855f7',
  link: '#06b6d4',
  audio: '#ec4899',
  video: '#3b82f6',
  archive: '#64748b',
  venue: '#ef4444',
  facility: '#6366f1',
  software: '#14b8a6',
  other: '#78716c'
};

const TYPE_BG_MAP: Record<string, string> = {
  document: '#fff7ed',
  spreadsheet: '#ecfdf5',
  image: '#faf5ff',
  link: '#ecfeff',
  audio: '#fdf2f8',
  video: '#eff6ff',
  archive: '#f8fafc',
  venue: '#fef2f2',
  facility: '#eef2ff',
  software: '#f0fdfa',
  other: '#fafaf9'
};

const DOCUMENT_EXTS = [
  'pdf', 'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'wps', 'wpt', 'rtf', 'odt', 'ott',
  'fodt', 'pages', 'ppt', 'pptx', 'dps', 'odp', 'otp', 'sxi', 'vsd', 'vsdx', 'txt', 'md',
  'log', 'json', 'properties', 'yaml', 'yml', 'gitignore', 'xml', 'xbrl', 'html', 'htm',
  'java', 'py', 'c', 'cpp', 'h', 'php', 'go', 'js', 'css', 'lua', 'sh', 'rb', 'sql', 'bat',
  'm', 'bas', 'prg', 'cmd', 'cs', 'ftl', 'asp', 'jsp', 'aspx', 'ofd', 'epub', 'eml',
  'xmind', 'drawio', 'bpmn', 'dcm', 'dwg', 'dxf', 'dwf', 'dwfx', 'dwt', 'dng', 'cf2',
  'plt', 'stl', 'obj', '3ds', 'ply', 'off', '3dm', 'fbx', 'dae', 'wrl', '3mf', 'glb',
  'gltf', 'o3dv', 'stp', 'step', 'iges', 'igs', 'brep', 'bim', 'fcstd', 'ifc'
];

const SPREADSHEET_EXTS = [
  'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'xlam', 'xla', 'et', 'ett', 'ods', 'ots',
  'csv', 'tsv'
];

const IMAGE_EXTS = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'jfif', 'svg', 'tif', 'tiff', 'tga',
  'psd', 'eps', 'wmf', 'emf'
];

const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'];

const VIDEO_EXTS = [
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'mpeg', '3gp', 'rm', 'mpd', 'm3u8', 'ts'
];

const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'jar', 'gzip'];

const SOFTWARE_EXTS = ['exe', 'dmg', 'pkg', 'deb', 'rpm', 'zip', 'msi', 'apk'];

const resourceTypeExtensionMap: Record<string, string[]> = {
  document: DOCUMENT_EXTS,
  spreadsheet: SPREADSHEET_EXTS,
  image: IMAGE_EXTS,
  audio: AUDIO_EXTS,
  video: VIDEO_EXTS,
  archive: ARCHIVE_EXTS,
  software: SOFTWARE_EXTS
};

const resourceTypeAccept: Record<string, string> = {
  document: DOCUMENT_EXTS.map((e) => `.${e}`).join(','),
  spreadsheet: SPREADSHEET_EXTS.map((e) => `.${e}`).join(','),
  image: IMAGE_EXTS.map((e) => `.${e}`).join(','),
  audio: AUDIO_EXTS.map((e) => `.${e}`).join(','),
  video: VIDEO_EXTS.map((e) => `.${e}`).join(','),
  archive: ARCHIVE_EXTS.map((e) => `.${e}`).join(','),
  software: SOFTWARE_EXTS.map((e) => `.${e}`).join(',')
};

const FILE_UPLOAD_TYPES = [
  'document',
  'spreadsheet',
  'image',
  'audio',
  'video',
  'archive',
  'other',
  'software'
];

const RESOURCE_MAX_FILE_SIZE = 10 * 1024 * 1024;

// 浏览器可原生渲染的格式（对齐 React file-viewer 优先路径的简化等价实现）
const NATIVE_IMAGE_EXTS = new Set([...IMAGE_EXTS, 'avif']);
const NATIVE_VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v']);
const NATIVE_AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']);
const NATIVE_TEXT_EXTS = new Set([
  'pdf', 'txt', 'md', 'log', 'json', 'yaml', 'yml', 'xml', 'html', 'htm', 'csv', 'tsv',
  'java', 'py', 'c', 'cpp', 'h', 'php', 'go', 'js', 'css', 'lua', 'sh', 'rb', 'sql', 'bat',
  'm', 'cs', 'properties', 'gitignore'
]);

/* ==================== 页面状态（对齐 React AddGranularPageInner） ==================== */

const route = useRoute();
const router = useRouter();
const editId = (route.query.id as string) || undefined;
const isNewCourse = route.query.new === 'true';

let hasSaved = false;
const loading = ref(false);
const saving = ref(false);
const course = ref<Course | null>(null);

// module 1: basic info
const courseName = ref('');
const hours = ref('');
const learningGoal = ref('');
const learningGoalPdf = ref<string | null>(null);
const majorName = ref('');
const majorId = ref('');
const difficulty = ref(0);
const coverImage = ref('');
const coverUploading = ref(false);
const batchId = ref('');

// module 2: knowledge points
const knowledgePool = ref<KpItem[]>([]);
const knowledgePoints = ref<KpItem[]>([]);
const customKnowledgePointIds = ref<Set<string>>(new Set());

// module 3: resources
const selectedResourceIds = ref<string[]>([]);
const courseResourcePool = ref<ResourceItem[]>([]);

// 预览资源（对齐 usePreviewResources）
const previewResources = ref<ResourceItem[]>([]);
function addPreviewResource(r: ResourceItem) {
  if (previewResources.value.some((x) => x.id === r.id)) return;
  const next = [...previewResources.value, r];
  if (next.length > 5) next.shift();
  previewResources.value = next;
}
function removePreviewResource(id: string) {
  previewResources.value = previewResources.value.filter((r) => r.id !== id);
}
function clearAllPreviews() {
  previewResources.value = [];
}

// 批次 / 专业下拉
const batches = ref<BatchLite[]>([]);
const majors = ref<Major[]>([]);

const hoursNum = computed<number | undefined>({
  get: () => parseInt(hours.value) || 0,
  set: (v: number | undefined) => {
    hours.value = String(v || 0);
  }
});

const batchModel = computed<string>({
  get: () => batchId.value || '__none__',
  set: (v: string) => {
    batchId.value = v === '__none__' ? '' : v;
  }
});

/* ==================== 分页拉全量（对齐 React fetchAllPages，后端 limit 钳制 200） ==================== */

const PAGE = 200;
async function fetchAllPages<T>(
  fn: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const res = await fn(offset / PAGE, PAGE);
    items.push(...res.items);
    if (res.items.length < PAGE || items.length >= res.total) break;
    offset += PAGE;
  }
  return items;
}

/* ==================== 加载（对齐 React load effect） ==================== */

// Vue api 缺 courseResourceApi：直接 request 同一后端端点（路径照抄 React api-client）
function courseResourceList(params: { courseId: string; limit: number; offset: number }) {
  return request<{ items: ResourceItem[]; total: number }>(
    `/lesson/course-resources${buildQuery(params)}`
  );
}

function courseResourceCreate(req: {
  courseId: string;
  name: string;
  type: string;
  url: string;
  description?: string;
  size?: number;
}) {
  return request<ResourceItem>('/lesson/course-resources/create', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

async function load() {
  loading.value = true;
  try {
    const [kpItems, libItemsAll] = await Promise.all([
      fetchAllPages((p, s) => knowledgeApi.list({ limit: s, offset: p * s })),
      fetchAllPages((p, s) => resourceLibraryApi.list({ limit: s, offset: p * s }))
    ]);
    const customIds = new Set<string>();
    kpItems.forEach((k) => {
      const kp = k as KnowledgePoint & { sourceType?: string; sourceId?: string };
      if (kp.sourceType === 'course' && kp.sourceId === editId) customIds.add(k.id);
    });
    customKnowledgePointIds.value = customIds;
    const pool: KpItem[] = kpItems.map((k) => ({
      id: k.id,
      name: k.name,
      code: k.code,
      description: k.description,
      linked: !customIds.has(k.id),
      granularLessons: (k as KnowledgePoint & { granularLessonIds?: string[] }).granularLessonIds || []
    }));
    knowledgePool.value = pool;

    const libItems: ResourceItem[] = libItemsAll.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.resourceType,
      url: r.url,
      description: r.description,
      size: r.fileSize
    }));
    // 课程已绑定的资源（含本地上传后已入库的）并入资源池，保证刷新后选中项可解析
    const boundItems: ResourceItem[] = editId
      ? (
          await fetchAllPages((p, s) =>
            courseResourceList({ courseId: editId, limit: s, offset: p * s })
          )
        ).map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          url: r.url,
          description: r.description,
          size: r.size
        }))
      : [];
    const mergedPool: ResourceItem[] = [...libItems, ...boundItems].filter(
      (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
    );
    courseResourcePool.value = mergedPool;

    if (editId) {
      const c = await courseApi.get(editId);
      course.value = c;
      courseName.value = c.name;
      hours.value = String(c.onlineHours ?? c.offlineHours ?? '');
      learningGoal.value = c.description || '';
      learningGoalPdf.value = (c.evalData as { descriptionPdf?: string } | undefined)?.descriptionPdf || null;
      majorName.value = c.majorName || '';
      majorId.value = c.majorId || '';
      difficulty.value = c.difficulty || 0;
      coverImage.value = c.coverImage || '';
      if (c.batchId) batchId.value = c.batchId;

      const kpNameById = new Map<string, string>();
      (c.knowledgePointNames || []).forEach((name, i) => {
        const id = (c.knowledgePointIds || [])[i];
        if (id && name) kpNameById.set(id, name);
      });
      const selected: KpItem[] = (c.knowledgePointIds || [])
        .filter((id): id is string => !!id)
        .map((id) => {
          const fromPool = pool.find((k) => k.id === id);
          if (fromPool) return fromPool;
          return { id, name: kpNameById.get(id) || id, linked: true };
        });
      knowledgePoints.value = selected;

      const resIds = new Set((c.resourceIds || []).filter((id): id is string => !!id));
      selectedResourceIds.value = Array.from(resIds).filter((id) =>
        mergedPool.some((r) => r.id === id)
      );
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadBatches() {
  try {
    const res = await lessonBatchApi.list({ limit: 1000 });
    batches.value = res.items || [];
  } catch (err: any) {
    ElMessage.error(err.message || '加载批次列表失败');
  }
}

async function loadMajors() {
  try {
    const items = await fetchAllPages((p, s) => majorApi.list({ limit: s, offset: p * s }));
    majors.value = items.filter((m) => m.enabled);
  } catch (err: any) {
    ElMessage.error(err.message || '加载专业列表失败');
  }
}

function onMajorChange(v: string | number | boolean | undefined) {
  const id = typeof v === 'string' ? v : '';
  majorId.value = id;
  majorName.value = majors.value.find((m) => m.id === id)?.name || '';
}

onMounted(() => {
  void load();
  void loadBatches();
  void loadMajors();
  void loadGranularCourses();
  void loadPositions();
  void loadScenarios();
});

/* ==================== 保存（对齐 React handleSave） ==================== */

// 本地上传资源（res- 临时 ID）入库并绑定课程，返回临时 ID → 真实 ID 映射
async function persistLocalResources(courseId: string): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {};
  for (const rid of selectedResourceIds.value) {
    if (!rid.startsWith('res-')) continue;
    const r = courseResourcePool.value.find((x) => x.id === rid);
    if (!r) continue;
    try {
      const created = await courseResourceCreate({
        courseId,
        name: r.name,
        type: r.type,
        url: r.url || '',
        description: r.description,
        size: r.size != null ? Number(r.size) : undefined
      });
      idMap[rid] = created.id;
      courseResourcePool.value = [
        ...courseResourcePool.value.filter((x) => x.id !== rid),
        { ...r, id: created.id }
      ];
    } catch (err: any) {
      ElMessage.error(`资源「${r.name}」保存失败: ${err.message}`);
      throw err;
    }
  }
  return idMap;
}

async function handleSave() {
  if (!courseName.value) {
    ElMessage.error('请输入课程名称');
    return;
  }
  saving.value = true;
  try {
    const kpIdMapping: Record<string, string> = {};
    for (const kp of knowledgePoints.value) {
      const isNew = kp.id.startsWith('kp-custom-');
      const isCustom = isNew || customKnowledgePointIds.value.has(kp.id);
      if (!isCustom) continue;
      try {
        const granularLessonIds = kp.granularLessons || [];
        if (isNew) {
          const created = await knowledgeApi.create({
            name: kp.name,
            code: kp.code,
            description: kp.description,
            linked: false,
            granularLessonIds,
            sourceType: 'course',
            sourceId: editId
          } as unknown as Parameters<typeof knowledgeApi.create>[0]);
          kpIdMapping[kp.id] = created.id;
          customKnowledgePointIds.value = new Set(customKnowledgePointIds.value).add(created.id);
        } else {
          await knowledgeApi.update(kp.id, {
            name: kp.name,
            code: kp.code,
            description: kp.description,
            linked: false,
            granularLessonIds
          } as unknown as Parameters<typeof knowledgeApi.update>[1]);
        }
      } catch (err: any) {
        ElMessage.error(`知识点「${kp.name}」保存失败: ${err.message}`);
        saving.value = false;
        return;
      }
    }
    const description = learningGoal.value || undefined;
    const knowledgePointIds = knowledgePoints.value
      .map((kp) => kpIdMapping[kp.id] || kp.id)
      .filter((id) => !id.startsWith('kp-custom-'));
    const tempResourceIds = selectedResourceIds.value.filter((id) => id.startsWith('res-'));
    const savedResourceIds = selectedResourceIds.value.filter((id) => !id.startsWith('res-'));
    const persistNewResources = async (courseId: string) => {
      if (tempResourceIds.length === 0) return savedResourceIds;
      const idMap = await persistLocalResources(courseId);
      const realIds = [...savedResourceIds, ...Object.values(idMap)];
      selectedResourceIds.value = realIds;
      return realIds;
    };
    const payload: Record<string, unknown> = {
      name: courseName.value,
      type: 'granular',
      category: course.value?.category || '专业基础',
      majorId: majorId.value || course.value?.majorId || undefined,
      majorName: majorName.value || course.value?.majorName || undefined,
      onlineHours: parseInt(hours.value) || 0,
      offlineHours: 0,
      coverImage: coverImage.value || undefined,
      batchId: batchId.value || undefined,
      status: course.value?.status || 'draft',
      creatorId: course.value?.creatorId || undefined,
      coCreatorIds: course.value?.coCreatorIds ?? [],
      difficulty: difficulty.value > 0 ? difficulty.value : undefined,
      description,
      evalData: {
        learningGoal: learningGoal.value || undefined,
        knowledgePointIds,
        descriptionPdf: learningGoalPdf.value || undefined
      },
      knowledgePointIds,
      resourceIds: savedResourceIds
    };
    if (editId) {
      const realIds = await persistNewResources(editId);
      await courseApi.update(editId, payload as Parameters<typeof courseApi.update>[1]);
      hasSaved = true;
      if (course.value && course.value.status !== 'draft') {
        await courseApi.saveDraft(editId);
        course.value = course.value ? { ...course.value, status: 'draft' } : course.value;
      }
      ElMessage.success('草稿已保存');
      if (Object.keys(kpIdMapping).length > 0) {
        knowledgePoints.value = knowledgePoints.value.map((kp) =>
          kpIdMapping[kp.id] ? { ...kp, id: kpIdMapping[kp.id] } : kp
        );
      }
    } else {
      const c = await courseApi.create(
        payload as Parameters<typeof courseApi.create>[0]
      );
      if (tempResourceIds.length > 0) {
        const realIds = await persistNewResources(c.id);
        await courseApi.update(c.id, { resourceIds: realIds } as Parameters<typeof courseApi.update>[1]);
      }
      hasSaved = true;
      void router.replace(`/lesson/admin/granular/add?id=${c.id}`);
      ElMessage.success('草稿已保存');
    }
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleFinish() {
  await handleSave();
  if (!hasSaved) return;
  void router.push('/lesson/admin/granular');
}

async function onCancel() {
  if (isNewCourse && editId && !hasSaved) {
    try {
      await courseApi.delete(editId);
    } catch (err) {
      console.error('删除未保存的课程草稿失败', err);
    }
  }
  void router.push('/lesson/admin/granular');
}

/* ==================== 发布检查面板（对齐 React PublishCheckPanel） ==================== */

const currentCheckNode = computed<CheckNode>(() => {
  const kpForCheck = knowledgePoints.value.map((kp) => ({
    id: kp.id,
    name: kp.name,
    linked: kp.linked ?? false
  }));
  const resForCheck = selectedResourceIds.value
    .map((id) => {
      const r = courseResourcePool.value.find((x) => x.id === id);
      if (!r) return null;
      return { id: r.id, name: r.name, type: r.type, size: 0, url: r.url };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  return {
    id: 'granular-current',
    courseId: editId || 'granular-new',
    parentId: null,
    name: courseName.value || '未命名',
    order: 1,
    type: 'normal',
    status: 'draft',
    teachingGoals: learningGoal.value,
    descriptionPdf: learningGoalPdf.value || undefined,
    duration: parseInt(hours.value) || 0,
    knowledgePoints: kpForCheck,
    resources: resForCheck,
    quizzes: [],
    evalData: {}
  };
});

interface CheckItem {
  key: string;
  label: string;
  check: (n: CheckNode) => boolean;
  statusText: (n: CheckNode) => string;
}

const CHECK_ITEMS: CheckItem[] = [
  {
    key: 'name',
    label: '节点名称',
    check: (n) => !!n.name?.trim(),
    statusText: (n) => `已填写：${n.name}`
  },
  {
    key: 'goals',
    label: '学习目标',
    check: (n) => !!n.teachingGoals?.trim(),
    statusText: (n) => {
      const lines = (n.teachingGoals || '').split('\n').filter((l) => l.trim());
      return `已填写：${lines.length} 条目标`;
    }
  },
  {
    key: 'knowledge',
    label: '涉及知识点',
    check: (n) => (n.knowledgePoints?.length ?? 0) > 0,
    statusText: (n) => `已关联：${n.knowledgePoints?.length ?? 0} 个知识点`
  },
  {
    key: 'duration',
    label: '预估课时',
    check: (n) => typeof n.duration === 'number' && n.duration > 0,
    statusText: (n) => `已设置：${n.duration ?? 0} 课时`
  },
  {
    key: 'resources',
    label: '课程资源',
    check: (n) => (n.resources?.length ?? 0) > 0,
    statusText: (n) => `已上传：${n.resources?.length ?? 0} 个文件`
  },
  {
    key: 'detailedDescription',
    label: '详细描述',
    check: (n) => !!n.detailedDescription?.trim(),
    statusText: (n) => {
      const len = n.detailedDescription?.length ?? 0;
      return len > 0 ? `已填写：${len} 字符` : '未填写详细描述';
    }
  }
];

// granular 页固定 hideEval + hideDetailedDescription（对齐 React 用法）
const checkResults = computed(() => {
  const node = currentCheckNode.value;
  const items = CHECK_ITEMS.filter((item) => item.key !== 'detailedDescription');
  return items.map((item) => {
    const passed = item.check(node);
    return {
      ...item,
      passed,
      statusText: passed ? item.statusText(node) : `未设置${item.label}`
    };
  });
});

const checkTotal = computed(() => checkResults.value.length);
const checkCompleted = computed(() => checkResults.value.filter((r) => r.passed).length);
const checkAllDone = computed(() => checkCompleted.value === checkTotal.value);
const checkPercent = computed(() =>
  checkTotal.value === 0 ? 0 : Math.round((checkCompleted.value / checkTotal.value) * 100)
);
const checkEmptyFields = computed(() =>
  checkResults.value.filter((r) => !r.passed).map((r) => r.label)
);

/* ==================== 学习目标编辑器（对齐 React RichTextEditor） ==================== */

const goalMode = ref<'rich_text' | 'pdf'>('rich_text');
const pdfUploading = ref(false);
const pdfPreviewOpen = ref(false);
const pdfInputRef = ref<HTMLInputElement | null>(null);

const pdfFileName = computed(() => {
  const url = learningGoalPdf.value;
  if (!url) return '';
  return url.split('/').pop() || url;
});

const goalPlaceholder = `课程目标

学生通过本课程学习，将能够：

• 掌握 [核心知识点/技能] 的基本概念与原理
• 能够独立完成 [具体任务/操作]
• 理解 [相关理论/方法] 的适用场景与局限性
• 具备 [某种能力/素养]

学习要求

• 课前预习：[预习材料/视频]
• 课堂参与：积极参与讨论与练习
• 课后作业：按时完成并提交
• 考核方式：[测验/项目/考试]

评价标准

• 知识掌握（40%）：理解核心概念，能正确运用
• 实践能力（30%）：能独立完成操作任务
• 团队协作（15%）：积极参与小组活动
• 创新思维（15%）：能提出有见地的问题或方案`;

function triggerPdfUpload() {
  if (!pdfUploading.value) pdfInputRef.value?.click();
}

function onPdfFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void handlePdfUpload(file);
}

function onPdfDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file) void handlePdfUpload(file);
}

async function handlePdfUpload(file: File) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    ElMessage.error('请上传 PDF 文件');
    return;
  }
  if (file.size > RESOURCE_MAX_FILE_SIZE) {
    ElMessage.error('文件大小超过 10MB');
    return;
  }
  pdfUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    learningGoalPdf.value = res.url;
    ElMessage.success('上传成功');
  } catch (err: any) {
    ElMessage.error(err.message || '上传失败');
  } finally {
    pdfUploading.value = false;
  }
}

/* ==================== 封面上传（对齐 React CoverImageUpload，简化：不做裁剪/HEIC 检测） ==================== */

const coverInputRef = ref<HTMLInputElement | null>(null);

function triggerCoverUpload() {
  if (!coverUploading.value) coverInputRef.value?.click();
}

async function onCoverFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    coverImage.value = res.url;
  } catch (err: any) {
    ElMessage.error(err.message || '封面上传失败');
  } finally {
    coverUploading.value = false;
  }
}

function removeCover() {
  coverImage.value = '';
}

/* ==================== 知识点选择器（对齐 React KnowledgeSelector） ==================== */

const kpDialogOpen = ref(false);

const kpSearch = ref('');
const searchResults = ref<KpItem[] | null>(null);
const searchLoading = ref(false);
let searchSeq = 0;
let searchTimer: number | undefined;

const positions = ref<PositionLite[]>([]);
const scenarios = ref<ScenarioLite[]>([]);
const sceneTasks = ref<TaskLite[]>([]);
const filterMode = ref<'all' | 'scene' | 'position'>('all');
const selectedPositionId = ref('all');
const selectedSceneId = ref('all');
const selectedTaskId = ref('all');
const filterKpIds = ref<Set<string> | null>(null);
const sceneKpIdSet = ref<Set<string> | null>(null);
const filterLoading = ref(false);
const allKps = ref<KpItem[] | null>(null);
let filterSeq = 0;

const kpActionOpen = ref(false);
const kpActionMode = ref<'add' | 'clone' | 'edit' | null>(null);
const kpActionTarget = ref<KpItem | null>(null);
const newKpForm = reactive<{
  name: string;
  description: string;
  code: string;
  granularLessons: string[];
}>({ name: '', description: '', code: '', granularLessons: [] });
const kpNameError = ref('');

const glSelectOpen = ref(false);
const glSelectTargetKp = ref<string | null>(null);
const glSearch = ref('');
const granularCourses = ref<Course[]>([]);

const kpDetailOpen = ref(false);
const selectedKpForDetail = ref<string | null>(null);

function generateKpCode(): string {
  return `KP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mapServerKp(k: KnowledgePoint): KpItem {
  return {
    id: k.id,
    name: k.name,
    code: k.code,
    description: k.description,
    linked: k.linked,
    granularLessons: (k as KnowledgePoint & { granularLessonIds?: string[] }).granularLessonIds || []
  };
}

async function loadGranularCourses() {
  try {
    const res = await courseApi.list({ type: 'granular' });
    granularCourses.value = res.items || [];
  } catch {
    granularCourses.value = [];
  }
}

async function loadPositions() {
  try {
    const items = await fetchAllPages((p, s) => positionApi.list({ limit: s, offset: p * s }));
    positions.value = items;
  } catch {
    positions.value = [];
  }
}

async function loadScenarios() {
  try {
    const items = await fetchAllPages((p, s) => scenarioApi.list({ limit: s, offset: p * s }));
    scenarios.value = items;
  } catch {
    scenarios.value = [];
  }
}

const isSearching = computed(() => !!kpSearch.value.trim());
const filterActive = computed(() => filterKpIds.value !== null && !isSearching.value);
const hasResults = computed(() => (isSearching.value ? filtered.value.length > 0 : false));

const filtered = computed(() => {
  if (isSearching.value) return searchResults.value || [];
  if (filterActive.value) return (allKps.value || []).filter((kp) => filterKpIds.value!.has(kp.id));
  return knowledgePool.value;
});

// 搜索走后端接口（name/code 模糊匹配），可命中全部知识点（对齐 React 300ms debounce）
watch(kpSearch, (val) => {
  const term = val.trim();
  window.clearTimeout(searchTimer);
  if (!term) {
    searchResults.value = null;
    searchLoading.value = false;
    return;
  }
  searchTimer = window.setTimeout(async () => {
    const seq = ++searchSeq;
    searchLoading.value = true;
    try {
      const res = await knowledgeApi.list({ search: term, limit: 200 });
      if (seq !== searchSeq) return;
      searchResults.value = (res.items || []).map(mapServerKp);
    } catch {
      if (seq !== searchSeq) return;
      searchResults.value = [];
    } finally {
      if (seq === searchSeq) searchLoading.value = false;
    }
  }, 300);
});

// 筛选命中集合非空时，懒加载全量知识点（超出 pool 200 条的部分也能筛出来）
watch(filterKpIds, (ids) => {
  if (ids === null || allKps.value !== null) return;
  void (async () => {
    try {
      const items = await fetchAllPages((p, s) => knowledgeApi.list({ limit: s, offset: p * s }));
      allKps.value = items.map(mapServerKp);
    } catch {
      allKps.value = [];
    }
  })();
});

function handleFilterModeChange(mode: string | number | boolean | undefined) {
  const m = (String(mode) as 'all' | 'scene' | 'position') || 'all';
  filterMode.value = m;
  selectedSceneId.value = 'all';
  selectedTaskId.value = 'all';
  selectedPositionId.value = 'all';
  sceneTasks.value = [];
  sceneKpIdSet.value = null;
  filterKpIds.value = null;
  filterLoading.value = false;
}

function handleSceneChange(sid: string) {
  selectedSceneId.value = sid;
  selectedTaskId.value = 'all';
  if (sid === 'all') {
    sceneTasks.value = [];
    sceneKpIdSet.value = null;
    filterKpIds.value = null;
    return;
  }
  filterLoading.value = true;
  filterKpIds.value = new Set();
  const seq = ++filterSeq;
  void taskApi
    .list({ scenarioId: sid, limit: 200 })
    .then((res) => {
      if (seq !== filterSeq) return;
      const tasks = res.items || [];
      sceneTasks.value = tasks;
      const ids = new Set<string>();
      for (const task of tasks) for (const id of task.knowledgePointIds || []) ids.add(id);
      sceneKpIdSet.value = ids;
      filterKpIds.value = ids;
    })
    .catch(() => {
      if (seq !== filterSeq) return;
      sceneTasks.value = [];
      filterKpIds.value = new Set();
    })
    .finally(() => {
      if (seq === filterSeq) filterLoading.value = false;
    });
}

function handleTaskChange(tid: string) {
  selectedTaskId.value = tid;
  if (tid === 'all') {
    filterKpIds.value = sceneKpIdSet.value;
  } else {
    const task = sceneTasks.value.find((t) => t.id === tid);
    filterKpIds.value = new Set(task?.knowledgePointIds || []);
  }
}

function handlePositionChange(pid: string) {
  selectedPositionId.value = pid;
  selectedSceneId.value = 'all';
  selectedTaskId.value = 'all';
  sceneTasks.value = [];
  sceneKpIdSet.value = null;
  if (pid === 'all') {
    filterKpIds.value = null;
    return;
  }
  const posScenarios = scenarios.value.filter((s) => s.careerPositionId === pid);
  filterLoading.value = true;
  filterKpIds.value = new Set();
  const seq = ++filterSeq;
  void Promise.all(
    posScenarios.map((s) =>
      taskApi
        .list({ scenarioId: s.id, limit: 200 })
        .then((res) => res.items || [])
        .catch(() => [] as TaskLite[])
    )
  )
    .then((results) => {
      if (seq !== filterSeq) return;
      const ids = new Set<string>();
      for (const r of results) for (const task of r || []) for (const id of task.knowledgePointIds || []) ids.add(id);
      filterKpIds.value = ids;
    })
    .catch(() => {
      if (seq !== filterSeq) return;
      filterKpIds.value = new Set();
    })
    .finally(() => {
      if (seq === filterSeq) filterLoading.value = false;
    });
}

function isKpSelected(id: string): boolean {
  return knowledgePoints.value.some((s) => s.id === id);
}

function referenceKp(kp: KpItem) {
  if (isKpSelected(kp.id)) return;
  knowledgePoints.value = [...knowledgePoints.value, kp];
}

function removeKp(kpId: string) {
  knowledgePoints.value = knowledgePoints.value.filter((s) => s.id !== kpId);
}

function openAddKp() {
  newKpForm.name = kpSearch.value;
  newKpForm.description = '';
  newKpForm.code = generateKpCode();
  newKpForm.granularLessons = [];
  kpNameError.value = '';
  kpActionMode.value = 'add';
  kpActionTarget.value = null;
  kpActionOpen.value = true;
}

function openCloneKp(kp: KpItem) {
  newKpForm.name = `${kp.name}-copy`;
  newKpForm.description = kp.description || '';
  newKpForm.code = generateKpCode();
  newKpForm.granularLessons = kp.granularLessons || [];
  kpNameError.value = '';
  kpActionMode.value = 'clone';
  kpActionTarget.value = kp;
  kpActionOpen.value = true;
}

function openEditKp(kp: KpItem) {
  newKpForm.name = kp.name;
  newKpForm.description = kp.description || '';
  newKpForm.code = kp.code || generateKpCode();
  newKpForm.granularLessons = kp.granularLessons || [];
  kpNameError.value = '';
  kpActionMode.value = 'edit';
  kpActionTarget.value = kp;
  kpActionOpen.value = true;
}

function findNameCollision(name: string, excludeId?: string): KpItem | undefined {
  return (
    knowledgePool.value.find((p) => p.id !== excludeId && p.name.trim() === name.trim()) ||
    (searchResults.value || []).find((p) => p.id !== excludeId && p.name.trim() === name.trim()) ||
    knowledgePoints.value.find((s) => s.id !== excludeId && s.name.trim() === name.trim())
  );
}

function handleSaveKp() {
  const name = newKpForm.name.trim();
  if (!name) return;
  const excludeId = kpActionMode.value === 'edit' ? kpActionTarget.value?.id : undefined;
  const collision = findNameCollision(name, excludeId);
  if (collision) {
    kpNameError.value = `已存在同名知识点「${collision.name}」，请选择已有知识点或使用其他名称`;
    return;
  }
  kpNameError.value = '';
  if (kpActionMode.value === 'edit' && kpActionTarget.value) {
    const target = kpActionTarget.value;
    const updated = knowledgePoints.value.map((s) =>
      s.id === target.id
        ? {
            ...s,
            name,
            description: newKpForm.description.trim(),
            code: newKpForm.code,
            granularLessons: newKpForm.granularLessons
          }
        : s
    );
    knowledgePoints.value = updated;
    if (searchResults.value) {
      searchResults.value = searchResults.value.map((p) =>
        p.id === target.id
          ? {
              ...p,
              name,
              description: newKpForm.description.trim(),
              code: newKpForm.code,
              granularLessons: newKpForm.granularLessons
            }
          : p
      );
    }
    allKps.value = null; // 失效全量缓存，下次筛选重新拉取
    kpActionOpen.value = false;
    return;
  }
  const newId = `kp-custom-${Date.now()}`;
  const newKp: KpItem = {
    id: newId,
    name,
    description: newKpForm.description.trim(),
    code: newKpForm.code,
    linked: false,
    granularLessons: newKpForm.granularLessons
  };
  // 与 React 语义一致：新知识点标记为自定义并加入已选列表。
  // 说明：React 端 onAddCustom 与 onChange 会重复追加同一次新建（双写），
  // Vue 端收敛为单条（符合保存逻辑意图：一条 kp 对应一次新建）。
  customKnowledgePointIds.value = new Set(customKnowledgePointIds.value).add(newId);
  knowledgePoints.value = [...knowledgePoints.value, newKp];
  allKps.value = null;
  kpActionOpen.value = false;
  kpSearch.value = '';
}

const kpActionTitle = computed(() =>
  kpActionMode.value === 'add'
    ? '新增知识点'
    : kpActionMode.value === 'clone'
      ? '克隆知识点'
      : '编辑知识点'
);

const kpActionConfirmText = computed(() =>
  kpActionMode.value === 'add'
    ? '新增并选中'
    : kpActionMode.value === 'clone'
      ? '克隆并选中'
      : '保存修改'
);

/* ---- 关联颗粒课（GL）选择 ---- */

const glFiltered = computed(() =>
  granularCourses.value.filter(
    (g) => !glSearch.value || g.name.includes(glSearch.value) || (g.code && g.code.includes(glSearch.value))
  )
);

const glTargetKp = computed(
  () => glSelectTargetKp.value && knowledgePoints.value.find((s) => s.id === glSelectTargetKp.value) || null
);

const glSelectedIds = computed(() =>
  glSelectTargetKp.value === 'new-kp'
    ? newKpForm.granularLessons
    : glTargetKp.value?.granularLessons || []
);

const glSelectTitle = computed(() =>
  glTargetKp.value ? `为「${glTargetKp.value.name}」选择颗粒课` : '选择颗粒课'
);

function openGlSelectForNewKp() {
  glSelectTargetKp.value = 'new-kp';
  glSearch.value = '';
  glSelectOpen.value = true;
}

function openGlSelectFromDetail(kpId: string) {
  kpDetailOpen.value = false;
  glSelectTargetKp.value = kpId;
  glSearch.value = '';
  glSelectOpen.value = true;
}

function toggleGlFor(glId: string) {
  if (glSelectTargetKp.value === 'new-kp') {
    const current = newKpForm.granularLessons;
    newKpForm.granularLessons = current.includes(glId)
      ? current.filter((x) => x !== glId)
      : [...current, glId];
  } else if (glSelectTargetKp.value) {
    const targetId = glSelectTargetKp.value;
    knowledgePoints.value = knowledgePoints.value.map((s) => {
      if (s.id !== targetId) return s;
      const current = s.granularLessons || [];
      const updated = current.includes(glId)
        ? current.filter((x) => x !== glId)
        : [...current, glId];
      return { ...s, granularLessons: updated };
    });
  }
}

function removeGlFromNewKp(gid: string) {
  newKpForm.granularLessons = newKpForm.granularLessons.filter((x) => x !== gid);
}

function glName(gid: string): string {
  return granularCourses.value.find((g) => g.id === gid)?.name || gid;
}

/* ---- 知识点详情 ---- */

function openKpDetail(id: string) {
  selectedKpForDetail.value = id;
  kpDetailOpen.value = true;
}

const detailKp = computed(() => {
  const id = selectedKpForDetail.value;
  if (!id) return null;
  return (
    knowledgePoints.value.find((s) => s.id === id) ||
    knowledgePool.value.find((p) => p.id === id) ||
    (searchResults.value || []).find((p) => p.id === id) ||
    null
  );
});

const detailGranularLessons = computed(() =>
  (detailKp.value?.granularLessons || [])
    .map((gid) => granularCourses.value.find((g) => g.id === gid))
    .filter((g): g is Course => !!g)
);

function kpGlNames(kp: KpItem): string[] {
  return (kp.granularLessons || [])
    .map((gid) => granularCourses.value.find((g) => g.id === gid)?.name)
    .filter((n): n is string => !!n);
}

function onKpCardClick(kp: KpItem) {
  if (kp.linked) {
    openKpDetail(kp.id);
  } else {
    openEditKp(kp);
  }
}

/* ==================== 资源选择器（对齐 React ResourceSelector，standalone=false） ==================== */

const resourceDialogOpen = ref(false);

const resType = ref('all');
const resSearchName = ref('');
const resSearchProvider = ref('');

const filteredRes = computed(() =>
  courseResourcePool.value.filter((r) => {
    const matchType = resType.value === 'all' || r.type === resType.value;
    const matchName = !resSearchName.value || r.name.includes(resSearchName.value);
    const matchProvider =
      !resSearchProvider.value ||
      (r.uploadedBy && r.uploadedBy.includes(resSearchProvider.value));
    return matchType && matchName && matchProvider;
  })
);

function toggleResource(rid: string) {
  const selected = selectedResourceIds.value.includes(rid);
  selectedResourceIds.value = selected
    ? selectedResourceIds.value.filter((id) => id !== rid)
    : [...selectedResourceIds.value, rid];
}

function removeResource(rid: string) {
  selectedResourceIds.value = selectedResourceIds.value.filter((id) => id !== rid);
}

function resourceName(rid: string): string {
  const r = courseResourcePool.value.find((x) => x.id === rid);
  return r?.name || rid.slice(0, 8);
}

function selectedResource(rid: string): ResourceItem | undefined {
  return courseResourcePool.value.find((r) => r.id === rid);
}

function resetResFilters() {
  resType.value = 'all';
  resSearchName.value = '';
  resSearchProvider.value = '';
}

function typeIcon(type?: string): Component {
  return TYPE_ICON_MAP[type || 'other'] || QuestionFilled;
}

function inferTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (DOCUMENT_EXTS.includes(ext)) return 'document';
  if (SPREADSHEET_EXTS.includes(ext)) return 'spreadsheet';
  if (ARCHIVE_EXTS.includes(ext)) return 'archive';
  if (SOFTWARE_EXTS.includes(ext)) return 'software';
  return 'other';
}

function validateResourceFile(file: File, type: string): string | null {
  if (file.size > RESOURCE_MAX_FILE_SIZE) return '文件大小超过 10MB';
  const allowed = resourceTypeExtensionMap[type] || [];
  if (allowed.length === 0) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowed.includes(ext)) {
    return `不支持的文件格式，请上传 ${allowed.map((e) => `.${e}`).join('、')} 文件`;
  }
  return null;
}

/* ---- 上传 ---- */

const uploadTypePickerOpen = ref(false);
const uploadOpen = ref(false);
const resourceUploadRef = ref<{ clearFiles: () => void } | null>(null);
const newResName = ref('');
const newResType = ref('document');
const newResUrl = ref('');
const newResDescription = ref('');
const newResAddress = ref('');
const newResOpenTime = ref('');
const newResCapacity = ref('');
const newResContact = ref('');
const newResLocation = ref('');
const newResQuantity = ref('');
const newResVersion = ref('');
const newResLicense = ref('');
const newResFile = ref<File | null>(null);
const newResUploading = ref(false);

function openUploadTypePicker() {
  uploadTypePickerOpen.value = true;
}

function pickUploadType(t: ResourceKind) {
  newResType.value = t;
  uploadTypePickerOpen.value = false;
  uploadOpen.value = true;
}

function onResourceFileChange(file: UploadFile) {
  const raw = file.raw;
  if (!raw) return;
  const err = validateResourceFile(raw, newResType.value);
  if (err) {
    ElMessage.error(err);
    return;
  }
  newResFile.value = raw;
  newResName.value = raw.name;
  newResType.value = inferTypeFromName(raw.name);
}

const uploadConfirmDisabled = computed(
  () =>
    !newResName.value.trim() ||
    (newResType.value === 'link' && !newResUrl.value.trim()) ||
    (FILE_UPLOAD_TYPES.includes(newResType.value) && !newResFile.value && !newResUrl.value.trim())
);

function resetUploadForm() {
  newResName.value = '';
  newResType.value = 'document';
  newResUrl.value = '';
  newResDescription.value = '';
  newResAddress.value = '';
  newResOpenTime.value = '';
  newResCapacity.value = '';
  newResContact.value = '';
  newResLocation.value = '';
  newResQuantity.value = '';
  newResVersion.value = '';
  newResLicense.value = '';
  newResFile.value = null;
  newResUploading.value = false;
  resourceUploadRef.value?.clearFiles();
}

function closeUploadDialog() {
  uploadOpen.value = false;
  resetUploadForm();
}

async function handleUpload() {
  if (!newResName.value.trim()) return;

  const isFileType = FILE_UPLOAD_TYPES.includes(newResType.value);
  let fileUrl = newResUrl.value.trim();
  let uploadedSize: number | undefined;

  if (isFileType && newResFile.value) {
    newResUploading.value = true;
    try {
      const res = await fileApi.upload(newResFile.value);
      fileUrl = res.url;
      uploadedSize = res.size;
    } catch (err: any) {
      ElMessage.error(err.message || '上传失败');
      newResUploading.value = false;
      return;
    }
  }

  if (newResType.value === 'link' && !fileUrl) {
    ElMessage.error('请填写链接地址');
    return;
  }

  const localId = `res-${Date.now()}`;
  const newRes: ResourceItem = {
    id: localId,
    name: newResName.value.trim(),
    type: newResType.value,
    url: fileUrl,
    description: newResDescription.value,
    uploadedBy: '当前用户',
    uploadedAt: new Date().toISOString().slice(0, 10),
    size: uploadedSize
  };

  // 页面级资源池：本地上传资源仅落组件状态，保存时经 persistLocalResources 持久化（对齐 React）
  courseResourcePool.value = courseResourcePool.value.some((x) => x.id === newRes.id)
    ? courseResourcePool.value
    : [...courseResourcePool.value, newRes];
  selectedResourceIds.value = [...selectedResourceIds.value, newRes.id];
  resetUploadForm();
  uploadOpen.value = false;
  ElMessage.success('资源已上传并选中');
}

/* ---- 资源预览（对齐 React ResourcePreviewModal 简化实现：el-dialog + iframe/原生渲染） ---- */

const previewOpen = ref(false);
const previewResource = ref<ResourceItem | null>(null);
const previewSrc = ref<string | null>(null);
const previewFor = ref('');
const previewLoading = ref(false);

function buildKkFileViewUrl(fileUrl: string): string {
  const origin =
    typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`;
}

function extOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const i = path.lastIndexOf('.');
  return i < 0 ? '' : path.slice(i + 1).toLowerCase();
}

const previewKind = computed<'image' | 'video' | 'audio' | 'text' | 'pdf' | ''>(() => {
  const url = previewResource.value?.url;
  if (!url) return '';
  const ext = extOf(url);
  if (NATIVE_IMAGE_EXTS.has(ext)) return 'image';
  if (NATIVE_VIDEO_EXTS.has(ext)) return 'video';
  if (NATIVE_AUDIO_EXTS.has(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (NATIVE_TEXT_EXTS.has(ext)) return 'text';
  return '';
});

const previewIframeSrc = computed(() => {
  const r = previewResource.value;
  if (!r?.url) return null;
  if (previewFor.value !== r.url || !previewSrc.value) return null;
  if (!previewSrc.value.startsWith('/uploads/')) return null;
  return buildKkFileViewUrl(previewSrc.value);
});

async function openPreview(r: ResourceItem) {
  previewResource.value = r;
  previewOpen.value = true;
  previewSrc.value = null;
  previewFor.value = '';
  if (!r.url) return;
  previewLoading.value = true;
  try {
    let u = r.url;
    if (r.url.startsWith('/uploads/')) {
      try {
        // Vue fileApi 缺 signUrl：用 request 直连同一后端端点（路径照抄 React）
        const data = await request<{ url: string }>(
          `/files/sign-url?name=${encodeURIComponent(r.url)}`
        );
        u = data.url;
      } catch {
        // 签名失败回退原 URL
      }
    }
    previewSrc.value = u;
    previewFor.value = r.url;
  } finally {
    previewLoading.value = false;
  }
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>

<style scoped>
.granular-edit-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.shell-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f2f5;
}

.shell-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.shell-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-box {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
}

.shell-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 0;
}

.main-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: none;
}

.section-card :deep(.el-card__body) {
  padding: 4px 16px 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.section-icon {
  color: #1890ff;
  font-size: 16px;
}

.basic-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
  align-items: start;
}

.basic-span2 {
  grid-column: 1 / -1;
}

.basic-left :deep(.el-form-item),
.basic-right :deep(.el-form-item) {
  margin-bottom: 14px;
}

.basic-left :deep(.el-form-item__label),
.basic-right :deep(.el-form-item__label),
.field-label {
  font-size: 12px;
  color: #374151;
  line-height: 1.6;
}

.field-hint {
  font-size: 12px;
  color: #9ca3af;
  margin: 2px 0 0;
}

.field-label .field-hint {
  margin-left: 4px;
}

.task-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

.cover-uploader {
  width: 100%;
  max-width: 400px;
}

.cover-box {
  position: relative;
  aspect-ratio: 16 / 9;
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: background 0.2s;
}

.cover-box:hover {
  background: #f3f4f6;
}

.cover-box.has-image {
  border-style: solid;
  border-color: #e5e7eb;
  background: #f3f4f6;
}

.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-icon {
  font-size: 28px;
  color: #9ca3af;
}

.cover-text {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.cover-hover {
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

.cover-box:hover .cover-hover {
  opacity: 1;
}

.cover-hover-btn {
  background: rgba(255, 255, 255, 0.9) !important;
  color: #1f2937 !important;
  border: 1px solid #fff !important;
}

.goal-tabs {
  margin: 6px 0 8px;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #9ca3af;
  padding: 6px 10px;
  background: #f9fafb;
  border-top: 1px solid #f0f2f5;
}

.pdf-dropzone {
  border: 2px dashed #e5e7eb;
  border-radius: 10px;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.pdf-dropzone:hover {
  border-color: rgba(64, 158, 255, 0.3);
  background: #fafafa;
}

.pdf-dropzone-uploading {
  border-color: rgba(64, 158, 255, 0.3);
  background: #fafafa;
}

.pdf-drop-text {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.pdf-drop-tip {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.hidden-input {
  display: none;
}

.res-uploader {
  width: 100%;
}

.res-uploader :deep(.el-upload) {
  width: 100%;
}

.pdf-upload-icon {
  font-size: 30px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.pdf-file-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 0;
}

.pdf-file-icon {
  font-size: 26px;
  color: #f56c6c;
}

.pdf-file-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.kp-tag {
  cursor: pointer;
}

.dashed-add {
  width: 100%;
  border-style: dashed;
  color: #409eff;
}

.bottom-space {
  height: 48px;
}

/* ---------- 发布检查面板 ---------- */

.check-panel {
  position: sticky;
  top: 76px;
  align-self: start;
}

.check-box {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #f0f2f5;
  padding: 14px;
}

.check-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.check-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.check-icon {
  color: #e6a23c;
}

.check-total {
  font-size: 12px;
  color: #9ca3af;
}

.check-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.check-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
}

.check-item-warn {
  background: #fdf6ec;
}

.check-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  margin-top: 1px;
}

.check-dot-ok {
  background: #f0f9eb;
  color: #67c23a;
}

.check-dot-warn {
  background: #fdf6ec;
  color: #e6a23c;
}

.check-item-body {
  flex: 1;
  min-width: 0;
}

.check-item-label {
  margin: 0;
  font-size: 12px;
  color: #1f2937;
}

.check-item-status {
  margin: 2px 0 0;
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-ok {
  color: #67c23a;
}

.status-warn {
  color: #e6a23c;
}

.check-progress {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;
}

.check-progress-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.check-progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-ok {
  background: #67c23a;
}

.dot-warn {
  background: #e6a23c;
}

.check-progress-text {
  font-size: 12px;
  color: #374151;
}

.check-progress-hint {
  margin: 8px 0 0;
  font-size: 10px;
  color: #9ca3af;
}

/* ---------- 知识点选择器 ---------- */

.kp-selector {
  display: flex;
  gap: 14px;
  min-height: 480px;
}

.kp-left {
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
}

.kp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.kp-search {
  flex: 1;
}

.kp-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 12px;
  color: #6b7280;
  flex-shrink: 0;
}

.filter-count {
  font-size: 10px;
  color: #9ca3af;
}

.filter-hint {
  font-size: 10px;
  color: #9ca3af;
}

.kp-list-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.kp-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  color: #9ca3af;
  font-size: 13px;
}

.kp-loading p {
  margin: 0;
}

.kp-name {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
}

.kp-code-tag {
  font-size: 10px;
}

.kp-desc {
  font-size: 12px;
  color: #6b7280;
}

.muted-text {
  color: #9ca3af;
}

.kp-right {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
}

.kp-right-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.kp-right-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.kp-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.kp-card {
  position: relative;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;
}

.kp-card:hover {
  background: #f3f4f6;
}

.kp-card-custom {
  border-color: rgba(64, 158, 255, 0.2);
  background: rgba(64, 158, 255, 0.05);
}

.kp-card-custom:hover {
  background: rgba(64, 158, 255, 0.1);
}

.kp-card-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.kp-card-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-card-remove {
  color: #9ca3af;
  font-size: 12px;
  flex-shrink: 0;
}

.kp-card-remove:hover {
  color: #f56c6c;
}

.kp-card-desc {
  margin: 0 0 4px;
  font-size: 11px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-card-gl {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}

.kp-gl-tag {
  font-size: 9px;
  padding: 0 4px;
  height: 18px;
}

.kp-gl-more {
  font-size: 9px;
  color: #9ca3af;
}

.kp-ref-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  background: #e5e7eb;
  color: #4b5563;
  font-size: 9px;
  padding: 1px 6px;
  border-top-left-radius: 6px;
}

.form-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #f56c6c;
}

.gl-badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.gl-pick-btn {
  width: 100%;
}

/* ---------- 选择颗粒课 ---------- */

.gl-selector {
  display: flex;
  gap: 14px;
  min-height: 420px;
  height: 60vh;
}

.gl-left {
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
}

.gl-search {
  margin-bottom: 8px;
}

.gl-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gl-item {
  display: flex;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.gl-item:hover {
  border-color: #d1d5db;
}

.gl-item-selected {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.05);
}

.gl-check {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  color: #fff;
  font-size: 12px;
}

.gl-check-on {
  background: #409eff;
  border-color: #409eff;
}

.gl-item-body {
  flex: 1;
  min-width: 0;
}

.gl-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gl-item-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
}

.gl-item-desc {
  margin: 4px 0 0 20px;
  font-size: 12px;
  color: #6b7280;
}

.gl-right {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
}

.gl-right-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.gl-right-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gl-selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.gl-selected-name {
  flex: 1;
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gl-selected-remove {
  color: #9ca3af;
  flex-shrink: 0;
}

.gl-selected-remove:hover {
  color: #f56c6c;
}

/* ---------- 知识点详情 ---------- */

.kp-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.kp-detail-name {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.kp-detail-text {
  margin: 4px 0 12px;
  font-size: 13px;
  color: #374151;
}

.kp-detail-gl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ---------- 资源选择器 ---------- */

.res-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 480px;
}

.res-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.res-type-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.res-type-btn {
  margin-left: 0 !important;
}

.res-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.res-search {
  flex: 1;
}

.res-panels {
  display: flex;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.res-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  overflow: hidden;
}

.res-left-head {
  margin-bottom: 10px;
}

.res-left-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.res-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.res-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.res-card {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}

.res-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.res-card-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.1);
}

.res-card-thumb {
  position: relative;
  height: 76px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
  overflow: hidden;
}

.res-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.res-thumb-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.res-selected-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.res-type-tag {
  position: absolute;
  left: 6px;
  bottom: 6px;
  font-size: 9px;
  padding: 0 4px;
  height: 18px;
}

.res-card-body {
  padding: 8px;
}

.res-card-name {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-card-provider {
  margin: 0;
  font-size: 10px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-card-actions {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
}

.res-action-btn {
  flex: 1;
  margin-left: 0 !important;
}

.res-right {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #fafafa;
  overflow: hidden;
}

.res-right-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.res-right-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.res-right-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.res-selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 8px;
  background: #fff;
}

.res-selected-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.res-selected-info {
  flex: 1;
  min-width: 0;
}

.res-selected-name {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-selected-provider {
  margin: 2px 0 0;
  font-size: 10px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-selected-remove {
  color: #9ca3af;
  flex-shrink: 0;
}

.res-selected-remove:hover {
  color: #f56c6c;
}

.res-file-size {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.form-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

/* ---------- 上传类型选择 ---------- */

.upload-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.upload-type-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-type-item:hover {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.05);
}

.upload-type-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.upload-type-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

/* ---------- 预览 ---------- */

.preview-frame {
  height: 65vh;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.preview-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-audio {
  width: 80%;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 13px;
}

.preview-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 16px;
  text-align: center;
}

@media (max-width: 1024px) {
  .shell-body {
    grid-template-columns: 1fr;
  }

  .check-panel {
    position: static;
  }

  .basic-grid {
    grid-template-columns: 1fr;
  }
}
</style>
