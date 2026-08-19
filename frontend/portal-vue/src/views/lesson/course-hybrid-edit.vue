<template>
  <div class="hybrid-edit-page">
    <el-card shadow="never" class="editor-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ editId ? '编辑混合课程' : '新建混合课程' }}</span>
          <div class="header-actions">
            <el-button @click="onBack">取消</el-button>
            <el-button :loading="saving" @click="handleSave">保存草稿</el-button>
            <el-button type="primary" :loading="saving" @click="handleFinish">完成配置</el-button>
          </div>
        </div>
      </template>

      <!-- ========== 课程基本信息（可折叠） ========== -->
      <div class="course-info">
        <div class="info-header" @click="globalInfoOpen = !globalInfoOpen">
          <div class="info-title">
            <el-icon color="#1890ff"><Reading /></el-icon>
            <span>课程基本信息</span>
            <span class="info-name">{{ courseForm.name ? `《${courseForm.name}》` : '未填写课程名称' }}</span>
            <el-tag v-if="courseForm.majorName" size="small" type="info" effect="plain">{{ courseForm.majorName }}</el-tag>
          </div>
          <div class="info-toggle">
            <span>{{ globalInfoOpen ? '收起' : '展开编辑' }}</span>
            <el-icon><component :is="globalInfoOpen ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
          </div>
        </div>
        <p v-if="!globalInfoOpen && courseForm.detailedDescription" class="info-desc">{{ courseForm.detailedDescription }}</p>
        <div v-show="globalInfoOpen" class="info-body">
          <div class="info-left">
            <el-form label-position="top">
              <el-form-item label="课程名称">
                <el-input v-model="courseForm.name" placeholder="请输入课程名称" />
              </el-form-item>
              <el-form-item label="课程分类">
                <el-select v-model="courseForm.category" placeholder="请选择课程分类" style="width: 100%">
                  <el-option v-for="c in COURSE_CATEGORIES" :key="c" :label="c" :value="c" />
                </el-select>
              </el-form-item>
              <el-form-item label="课程简介">
                <!-- 对齐 React RichTextEditor（value/onChange + pdfUrl/onPdfChange），复用门户 description-editor -->
                <DescriptionEditor
                  :value="courseForm.detailedDescription"
                  :pdf-url="courseDescriptionPdf"
                  :min-height="280"
                  placeholder="请输入课程简介..."
                  @update:value="courseForm.detailedDescription = $event"
                  @update:pdf-url="courseDescriptionPdf = $event"
                />
              </el-form-item>
            </el-form>
          </div>
          <div class="info-right">
            <el-form label-position="top">
              <el-form-item label="课程封面">
                <div class="cover-row">
                  <el-image
                    v-if="courseForm.coverImage"
                    :src="courseForm.coverImage"
                    fit="cover"
                    class="cover-preview"
                    :preview-src-list="[courseForm.coverImage]"
                    preview-teleported
                  />
                  <div v-else class="cover-placeholder">暂无封面</div>
                  <div class="cover-actions">
                    <el-button size="small" :loading="coverUploading" @click="coverInputRef?.click()">上传封面</el-button>
                    <el-button v-if="courseForm.coverImage" size="small" @click="removeCover">移除</el-button>
                  </div>
                  <input ref="coverInputRef" type="file" accept="image/*" class="hidden-input" @change="onCoverFile" />
                </div>
              </el-form-item>
              <el-form-item label="适用专业">
                <el-select v-model="courseForm.majorId" clearable placeholder="请选择适用专业" style="width: 100%" @change="onMajorChange">
                  <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="所属批次">
                <el-select v-model="batchId" clearable placeholder="请选择所属批次" style="width: 100%">
                  <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="关联能力点（用于岗位能力汇聚）">
                <!-- 对齐 React AbilityPointSelector（selected/pool/onChange/onAddCustom） -->
                <AbilityPointSelector
                  :selected="abilityPoints"
                  :pool="abilityPool"
                  @change="abilityPoints = $event"
                  @add-custom="addCustomAbility"
                />
              </el-form-item>
            </el-form>
          </div>
        </div>
      </div>

      <!-- ========== 双栏布局 ========== -->
      <div class="editor-main">
        <!-- 左：课程节点目录（复用 system-course-tree，对齐 React CourseNodeTree 的 props/回调） -->
        <SystemCourseTree
          :nodes="nodes"
          :selected-node-id="selectedNodeId"
          @select="selectedNodeId = $event"
          @add-node="handleAddNode"
          @update-node="handleUpdateNode"
          @delete-node="handleDeleteNode"
          @reorder-nodes="handleReorderNodes"
        />

        <!-- 右：节点内容 -->
        <div class="content-area">
          <div v-if="selectedNode" class="node-info-bar">
            <span class="dot" />
            <span class="node-info-text">当前编辑节点：<b>{{ selectedNode.name }}</b></span>
          </div>
          <div v-else class="empty-selection">
            <el-icon :size="28" color="#c0c4cc"><InfoFilled /></el-icon>
            <p>请从左侧目录选择一个节点进行编辑</p>
          </div>

          <el-tabs v-if="selectedNode && currentData" v-model="activeTab" class="node-tabs">
            <el-tab-pane label="教学设计" name="design">
              <div class="design-card">
                <div class="design-header">
                  <div>
                    <div class="design-title">
                      <el-icon color="#409eff"><Reading /></el-icon>
                      <span>教学设计</span>
                    </div>
                    <div v-if="currentData.teachingDesignGroups.length > 0" class="design-groups">
                      <span class="group-label">所属分组：</span>
                      <el-tag
                        v-for="g in currentData.teachingDesignGroups"
                        :key="g.id"
                        size="small"
                        type="warning"
                        effect="light"
                        class="group-tag"
                        @click="openShareDialog"
                      >
                        {{ g.name }}（{{ relatedDesignNodeIds.length > 0 ? relatedDesignNodeIds.length + 1 : 1 }}）
                      </el-tag>
                    </div>
                  </div>
                  <el-button size="small" @click="openShareDialog">
                    <el-icon><CopyDocument /></el-icon> 复用教学设计
                  </el-button>
                </div>
                <!-- 教学设计内容改动需同步到同一复用分组的其他节点（对齐 React updateTeachingDesignContent） -->
                <el-input
                  :model-value="currentData.teachingDesignContent"
                  type="textarea"
                  :rows="12"
                  placeholder="请输入教学设计内容"
                  @update:model-value="updateTeachingDesignContent"
                />
              </div>
            </el-tab-pane>

            <el-tab-pane label="教学过程" name="process">
              <div v-for="cat in processCategories" :key="cat.key" class="process-category">
                <div class="category-header">
                  <h3>{{ cat.label }}</h3>
                  <el-button size="small" @click="openAddDialog(cat.key)">
                    <el-icon><Plus /></el-icon> 添加教学活动
                  </el-button>
                </div>
                <div class="module-grid">
                  <el-empty
                    v-if="categoryModules(cat.key).length === 0"
                    :description="`暂无${cat.label}教学活动，点击上方按钮添加`"
                    :image-size="60"
                  />
                  <div
                    v-for="key in categoryModules(cat.key)"
                    :key="key"
                    class="module-card"
                    :class="isModuleConfigured(key, currentData) ? 'configured' : 'unconfigured'"
                    @click="openModuleDialog(key)"
                  >
                    <div class="module-card-head">
                      <span class="module-icon" :class="isModuleConfigured(key, currentData) ? 'on' : 'off'">
                        <el-icon><component :is="ATOMIC_MODULES_BY_KEY[key].icon" /></el-icon>
                      </span>
                      <span class="module-label">{{ ATOMIC_MODULES_BY_KEY[key].label }}</span>
                      <el-tag size="small" :type="isModuleConfigured(key, currentData) ? 'success' : 'info'" effect="plain">
                        {{ isModuleConfigured(key, currentData) ? '已配置' : '未配置' }}
                      </el-tag>
                    </div>
                    <p class="module-summary" :class="isModuleConfigured(key, currentData) ? 'on' : 'off'">
                      {{ isModuleConfigured(key, currentData) ? getModuleSummary(key, currentData) : '尚未配置，点击卡片开始编辑' }}
                    </p>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="课后复盘" name="review">
              <div class="review-card">
                <div class="review-title">
                  <el-icon color="#409eff"><Tickets /></el-icon>
                  <span>课后复盘</span>
                </div>
                <el-input v-model="currentData.postLessonReviewContent" type="textarea" :rows="12" placeholder="请输入课后总结内容" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </el-card>

    <!-- 添加节点弹窗 -->
    <el-dialog v-model="nodeAddDialogOpen" :title="nodeAddParent ? '添加子节点' : '添加节点'" width="440px">
      <p v-if="nodeAddParent" class="dialog-hint">将在「{{ parentNodeName }}」下添加子节点</p>
      <el-form label-position="top">
        <el-form-item label="节点名称" required>
          <el-input v-model="nodeAddName" placeholder="请输入节点名称" maxlength="50" @keyup.enter="confirmNodeAdd" />
          <span class="char-count">{{ nodeAddName.length }} / 50</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nodeAddDialogOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!nodeAddName.trim()" @click="confirmNodeAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 编辑节点名称弹窗 -->
    <el-dialog v-model="nodeEditDialogOpen" title="编辑节点名称" width="440px">
      <el-form label-position="top">
        <el-form-item label="节点名称">
          <el-input v-model="nodeEditName" placeholder="请输入节点名称" maxlength="50" @keyup.enter="confirmNodeEdit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nodeEditDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmNodeEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加教学活动弹窗 -->
    <el-dialog v-model="addDialogOpen" :title="dialogTitle" width="640px" @closed="addDialogCategory = null">
      <el-empty v-if="dialogModules.length === 0" description="该分组下所有教学活动已挂载" :image-size="60" />
      <div v-else class="module-options">
        <div v-for="m in dialogModules" :key="m.key" class="module-option" @click="addModule(m.key)">
          <el-icon color="#409eff"><component :is="m.icon" /></el-icon>
          <span>{{ m.label }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 模块编辑弹窗 -->
    <el-dialog
      v-model="moduleDialogOpen"
      :title="editingModuleMeta?.label || ''"
      width="860px"
      top="5vh"
      class="module-dialog"
      @closed="editingModuleKey = null"
    >
      <div v-if="anyData" class="module-dialog-body">
        <!-- 课前预习 -->
        <template v-if="editingModuleKey === 'prePreview'">
          <el-input v-model="anyData.previewContent" type="textarea" :rows="6" placeholder="请输入课前预习内容" />
          <div class="editor-block">
            <div class="editor-label">预习资料附件</div>
            <div v-for="(item, i) in anyData.previewAttachments" :key="item.id" class="attachment-row">
              <el-input v-model="item.name" placeholder="附件名称" size="small" style="flex: 1" />
              <el-tag v-if="item.file" size="small" type="info">{{ resourceFileName(item.file) }}</el-tag>
              <span v-else class="muted">未选择资料</span>
              <el-button size="small" @click="triggerAttachmentUpload(item.id)">选择资料</el-button>
              <el-button size="small" text type="danger" @click="removeAttachment(anyData.previewAttachments, i)">删除</el-button>
            </div>
            <el-button size="small" @click="addAttachment('previewAttachments')">
              <el-icon><Plus /></el-icon> 添加附件
            </el-button>
          </div>
        </template>

        <!-- 学习资源 / 拓展资料：资源选择器 -->
        <template v-if="editingModuleKey === 'preResources' || editingModuleKey === 'extensionMaterials'">
          <div class="picker-toolbar">
            <el-select v-model="resourceTypeFilter" size="small" style="width: 120px">
              <el-option v-for="(label, key) in RESOURCE_TYPE_SHORT_LABELS" :key="key" :label="label" :value="key" />
            </el-select>
            <el-input v-model="resourceSearch" size="small" placeholder="搜索资源名称" clearable style="flex: 1" />
            <el-button size="small" :loading="resourceUploading" @click="resourceInputRef?.click()">上传资源</el-button>
            <input ref="resourceInputRef" type="file" class="hidden-input" @change="onResourceUploadFile" />
          </div>
          <div class="picker-list">
            <div
              v-for="r in filteredResourcePool"
              :key="r.id"
              class="picker-item"
              :class="{ selected: isResourceSelected(r.id) }"
              @click="toggleResource(r.id)"
            >
              <el-icon :color="isResourceSelected(r.id) ? '#409eff' : '#909399'">
                <component :is="resourceTypeIcon(r.type)" />
              </el-icon>
              <div class="picker-item-info">
                <p>{{ r.name }}</p>
                <p class="muted">{{ r.type }}</p>
              </div>
              <el-icon v-if="isResourceSelected(r.id)" color="#409eff"><Checked /></el-icon>
            </div>
            <el-empty v-if="filteredResourcePool.length === 0" description="暂无资源" :image-size="50" />
          </div>
        </template>

        <!-- 任务列表（课前任务/课堂任务/实践任务） -->
        <template v-if="editingModuleKey === 'preTasks' || editingModuleKey === 'inClassTasks' || editingModuleKey === 'practiceTasks'">
          <div v-for="(task, idx) in taskList" :key="task.id" class="task-card">
            <template v-if="task.source === 'scenario'">
              <div class="task-head">
                <el-icon color="#1890ff"><Coin /></el-icon>
                <div>
                  <p>{{ task.scenarioTitle || task.name }}</p>
                  <p class="muted">来自实践场景库</p>
                </div>
                <el-button size="small" text type="danger" @click="removeTask(idx)">删除</el-button>
              </div>
            </template>
            <template v-else>
              <div class="task-head">
                <el-input v-model="task.name" placeholder="任务名称" size="small" style="flex: 1" />
                <el-button size="small" text type="danger" @click="removeTask(idx)">删除</el-button>
              </div>
              <el-input v-model="task.requirement" type="textarea" :rows="3" placeholder="任务要求" />
              <div class="editor-block">
                <div class="editor-label">任务附件</div>
                <div v-for="(att, ai) in task.attachments" :key="att.id" class="attachment-row">
                  <el-input v-model="att.name" placeholder="附件名称" size="small" style="flex: 1" />
                  <el-tag v-if="att.file" size="small" type="info">{{ resourceFileName(att.file) }}</el-tag>
                  <span v-else class="muted">未选择资料</span>
                  <el-button size="small" @click="triggerAttachmentUpload(att.id)">选择资料</el-button>
                  <el-button size="small" text type="danger" @click="removeAttachment(task.attachments, ai)">删除</el-button>
                </div>
                <el-button size="small" @click="addTaskAttachment(task)">
                  <el-icon><Plus /></el-icon> 上传附件
                </el-button>
              </div>
            </template>
          </div>
          <el-button size="small" @click="addTask">
            <el-icon><Plus /></el-icon> {{ taskAddLabel }}
          </el-button>
        </template>

        <!-- 测评方式 + 评价规则（课前测验/随堂测验/课后作业） -->
        <template v-if="evalFields && anyData">
          <div class="editor-block">
            <div class="editor-label">
              <el-icon color="#1890ff"><Tickets /></el-icon> 配置课程测评方式
            </div>
            <div class="eval-tabs">
              <el-button
                v-for="tab in evalPrimaryOptions"
                :key="tab.key"
                :type="evalPrimaryTab === tab.key ? 'primary' : 'default'"
                size="small"
                round
                @click="setEvalPrimaryTab(tab.key)"
              >
                {{ tab.label }}
              </el-button>
            </div>
            <div class="eval-subtabs">
              <el-button
                v-for="tab in SECONDARY_TABS[evalPrimaryTab]"
                :key="tab"
                size="small"
                :class="evalSecondaryTab === tab ? 'subtab-active' : ''"
                @click="evalSecondaryTab = tab"
              >
                {{ tab }}
              </el-button>
            </div>
            <div class="eval-grid">
              <div
                v-for="m in filteredEvalMethods"
                :key="m.key"
                class="eval-method-card"
                :class="{ selected: anyData[evalFields.methodsField].includes(m.key), disabled: !m.available }"
                @click="toggleEvalMethod(m, evalFields.methodsField, evalFields.rulesField)"
              >
                <div class="eval-method-head">
                  <span class="eval-method-icon"><el-icon><component :is="m.icon" /></el-icon></span>
                  <div>
                    <p>{{ m.label }}</p>
                    <p class="muted">{{ m.desc }}</p>
                  </div>
                </div>
                <el-tag v-if="anyData[evalFields.methodsField].includes(m.key)" size="small" type="success">已开通</el-tag>
                <el-tag v-else-if="!m.available" size="small" type="info">未开通</el-tag>
              </div>
            </div>
          </div>

          <div v-if="anyData[evalFields.methodsField].length > 0" class="editor-block">
            <div class="editor-label">
              <el-icon color="#1890ff"><Medal /></el-icon> 配置课程评价规则
            </div>
            <div class="rule-weights">
              <div v-for="m in anyData[evalFields.methodsField]" :key="m" class="weight-row">
                <span class="rule-label">{{ methodLabel(m) }}</span>
                <el-input-number
                  :model-value="anyData[evalFields.rulesField].methodWeights?.[m] ?? 0"
                  :min="0"
                  :max="100"
                  size="small"
                  @update:model-value="setMethodWeight(anyData[evalFields.rulesField], m, $event)"
                />
                <span>%</span>
              </div>
              <el-button size="small" @click="distributeWeights(evalFields.rulesField)">均分权重</el-button>
            </div>
            <div class="rule-row">
              <span class="rule-label">评价对象</span>
              <el-radio-group v-model="anyData[evalFields.rulesField].evalObject">
                <el-radio value="individual">个人评价</el-radio>
                <el-radio value="group">小组评价</el-radio>
              </el-radio-group>
            </div>
            <div class="rule-row">
              <span class="rule-label">评价主体</span>
              <div class="subject-list">
                <div v-for="s in anyData[evalFields.rulesField].evalSubjects" :key="s.type" class="subject-row">
                  <el-checkbox v-model="s.enabled">{{ SUBJECT_LABELS[s.type] || s.type }}</el-checkbox>
                  <el-input-number
                    :model-value="s.params?.weightPercent ?? 0"
                    :min="0"
                    :max="100"
                    size="small"
                    :disabled="!s.enabled"
                    @update:model-value="setSubjectWeight(s, $event)"
                  />
                </div>
              </div>
            </div>
            <div class="rule-row">
              <span class="rule-label">评价点</span>
              <el-select v-model="evalPointMethod" size="small" style="width: 180px">
                <el-option v-for="m in anyData[evalFields.methodsField]" :key="m" :label="methodLabel(m)" :value="m" />
              </el-select>
            </div>
            <div class="eval-points">
              <div v-for="(p, i) in evalPointList" :key="p.id" class="eval-point-row">
                <el-input v-model="p.name" size="small" placeholder="评价点名称" style="flex: 1" />
                <el-input v-model="p.desc" size="small" placeholder="描述" style="flex: 1" />
                <el-input-number v-model="p.weight" :min="0" :max="100" size="small" />
                <el-button size="small" text type="danger" @click="removeEvalPoint(i)">删除</el-button>
              </div>
              <el-button size="small" @click="addEvalPoint">
                <el-icon><Plus /></el-icon> 添加评价点
              </el-button>
            </div>
          </div>
        </template>

        <!-- 课堂讲授 -->
        <template v-if="editingModuleKey === 'lecture'">
          <el-empty v-if="anyData.lectureSections.length === 0" description="暂无讲授环节，点击下方按钮新增" :image-size="60" />
          <div v-for="(section, idx) in anyData.lectureSections" :key="section.id" class="task-card">
            <div class="task-head">
              <el-input v-model="section.name" placeholder="环节名称" size="small" style="flex: 1" />
              <el-button size="small" text type="danger" @click="anyData.lectureSections.splice(idx, 1)">删除</el-button>
            </div>
            <el-input v-model="section.content" type="textarea" :rows="3" placeholder="请输入环节讲授内容" />
            <div class="editor-block">
              <div class="editor-label">环节附件</div>
              <div v-for="(att, ai) in section.attachments" :key="att.id" class="attachment-row">
                <el-input v-model="att.name" placeholder="附件名称" size="small" style="flex: 1" />
                <el-tag v-if="att.file" size="small" type="info">{{ resourceFileName(att.file) }}</el-tag>
                <span v-else class="muted">未选择资料</span>
                <el-button size="small" @click="triggerAttachmentUpload(att.id)">选择资料</el-button>
                <el-button size="small" text type="danger" @click="removeAttachment(section.attachments, ai)">删除</el-button>
              </div>
              <el-button size="small" @click="addSectionAttachment(section)">
                <el-icon><Plus /></el-icon> 上传附件
              </el-button>
            </div>
          </div>
          <el-button size="small" @click="addLectureSection">
            <el-icon><Plus /></el-icon> 新增环节
          </el-button>
        </template>

        <!-- 课堂提问 -->
        <template v-if="editingModuleKey === 'classQuestions'">
          <div v-for="(q, idx) in anyData.classQuestions" :key="q.id" class="task-card">
            <template v-if="q.source === 'bank'">
              <div class="task-head">
                <el-icon color="#1890ff"><Coin /></el-icon>
                <div>
                  <p>{{ q.bankTitle || q.stem }}</p>
                  <p class="muted">来自题库</p>
                </div>
                <el-button size="small" text type="danger" @click="anyData.classQuestions.splice(idx, 1)">删除</el-button>
              </div>
            </template>
            <template v-else>
              <div class="task-head">
                <el-input v-model="q.stem" placeholder="问题内容" size="small" style="flex: 1" />
                <el-button size="small" text type="danger" @click="anyData.classQuestions.splice(idx, 1)">删除</el-button>
              </div>
              <el-input v-model="q.answer" placeholder="参考答案" size="small" />
            </template>
          </div>
          <el-button size="small" @click="addClassQuestion">
            <el-icon><Plus /></el-icon> 添加提问
          </el-button>
        </template>

        <!-- 实训报告 -->
        <template v-if="editingModuleKey === 'trainingReports'">
          <div v-for="(report, idx) in anyData.trainingReports" :key="report.id" class="task-card">
            <div class="task-head">
              <el-input v-model="report.name" placeholder="报告名称" size="small" style="flex: 1" />
              <el-switch v-model="report.required" size="small" />
              <span class="mode-label">必修</span>
              <el-button size="small" text type="danger" @click="anyData.trainingReports.splice(idx, 1)">删除</el-button>
            </div>
            <el-input v-model="report.template" type="textarea" :rows="2" placeholder="报告模板" />
            <el-input v-model="report.requirement" type="textarea" :rows="2" placeholder="报告要求" />
            <div class="editor-block">
              <div class="editor-label">报告附件</div>
              <div v-for="(att, ai) in report.attachments" :key="att.id" class="attachment-row">
                <el-input v-model="att.name" placeholder="附件名称" size="small" style="flex: 1" />
                <el-tag v-if="att.file" size="small" type="info">{{ resourceFileName(att.file) }}</el-tag>
                <span v-else class="muted">未选择资料</span>
                <el-button size="small" @click="triggerAttachmentUpload(att.id)">选择资料</el-button>
                <el-button size="small" text type="danger" @click="removeAttachment(report.attachments, ai)">删除</el-button>
              </div>
              <el-button size="small" @click="addReportAttachment(report)">
                <el-icon><Plus /></el-icon> 上传附件
              </el-button>
            </div>
          </div>
          <el-button size="small" @click="addReportItem">
            <el-icon><Plus /></el-icon> 添加报告
          </el-button>
        </template>
      </div>
      <template #footer>
        <div class="module-dialog-footer">
          <div class="footer-left">
            <el-switch v-model="moduleModeOnline" />
            <span class="mode-label">{{ moduleModeOnline ? '线上' : '线下' }}</span>
            <el-button text type="danger" @click="removeModuleFromDialog">删除</el-button>
          </div>
          <div>
            <el-button @click="moduleDialogOpen = false">取消</el-button>
            <el-button type="primary" @click="moduleDialogOpen = false">完成</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 教学设计复用分组弹窗 -->
    <el-dialog v-model="shareDialogOpen" title="教学设计复用分组" width="720px" @closed="resetShareDialog">
      <div class="share-body">
        <div class="share-new">
          <el-input v-model="newGroupName" placeholder="输入新分组名称（如：共用教学设计）" size="small" style="flex: 1" @keyup.enter="createShareGroup" />
          <el-button size="small" type="primary" :disabled="!newGroupName.trim()" @click="createShareGroup">
            <el-icon><Plus /></el-icon> 新建分组
          </el-button>
        </div>
        <el-empty v-if="allShareGroups.length === 0" description="尚未创建分组" :image-size="60" />
        <div v-for="g in allShareGroups" :key="g.id" class="share-group">
          <div class="share-group-head">
            <template v-if="renamingGroupId === g.id">
              <el-input v-model="renameValue" size="small" style="flex: 1" @keyup.enter="renameShareGroup(g.id)" />
              <el-button size="small" :disabled="!renameValue.trim()" @click="renameShareGroup(g.id)">保存</el-button>
              <el-button size="small" @click="renamingGroupId = null; renameValue = ''">取消</el-button>
            </template>
            <template v-else>
              <div class="share-group-title">
                <span>{{ g.name }}</span>
                <el-tag size="small" type="info" effect="plain">{{ g.members.length }} 个节点</el-tag>
              </div>
              <div class="share-group-actions">
                <el-button size="small" text @click="renamingGroupId = g.id; renameValue = g.name">重命名分组</el-button>
                <el-button size="small" text @click="openAddMember(g.id, g.name)">
                  <el-icon><Plus /></el-icon> 加入复用分组
                </el-button>
                <template v-if="disbandGroupId === g.id">
                  <el-button size="small" type="danger" @click="disbandShareGroup(g.id)">确认删除</el-button>
                  <el-button size="small" @click="disbandGroupId = ''">取消</el-button>
                </template>
                <el-button v-else size="small" text type="danger" @click="disbandGroupId = g.id">删除分组</el-button>
              </div>
            </template>
          </div>
          <div class="share-group-members">
            <el-tag v-for="m in g.members" :key="m.id" size="small" closable @close="removeGroupMember(g.id, m.id)">{{ m.name }}</el-tag>
            <span v-if="g.members.length === 0" class="muted">暂无成员</span>
          </div>
          <div v-if="addMemberGroupId === g.id" class="share-add-members">
            <p class="muted">
              勾选节点加入「{{ g.name }}」，加入后与组内节点教学设计同步{{ candidateNodes(g).length === 0 ? '（所有节点均已在该组中）' : '' }}
            </p>
            <div v-if="candidateNodes(g).length > 0" class="candidate-list">
              <div
                v-for="n in candidateNodes(g)"
                :key="n.id"
                class="candidate-item"
                :class="{ selected: addMemberSelectedIds.includes(n.id) }"
                @click="toggleAddMember(n.id)"
              >
                <el-checkbox :model-value="addMemberSelectedIds.includes(n.id)" @click.stop @change="toggleAddMember(n.id)" />
                <span>{{ n.name }}</span>
              </div>
            </div>
            <div v-if="candidateNodes(g).length > 0" class="share-add-actions">
              <el-button size="small" @click="addMemberGroupId = ''; addMemberSelectedIds = []">取消</el-button>
              <el-button
                size="small"
                type="primary"
                :disabled="addMemberSelectedIds.length === 0"
                @click="confirmAddMembers"
              >
                确认加入（{{ addMemberSelectedIds.length }}）
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 关联能力点弹窗 -->
    <el-dialog v-model="abilityDialogOpen" title="关联能力点" width="520px">
      <el-input v-model="abilitySearch" placeholder="搜索能力点名称、编码、描述" clearable size="small" class="ability-search" />
      <div class="ability-list">
        <el-empty v-if="filteredAbilityPool.length === 0 && !abilityAdding" description="未找到匹配的能力点" :image-size="50" />
        <div
          v-for="ap in filteredAbilityPool"
          :key="ap.id"
          class="ability-item"
          :class="{ selected: isAbilitySelected(ap.id) }"
          @click="toggleAbilityPoint(ap)"
        >
          <el-icon :color="isAbilitySelected(ap.id) ? '#409eff' : '#c0c4cc'">
            <Checked v-if="isAbilitySelected(ap.id)" />
          </el-icon>
          <div class="ability-item-info">
            <p>{{ ap.name }}</p>
            <p v-if="ap.code" class="muted">{{ ap.code }}</p>
            <p v-if="ap.description" class="muted truncate">{{ ap.description }}</p>
          </div>
        </div>
      </div>
      <template v-if="abilityAdding">
        <div class="ability-add-form">
          <el-input v-model="abilityNewName" placeholder="名称" size="small" />
          <el-input v-model="abilityNewDesc" placeholder="描述（可选）" size="small" />
          <div class="share-add-actions">
            <el-button size="small" @click="abilityAdding = false">取消</el-button>
            <el-button size="small" type="primary" :disabled="!abilityNewName.trim()" @click="addCustomAbility">添加</el-button>
          </div>
        </div>
      </template>
      <div v-else class="ability-add-link">
        <el-button size="small" text type="primary" @click="abilityAdding = true">
          <el-icon><Plus /></el-icon> 自定义能力点
        </el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="abilityDialogOpen = false">完成</el-button>
      </template>
    </el-dialog>

    <!-- 隐藏文件输入（附件/封面/PDF/资源上传共用） -->
    <input ref="fileInputRef" type="file" class="hidden-input" @change="onAttachmentFile" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { courseApi, courseNodeApi, lessonBatchApi } from '@/api/lesson';
import { abilityApi } from '@/api/job';
import { resourceLibraryApi } from '@/api/library';
import { fileApi } from '@/api/import-export';
import { majorApi } from '@/api/system';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { Course, SystemCourseNode } from '@/types/lesson';
import { RESOURCE_TYPE_SHORT_LABELS } from '@/types/library';

/* ==================== 常量与类型（对齐 React hybrid/add） ==================== */

const COURSE_CATEGORIES = [
  '公共基础必修课程',
  '公共基础限选课程',
  '公共基础任选课程',
  '专业基础课程',
  '专业核心课程',
  '专业拓展课程'
] as const;
type CourseCategory = (typeof COURSE_CATEGORIES)[number];

interface CourseBasicForm {
  name: string;
  code: string;
  majorId: string;
  majorName: string;
  semester: string;
  category: CourseCategory;
  courseObjectives: string;
  detailedDescription: string;
  background: string;
  estimatedHours: string;
  coverImage: string;
}

interface AttachmentItem {
  id: string;
  name: string;
  file: string;
}

interface LectureSectionItem {
  id: string;
  name: string;
  content: string;
  attachments: AttachmentItem[];
}

interface TaskItem {
  id: string;
  name: string;
  requirement: string;
  attachments: AttachmentItem[];
  source?: 'manual' | 'scenario';
  scenarioId?: string;
  scenarioTitle?: string;
}

interface QuestionOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'judge' | 'essay';
  stem: string;
  options: QuestionOption[];
  answer: string;
}

interface QuizItem {
  id: string;
  name: string;
  questions: QuizQuestion[];
}

interface ClassroomQuestion {
  id: string;
  stem: string;
  answer: string;
  source?: 'manual' | 'bank';
  bankId?: string;
  bankTitle?: string;
}

interface HomeworkItem {
  id: string;
  requirement: string;
  allowText: boolean;
  allowAttachment: boolean;
  deadline: string;
}

interface ResourceItem {
  id: string;
  name: string;
  type: string;
  source?: string;
  url?: string;
  description?: string;
  thumbnail?: string;
}

interface ReportItem {
  id: string;
  name: string;
  template: string;
  requirement: string;
  required: boolean;
  attachments: AttachmentItem[];
}

type AtomicModuleCategory = 'pre-class' | 'in-class' | 'post-class';

type AtomicModuleKey =
  | 'prePreview'
  | 'preResources'
  | 'preTasks'
  | 'preQuizzes'
  | 'lecture'
  | 'inClassTasks'
  | 'inClassQuizzes'
  | 'classQuestions'
  | 'practiceTasks'
  | 'homeworks'
  | 'extensionMaterials'
  | 'trainingReports';

interface NodeModuleData {
  form: CourseBasicForm;
  teachingDesignContent: string;
  postLessonReviewContent: string;
  teachingDesignGroups: { id: string; name: string }[];
  moduleModes: Partial<Record<AtomicModuleKey, 'online' | 'offline'>>;
  previewContent: string;
  previewAttachments: AttachmentItem[];
  preClassResources: ResourceItem[];
  preClassTasks: TaskItem[];
  preClassQuizzes: QuizItem[];
  preQuizEvalMethods: string[];
  preQuizEvalRules?: EvalRuleConfig;
  lectureContent: string;
  lectureResources: ResourceItem[];
  lectureSections: LectureSectionItem[];
  inClassTasks: TaskItem[];
  inClassQuizzes: QuizItem[];
  inClassQuizEvalMethods: string[];
  inClassQuizEvalRules?: EvalRuleConfig;
  classQuestions: ClassroomQuestion[];
  practiceTasks: TaskItem[];
  homeworks: HomeworkItem[];
  homeworkEvalMethods: string[];
  homeworkEvalRules?: EvalRuleConfig;
  extensionMaterials: ResourceItem[];
  trainingReports: ReportItem[];
}

interface AtomicModuleMeta {
  key: AtomicModuleKey;
  label: string;
  category: AtomicModuleCategory;
  icon: string;
}

interface HybridNodeModule {
  id: string;
  nodeId: string;
  moduleKey: string;
  mode: 'online' | 'offline';
  data?: Record<string, any>;
}

interface HybridModulePayload {
  moduleKey: string;
  mode: 'online' | 'offline';
  data: Record<string, any>;
}

interface EvalRulePoint {
  id: string;
  name: string;
  desc: string;
  weight?: number;
}

interface EvalRuleSubjectConfig {
  type: string;
  enabled: boolean;
  params?: Record<string, any>;
}

interface EvalRuleConfig {
  evaluationMethods: string[];
  disabledEvaluationMethods?: string[];
  methodWeights: Record<string, number>;
  evalObject: 'individual' | 'group';
  methodEvalObjects?: Record<string, string>;
  evalSubjects: EvalRuleSubjectConfig[];
  methodEvalSubjects?: Record<string, EvalRuleSubjectConfig[]>;
  gradeMapping?: { id: string; grade: string; minScore: number; maxScore: number; color?: string; remark?: string }[];
  methodResourceConfigs?: Record<string, Record<string, any>>;
  [key: string]: any;
}

interface AbilityPointItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

interface EvalMethodOption {
  key: string;
  label: string;
  icon: string;
  color: string;
  available: boolean;
  desc: string;
  primaryCategory: 'platform' | 'industry';
  secondaryCategory: string;
}

interface ClaimSession {
  week: number;
  weekday: string;
  period: string;
  venue?: string;
}

interface ClaimPayload {
  course?: string;
  teacher?: string;
  className?: string;
  sessions: ClaimSession[];
}

interface TreeRow {
  node: SystemCourseNode;
  level: number;
  seq: string;
}

const FIRST_NODE_ID = 'hybrid-node-1';
const TEACHING_DESIGN_KEY = 'teachingDesign';
const POST_LESSON_REVIEW_KEY = 'postLessonReview';
const POST_REVIEW_DEFAULT = '请输入课后总结内容';

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// 分页全量拉取：后端列表接口 limit 上限 200，客户端分页合并避免静默截断（对齐 fetchAllPages）
async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  pageSize = 200,
  maxPages = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    if (page >= maxPages) {
      throw new Error('fetchAllPages: 超过最大页数，疑似分页未生效，已中止');
    }
    const res = await fetcher(page, pageSize);
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

function createDefaultNodeModuleData(existing?: {
  name?: string;
  code?: string;
  majorId?: string;
  majorName?: string;
  semester?: string;
  category?: CourseCategory;
  coverImage?: string;
}): NodeModuleData {
  const incomingCategory = existing?.category;
  const category: CourseCategory =
    incomingCategory && COURSE_CATEGORIES.includes(incomingCategory) ? incomingCategory : '专业核心课程';
  const ts = Date.now().toString();
  return {
    form: {
      name: existing?.name ?? '',
      code: existing?.code ?? `HYB-${ts.slice(-6)}`,
      majorId: existing?.majorId ?? '',
      majorName: existing?.majorName ?? '',
      semester: existing?.semester ?? '2026-2027-1',
      category,
      courseObjectives: '',
      detailedDescription: '',
      background: '',
      estimatedHours: '',
      coverImage: ''
    },
    teachingDesignContent: `● 知识目标
● 能力目标
● 素质目标
● 教学重点
● 教学难点
● 教学方法
● 考核方式`,
    postLessonReviewContent: POST_REVIEW_DEFAULT,
    teachingDesignGroups: [],
    moduleModes: {},
    previewContent: '',
    previewAttachments: [],
    preClassResources: [],
    preClassTasks: [],
    preClassQuizzes: [],
    preQuizEvalMethods: [],
    lectureContent: '',
    lectureResources: [],
    lectureSections: [],
    inClassTasks: [],
    inClassQuizzes: [],
    inClassQuizEvalMethods: [],
    classQuestions: [],
    practiceTasks: [],
    homeworks: [],
    homeworkEvalMethods: [],
    extensionMaterials: [],
    trainingReports: []
  };
}

const ATOMIC_MODULES: AtomicModuleMeta[] = [
  { key: 'prePreview', label: '课前预习', category: 'pre-class', icon: 'Reading' },
  { key: 'preResources', label: '学习资源', category: 'pre-class', icon: 'Coin' },
  { key: 'preTasks', label: '课前任务', category: 'pre-class', icon: 'List' },
  { key: 'preQuizzes', label: '课前测验', category: 'pre-class', icon: 'QuestionFilled' },
  { key: 'lecture', label: '课堂讲授', category: 'in-class', icon: 'VideoPlay' },
  { key: 'inClassTasks', label: '课堂任务', category: 'in-class', icon: 'List' },
  { key: 'inClassQuizzes', label: '随堂测验', category: 'in-class', icon: 'Checked' },
  { key: 'classQuestions', label: '课堂提问', category: 'in-class', icon: 'ChatDotRound' },
  { key: 'practiceTasks', label: '实践任务', category: 'in-class', icon: 'Tools' },
  { key: 'homeworks', label: '课后作业', category: 'post-class', icon: 'Document' },
  { key: 'extensionMaterials', label: '拓展资料', category: 'post-class', icon: 'FolderOpened' },
  { key: 'trainingReports', label: '实训报告', category: 'post-class', icon: 'Memo' }
];

const ATOMIC_MODULES_BY_KEY = Object.fromEntries(ATOMIC_MODULES.map((m) => [m.key, m])) as Record<
  AtomicModuleKey,
  AtomicModuleMeta
>;

const DEFAULT_MODULES: AtomicModuleKey[] = [];

/* ==================== 测评方式与评价规则 ==================== */

const EVALUATION_METHOD_OPTIONS: EvalMethodOption[] = [
  { key: 'question_bank', label: '题库', icon: 'Coin', color: 'orange', available: true, desc: '从题库选题组成测评资源', primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'paper', label: '试卷', icon: 'Tickets', color: 'green', available: true, desc: '使用固定试卷进行考核', primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'quiz', label: '随堂测', icon: 'QuestionFilled', color: 'red', available: true, desc: '课堂即时测验', primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'random_draw', label: '现场问答', icon: 'ChatLineRound', color: 'blue', available: true, desc: '从题库抽取题目，教师现场提问', primaryCategory: 'platform', secondaryCategory: '过程评价' },
  { key: 'review', label: '现场评审', icon: 'Stamp', color: 'purple', available: true, desc: '教师根据表现/材料给评价点打分', primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'outcome', label: '成果评价', icon: 'FolderChecked', color: 'cyan', available: true, desc: '对学生成果进行评价', primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'homework', label: '作业', icon: 'EditPen', color: 'pink', available: true, desc: '学生提交作业进行评价', primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'wms_inbound', label: 'WMS(入库单)自动化评分', icon: 'Box', color: 'indigo', available: false, desc: '基于 WMS 入库单操作的自动化评分', primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'wms_outbound', label: 'WMS(出库单)自动化评分', icon: 'Box', color: 'indigo', available: false, desc: '基于 WMS 出库单操作的自动化评分', primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'wms_wave', label: 'WMS(波次分拣)自动化评分', icon: 'Box', color: 'indigo', available: false, desc: '基于 WMS 波次分拣操作的自动化评分', primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'network_traffic', label: '网络流量分析自助评价', icon: 'Lock', color: 'emerald', available: false, desc: '基于网络流量分析的自助评价', primaryCategory: 'industry', secondaryCategory: '网络安全' },
  { key: 'cyber_range', label: '网络靶场自助评价', icon: 'Lock', color: 'emerald', available: false, desc: '基于网络靶场环境的自助评价', primaryCategory: 'industry', secondaryCategory: '网络安全' }
];

const methodLabel = (key: string) => EVALUATION_METHOD_OPTIONS.find((o) => o.key === key)?.label || key;

const SUBJECT_LABELS: Record<string, string> = {
  teacher: '教师',
  enterprise_mentor: '企业导师',
  peer: '同伴互评',
  self: '自我评价',
  ai: 'AI 评价',
  service_target: '服务对象评价'
};

const DEFAULT_EVAL_RULE_GRADE_MAPPING = [
  { id: 'grade-1', grade: 'A', minScore: 90, maxScore: 100, color: 'bg-green-500', remark: '表现卓越' },
  { id: 'grade-2', grade: 'B', minScore: 75, maxScore: 89, color: 'bg-blue-500', remark: '表现良好' },
  { id: 'grade-3', grade: 'C', minScore: 60, maxScore: 74, color: 'bg-yellow-500', remark: '基本达标' },
  { id: 'grade-4', grade: 'D', minScore: 0, maxScore: 59, color: 'bg-red-500', remark: '未达标' }
];

const DEFAULT_EVAL_RULE_SUBJECTS: EvalRuleSubjectConfig[] = [
  { type: 'teacher', enabled: true, params: { teacherBackground: '计算机/软件工程相关专业', scorerCount: 2, weightPercent: 50, scoringDimensions: ['knowledge_mastery', 'operation_standard', 'task_completion', 'result_quality'], minTeachingYears: 3 } },
  { type: 'enterprise_mentor', enabled: true, params: { expertise: '网络安全 / 渗透测试', minYears: 5, scorerCount: 1, weightPercent: 20, companyType: '互联网/科技公司' } },
  { type: 'self', enabled: true, params: { requiresReflection: true, weightPercent: 10, reflectionMinLength: 500 } },
  { type: 'peer', enabled: false, params: { peerCount: 4, peerRule: '随机分配', anonymous: true, weightPercent: 15 } },
  { type: 'ai', enabled: false, params: { aiModel: 'GPT-4', weightPercent: 5, confidenceThreshold: 85, autoReview: true } },
  { type: 'service_target', enabled: false, params: { serviceMethod: '满意度问卷', sampleSize: 20, weightPercent: 5 } }
];

function makeDefaultEvalRuleConfig(methods: string[]): EvalRuleConfig {
  const count = methods.length;
  const methodWeights: Record<string, number> = {};
  methods.forEach((m, i) => {
    methodWeights[m] = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0;
  });
  return {
    evaluationMethods: methods,
    disabledEvaluationMethods: [],
    methodWeights,
    evalObject: 'individual',
    methodEvalObjects: {},
    evalSubjects: JSON.parse(JSON.stringify(DEFAULT_EVAL_RULE_SUBJECTS)),
    methodEvalSubjects: {},
    gradeMapping: JSON.parse(JSON.stringify(DEFAULT_EVAL_RULE_GRADE_MAPPING)),
    methodResourceConfigs: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: 'eval_points',
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: 'eval_points',
    reviewRubricId: null,
    reviewSteps: [],
    paperIds: [],
    paperWeights: {},
    paperEvalPoints: [],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: 'eval_points',
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: 'eval_points',
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: []
  };
}

function mergeEvalRuleMethods(config: EvalRuleConfig, nextMethods: string[]): EvalRuleConfig {
  const next: EvalRuleConfig = { ...config, methodWeights: { ...config.methodWeights } };
  next.evaluationMethods = nextMethods;
  const current = new Set(config.evaluationMethods);
  const added = nextMethods.filter((m) => !current.has(m));
  if (added.length > 0) {
    const remaining = Math.max(100 - nextMethods.filter((m) => !added.includes(m)).reduce((s, m) => s + (next.methodWeights[m] || 0), 0), 0);
    const base = Math.floor(remaining / added.length);
    added.forEach((m, i) => {
      next.methodWeights[m] = base + (i < remaining - base * added.length ? 1 : 0);
    });
  }
  const total = nextMethods.reduce((s, m) => s + (next.methodWeights[m] || 0), 0);
  if (total !== 100 && nextMethods.length > 0) {
    const base = Math.floor(100 / nextMethods.length);
    const remainder = 100 % nextMethods.length;
    nextMethods.forEach((m, i) => {
      next.methodWeights[m] = base + (i < remainder ? 1 : 0);
    });
  }
  return next;
}

const EVAL_POINT_FIELD: Record<string, string> = {
  random_draw: 'randomDrawEvalPoints',
  review: 'reviewEvalPoints',
  paper: 'paperEvalPoints',
  question_bank: 'questionBankEvalPoints',
  outcome: 'outcomeEvalPoints',
  homework: 'homeworkEvalPoints',
  quiz: 'quizEvalPoints'
};

/* ==================== 模块序列化（对齐 module-serialize.ts） ==================== */

function moduleDataFor(key: AtomicModuleKey, d: NodeModuleData): Record<string, any> {
  switch (key) {
    case 'prePreview':
      return { content: d.previewContent, attachments: d.previewAttachments };
    case 'preResources':
      return { resources: d.preClassResources };
    case 'preTasks':
      return { tasks: d.preClassTasks };
    case 'preQuizzes':
      return { evalMethods: d.preQuizEvalMethods, evalRules: d.preQuizEvalRules };
    case 'lecture':
      return { content: d.lectureContent, resources: d.lectureResources, sections: d.lectureSections };
    case 'inClassTasks':
      return { tasks: d.inClassTasks };
    case 'inClassQuizzes':
      return { evalMethods: d.inClassQuizEvalMethods, evalRules: d.inClassQuizEvalRules };
    case 'classQuestions':
      return { questions: d.classQuestions };
    case 'practiceTasks':
      return { tasks: d.practiceTasks };
    case 'homeworks':
      return { evalMethods: d.homeworkEvalMethods, evalRules: d.homeworkEvalRules, items: d.homeworks };
    case 'extensionMaterials':
      return { resources: d.extensionMaterials };
    case 'trainingReports':
      return { reports: d.trainingReports };
    default:
      return {};
  }
}

function isEmptyData(data: Record<string, any>): boolean {
  return Object.values(data).every((v) => {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'string') return v === '';
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  });
}

function buildModulesForNode(d: NodeModuleData, moduleKeys: AtomicModuleKey[]): HybridModulePayload[] {
  const modules: HybridModulePayload[] = [];
  if (d.teachingDesignContent || (d.teachingDesignGroups || []).length > 0) {
    modules.push({
      moduleKey: TEACHING_DESIGN_KEY,
      mode: 'offline',
      data: { content: d.teachingDesignContent, groups: d.teachingDesignGroups || [] }
    });
  }
  if (d.postLessonReviewContent && d.postLessonReviewContent !== POST_REVIEW_DEFAULT) {
    modules.push({
      moduleKey: POST_LESSON_REVIEW_KEY,
      mode: 'offline',
      data: { content: d.postLessonReviewContent }
    });
  }
  moduleKeys.forEach((key) => {
    const data = moduleDataFor(key, d);
    if (isEmptyData(data)) return;
    modules.push({ moduleKey: key, mode: d.moduleModes?.[key] || 'offline', data });
  });
  return modules;
}

function applyModuleData(d: NodeModuleData, m: { moduleKey: string; data?: Record<string, any> }): NodeModuleData {
  const data = m.data || {};
  switch (m.moduleKey) {
    case TEACHING_DESIGN_KEY:
      d.teachingDesignContent = data.content || '';
      d.teachingDesignGroups = Array.isArray(data.groups) ? data.groups : [];
      break;
    case POST_LESSON_REVIEW_KEY:
      d.postLessonReviewContent = data.content || '';
      break;
    case 'prePreview':
      d.previewContent = data.content || '';
      d.previewAttachments = data.attachments || [];
      break;
    case 'preResources':
      d.preClassResources = data.resources || [];
      break;
    case 'preTasks':
      d.preClassTasks = data.tasks || [];
      break;
    case 'preQuizzes':
      d.preQuizEvalMethods = data.evalMethods || [];
      d.preQuizEvalRules = data.evalRules;
      break;
    case 'lecture':
      d.lectureContent = data.content || '';
      d.lectureResources = data.resources || [];
      d.lectureSections = data.sections || [];
      break;
    case 'inClassTasks':
      d.inClassTasks = data.tasks || [];
      break;
    case 'inClassQuizzes':
      d.inClassQuizEvalMethods = data.evalMethods || [];
      d.inClassQuizEvalRules = data.evalRules;
      break;
    case 'classQuestions':
      d.classQuestions = data.questions || [];
      break;
    case 'practiceTasks':
      d.practiceTasks = data.tasks || [];
      break;
    case 'homeworks':
      d.homeworkEvalMethods = data.evalMethods || [];
      d.homeworkEvalRules = data.evalRules;
      d.homeworks = data.items || [];
      break;
    case 'extensionMaterials':
      d.extensionMaterials = data.resources || [];
      break;
    case 'trainingReports':
      d.trainingReports = data.reports || [];
      break;
  }
  return d;
}

/* ==================== hybridModuleApi（Vue 缺失，request() 直连同一后端端点） ==================== */

const hybridModuleApi = {
  list: (params?: { nodeId?: string; courseId?: string; limit?: number }) =>
    request<ListResponse<HybridNodeModule>>(`/lesson/hybrid-modules${buildQuery(params || {})}`),
  batchSave: (nodeId: string, modules: HybridModulePayload[]) =>
    request<{ nodeId: string }>('/lesson/hybrid-modules/batch', {
      method: 'POST',
      body: JSON.stringify({ nodeId, modules })
    })
};

/* ==================== 路由与查询参数 ==================== */

const route = useRoute();
const router = useRouter();

const editId = computed(() => (typeof route.query.id === 'string' ? route.query.id : undefined));
const isNewCourse = route.query.new === 'true';
const claimCourse = typeof route.query.claimCourse === 'string' ? route.query.claimCourse : undefined;
const claimSessionsParam = typeof route.query.claimSessions === 'string' ? route.query.claimSessions : undefined;

const claimPayload = computed<ClaimPayload | null>(() => {
  if (!claimSessionsParam) return null;
  try {
    const decoded = decodeURIComponent(atob(claimSessionsParam));
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) return { sessions: parsed as ClaimSession[] };
    return {
      course: parsed.course,
      teacher: parsed.teacher,
      className: parsed.className,
      sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as ClaimSession[]) : []
    };
  } catch {
    return null;
  }
});

const claimSessionNames = computed<string[]>(() =>
  (claimPayload.value?.sessions || []).map((s) => `第 ${s.week} 周 · ${s.weekday} · ${s.period}`)
);

/* ==================== 页面状态 ==================== */

const existing = ref<Course | null>(null);
const batchId = ref('');
const courseDescriptionPdf = ref<string | null>(null);
const abilityPoints = ref<AbilityPointItem[]>([]);
const abilityPool = ref<AbilityPointItem[]>([]);

const nodes = ref<SystemCourseNode[]>([]);
const selectedNodeId = ref<string | null>(null);
const moduleAssignments = reactive<Record<string, AtomicModuleKey[]>>({});
const nodeDataMap = reactive<Record<string, NodeModuleData>>({});

const courseForm = reactive<CourseBasicForm>({ ...createDefaultNodeModuleData().form, category: COURSE_CATEGORIES[0] });

const globalInfoOpen = ref(false);
const saving = ref(false);
const coverUploading = ref(false);
const hasSaved = ref(false);
const activeTab = ref('design');

/* 节点树 UI */
const nodeAddDialogOpen = ref(false);
const nodeAddParent = ref<string | null>(null);
const nodeAddName = ref('');
const nodeAddNextOrder = ref(1);
const nodeEditDialogOpen = ref(false);
const nodeEditId = ref<string | null>(null);
const nodeEditName = ref('');
const draggingId = ref<string | null>(null);
const dragOverState = reactive<{ nodeId: string | null; position: 'before' | 'after' | null }>({ nodeId: null, position: null });

/* 模块 UI */
const addDialogOpen = ref(false);
const addDialogCategory = ref<AtomicModuleCategory | null>(null);
const editingModuleKey = ref<AtomicModuleKey | null>(null);
const moduleDialogOpen = ref(false);

/* 复用分组 UI */
const shareDialogOpen = ref(false);
const newGroupName = ref('');
const addMemberGroupId = ref('');
const addMemberGroupName = ref('');
const addMemberSelectedIds = ref<string[]>([]);
const renamingGroupId = ref<string | null>(null);
const renameValue = ref('');
const disbandGroupId = ref('');

/* 能力点 UI */
const abilityDialogOpen = ref(false);
const abilitySearch = ref('');
const abilityNewName = ref('');
const abilityNewDesc = ref('');
const abilityAdding = ref(false);

/* 资源选择器 UI */
const resourceField = ref<'preClassResources' | 'extensionMaterials'>('preClassResources');
const resourcePool = ref<ResourceItem[]>([]);
const resourceTypeFilter = ref('all');
const resourceSearch = ref('');
const resourceUploading = ref(false);

/* 上传输入 */
const fileInputRef = ref<HTMLInputElement | null>(null);
const coverInputRef = ref<HTMLInputElement | null>(null);
const pdfInputRef = ref<HTMLInputElement | null>(null);
const resourceInputRef = ref<HTMLInputElement | null>(null);
const pendingAttachmentId = ref<string | null>(null);

const majors = ref<{ id: string; name: string }[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);

/* ==================== 派生状态 ==================== */

const selectedNode = computed(() => nodes.value.find((n) => n.id === selectedNodeId.value) || null);

const defaultNodeData = (): NodeModuleData =>
  createDefaultNodeModuleData({
    name: claimCourse || existing.value?.name,
    code: existing.value?.code,
    majorId: existing.value?.majorId,
    majorName: existing.value?.majorName,
    semester: existing.value?.semester,
    category: existing.value?.category as CourseBasicForm['category']
  });

const currentData = computed<NodeModuleData | null>(() =>
  selectedNodeId.value && nodeDataMap[selectedNodeId.value] ? nodeDataMap[selectedNodeId.value] : null
);

const anyData = computed<any>(() => currentData.value);

// 选中节点缺省数据在 watcher 中落 state（不在渲染期赋值）
watch(
  selectedNodeId,
  (id) => {
    if (!id || nodeDataMap[id]) return;
    nodeDataMap[id] = defaultNodeData();
  },
  { immediate: true }
);

const currentModules = computed<AtomicModuleKey[]>(() =>
  selectedNodeId.value ? moduleAssignments[selectedNodeId.value] || [] : []
);

const relatedDesignNodeIds = computed<string[]>(() => {
  if (!selectedNodeId.value || !currentData.value) return [];
  const myGroupIds = new Set((currentData.value.teachingDesignGroups || []).map((g) => g.id));
  if (myGroupIds.size === 0) return [];
  return nodes.value
    .filter((n) => n.id !== selectedNodeId.value)
    .filter((n) => (nodeDataMap[n.id]?.teachingDesignGroups || []).some((g) => myGroupIds.has(g.id)))
    .map((n) => n.id);
});

const allShareGroups = computed<{ id: string; name: string; members: SystemCourseNode[] }[]>(() => {
  const map = new Map<string, { id: string; name: string; members: SystemCourseNode[] }>();
  nodes.value.forEach((n) => {
    (nodeDataMap[n.id]?.teachingDesignGroups || []).forEach((g) => {
      const entry = map.get(g.id) || { id: g.id, name: g.name, members: [] };
      entry.name = g.name;
      entry.members.push(n);
      map.set(g.id, entry);
    });
  });
  return Array.from(map.values());
});

const parentNodeName = computed(() => {
  if (!nodeAddParent.value) return '';
  return nodes.value.find((n) => n.id === nodeAddParent.value)?.name || '';
});

const processCategories: { key: AtomicModuleCategory; label: string }[] = [
  { key: 'pre-class', label: '课前' },
  { key: 'in-class', label: '课中' },
  { key: 'post-class', label: '课后' }
];

const availableModules = computed(() => ATOMIC_MODULES.filter((m) => !currentModules.value.includes(m.key)));

const dialogModules = computed(() =>
  addDialogCategory.value ? availableModules.value.filter((m) => m.category === addDialogCategory.value) : []
);

const dialogTitle = computed(() => {
  const label = addDialogCategory.value
    ? processCategories.find((c) => c.key === addDialogCategory.value)?.label || ''
    : '';
  return `添加${label}教学活动`;
});

function categoryModules(category: AtomicModuleCategory): AtomicModuleKey[] {
  return currentModules.value.filter((k) => ATOMIC_MODULES_BY_KEY[k]?.category === category);
}

const editingModuleMeta = computed(() => (editingModuleKey.value ? ATOMIC_MODULES_BY_KEY[editingModuleKey.value] : null));

const moduleModeOnline = computed({
  get: () => {
    const key = editingModuleKey.value;
    if (!key || !currentData.value) return true;
    return (currentData.value.moduleModes?.[key] ?? 'online') === 'online';
  },
  set: (v: boolean) => {
    const key = editingModuleKey.value;
    if (!key || !currentData.value) return;
    currentData.value.moduleModes = { ...currentData.value.moduleModes, [key]: v ? 'online' : 'offline' };
  }
});

/* ==================== 节点树（buildTree + wouldCreateCycle，对齐 React CourseNodeTree） ==================== */

interface TreeNode {
  node: SystemCourseNode;
  level: number;
  children: TreeNode[];
}

const treeRows = computed<TreeRow[]>(() => {
  const sorted = [...nodes.value].sort((a, b) => a.order - b.order);
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  sorted.forEach((node) => map.set(node.id, { node, level: 0, children: [] }));
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
  const out: TreeRow[] = [];
  const walk = (items: TreeNode[], prefix: string) => {
    items.forEach((item, idx) => {
      const seq = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      out.push({ node: item.node, level: item.level, seq });
      walk(item.children, seq);
    });
  };
  walk(roots, '');
  return out;
});

function wouldCreateCycle(nodeId: string, targetId: string): boolean {
  if (nodeId === targetId) return true;
  const childrenByParent = new Map<string | null, SystemCourseNode[]>();
  for (const n of nodes.value) {
    const key = n.parentId ?? null;
    const list = childrenByParent.get(key) || [];
    list.push(n);
    childrenByParent.set(key, list);
  }
  const stack: string[] = [nodeId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const child of childrenByParent.get(id) || []) {
      if (child.id === targetId) return true;
      stack.push(child.id);
    }
  }
  return false;
}

function handleAddNode(parentId: string | null, name: string, order: number, type?: string, sourceId?: string, sourceName?: string) {
  const newNode: SystemCourseNode = {
    id: uid('node'),
    courseId: editId.value || 'hybrid-new',
    parentId,
    name,
    order,
    type: type || 'normal',
    status: 'draft',
    sourceId,
    sourceName
  };
  nodes.value = [...nodes.value, newNode];
  moduleAssignments[newNode.id] = [...DEFAULT_MODULES];
  nodeDataMap[newNode.id] = createDefaultNodeModuleData({
    name: claimCourse || existing.value?.name,
    code: existing.value?.code,
    majorId: existing.value?.majorId,
    semester: existing.value?.semester,
    category: existing.value?.category as CourseBasicForm['category']
  });
}

function handleUpdateNode(nodeId: string, updates: Partial<SystemCourseNode>) {
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
  deleteIds.forEach((id) => delete moduleAssignments[id]);
  deleteIds.forEach((id) => delete nodeDataMap[id]);
  if (selectedNodeId.value && deleteIds.has(selectedNodeId.value)) selectedNodeId.value = null;
}

function handleReorderNodes(nodeId: string, targetNodeId: string, position: 'before' | 'after' = 'after') {
  const dragged = nodes.value.find((n) => n.id === nodeId);
  const target = nodes.value.find((n) => n.id === targetNodeId);
  if (!dragged || !target) return;
  if (wouldCreateCycle(nodeId, targetNodeId)) return;
  const orderOffset = position === 'before' ? -0.5 : 0.5;
  const newNodes = nodes.value.map((n) =>
    n.id === nodeId ? { ...n, parentId: target.parentId, order: target.order + orderOffset } : { ...n }
  );
  const siblings = newNodes.filter((n) => n.parentId === target.parentId).sort((a, b) => a.order - b.order);
  siblings.forEach((n, idx) => {
    const idxInPrev = newNodes.findIndex((x) => x.id === n.id);
    if (idxInPrev >= 0) newNodes[idxInPrev] = { ...newNodes[idxInPrev], order: idx + 1 };
  });
  nodes.value = newNodes;
}

function openNodeAdd(parentId: string | null) {
  const siblings = nodes.value.filter((n) => n.parentId === parentId);
  const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((n) => n.order)) + 1 : 1;
  nodeAddParent.value = parentId;
  nodeAddName.value = '';
  nodeAddNextOrder.value = nextOrder;
  nodeAddDialogOpen.value = true;
}

function confirmNodeAdd() {
  if (!nodeAddName.value.trim()) return;
  handleAddNode(nodeAddParent.value, nodeAddName.value.trim(), nodeAddNextOrder.value, 'normal');
  nodeAddDialogOpen.value = false;
}

function openNodeEdit(nodeId: string) {
  const node = nodes.value.find((n) => n.id === nodeId);
  if (!node) return;
  nodeEditId.value = nodeId;
  nodeEditName.value = node.name;
  nodeEditDialogOpen.value = true;
}

function confirmNodeEdit() {
  if (!nodeEditId.value || !nodeEditName.value.trim()) return;
  handleUpdateNode(nodeEditId.value, { name: nodeEditName.value.trim() });
  nodeEditDialogOpen.value = false;
  nodeEditId.value = null;
}

function onNodeMenuCommand(command: string, nodeId: string) {
  if (command === 'edit') openNodeEdit(nodeId);
  else if (command === 'add-child') openNodeAdd(nodeId);
  else if (command === 'delete') confirmDeleteNode(nodeId);
}

async function confirmDeleteNode(nodeId: string) {
  try {
    await ElMessageBox.confirm('确定删除该节点吗？删除后其所有子节点也将被删除。', '删除节点', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  handleDeleteNode(nodeId);
}

/* 拖拽排序（对齐 React CourseNodeTree 的 HTML5 DnD） */
function onDragStart(e: DragEvent, nodeId: string) {
  draggingId.value = nodeId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
  }
}

function onDragOver(e: DragEvent, nodeId: string) {
  e.preventDefault();
  e.stopPropagation();
  if (!draggingId.value || draggingId.value === nodeId) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  if (!(dragOverState.nodeId === nodeId && dragOverState.position === position)) {
    dragOverState.nodeId = nodeId;
    dragOverState.position = position;
  }
}

function onDragLeave(e: DragEvent, nodeId: string) {
  const target = e.relatedTarget as Node | null;
  if (!(e.currentTarget as HTMLElement).contains(target)) {
    if (dragOverState.nodeId === nodeId) {
      dragOverState.nodeId = null;
      dragOverState.position = null;
    }
  }
}

function onDrop(e: DragEvent, targetId: string) {
  e.preventDefault();
  e.stopPropagation();
  if (
    draggingId.value &&
    draggingId.value !== targetId &&
    !wouldCreateCycle(draggingId.value, targetId) &&
    dragOverState.nodeId === targetId
  ) {
    handleReorderNodes(draggingId.value, targetId, dragOverState.position || 'after');
  }
  draggingId.value = null;
  dragOverState.nodeId = null;
  dragOverState.position = null;
}

/* ==================== 模块操作 ==================== */

function addModule(key: AtomicModuleKey) {
  if (!selectedNodeId.value) return;
  const list = moduleAssignments[selectedNodeId.value] || [];
  if (list.includes(key)) return;
  moduleAssignments[selectedNodeId.value] = [...list, key];
  addDialogOpen.value = false;
  addDialogCategory.value = null;
}

function openAddDialog(category: AtomicModuleCategory) {
  addDialogCategory.value = category;
  addDialogOpen.value = true;
}

function removeModule(key: AtomicModuleKey) {
  if (!selectedNodeId.value) return;
  moduleAssignments[selectedNodeId.value] = (moduleAssignments[selectedNodeId.value] || []).filter((k) => k !== key);
  if (editingModuleKey.value === key) editingModuleKey.value = null;
}

function updateTeachingDesignContent(value: string) {
  if (!selectedNodeId.value || !currentData.value) return;
  nodeDataMap[selectedNodeId.value].teachingDesignContent = value;
  relatedDesignNodeIds.value.forEach((id) => {
    if (nodeDataMap[id]) nodeDataMap[id].teachingDesignContent = value;
  });
}

function openModuleDialog(key: AtomicModuleKey) {
  editingModuleKey.value = key;
  if (key === 'preResources') resourceField.value = 'preClassResources';
  if (key === 'extensionMaterials') resourceField.value = 'extensionMaterials';
  const d = currentData.value;
  if (d) {
    const rulesField =
      key === 'preQuizzes' ? 'preQuizEvalRules' : key === 'inClassQuizzes' ? 'inClassQuizEvalRules' : key === 'homeworks' ? 'homeworkEvalRules' : null;
    if (rulesField && (d as any)[rulesField] === undefined) {
      const methodsField =
        key === 'preQuizzes' ? 'preQuizEvalMethods' : key === 'inClassQuizzes' ? 'inClassQuizEvalMethods' : 'homeworkEvalMethods';
      const methodsArr = ((d as any)[methodsField] as string[]) || [];
      (d as any)[rulesField] = makeDefaultEvalRuleConfig([...methodsArr]);
      const subjects = (d as any)[rulesField].evalSubjects;
      if (Array.isArray(subjects)) {
        (d as any)[rulesField].evalSubjects = subjects.map((s: any) => ({
          type: s.type,
          enabled: !!s.enabled,
          params: s.params || {}
        }));
      }
    }
    const methodsField =
      key === 'preQuizzes' ? 'preQuizEvalMethods' : key === 'inClassQuizzes' ? 'inClassQuizEvalMethods' : key === 'homeworks' ? 'homeworkEvalMethods' : null;
    const first = methodsField ? (d as any)[methodsField]?.[0] : undefined;
    evalPointMethod.value = typeof first === 'string' ? first : '';
  }
  moduleDialogOpen.value = true;
}

function removeModuleFromDialog() {
  const key = editingModuleKey.value;
  if (key) removeModule(key);
  moduleDialogOpen.value = false;
}

/* ==================== 复用教学设计分组 ==================== */

function createShareGroup() {
  const name = newGroupName.value.trim();
  if (!name) return;
  const gid = uid('dg');
  if (selectedNodeId.value && nodeDataMap[selectedNodeId.value]) {
    const groups = nodeDataMap[selectedNodeId.value].teachingDesignGroups || [];
    if (!groups.some((g) => g.id === gid)) {
      nodeDataMap[selectedNodeId.value].teachingDesignGroups = [...groups, { id: gid, name }];
    }
  }
  newGroupName.value = '';
  addMemberGroupId.value = gid;
  addMemberGroupName.value = name;
  addMemberSelectedIds.value = [];
  ElMessage.success(`已创建分组「${name}」，可继续添加其他节点`);
}

function renameShareGroup(gid: string) {
  const name = renameValue.value.trim();
  if (!name) return;
  Object.keys(nodeDataMap).forEach((k) => {
    const groups = nodeDataMap[k].teachingDesignGroups || [];
    if (groups.some((g) => g.id === gid)) {
      nodeDataMap[k].teachingDesignGroups = groups.map((g) => (g.id === gid ? { ...g, name } : g));
    }
  });
  renamingGroupId.value = null;
  renameValue.value = '';
}

function disbandShareGroup(gid: string) {
  Object.keys(nodeDataMap).forEach((k) => {
    const groups = nodeDataMap[k].teachingDesignGroups || [];
    if (groups.some((g) => g.id === gid)) {
      nodeDataMap[k].teachingDesignGroups = groups.filter((g) => g.id !== gid);
    }
  });
  if (addMemberGroupId.value === gid) addMemberGroupId.value = '';
  disbandGroupId.value = '';
}

function openAddMember(gid: string, gname: string) {
  if (addMemberGroupId.value === gid) {
    addMemberGroupId.value = '';
    return;
  }
  addMemberGroupId.value = gid;
  addMemberGroupName.value = gname;
  addMemberSelectedIds.value = [];
}

function toggleAddMember(nodeId: string) {
  const list = addMemberSelectedIds.value;
  addMemberSelectedIds.value = list.includes(nodeId) ? list.filter((id) => id !== nodeId) : [...list, nodeId];
}

function confirmAddMembers() {
  const gid = addMemberGroupId.value;
  const gname = addMemberGroupName.value;
  if (!gid || !gname) return;
  const group = allShareGroups.value.find((g) => g.id === gid);
  const baseMember = group?.members.find((m) => nodeDataMap[m.id]?.teachingDesignContent);
  const baseContent = baseMember ? nodeDataMap[baseMember.id].teachingDesignContent : undefined;
  addMemberSelectedIds.value.forEach((id) => {
    if (!nodeDataMap[id]) return;
    const groups = nodeDataMap[id].teachingDesignGroups || [];
    if (groups.some((g) => g.id === gid)) return;
    nodeDataMap[id].teachingDesignGroups = [...groups, { id: gid, name: gname }];
    if (baseContent !== undefined) nodeDataMap[id].teachingDesignContent = baseContent;
  });
  addMemberGroupId.value = '';
  addMemberSelectedIds.value = [];
}

function removeGroupMember(gid: string, nodeId: string) {
  if (!nodeDataMap[nodeId]) return;
  nodeDataMap[nodeId].teachingDesignGroups = (nodeDataMap[nodeId].teachingDesignGroups || []).filter((g) => g.id !== gid);
}

function openShareDialog() {
  shareDialogOpen.value = true;
  newGroupName.value = '';
  addMemberGroupId.value = '';
  renamingGroupId.value = null;
}

function resetShareDialog() {
  newGroupName.value = '';
  addMemberGroupId.value = '';
  addMemberSelectedIds.value = [];
  renamingGroupId.value = null;
  disbandGroupId.value = '';
}

function candidateNodes(g: { id: string; members: SystemCourseNode[] }) {
  return nodes.value.filter((n) => !g.members.some((m) => m.id === n.id));
}

/* ==================== 加载 ==================== */

let loadSeq = 0;

async function load() {
  const seq = ++loadSeq;
  if (editId.value) {
    try {
      const [c, nodeRes, moduleRes] = await Promise.all([
        courseApi.get(editId.value),
        courseNodeApi.list({ courseId: editId.value }),
        hybridModuleApi.list({ courseId: editId.value })
      ]);
      if (seq !== loadSeq) return;
      existing.value = c;
      if (c.batchId) batchId.value = c.batchId;
      const courseEvalData = (c.evalData || {}) as Record<string, any>;
      Object.assign(courseForm, {
        name: c.name || '',
        code: c.code || '',
        majorId: c.majorId || '',
        majorName: c.majorName || '',
        semester: c.semester || '',
        category: COURSE_CATEGORIES.includes(c.category as CourseBasicForm['category'])
          ? (c.category as CourseBasicForm['category'])
          : COURSE_CATEGORIES[0],
        courseObjectives: courseEvalData.learningGoal || '',
        detailedDescription: c.description || '',
        background: courseEvalData.background || '',
        estimatedHours: courseEvalData.estimatedHours ? String(courseEvalData.estimatedHours) : '',
        coverImage: c.coverImage || ''
      });
      courseDescriptionPdf.value = courseEvalData.descriptionPdf || null;
      const loadedNodes = (nodeRes.items || []) as SystemCourseNode[];
      if (loadedNodes.length === 0) {
        loadedNodes.push({
          id: uid('node'),
          courseId: editId.value,
          parentId: null,
          name: c.name || '混合课程',
          order: 1,
          type: 'normal',
          status: 'draft'
        });
      }
      nodes.value = loadedNodes;
      abilityPoints.value = (c.abilityPointIds || []).map((id: string) => {
        const found = abilityPool.value.find((a) => a.id === id);
        return found || { id, name: id };
      });
      const modulesByNode = new Map<string, HybridNodeModule[]>();
      (moduleRes.items || []).forEach((m) => {
        const list = modulesByNode.get(m.nodeId) || [];
        list.push(m);
        modulesByNode.set(m.nodeId, list);
      });
      const assignments: Record<string, AtomicModuleKey[]> = {};
      const dataMap: Record<string, NodeModuleData> = {};
      loadedNodes.forEach((n) => {
        const modules = modulesByNode.get(n.id) || [];
        const keys: AtomicModuleKey[] = [];
        const modes: NodeModuleData['moduleModes'] = {};
        const d = createDefaultNodeModuleData({
          name: n.name,
          code: c.code,
          majorId: c.majorId,
          majorName: c.majorName,
          semester: c.semester,
          category: c.category as CourseBasicForm['category'],
          coverImage: c.coverImage
        });
        modules.forEach((m) => {
          if (m.moduleKey === TEACHING_DESIGN_KEY || m.moduleKey === 'postLessonReview') {
            applyModuleData(d, m);
            return;
          }
          if (!(m.moduleKey in ATOMIC_MODULES_BY_KEY)) return;
          keys.push(m.moduleKey as AtomicModuleKey);
          modes[m.moduleKey as AtomicModuleKey] = m.mode;
          applyModuleData(d, m);
        });
        d.moduleModes = modes;
        assignments[n.id] = keys;
        dataMap[n.id] = d;
      });
      Object.keys(moduleAssignments).forEach((k) => delete moduleAssignments[k]);
      Object.keys(nodeDataMap).forEach((k) => delete nodeDataMap[k]);
      Object.assign(moduleAssignments, assignments);
      Object.assign(nodeDataMap, dataMap);
      selectedNodeId.value = loadedNodes[0]?.id || null;
    } catch (err) {
      if (seq !== loadSeq) return;
      ElMessage.error((err as Error)?.message || '加载课程信息失败');
      existing.value = null;
    }
    return;
  }

  // 新建：根节点 + 排课会话生成的节次子节点
  const rootNode: SystemCourseNode = {
    id: FIRST_NODE_ID,
    courseId: 'hybrid-new',
    parentId: null,
    name: claimCourse || '混合课程',
    order: 1,
    type: 'normal',
    status: 'draft'
  };
  const childNodes: SystemCourseNode[] = claimSessionNames.value.map((name, idx) => ({
    id: `hybrid-node-child-${idx + 1}`,
    courseId: 'hybrid-new',
    parentId: FIRST_NODE_ID,
    name,
    order: idx + 1,
    type: 'normal',
    status: 'draft'
  }));
  if (seq !== loadSeq) return;
  nodes.value = [rootNode, ...childNodes];
  selectedNodeId.value = FIRST_NODE_ID;
  Object.keys(moduleAssignments).forEach((k) => delete moduleAssignments[k]);
  Object.keys(nodeDataMap).forEach((k) => delete nodeDataMap[k]);
  moduleAssignments[FIRST_NODE_ID] = [...DEFAULT_MODULES];
  nodeDataMap[FIRST_NODE_ID] = createDefaultNodeModuleData({ name: claimCourse || undefined });
}

async function fetchAbilityPool() {
  try {
    const res = await fetchAllPages((page, pageSize) => abilityApi.list({ limit: pageSize, offset: page * pageSize }));
    const pool = (res || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      code: a.code,
      description: a.description
    }));
    abilityPool.value = pool;
    abilityPoints.value = abilityPoints.value.map((ap) => {
      if (ap.name !== ap.id) return ap;
      const found = pool.find((a) => a.id === ap.id);
      return found || ap;
    });
  } catch {
    abilityPool.value = [];
  }
}

async function fetchSelectOptions() {
  try {
    const [majorRes, batchRes] = await Promise.all([
      majorApi.list({ limit: 500 }),
      lessonBatchApi.list({ limit: 200 })
    ]);
    majors.value = (majorRes.items || []).map((m: any) => ({ id: m.id, name: m.name }));
    batches.value = (batchRes.items || []).map((b: any) => ({ id: b.id, name: b.name }));
  } catch {
    /* 选项加载失败不阻塞编辑 */
  }
}

onMounted(() => {
  load();
  fetchAbilityPool();
  fetchSelectOptions();
});
watch(editId, () => load());

/* ==================== 保存 ==================== */

function buildNodeHybridEvalRules(d: NodeModuleData): Record<string, any> {
  return {
    preQuiz: { methods: d.preQuizEvalMethods || [], evalRuleConfig: d.preQuizEvalRules },
    inClassQuiz: { methods: d.inClassQuizEvalMethods || [], evalRuleConfig: d.inClassQuizEvalRules },
    homework: { methods: d.homeworkEvalMethods || [], evalRuleConfig: d.homeworkEvalRules }
  };
}

function buildCoursePayload(): Omit<
  Course,
  'id' | 'nodeCount' | 'resourceCount' | 'studyCount' | 'createdAt' | 'updatedAt'
> {
  return {
    code: courseForm.code || '',
    name: courseForm.name || '',
    type: 'hybrid',
    category: courseForm.category || '专业核心课程',
    majorId: courseForm.majorId || existing.value?.majorId || undefined,
    majorName: courseForm.majorName || existing.value?.majorName || undefined,
    semester: existing.value?.semester || undefined,
    className: existing.value?.className || '',
    coverImage: courseForm.coverImage || undefined,
    batchId: batchId.value || undefined,
    status: 'draft',
    creatorId: existing.value?.creatorId || '',
    coCreatorIds: existing.value?.coCreatorIds || [],
    description: courseForm.detailedDescription || undefined,
    abilityPointIds: abilityPoints.value.map((a) => a.id),
    evalData: {
      descriptionPdf: courseDescriptionPdf.value || undefined,
      learningGoal: courseForm.courseObjectives || undefined,
      background: courseForm.background || undefined,
      estimatedHours: courseForm.estimatedHours ? Number(courseForm.estimatedHours) : undefined
    }
  };
}

async function saveNodes(effectiveCourseId: string) {
  // 删除在后端存在但本地已删除的节点（级联删除其混合模块）
  const currentBackendNodes = await courseNodeApi.list({ courseId: effectiveCourseId });
  const backendNodeIds = new Set((currentBackendNodes.items || []).map((n) => n.id));
  const isTempNodeId = (id: string) => id.startsWith('node-') || id.startsWith('hybrid-node-');
  const localNodeIds = new Set(nodes.value.map((n) => n.id).filter((id) => !isTempNodeId(id)));
  for (const backendId of backendNodeIds) {
    if (!localNodeIds.has(backendId)) {
      try {
        await courseNodeApi.delete(backendId);
      } catch (err) {
        ElMessage.error((err as Error)?.message || '删除多余课程节点失败');
      }
    }
  }

  // 父节点必须先于子节点创建（parent_id 外键）：按层级拓扑排序
  const all = [...nodes.value].sort((a, b) => a.order - b.order);
  const byId = new Map(all.map((n) => [n.id, n]));
  const out: SystemCourseNode[] = [];
  const visited = new Set<string>();
  const visit = (n: SystemCourseNode) => {
    if (visited.has(n.id)) return;
    visited.add(n.id);
    if (n.parentId && byId.has(n.parentId)) visit(byId.get(n.parentId)!);
    out.push(n);
  };
  all.forEach(visit);
  const sortedNodes = out;

  const idMapping = new Map<string, string>();
  const courseCode = courseForm.code || existing.value?.code || '';

  // 第一遍：创建/更新节点，建立临时 ID → 真实 ID 映射
  for (const node of sortedNodes) {
    const d = nodeDataMap[node.id];
    if (!d) continue;
    const isTempId = isTempNodeId(node.id);
    const realParentId = node.parentId ? idMapping.get(node.parentId) || node.parentId : undefined;
    const payload = {
      courseId: effectiveCourseId,
      parentId: realParentId,
      name: node.name,
      code: node.code || courseCode,
      sortOrder: Math.round(node.order),
      refType: 'normal',
      evalData: { hybridEvalRules: buildNodeHybridEvalRules(d) },
      status: 'draft'
    };
    if (isTempId) {
      const created = await courseNodeApi.create(payload as unknown as Partial<Omit<SystemCourseNode, 'id'>>);
      idMapping.set(node.id, created.id);
    } else {
      await courseNodeApi.update(node.id, payload as unknown as Partial<Omit<SystemCourseNode, 'id'>>);
      idMapping.set(node.id, node.id);
    }
  }

  // 第二遍：保存各节点模块（全量替换）；任一失败向上抛错，防止静默丢失教学内容
  for (const node of sortedNodes) {
    const d = nodeDataMap[node.id];
    const realNodeId = idMapping.get(node.id);
    if (!d || !realNodeId) continue;
    const modules = buildModulesForNode(d, moduleAssignments[node.id] || []);
    await hybridModuleApi.batchSave(realNodeId, modules);
  }

  // 刷新节点列表（临时 ID 已映射为真实 ID），并迁移编辑态缓存 key（含共享节点 ID）
  const refreshed = await courseNodeApi.list({ courseId: effectiveCourseId });
  const refreshedNodes = (refreshed.items || []) as SystemCourseNode[];
  nodes.value = refreshedNodes;
  const nextData: Record<string, NodeModuleData> = {};
  Object.entries(nodeDataMap).forEach(([k, v]) => {
    nextData[idMapping.get(k) || k] = v;
  });
  Object.keys(nodeDataMap).forEach((k) => delete nodeDataMap[k]);
  Object.assign(nodeDataMap, nextData);
  const nextAssign: Record<string, AtomicModuleKey[]> = {};
  Object.entries(moduleAssignments).forEach(([k, v]) => {
    nextAssign[idMapping.get(k) || k] = v;
  });
  Object.keys(moduleAssignments).forEach((k) => delete moduleAssignments[k]);
  Object.assign(moduleAssignments, nextAssign);
  if (selectedNodeId.value) {
    const mapped = idMapping.get(selectedNodeId.value);
    if (mapped) selectedNodeId.value = mapped;
  }
}

async function handleSave(): Promise<boolean> {
  if (!courseForm.name || !courseForm.code) {
    ElMessage.warning('请填写课程名称和课程编码');
    return false;
  }
  saving.value = true;
  try {
    const payload = buildCoursePayload();
    let effectiveCourseId = editId.value;
    if (editId.value) {
      const updated = await courseApi.update(editId.value, payload);
      hasSaved.value = true;
      if (existing.value?.status !== 'draft') {
        await courseApi.saveDraft(editId.value);
        existing.value = { ...updated, status: 'draft' };
      } else {
        existing.value = updated;
      }
    } else {
      const created = await courseApi.create(payload);
      existing.value = created;
      effectiveCourseId = created.id;
      hasSaved.value = true;
    }
    if (effectiveCourseId) {
      await saveNodes(effectiveCourseId);
    }
    ElMessage.success('草稿已保存');
    if (!editId.value && effectiveCourseId) {
      router.replace({ path: '/lesson/courses/hybrid/add', query: { id: effectiveCourseId } });
    }
    return true;
  } catch (e) {
    ElMessage.error((e as Error)?.message || '保存失败，请检查表单后重试');
  } finally {
    saving.value = false;
  }
  return false;
}

async function handleFinish() {
  const ok = await handleSave();
  if (ok) router.push('/lesson/courses');
}

async function onBack() {
  if (isNewCourse && editId.value && !hasSaved.value) {
    try {
      await courseApi.delete(editId.value);
    } catch (err) {
      ElMessage.error((err as Error)?.message || '删除未保存的课程草稿失败');
    }
  }
  router.push('/lesson/courses');
}

/* ==================== 课程基本信息辅助 ==================== */

function onMajorChange(v: string | undefined) {
  courseForm.majorName = v ? majors.value.find((m) => m.id === v)?.name || '' : '';
}

function removeCover() {
  courseForm.coverImage = '';
}

function pdfFileName(): string {
  const url = courseDescriptionPdf.value;
  return url ? url.split('/').pop() || url : '';
}

async function onCoverFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    courseForm.coverImage = res.url;
    ElMessage.success('封面上传成功');
  } catch (err) {
    ElMessage.error((err as Error)?.message || '封面上传失败');
  } finally {
    coverUploading.value = false;
  }
}

async function onPdfFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const res = await fileApi.upload(file);
    courseDescriptionPdf.value = res.url;
    ElMessage.success('PDF 上传成功');
  } catch (err) {
    ElMessage.error((err as Error)?.message || 'PDF 上传失败');
  }
}

/* ==================== 能力点 ==================== */

const filteredAbilityPool = computed(() => {
  const q = abilitySearch.value.trim().toLowerCase();
  if (!q) return abilityPool.value;
  return abilityPool.value.filter(
    (ap) =>
      (ap.name || '').toLowerCase().includes(q) ||
      (ap.code || '').toLowerCase().includes(q) ||
      (ap.description || '').toLowerCase().includes(q)
  );
});

function isAbilitySelected(id: string) {
  return abilityPoints.value.some((s) => s.id === id);
}

function removeAbilityPoint(id: string) {
  abilityPoints.value = abilityPoints.value.filter((s) => s.id !== id);
}

function toggleAbilityPoint(ap: AbilityPointItem) {
  const exists = abilityPoints.value.find((s) => s.id === ap.id);
  abilityPoints.value = exists ? abilityPoints.value.filter((s) => s.id !== ap.id) : [...abilityPoints.value, ap];
}

async function addCustomAbility() {
  const name = abilityNewName.value.trim();
  if (!name) return;
  try {
    // 先创建真实能力点换取 ID，避免假 ID 随 abilityPointIds 入库
    const created = await abilityApi.create({
      name,
      description: abilityNewDesc.value.trim() || undefined,
      attributes: [],
      isPublic: false
    });
    abilityPoints.value = [
      ...abilityPoints.value,
      { id: created.id, name: created.name, code: created.code, description: created.description }
    ];
  } catch (err) {
    ElMessage.error((err as Error)?.message || '创建能力点失败');
  }
  abilityNewName.value = '';
  abilityNewDesc.value = '';
  abilityAdding.value = false;
}

/* ==================== 附件编辑 ==================== */

function addAttachment(field: string) {
  (anyData.value as any)[field].push({ id: uid('att'), name: '', file: '' });
}

function addTaskAttachment(task: TaskItem) {
  task.attachments.push({ id: uid('att'), name: '', file: '' });
}

function addSectionAttachment(section: LectureSectionItem) {
  section.attachments.push({ id: uid('att'), name: '', file: '' });
}

function addReportAttachment(report: ReportItem) {
  report.attachments.push({ id: uid('att'), name: '', file: '' });
}

function removeAttachment(arr: AttachmentItem[], idx: number | string) {
  arr.splice(Number(idx), 1);
}

function triggerAttachmentUpload(itemId: string) {
  pendingAttachmentId.value = itemId;
  fileInputRef.value?.click();
}

// 按附件 id 在节点数据各附件数组中定位并更新（附件散落在预习/任务/环节/报告下）
function updateAttachmentItemById(itemId: string, patch: Partial<AttachmentItem>) {
  const d = currentData.value;
  if (!d) return;
  const fields: AttachmentItem[][] = [
    d.previewAttachments,
    ...d.preClassTasks.map((t) => t.attachments),
    ...d.lectureSections.map((s) => s.attachments),
    ...d.inClassTasks.map((t) => t.attachments),
    ...d.practiceTasks.map((t) => t.attachments),
    ...d.trainingReports.map((r) => r.attachments || [])
  ];
  for (const arr of fields) {
    const idx = arr.findIndex((it) => it.id === itemId);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...patch };
      return;
    }
  }
}

async function onAttachmentFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  const itemId = pendingAttachmentId.value;
  input.value = '';
  if (!file || !itemId) return;
  try {
    const res = await fileApi.upload(file);
    updateAttachmentItemById(itemId, { name: file.name, file: res.url });
    ElMessage.success('附件上传成功');
  } catch (err) {
    ElMessage.error((err as Error)?.message || '附件上传失败');
  } finally {
    pendingAttachmentId.value = null;
  }
}

function resourceFileName(url?: string): string {
  return url ? url.split('/').pop() || url : '';
}

/* ==================== 任务/环节/提问/报告列表 ==================== */

const taskList = computed<TaskItem[]>(() => {
  if (!currentData.value) return [];
  const key = editingModuleKey.value;
  if (key === 'preTasks') return currentData.value.preClassTasks;
  if (key === 'inClassTasks') return currentData.value.inClassTasks;
  if (key === 'practiceTasks') return currentData.value.practiceTasks;
  return [];
});

const taskAddLabel = computed(() => {
  const key = editingModuleKey.value;
  if (key === 'preTasks') return '添加课前任务';
  if (key === 'inClassTasks') return '添加课堂任务';
  if (key === 'practiceTasks') return '添加实践任务';
  return '添加任务';
});

function addTask() {
  taskList.value.push({ id: uid('task'), name: '', requirement: '', attachments: [], source: 'manual' });
}

function removeTask(idx: number) {
  taskList.value.splice(idx, 1);
}

function addLectureSection() {
  (anyData.value as any).lectureSections.push({ id: uid('lecture-section'), name: '', content: '', attachments: [] });
}

function addClassQuestion() {
  (anyData.value as any).classQuestions.push({ id: uid('q'), stem: '', answer: '', source: 'manual' });
}

function addReportItem() {
  (anyData.value as any).trainingReports.push({
    id: uid('report'),
    name: '',
    template: '',
    requirement: '',
    required: true,
    attachments: []
  });
}

/* ==================== 资源选择器 ==================== */

async function loadResourcePool() {
  try {
    const res = await fetchAllPages((page, pageSize) =>
      resourceLibraryApi.list({ limit: pageSize, offset: page * pageSize })
    );
    resourcePool.value = (res || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.resourceType || r.type || 'other',
      url: r.url,
      description: r.description,
      thumbnail: r.thumbnail,
      source: r.url || ''
    }));
  } catch {
    resourcePool.value = [];
  }
}

const filteredResourcePool = computed(() => {
  let list = resourcePool.value;
  if (resourceTypeFilter.value !== 'all') list = list.filter((r) => r.type === resourceTypeFilter.value);
  const q = resourceSearch.value.trim().toLowerCase();
  if (q) list = list.filter((r) => (r.name || '').toLowerCase().includes(q));
  return list;
});

function currentResourceItems(): ResourceItem[] {
  return (anyData.value?.[resourceField.value] as ResourceItem[]) || [];
}

function isResourceSelected(id: string) {
  return currentResourceItems().some((r) => r.id === id);
}

function toggleResource(id: string) {
  const items = [...currentResourceItems()];
  const exists = items.find((r) => r.id === id);
  const poolItem = resourcePool.value.find((r) => r.id === id);
  anyData.value[resourceField.value] = exists ? items.filter((r) => r.id !== id) : poolItem ? [...items, poolItem] : items;
}

async function onResourceUploadFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  resourceUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    const created = await resourceLibraryApi.create({
      name: file.name,
      resourceType: 'document',
      url: res.url,
      description: '',
      fileSize: res.size
    });
    const newRes: ResourceItem = {
      id: created.id,
      name: created.name,
      type: 'document',
      url: created.url || res.url,
      description: created.description || '',
      source: created.url || res.url
    };
    resourcePool.value = [newRes, ...resourcePool.value];
    anyData.value[resourceField.value] = [...currentResourceItems(), newRes];
    ElMessage.success('资源已上传并选中');
  } catch (err) {
    ElMessage.error((err as Error)?.message || '资源上传失败');
  } finally {
    resourceUploading.value = false;
  }
}

const RESOURCE_TYPE_ICONS: Record<string, string> = {
  document: 'Document',
  spreadsheet: 'Memo',
  image: 'Picture',
  link: 'Link',
  audio: 'Headset',
  video: 'VideoPlay',
  archive: 'Box',
  venue: 'Location',
  facility: 'SetUp',
  software: 'Cpu',
  other: 'Files'
};

function resourceTypeIcon(type: string): string {
  return RESOURCE_TYPE_ICONS[type] || 'Files';
}

/* ==================== 测评方式与评价规则编辑 ==================== */

const evalPrimaryOptions = [
  { key: 'platform' as const, label: '平台通用' },
  { key: 'industry' as const, label: '行业专属' }
];

const SECONDARY_TABS: Record<string, string[]> = {
  platform: ['全部', '知识评价', '过程评价', '成果评价'],
  industry: ['全部', '智慧物流', '网络安全']
};

const evalPrimaryTab = ref<'platform' | 'industry'>('platform');
const evalSecondaryTab = ref('全部');
const evalPointMethod = ref('');

const filteredEvalMethods = computed(() =>
  EVALUATION_METHOD_OPTIONS.filter((m) => {
    if (m.primaryCategory !== evalPrimaryTab.value) return false;
    if (evalSecondaryTab.value === '全部') return true;
    return m.secondaryCategory === evalSecondaryTab.value;
  })
);

function setEvalPrimaryTab(tab: 'platform' | 'industry') {
  evalPrimaryTab.value = tab;
  evalSecondaryTab.value = '全部';
}

const evalFields = computed<{ methodsField: string; rulesField: string } | null>(() => {
  const key = editingModuleKey.value;
  if (key === 'preQuizzes') return { methodsField: 'preQuizEvalMethods', rulesField: 'preQuizEvalRules' };
  if (key === 'inClassQuizzes') return { methodsField: 'inClassQuizEvalMethods', rulesField: 'inClassQuizEvalRules' };
  if (key === 'homeworks') return { methodsField: 'homeworkEvalMethods', rulesField: 'homeworkEvalRules' };
  return null;
});

function toggleEvalMethod(method: EvalMethodOption, methodsField: string, rulesField: string) {
  if (!method.available) return;
  const d = anyData.value;
  if (!d) return;
  const methods = [...(d[methodsField] as string[])];
  const enabled = methods.includes(method.key);
  const next = enabled ? methods.filter((m) => m !== method.key) : [...methods, method.key];
  d[methodsField] = next;
  if (d[rulesField] !== undefined) {
    d[rulesField] = mergeEvalRuleMethods(d[rulesField], next);
  }
}

function setMethodWeight(rules: EvalRuleConfig, methodKey: string, v: number | undefined) {
  rules.methodWeights = rules.methodWeights || {};
  rules.methodWeights[methodKey] = v ?? 0;
}

function setSubjectWeight(s: EvalRuleSubjectConfig, v: number | undefined) {
  if (!s.params) s.params = {};
  s.params.weightPercent = v ?? 0;
}

function distributeWeights(rulesField: string) {
  const rules = anyData.value?.[rulesField];
  if (!rules) return;
  const methods: string[] = rules.evaluationMethods || [];
  const count = methods.length;
  if (count === 0) return;
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  const weights: Record<string, number> = {};
  methods.forEach((m, i) => {
    weights[m] = base + (i < remainder ? 1 : 0);
  });
  rules.methodWeights = weights;
}

const evalPointList = computed<EvalRulePoint[]>(() => {
  if (!evalFields.value || !anyData.value) return [];
  const rules = anyData.value[evalFields.value.rulesField];
  const field = EVAL_POINT_FIELD[evalPointMethod.value];
  if (!rules || !field) return [];
  return rules[field] || [];
});

function addEvalPoint() {
  if (!evalFields.value || !anyData.value) return;
  const rules = anyData.value[evalFields.value.rulesField];
  const field = EVAL_POINT_FIELD[evalPointMethod.value];
  if (!rules || !field) return;
  rules[field] = [...(rules[field] || []), { id: uid('ep'), name: '', desc: '', weight: 0 }];
}

function removeEvalPoint(idx: number) {
  if (!evalFields.value || !anyData.value) return;
  const rules = anyData.value[evalFields.value.rulesField];
  const field = EVAL_POINT_FIELD[evalPointMethod.value];
  if (!rules || !field) return;
  rules[field] = evalPointList.value.filter((_, i) => i !== idx);
}

/* ==================== 模块卡片摘要（对齐 module-preview.tsx） ==================== */

function truncate(text: string, max = 60) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function listSummary(items: Array<{ name?: string; stem?: string; bankTitle?: string; requirement?: string }>, countLabel: string) {
  if (items.length === 0) return '';
  const lines = items
    .slice(0, 5)
    .map((it) => `· ${truncate(it.name || it.bankTitle || it.stem || it.requirement || '未填写', 40)}`)
    .join('\n');
  return items.length > 5 ? `…共 ${items.length} ${countLabel}` : lines;
}

function evalSummary(methods: string[]) {
  return methods.length > 0 ? `测评方式：${methods.map(methodLabel).join('、')}` : '';
}

function isModuleConfigured(key: AtomicModuleKey, d: NodeModuleData): boolean {
  switch (key) {
    case 'prePreview':
      return !!d.previewContent.trim() || d.previewAttachments.length > 0;
    case 'preResources':
      return d.preClassResources.length > 0;
    case 'preTasks':
      return d.preClassTasks.length > 0;
    case 'preQuizzes':
      return d.preQuizEvalMethods.length > 0 || !!d.preQuizEvalRules;
    case 'lecture':
      return d.lectureSections.length > 0;
    case 'inClassTasks':
      return d.inClassTasks.length > 0;
    case 'inClassQuizzes':
      return d.inClassQuizEvalMethods.length > 0 || !!d.inClassQuizEvalRules;
    case 'classQuestions':
      return d.classQuestions.length > 0;
    case 'practiceTasks':
      return d.practiceTasks.length > 0;
    case 'homeworks':
      return d.homeworks.length > 0 || d.homeworkEvalMethods.length > 0 || !!d.homeworkEvalRules;
    case 'extensionMaterials':
      return d.extensionMaterials.length > 0;
    case 'trainingReports':
      return d.trainingReports.length > 0;
  }
}

function getModuleSummary(key: AtomicModuleKey, d: NodeModuleData): string {
  switch (key) {
    case 'prePreview': {
      const lines = [truncate(d.previewContent)];
      if (d.previewAttachments.length > 0) lines.push(`${d.previewAttachments.length} 份附件`);
      return lines.filter(Boolean).join('\n');
    }
    case 'preResources':
      return listSummary(d.preClassResources, '份资源');
    case 'preTasks':
      return listSummary(d.preClassTasks, '项任务');
    case 'preQuizzes':
      return [evalSummary(d.preQuizEvalMethods), d.preQuizEvalRules ? '已配置评价规则' : ''].filter(Boolean).join('\n');
    case 'lecture':
      return listSummary(d.lectureSections, '个环节');
    case 'inClassTasks':
      return listSummary(d.inClassTasks, '项任务');
    case 'inClassQuizzes':
      return [evalSummary(d.inClassQuizEvalMethods), d.inClassQuizEvalRules ? '已配置评价规则' : ''].filter(Boolean).join('\n');
    case 'classQuestions':
      return listSummary(d.classQuestions, '个问题');
    case 'practiceTasks':
      return listSummary(d.practiceTasks, '项任务');
    case 'homeworks':
      return [
        d.homeworks.length > 0 ? `${d.homeworks.length} 项作业` : '',
        evalSummary(d.homeworkEvalMethods),
        d.homeworkEvalRules ? '已配置评价规则' : ''
      ]
        .filter(Boolean)
        .join('\n');
    case 'extensionMaterials':
      return listSummary(d.extensionMaterials, '份资料');
    case 'trainingReports':
      return listSummary(d.trainingReports, '份报告');
  }
}
</script>

<style scoped>
.hybrid-edit-page {
  padding: 16px;
}
.editor-card {
  border-radius: 8px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.header-actions {
  display: flex;
  gap: 8px;
}

/* 课程基本信息 */
.course-info {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 16px;
  background: #fff;
}
.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
}
.info-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
.info-name {
  font-weight: 400;
  color: #909399;
  font-size: 12px;
}
.info-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 12px;
}
.info-desc {
  margin: 0;
  padding: 0 16px 10px 44px;
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.info-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 4px 16px 16px;
  border-top: 1px solid #f2f3f5;
}
@media (max-width: 900px) {
  .info-body {
    grid-template-columns: 1fr;
  }
}
.pdf-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.cover-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cover-preview {
  width: 120px;
  height: 80px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  flex-shrink: 0;
}
.cover-placeholder {
  width: 120px;
  height: 80px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
}
.cover-actions {
  display: flex;
  gap: 8px;
}
.ability-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  width: 100%;
}
.ability-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 双栏 */
.editor-main {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px) {
  .editor-main {
    grid-template-columns: 1fr;
  }
}
.tree-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}
.tree-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.tree-list {
  max-height: 480px;
  overflow-y: auto;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  user-select: none;
  border-left: 2px solid transparent;
}
.tree-node:hover {
  background: #f5f7fa;
}
.tree-node.active {
  background: #ecf5ff;
  color: #409eff;
  border-left-color: #409eff;
}
.tree-node.dragging {
  opacity: 0.4;
}
.tree-node.drag-before {
  border-top: 2px solid #409eff;
}
.tree-node.drag-after {
  border-bottom: 2px solid #409eff;
}
.tree-node .grip {
  color: #c0c4cc;
  cursor: grab;
  opacity: 0;
}
.tree-node:hover .grip {
  opacity: 0.6;
}
.tree-node .seq {
  color: #c0c4cc;
  font-size: 12px;
  width: 20px;
  flex-shrink: 0;
}
.tree-node .name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-node .more {
  color: #909399;
  font-size: 12px;
  padding: 0 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.add-node-btn {
  width: 100%;
  margin-top: 12px;
}
.tree-hint {
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px solid #f2f3f5;
  font-size: 12px;
  color: #909399;
}

/* 内容区 */
.content-area {
  min-width: 0;
}
.node-info-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #909399;
}
.node-info-bar .dot {
  width: 6px;
  height: 6px;
  background: #e6a23c;
  border-radius: 50%;
}
.node-info-text b {
  color: #606266;
  font-weight: 500;
}
.empty-selection {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  color: #909399;
}
.design-card,
.review-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
}
.design-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.design-title,
.review-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.design-groups {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.group-label {
  font-size: 12px;
  color: #909399;
}
.group-tag {
  cursor: pointer;
}

.process-category {
  margin-bottom: 20px;
}
.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.category-header h3 {
  margin: 0;
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) {
  .module-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 900px) {
  .module-grid {
    grid-template-columns: 1fr;
  }
}
.module-card {
  min-height: 110px;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s;
}
.module-card.configured {
  background: #fff;
  border: 1px solid #e4e7ed;
}
.module-card.configured:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.module-card.unconfigured {
  background: #fafafa;
  border: 1px dashed #dcdfe6;
}
.module-card.unconfigured:hover {
  border-color: #409eff;
}
.module-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.module-icon {
  padding: 5px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.module-icon.on {
  background: #ecf5ff;
  color: #409eff;
}
.module-icon.off {
  background: #f0f2f5;
  color: #909399;
}
.module-label {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.module-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-line;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}
.module-summary.on {
  color: #606266;
}
.module-summary.off {
  color: #c0c4cc;
}

/* 添加模块弹窗 */
.module-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 8px 0;
}
.module-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.module-option:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

/* 模块编辑弹窗 */
.module-dialog-body {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 4px;
}
.module-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mode-label {
  font-size: 12px;
  color: #606266;
}
.editor-block {
  margin-top: 14px;
  border-top: 1px solid #f2f3f5;
  padding-top: 12px;
}
.editor-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.attachment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px;
  background: #fafafa;
  margin-bottom: 8px;
}
.task-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.task-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-head p {
  margin: 0;
  font-size: 13px;
}
.muted {
  color: #909399;
  font-size: 12px;
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hidden-input {
  display: none;
}
.char-count {
  position: absolute;
  right: 0;
  bottom: -18px;
  font-size: 12px;
  color: #c0c4cc;
}
.dialog-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #909399;
}

/* 资源选择器 */
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.picker-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
}
.picker-item:hover {
  border-color: #409eff;
}
.picker-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.picker-item-info {
  flex: 1;
  min-width: 0;
}
.picker-item-info p {
  margin: 0;
  font-size: 13px;
}
.picker-item-info p.muted {
  font-size: 11px;
}

/* 测评方式 */
.eval-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #f2f3f5;
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.eval-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.eval-subtabs .el-button {
  font-size: 12px;
  border: 1px solid #e4e7ed;
  color: #909399;
  background: #fff;
}
.eval-subtabs .el-button.subtab-active {
  color: #409eff;
  border-color: #409eff;
  background: #ecf5ff;
}
.eval-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.eval-method-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}
.eval-method-card:hover {
  border-color: #409eff;
}
.eval-method-card.selected {
  border-color: #409eff;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2);
}
.eval-method-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.eval-method-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.eval-method-head p {
  margin: 0;
}
.eval-method-head p:first-child {
  font-size: 13px;
  font-weight: 600;
}
.eval-method-icon {
  padding: 6px;
  border-radius: 6px;
  background: #f0f2f5;
  color: #606266;
  display: flex;
  align-items: center;
}

/* 评价规则 */
.rule-weights {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.weight-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rule-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}
.rule-label {
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
  min-width: 60px;
}
.subject-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.subject-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.eval-points {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.eval-point-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 复用分组 */
.share-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.share-new {
  display: flex;
  gap: 8px;
}
.share-group {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}
.share-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.share-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.share-group-title span {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-group-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.share-group-members {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.share-add-members {
  margin-top: 10px;
  border-top: 1px solid #f2f3f5;
  padding-top: 10px;
}
.candidate-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  max-height: 192px;
  overflow-y: auto;
  margin: 8px 0;
}
.candidate-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.candidate-item:hover {
  background: #f5f7fa;
}
.candidate-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.share-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 能力点 */
.ability-search {
  margin-bottom: 10px;
}
.ability-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.ability-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
}
.ability-item:hover {
  border-color: #409eff;
}
.ability-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.ability-item-info {
  flex: 1;
  min-width: 0;
}
.ability-item-info p {
  margin: 0;
  font-size: 13px;
}
.ability-add-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid #f2f3f5;
  padding-top: 10px;
}
.ability-add-link {
  border-top: 1px solid #f2f3f5;
  padding-top: 8px;
}
</style>
