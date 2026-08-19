<template>
  <el-dialog
    :model-value="modelValue"
    width="1180px"
    top="4vh"
    append-to-body
    destroy-on-close
    class="resource-dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="dialog-header">
        <p class="dialog-title">测评资源配置</p>
        <p class="dialog-desc">配置 {{ methodLabel }} 的测评资源</p>
      </div>
    </template>

    <!-- ============ 现场问答（random_draw） ============ -->
    <div v-if="methodKey === 'random_draw'" class="panel">
      <div class="rdq-toolbar">
        <el-input v-model="rdqSearch" placeholder="搜索现场问答题名称、描述或适用专业..." clearable class="grow">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="openAddRdq">
          <el-icon><Plus /></el-icon> 新增现场问答题
        </el-button>
      </div>
      <div class="two-col">
        <div class="col-left">
          <div class="major-tabs">
            <button
              v-for="opt in majorOptions"
              :key="opt.id"
              type="button"
              class="major-tab"
              :class="{ active: rdqMajorTab === opt.id }"
              @click="rdqMajorTab = opt.id"
            >
              {{ opt.name }}
            </button>
          </div>
          <p class="col-title">{{ rdqListTitle }}</p>
          <div class="scroll-area">
            <div v-if="loadingRdq" class="loading">加载中...</div>
            <el-empty
              v-else-if="filteredRdq.length === 0"
              :description="rdqSearch ? '未找到匹配的现场问答题' : '暂无现场问答题，请点击上方按钮新增'"
              :image-size="60"
            />
            <el-table v-else :data="filteredRdq" size="small">
              <el-table-column label="题目名称" min-width="130">
                <template #default="{ row }"><span class="strong">{{ row.name }}</span></template>
              </el-table-column>
              <el-table-column label="题目描述" min-width="160">
                <template #default="{ row }">
                  <span class="dim ellipsis" :title="row.description">{{ row.description || '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="适用专业" width="110">
                <template #default="{ row }">
                  <el-tag size="small" type="info" disable-transitions>{{ row.majorName || majorNameMap[row.majorId || ''] || '-' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="230" align="right">
                <template #default="{ row }">
                  <el-button link size="small" @click="openRdqDetail(row.id)">详情</el-button>
                  <el-button link size="small" @click="openEditRdq(row)">编辑</el-button>
                  <el-button
                    size="small"
                    :type="isRdqSelected(row.id) ? 'default' : 'primary'"
                    :plain="isRdqSelected(row.id)"
                    @click="toggleRdqSelect(row.id)"
                  >
                    {{ isRdqSelected(row.id) ? '取消' : '选择' }}
                  </el-button>
                  <el-button link size="small" class="danger" @click="handleDeleteRdq(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div class="col-right">
          <p class="col-title">已配置现场问答题 ({{ selectedRdqList.length }})</p>
          <div class="scroll-area">
            <el-empty v-if="selectedRdqList.length === 0" description="请从左侧选择现场问答题" :image-size="60" />
            <div v-else class="selected-list">
              <div v-for="q in selectedRdqList" :key="q.id" class="selected-card">
                <div class="selected-head">
                  <span class="selected-name">{{ q.name }}</span>
                  <el-button link size="small" @click="toggleRdqSelect(q.id)">
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <p class="selected-desc">{{ q.description || '暂无描述' }}</p>
                <el-tag size="small" type="info" disable-transitions>{{ q.majorName || majorNameMap[q.majorId || ''] || '通用' }}</el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="box">
        <p class="box-title">抽题规则</p>
        <div class="field-grid">
          <div class="field">
            <p class="field-label">抽题方式</p>
            <el-select
              :model-value="rc('drawMode', 'random')"
              @update:model-value="(v: string) => patchResource({ drawMode: v })"
            >
              <el-option label="系统随机分配" value="random" />
              <el-option label="老师手动选择" value="manual" />
            </el-select>
          </div>
          <div class="field">
            <p class="field-label">抽题数量</p>
            <el-input-number
              :min="1"
              :precision="0"
              controls-position="right"
              :model-value="rc('drawCount', 5)"
              @update:model-value="(v: number | undefined) => patchResource({ drawCount: Math.max(1, v || 1) })"
            />
          </div>
        </div>
      </div>

      <div class="box">
        <p class="box-title">现场要求</p>
        <div class="field">
          <p class="field-label">提交材料要求</p>
          <el-input
            type="textarea"
            :rows="4"
            placeholder="请用一句话说明学生需要准备的材料要求..."
            :model-value="rc('submitFormatDesc', '')"
            @update:model-value="(v: string) => patchResource({ submitFormatDesc: v })"
          />
        </div>
        <div class="field">
          <p class="field-label">现场场地/环境资源准备</p>
          <el-input
            type="textarea"
            :rows="4"
            placeholder="请描述现场问答所需的场地、设备及环境资源准备要求..."
            :model-value="rc('venueResources', '')"
            @update:model-value="(v: string) => patchResource({ venueResources: v })"
          />
        </div>
      </div>
    </div>

    <!-- ============ 现场评审（review） ============ -->
    <div v-else-if="methodKey === 'review'" class="panel">
      <el-alert type="warning" :closable="false" show-icon class="notice">
        <template #title>评审说明</template>
        评审时教师根据学生现场表现或提交的材料进行打分。评价点配置请在「评价标准配置」卡片中设置。
      </el-alert>

      <div class="box">
        <div class="box-head">
          <p class="box-title">评审材料要求</p>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('requiresMaterial', true)"
              @update:model-value="(v: boolean) => patchResource({ requiresMaterial: v })"
            />
            <span class="switch-text">是否需要提交评审材料</span>
          </div>
        </div>
        <template v-if="rc('requiresMaterial', true)">
          <div class="field-grid">
            <div class="field">
              <p class="field-label">预估提交天数</p>
              <el-input-number
                :min="1"
                :precision="0"
                controls-position="right"
                :model-value="rc('deadlineDays', 3)"
                @update:model-value="(v: number | undefined) => patchResource({ deadlineDays: Math.max(1, v || 1) })"
              />
            </div>
          </div>
          <div class="field">
            <p class="field-label">提交材料要求</p>
            <el-input
              type="textarea"
              :rows="2"
              placeholder="请用一句话说明学生需要提交的材料要求..."
              :model-value="rc('submitFormatDesc', '')"
              @update:model-value="(v: string) => patchResource({ submitFormatDesc: v })"
            />
          </div>
        </template>
        <div class="field">
          <p class="field-label">评审场地/环境资源准备</p>
          <el-input
            type="textarea"
            :rows="2"
            placeholder="请描述评审所需的场地、设备及环境资源准备要求..."
            :model-value="rc('venueResources', '')"
            @update:model-value="(v: string) => patchResource({ venueResources: v })"
          />
        </div>
        <div class="switch-inline">
          <el-switch
            :model-value="rc('allowResubmit', false)"
            @update:model-value="(v: boolean) => patchResource({ allowResubmit: v })"
          />
          <span class="switch-text">允许重新提交</span>
        </div>
      </div>

      <div class="box">
        <div class="box-head">
          <div class="box-head-left">
            <p class="box-title">评审流程设置</p>
            <span
              v-if="enabledStepCount > 0"
              class="weight-pill"
              :class="stepWeightTotal === 100 ? 'ok' : 'bad'"
            >
              权重合计 {{ stepWeightTotal }}%
              <span v-if="stepWeightTotal !== 100" class="pill-tip">(需等于100%)</span>
            </span>
          </div>
          <div class="box-head-actions">
            <el-button size="small" plain @click="distributeStepWeights">
              <el-icon><RefreshLeft /></el-icon> 一键平均权重
            </el-button>
            <el-button size="small" plain @click="openAddStep">
              <el-icon><Plus /></el-icon> 新增步骤
            </el-button>
          </div>
        </div>

        <div class="step-list">
          <div v-for="(step, idx) in reviewSteps" :key="step.id" class="step-item">
            <!-- 编辑态 -->
            <div v-if="editingStepId === step.id" class="step-edit">
              <div class="field-grid">
                <el-input v-model="editingStepLabel" size="small" placeholder="步骤名称" />
                <el-select
                  size="small"
                  :model-value="step.subjectType || ''"
                  placeholder="请选择评价主体"
                  @update:model-value="(v: string) => updateStep(idx, { subjectType: v })"
                >
                  <el-option v-for="(label, key) in SUBJECT_LABELS" :key="key" :label="label" :value="key" />
                </el-select>
              </div>
              <el-input v-model="editingStepDesc" size="small" placeholder="步骤描述" class="mt-6" />
              <div class="step-edit-actions">
                <el-button size="small" type="primary" @click="saveStepEdit(idx)">保存</el-button>
                <el-button size="small" @click="editingStepId = null">取消</el-button>
              </div>
            </div>
            <!-- 展示态 -->
            <div v-else class="step-row">
              <div class="step-left">
                <el-switch :model-value="step.enabled" @update:model-value="(v: boolean) => toggleStepEnabled(idx, v)" />
                <div class="step-text">
                  <p class="step-label">{{ step.label }}</p>
                  <p class="step-desc">{{ step.desc }}</p>
                </div>
                <el-tag size="small" :type="step.subjectType ? 'info' : 'warning'" disable-transitions>
                  {{ step.subjectType ? SUBJECT_LABELS[step.subjectType] || step.subjectType : '未绑定' }}
                </el-tag>
              </div>
              <div class="step-right">
                <div v-if="step.enabled" class="step-weight">
                  <el-input-number
                    :min="0"
                    :max="100"
                    :precision="0"
                    size="small"
                    controls-position="right"
                    class="weight-input"
                    :model-value="step.weight || 0"
                    @update:model-value="(v: number | undefined) => updateStep(idx, { weight: Math.max(0, Math.min(100, v || 0)) })"
                  />
                  <span class="dim">%</span>
                </div>
                <el-button link size="small" @click="startEditStep(step)">
                  <el-icon><EditPen /></el-icon>
                </el-button>
                <el-button v-if="reviewSteps.length > 1" link size="small" class="danger" @click="removeStep(idx)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>

            <!-- 指定评分人（企业导师影子账号） -->
            <div
              v-if="editingStepId !== step.id && step.enabled && step.subjectType === 'enterprise_mentor'"
              class="mentor-box"
            >
              <p class="mentor-title">指定评分人（企业导师）</p>
              <p v-if="selectableMentors.length === 0" class="dim">
                {{ mentorOptions === null ? '加载中...' : '暂无绑定企业账号的专家，可在企业端专家库完善账号后重试' }}
              </p>
              <template v-else>
                <el-checkbox
                  v-for="m in selectableMentors"
                  :key="m.expertId"
                  :model-value="(step.assignedUserIds || []).includes(m.userId as string)"
                  size="small"
                  class="mentor-item"
                  @update:model-value="(v: boolean) => toggleMentor(idx, m.userId as string, v)"
                >
                  {{ [m.enterpriseName, m.name, m.title].filter(Boolean).join(' · ') }}
                </el-checkbox>
              </template>
            </div>
          </div>
        </div>

        <div v-if="showAddStep" class="add-step">
          <div class="field-grid">
            <el-input v-model="newStepLabel" size="small" placeholder="步骤名称" />
            <el-select v-model="newStepSubjectType" size="small" placeholder="请选择评价主体">
              <el-option v-for="(label, key) in SUBJECT_LABELS" :key="key" :label="label" :value="key" />
            </el-select>
          </div>
          <el-input v-model="newStepDesc" size="small" placeholder="步骤描述" class="mt-6" />
          <div class="step-edit-actions">
            <el-button size="small" type="primary" @click="confirmAddStep">添加</el-button>
            <el-button size="small" @click="cancelAddStep">取消</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 试卷（paper） ============ -->
    <div v-else-if="methodKey === 'paper'" class="panel">
      <div class="box">
        <p class="box-title">选择已有试卷</p>
        <div class="rdq-toolbar">
          <el-input v-model="paperSearch" placeholder="搜索试卷..." clearable class="grow">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button size="small" plain @click="showCreatePaper = true">
            <el-icon><Plus /></el-icon> 新建试卷
          </el-button>
        </div>
        <div v-if="loadingPapers" class="loading">加载中...</div>
        <div v-else class="paper-list">
          <div
            v-for="paper in filteredPapers"
            :key="paper.id"
            class="paper-row"
            :class="{ active: config.paperIds.includes(paper.id) }"
            @click="selectPaper(paper.id)"
          >
            <span class="radio" :class="{ on: config.paperIds.includes(paper.id) }"><i v-if="config.paperIds.includes(paper.id)" /></span>
            <span class="paper-name">{{ paper.name }}</span>
            <el-tag size="small" type="primary" disable-transitions>{{ paper.questions?.length ?? paper.questionCount ?? 0 }} 题</el-tag>
            <el-tag size="small" type="success" disable-transitions>总分 {{ paper.totalScore ?? 100 }}</el-tag>
            <el-button link size="small" @click.stop="openPaperDetail(paper.id)">查看详情</el-button>
          </div>
          <el-empty
            v-if="filteredPapers.length === 0"
            :description="paperSearch ? '未找到匹配的试卷' : '暂无可选试卷，请点击「新建试卷」创建试卷'"
            :image-size="60"
          />
        </div>
      </div>

      <div class="box">
        <p class="box-title">考卷设置</p>
        <div class="field-grid">
          <div class="field">
            <p class="field-label">考试时长（分钟）</p>
            <el-input-number
              :min="0"
              :precision="0"
              controls-position="right"
              :model-value="rc('duration', 60)"
              @update:model-value="(v: number | undefined) => patchResource({ duration: Math.max(0, v || 0) })"
            />
          </div>
          <div class="field">
            <p class="field-label">允许重考</p>
            <div class="switch-inline">
              <el-switch
                :model-value="rc('allowRetake', false)"
                @update:model-value="(v: boolean) => patchResource({ allowRetake: v })"
              />
              <span class="switch-text">{{ rc('allowRetake', false) ? '是' : '否' }}</span>
            </div>
          </div>
          <div v-if="rc('allowRetake', false)" class="field">
            <p class="field-label">最多重考次数</p>
            <el-input-number
              :min="1"
              :precision="0"
              controls-position="right"
              :model-value="rc('retakeCount', 1)"
              @update:model-value="(v: number | undefined) => patchResource({ retakeCount: Math.max(1, v || 1) })"
            />
          </div>
        </div>
        <div class="switch-row">
          <div class="switch-inline">
            <el-switch
              :model-value="rc('shuffleQuestions', true)"
              @update:model-value="(v: boolean) => patchResource({ shuffleQuestions: v })"
            />
            <span class="switch-text">题目乱序</span>
          </div>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('showResult', true)"
              @update:model-value="(v: boolean) => patchResource({ showResult: v })"
            />
            <span class="switch-text">交卷后显示成绩</span>
          </div>
        </div>
        <ExamActivationConfig :value="resourceConfig" @change="patchResource" />
      </div>

      <ExamFormDialog v-model="showCreatePaper" @submit="handleCreatePaper" />

      <el-dialog v-model="paperDetailOpen" title="试卷详情" width="520px" append-to-body>
        <template v-if="paperForDetail">
          <div class="detail-item">
            <p class="field-label">试卷名称</p>
            <p class="detail-value">{{ paperForDetail.name }}</p>
          </div>
          <div class="detail-row">
            <div class="detail-item">
              <p class="field-label">题目数量</p>
              <p class="detail-value">{{ paperForDetail.questions?.length ?? paperForDetail.questionCount ?? 0 }} 题</p>
            </div>
            <div class="detail-item">
              <p class="field-label">总分</p>
              <p class="detail-value">{{ paperForDetail.totalScore ?? 100 }} 分</p>
            </div>
          </div>
        </template>
        <template #footer>
          <el-button @click="paperDetailOpen = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>

    <!-- ============ 题库（question_bank） ============ -->
    <div v-else-if="methodKey === 'question_bank'" class="panel">
      <BankQuestionSelectorPanel
        field="questionBankQuestions"
        :selected-ids="config.questionBankQuestions"
        :question-scores="rc('questionScores', {})"
        @toggle-question="(qid) => emit('toggle-question', 'questionBankQuestions', qid)"
        @update-scores="(scores) => patchResource({ questionScores: { ...rc('questionScores', {}), ...scores } })"
      />
      <div class="box">
        <p class="box-title">答题规则</p>
        <div class="field-grid">
          <div class="field">
            <p class="field-label">答题方式</p>
            <el-select
              :model-value="questionBankDrawMode"
              @update:model-value="(v: string) => patchResource({ drawMode: v })"
            >
              <el-option label="全部作答" value="all" />
              <el-option label="自由刷题" value="practice" />
            </el-select>
          </div>
          <div v-if="questionBankDrawMode === 'practice'" class="field">
            <p class="field-label">正确率（%）</p>
            <el-input-number
              :min="0"
              :max="100"
              :precision="0"
              controls-position="right"
              :model-value="rc('passRate', 60)"
              @update:model-value="(v: number | undefined) => patchResource({ passRate: Math.max(0, Math.min(100, v || 0)) })"
            />
            <p class="field-hint">超过正确率则得分 100，低于正确率得分 0</p>
          </div>
          <div class="field">
            <p class="field-label">时间限制（分钟）</p>
            <el-input-number
              :min="5"
              :precision="0"
              controls-position="right"
              :model-value="rc('timeLimit', 30)"
              @update:model-value="(v: number | undefined) => patchResource({ timeLimit: Math.max(5, v || 5) })"
            />
          </div>
        </div>
        <div class="switch-row">
          <div class="switch-inline">
            <el-switch
              :model-value="rc('allowRetake', true)"
              @update:model-value="(v: boolean) => patchResource({ allowRetake: v })"
            />
            <span class="switch-text">允许重复测评</span>
          </div>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('shuffleQuestions', true)"
              @update:model-value="(v: boolean) => patchResource({ shuffleQuestions: v })"
            />
            <span class="switch-text">题目乱序</span>
          </div>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('showResult', true)"
              @update:model-value="(v: boolean) => patchResource({ showResult: v })"
            />
            <span class="switch-text">提交后展示成绩</span>
          </div>
        </div>
        <div v-if="rc('allowRetake', true)" class="field-grid mt-12">
          <div class="field">
            <p class="field-label">最多重考次数</p>
            <el-input-number
              :min="1"
              :precision="0"
              controls-position="right"
              :model-value="rc('retakeCount', 3)"
              @update:model-value="(v: number | undefined) => patchResource({ retakeCount: Math.max(1, v || 1) })"
            />
          </div>
        </div>
        <ExamActivationConfig :value="resourceConfig" @change="patchResource" />
      </div>
    </div>

    <!-- ============ 成果评价（outcome） ============ -->
    <div v-else-if="methodKey === 'outcome'" class="panel">
      <el-alert type="info" :closable="false" show-icon class="notice">
        <template #title>成果评价说明</template>
        成果评价时教师根据学生提交的成果材料进行打分。评价点配置请在「评价标准配置」卡片中设置。
      </el-alert>
      <div class="box">
        <div class="box-head">
          <p class="box-title">成果材料要求</p>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('requiresMaterial', true)"
              @update:model-value="(v: boolean) => patchResource({ requiresMaterial: v })"
            />
            <span class="switch-text">是否需要提交成果材料</span>
          </div>
        </div>
        <template v-if="rc('requiresMaterial', true)">
          <div class="field-grid">
            <div class="field">
              <p class="field-label">预估提交天数</p>
              <el-input-number
                :min="1"
                :precision="0"
                controls-position="right"
                :model-value="rc('deadlineDays', 3)"
                @update:model-value="(v: number | undefined) => patchResource({ deadlineDays: Math.max(1, v || 1) })"
              />
            </div>
          </div>
          <div class="field">
            <p class="field-label">提交材料要求</p>
            <el-input
              type="textarea"
              :rows="2"
              placeholder="请用一句话说明学生需要提交的成果材料要求..."
              :model-value="rc('submitFormatDesc', '')"
              @update:model-value="(v: string) => patchResource({ submitFormatDesc: v })"
            />
          </div>
        </template>
        <div class="field">
          <p class="field-label">评价场地/环境资源准备</p>
          <el-input
            type="textarea"
            :rows="2"
            placeholder="请描述评价所需的场地、设备及环境资源准备要求..."
            :model-value="rc('venueResources', '')"
            @update:model-value="(v: string) => patchResource({ venueResources: v })"
          />
        </div>
        <div class="switch-inline">
          <el-switch
            :model-value="rc('allowResubmit', false)"
            @update:model-value="(v: boolean) => patchResource({ allowResubmit: v })"
          />
          <span class="switch-text">允许重新提交</span>
        </div>
      </div>
    </div>

    <!-- ============ 作业（homework） ============ -->
    <div v-else-if="methodKey === 'homework'" class="panel">
      <el-alert type="info" :closable="false" show-icon class="notice">
        <template #title>作业说明</template>
        学生提交作业后，教师按评分规则进行打分。评价点配置请在「评价标准配置」卡片中设置。
      </el-alert>
      <div class="box">
        <div class="box-head">
          <p class="box-title">作业提交要求</p>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('requiresMaterial', true)"
              @update:model-value="(v: boolean) => patchResource({ requiresMaterial: v })"
            />
            <span class="switch-text">是否需要提交作业材料</span>
          </div>
        </div>
        <template v-if="rc('requiresMaterial', true)">
          <div class="field-grid">
            <div class="field">
              <p class="field-label">预估提交天数</p>
              <el-input-number
                :min="1"
                :precision="0"
                controls-position="right"
                :model-value="rc('deadlineDays', 3)"
                @update:model-value="(v: number | undefined) => patchResource({ deadlineDays: Math.max(1, v || 1) })"
              />
            </div>
          </div>
          <div class="field">
            <p class="field-label">作业格式要求</p>
            <el-input
              type="textarea"
              :rows="2"
              placeholder="请用一句话说明学生需要提交的作业格式要求..."
              :model-value="rc('submitFormatDesc', '')"
              @update:model-value="(v: string) => patchResource({ submitFormatDesc: v })"
            />
          </div>
        </template>
        <div class="switch-inline">
          <el-switch
            :model-value="rc('allowResubmit', false)"
            @update:model-value="(v: boolean) => patchResource({ allowResubmit: v })"
          />
          <span class="switch-text">允许重新提交</span>
        </div>
      </div>
    </div>

    <!-- ============ 随堂测（quiz） ============ -->
    <div v-else-if="methodKey === 'quiz'" class="panel">
      <BankQuestionSelectorPanel
        field="quizQuestions"
        :selected-ids="config.quizQuestions"
        :max-count="30"
        :question-scores="rc('questionScores', {})"
        @toggle-question="(qid) => emit('toggle-question', 'quizQuestions', qid)"
        @update-scores="(scores) => patchResource({ questionScores: { ...rc('questionScores', {}), ...scores } })"
      />
      <div class="box">
        <p class="box-title">答题规则</p>
        <div class="field">
          <p class="field-label">时间限制</p>
          <div class="preset-row">
            <button
              v-for="min in quizPresetTimes"
              :key="min"
              type="button"
              class="preset-btn"
              :class="{ active: rc('timeLimit', 30) === min && quizIsPreset }"
              @click="patchResource({ timeLimit: min })"
            >
              {{ min }} 分钟
            </button>
            <button
              type="button"
              class="preset-btn"
              :class="{ active: !quizIsPreset && rc('timeLimit', 30) > 0 }"
              @click="patchResource({ timeLimit: quizIsPreset ? 1 : rc('timeLimit', 30) })"
            >
              自定义
            </button>
          </div>
          <el-input-number
            v-if="!quizIsPreset"
            :min="1"
            :precision="0"
            controls-position="right"
            class="mt-6"
            :model-value="rc('timeLimit', 30)"
            @update:model-value="(v: number | undefined) => patchResource({ timeLimit: Math.max(1, v || 1) })"
          />
        </div>
        <div class="switch-row">
          <div class="switch-inline">
            <el-switch
              :model-value="rc('allowRetake', true)"
              @update:model-value="(v: boolean) => patchResource({ allowRetake: v })"
            />
            <span class="switch-text">允许重复测评</span>
          </div>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('shuffleQuestions', true)"
              @update:model-value="(v: boolean) => patchResource({ shuffleQuestions: v })"
            />
            <span class="switch-text">题目乱序</span>
          </div>
          <div class="switch-inline">
            <el-switch
              :model-value="rc('showResult', true)"
              @update:model-value="(v: boolean) => patchResource({ showResult: v })"
            />
            <span class="switch-text">提交后展示成绩</span>
          </div>
        </div>
        <ExamActivationConfig :value="resourceConfig" @change="patchResource" />
      </div>
    </div>

    <!-- 新增/编辑现场问答题 -->
    <el-dialog
      v-model="rdqActionOpen"
      :title="rdqActionMode === 'add' ? '新增现场问答题' : '编辑现场问答题'"
      width="560px"
      append-to-body
      destroy-on-close
    >
      <p class="dialog-desc mb-12">{{ rdqActionMode === 'add' ? '创建一个新的现场问答题' : '修改现场问答题信息' }}</p>
      <el-form label-position="top">
        <el-form-item label="题目名称" required>
          <el-input v-model="rdqForm.name" placeholder="输入题目名称" />
        </el-form-item>
        <el-form-item label="适用专业">
          <el-select v-model="rdqForm.majorId" placeholder="选择适用专业" clearable style="width: 100%">
            <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="题目描述">
          <el-input v-model="rdqForm.description" type="textarea" :rows="3" placeholder="输入题目描述" />
        </el-form-item>
        <el-form-item label="题目答案">
          <el-input v-model="rdqForm.answer" type="textarea" :rows="3" placeholder="输入题目答案" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rdqActionOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!rdqForm.name.trim()" :loading="savingRdq" @click="handleSaveRdq">
          {{ rdqActionMode === 'add' ? '新增' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 现场问答题详情 -->
    <el-dialog v-model="rdqDetailOpen" title="现场问答题详情" width="480px" append-to-body>
      <template v-if="rdqForDetail">
        <div class="detail-item">
          <p class="field-label">题目名称</p>
          <p class="detail-value">{{ rdqForDetail.name }}</p>
        </div>
        <div class="detail-item">
          <p class="field-label">适用专业</p>
          <el-tag size="small" type="info" disable-transitions>
            {{ rdqForDetail.majorName || majorNameMap[rdqForDetail.majorId || ''] || '通用' }}
          </el-tag>
        </div>
        <div class="detail-item">
          <p class="field-label">题目描述</p>
          <p class="detail-value pre">{{ rdqForDetail.description || '-' }}</p>
        </div>
        <div class="detail-item">
          <p class="field-label">题目答案</p>
          <p class="detail-value pre">{{ rdqForDetail.answer || '-' }}</p>
        </div>
      </template>
      <template #footer>
        <el-button @click="rdqDetailOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 测评资源配置弹窗：逐个复刻 React EvaluationRulesEditor 的 evalResourceOnlyPanel。
 * - random_draw：现场问答题库（专业 Tab / 搜索 / 新增 / 编辑 / 详情 / 删除 / 选择）+ 抽题规则 + 现场要求
 * - review：评审材料要求 + 评审流程设置（步骤增删改、权重、一键平均、企业导师指定评分人）
 * - paper：试卷选择 + 考卷设置 + 启用条件 + 新建试卷 / 试卷详情
 * - question_bank / quiz：题库选题面板 + 答题规则 + 启用条件
 * - outcome / homework：材料要求
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Close, Delete, EditPen, Plus, RefreshLeft, Search } from '@element-plus/icons-vue';
import { examApi } from '@/api/evaluation';
import { majorApi } from '@/api/system';
import { fetchAllPages, uid, type EvalRuleConfig, type EvalRuleReviewStepInput } from '@/views/lesson/lesson-edit-utils';
import BankQuestionSelectorPanel from './BankQuestionSelectorPanel.vue';
import ExamActivationConfig from './ExamActivationConfig.vue';
import ExamFormDialog from './ExamFormDialog.vue';
import { allianceExpertApi, randomDrawQuestionApi, type MentorOption, type RandomDrawQuestion } from './api';
import { RESOURCE_DEFAULTS, SUBJECT_LABELS, methodLabelOf, type ExamFormData, type ReviewStep } from './types';

const props = defineProps<{
  modelValue: boolean;
  methodKey: string;
  config: EvalRuleConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'patch', patch: Partial<EvalRuleConfig>): void;
  (e: 'toggle-question', field: 'questionBankQuestions' | 'quizQuestions', qid: string): void;
}>();

const methodLabel = computed(() => methodLabelOf(props.methodKey));

/* ============ 资源配置读写（统一收敛到 config.methodResourceConfigs） ============ */

const resourceConfig = computed<Record<string, any>>(
  () => props.config.methodResourceConfigs?.[props.methodKey] || RESOURCE_DEFAULTS[props.methodKey] || {}
);

/** 读单个资源配置项，缺省回退方法默认值 */
function rc<T>(key: string, fallback: T): T {
  const v = resourceConfig.value[key];
  return (v === undefined || v === null ? fallback : v) as T;
}

function patchResource(updates: Record<string, any>) {
  emit('patch', {
    methodResourceConfigs: {
      ...props.config.methodResourceConfigs,
      [props.methodKey]: { ...(props.config.methodResourceConfigs?.[props.methodKey] || {}), ...updates }
    }
  });
}

/* ============ 现场问答题（random_draw） ============ */

const rdqQuestions = ref<RandomDrawQuestion[]>([]);
const loadingRdq = ref(false);
const rdqSearch = ref('');
const rdqMajorTab = ref('all');
const majors = ref<{ id: string; name: string }[]>([]);
const rdqActionOpen = ref(false);
const rdqActionMode = ref<'add' | 'edit'>('add');
const rdqActionTargetId = ref<string | null>(null);
const rdqForm = ref({ name: '', description: '', answer: '', majorId: '' });
const savingRdq = ref(false);
const rdqDetailOpen = ref(false);
const rdqDetailId = ref<string | null>(null);

const majorOptions = computed(() => [{ id: 'all', name: '全部' }, ...majors.value]);

const majorNameMap = computed(() => {
  const map: Record<string, string> = {};
  majors.value.forEach((m) => (map[m.id] = m.name));
  return map;
});

const filteredRdq = computed(() =>
  rdqQuestions.value.filter((q) => {
    const matchMajor = rdqMajorTab.value === 'all' || q.majorId === rdqMajorTab.value;
    const kw = rdqSearch.value.trim();
    const matchSearch =
      !kw ||
      (q.name || '').includes(kw) ||
      (q.description || '').includes(kw) ||
      (q.majorName || majorNameMap.value[q.majorId || ''] || '').includes(kw);
    return matchMajor && matchSearch;
  })
);

const rdqListTitle = computed(() => {
  if (rdqSearch.value.trim()) return `搜索结果 (${filteredRdq.value.length})`;
  if (rdqMajorTab.value === 'all') return '全部现场问答题';
  return `${majorNameMap.value[rdqMajorTab.value] || rdqMajorTab.value}相关现场问答题`;
});

const selectedRdqList = computed(() =>
  props.config.randomDrawSelectedIds
    .map((id) => rdqQuestions.value.find((q) => q.id === id))
    .filter(Boolean) as RandomDrawQuestion[]
);

const rdqForDetail = computed(() => rdqQuestions.value.find((q) => q.id === rdqDetailId.value) || null);

function isRdqSelected(id: string): boolean {
  return props.config.randomDrawSelectedIds.includes(id);
}

function toggleRdqSelect(id: string) {
  emit('patch', {
    randomDrawSelectedIds: isRdqSelected(id)
      ? props.config.randomDrawSelectedIds.filter((sid) => sid !== id)
      : [...props.config.randomDrawSelectedIds, id]
  });
}

async function loadRdqQuestions() {
  loadingRdq.value = true;
  try {
    rdqQuestions.value = await fetchAllPages<RandomDrawQuestion>(({ limit, offset }) =>
      randomDrawQuestionApi.list({ limit, offset })
    );
  } catch (err) {
    ElMessage.error((err as Error).message || '加载现场问答题列表失败');
  } finally {
    loadingRdq.value = false;
  }
}

async function loadMajors() {
  try {
    const res = await majorApi.list({ limit: 1000 });
    majors.value = ((res.items || []) as any[]).map((m) => ({ id: m.id, name: m.name }));
  } catch (err) {
    ElMessage.error((err as Error).message || '加载专业列表失败');
  }
}

function openAddRdq() {
  rdqForm.value = { name: '', description: '', answer: '', majorId: '' };
  rdqActionMode.value = 'add';
  rdqActionTargetId.value = null;
  rdqActionOpen.value = true;
}

function openEditRdq(q: RandomDrawQuestion) {
  rdqForm.value = {
    name: q.name,
    description: q.description || '',
    answer: q.answer || '',
    majorId: q.majorId || ''
  };
  rdqActionMode.value = 'edit';
  rdqActionTargetId.value = q.id;
  rdqActionOpen.value = true;
}

function openRdqDetail(id: string) {
  rdqDetailId.value = id;
  rdqDetailOpen.value = true;
}

async function handleSaveRdq() {
  if (!rdqForm.value.name.trim()) return;
  savingRdq.value = true;
  try {
    const payload = {
      name: rdqForm.value.name.trim(),
      description: rdqForm.value.description.trim() || undefined,
      answer: rdqForm.value.answer.trim() || undefined,
      majorId: rdqForm.value.majorId || undefined
    };
    if (rdqActionMode.value === 'edit' && rdqActionTargetId.value) {
      await randomDrawQuestionApi.update(rdqActionTargetId.value, payload);
    } else {
      await randomDrawQuestionApi.create(payload);
    }
    await loadRdqQuestions();
    rdqActionOpen.value = false;
    rdqSearch.value = '';
  } catch (err) {
    ElMessage.error((err as Error).message || '现场问答题保存失败');
  } finally {
    savingRdq.value = false;
  }
}

async function handleDeleteRdq(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该现场问答题？', '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await randomDrawQuestionApi.remove(id);
    emit('patch', {
      randomDrawSelectedIds: props.config.randomDrawSelectedIds.filter((sid) => sid !== id)
    });
    await loadRdqQuestions();
  } catch (err) {
    ElMessage.error((err as Error).message || '现场问答题删除失败');
  }
}

/* ============ 试卷（paper） ============ */

const papers = ref<any[]>([]);
const loadingPapers = ref(false);
const paperSearch = ref('');
const showCreatePaper = ref(false);
const paperDetailOpen = ref(false);
const paperDetailId = ref<string | null>(null);

const filteredPapers = computed(() =>
  papers.value.filter((p) => !paperSearch.value.trim() || (p.name || '').includes(paperSearch.value.trim()))
);

const paperForDetail = computed(() => papers.value.find((p) => p.id === paperDetailId.value) || null);

async function loadPapers() {
  loadingPapers.value = true;
  try {
    const res = await examApi.list({ limit: 1000 });
    papers.value = (res.items || []) as any[];
  } catch (err) {
    ElMessage.error((err as Error).message || '加载试卷列表失败');
  } finally {
    loadingPapers.value = false;
  }
}

function selectPaper(paperId: string) {
  emit('patch', { paperIds: [paperId], paperWeights: { [paperId]: 100 } });
}

function openPaperDetail(id: string) {
  paperDetailId.value = id;
  paperDetailOpen.value = true;
}

async function handleCreatePaper(data: ExamFormData) {
  try {
    const created = await examApi.create({
      name: data.name,
      description: data.description,
      batchId: data.batchId,
      duration: data.duration
    } as any);
    papers.value = [...papers.value, created];
    emit('patch', { paperIds: [created.id], paperWeights: { [created.id]: 100 } });
  } catch (err) {
    ElMessage.error((err as Error).message || '创建试卷失败');
  }
}

/* ============ 随堂测时间限制预设 ============ */

const quizPresetTimes = [5, 10, 15, 20, 30];
const quizIsPreset = computed(() => quizPresetTimes.includes(rc('timeLimit', 30)));

/** 题库答题方式（全部作答 / 自由刷题） */
const questionBankDrawMode = computed<string>(() => rc<string>('drawMode', 'all'));

/* ============ 评审步骤（review） ============ */

const reviewSteps = computed<ReviewStep[]>(() =>
  (props.config.reviewSteps || []).map((rs, i) => ({
    id: (rs as { id?: string }).id || `rs-${i}`,
    label: rs.label,
    desc: rs.description || '',
    enabled: rs.enabled,
    subjectType: rs.subjectType || '',
    assignedUserIds: rs.assignedUserIds || [],
    weight: rs.weight
  }))
);

const enabledStepCount = computed(() => reviewSteps.value.filter((s) => s.enabled).length);
const stepWeightTotal = computed(() =>
  reviewSteps.value.filter((s) => s.enabled).reduce((sum, s) => sum + (s.weight || 0), 0)
);

const editingStepId = ref<string | null>(null);
const editingStepLabel = ref('');
const editingStepDesc = ref('');
const showAddStep = ref(false);
const newStepLabel = ref('');
const newStepDesc = ref('');
const newStepSubjectType = ref('');

function writeSteps(next: ReviewStep[]) {
  const steps: EvalRuleReviewStepInput[] = next.map((rs, i) => ({
    id: rs.id,
    label: rs.label,
    description: rs.desc || null,
    enabled: rs.enabled,
    subjectType: rs.subjectType || null,
    assignedUserIds: rs.assignedUserIds || [],
    weight: rs.weight,
    sortOrder: i
  }));
  emit('patch', { reviewSteps: steps });
}

function updateStep(idx: number, updates: Partial<ReviewStep>) {
  writeSteps(reviewSteps.value.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
}

function toggleStepEnabled(idx: number, v: boolean) {
  const step = reviewSteps.value[idx];
  // 开启未绑定主体的步骤时默认绑定「教师」，与 React 一致
  if (v && !step.subjectType) updateStep(idx, { enabled: v, subjectType: 'teacher' });
  else updateStep(idx, { enabled: v });
}

function removeStep(idx: number) {
  writeSteps(reviewSteps.value.filter((_, i) => i !== idx));
}

function startEditStep(step: ReviewStep) {
  editingStepId.value = step.id;
  editingStepLabel.value = step.label;
  editingStepDesc.value = step.desc;
}

function saveStepEdit(idx: number) {
  const step = reviewSteps.value[idx];
  updateStep(idx, {
    label: editingStepLabel.value || step.label,
    desc: editingStepDesc.value || step.desc
  });
  editingStepId.value = null;
}

function openAddStep() {
  showAddStep.value = true;
  newStepLabel.value = '';
  newStepDesc.value = '';
}

function cancelAddStep() {
  showAddStep.value = false;
  newStepLabel.value = '';
  newStepDesc.value = '';
  newStepSubjectType.value = '';
}

function confirmAddStep() {
  if (!newStepLabel.value.trim() || !newStepSubjectType.value) return;
  writeSteps([
    ...reviewSteps.value,
    {
      id: uid('rs'),
      label: newStepLabel.value,
      desc: newStepDesc.value,
      enabled: true,
      subjectType: newStepSubjectType.value,
      assignedUserIds: [],
      weight: 0
    }
  ]);
  cancelAddStep();
}

function distributeStepWeights() {
  const enabled = reviewSteps.value.filter((s) => s.enabled);
  const count = enabled.length;
  if (count === 0) return;
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  writeSteps(
    reviewSteps.value.map((s) =>
      !s.enabled
        ? s
        : { ...s, weight: base + (enabled.findIndex((e) => e.id === s.id) < remainder ? 1 : 0) }
    )
  );
}

/* ============ 企业导师（影子账号）选项 ============ */

const mentorOptions = ref<MentorOption[] | null>(null);
const selectableMentors = computed(() => (mentorOptions.value || []).filter((o) => o.userId));

const hasEnterpriseMentorStep = computed(() =>
  reviewSteps.value.some((s) => s.enabled && s.subjectType === 'enterprise_mentor')
);

async function loadMentorOptions() {
  if (mentorOptions.value !== null) return;
  try {
    const res = await allianceExpertApi.mentorOptions();
    mentorOptions.value = res.items || [];
  } catch {
    mentorOptions.value = [];
  }
}

function toggleMentor(idx: number, userId: string, checked: boolean) {
  const step = reviewSteps.value[idx];
  const ids = step.assignedUserIds || [];
  updateStep(idx, {
    assignedUserIds: checked ? [...ids, userId] : ids.filter((x) => x !== userId)
  });
}

watch(hasEnterpriseMentorStep, (has) => {
  if (has) void loadMentorOptions();
});

/* ============ 首次挂载按方法预加载数据 ============ */

function loadForMethod() {
  if (props.methodKey === 'random_draw') {
    void loadRdqQuestions();
    void loadMajors();
  }
  if (props.methodKey === 'paper') void loadPapers();
  if (props.methodKey === 'review' && hasEnterpriseMentorStep.value) void loadMentorOptions();
}

onMounted(loadForMethod);
watch(() => props.methodKey, loadForMethod);
</script>

<style scoped>
.dialog-header .dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.dialog-header .dialog-desc,
.dialog-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.notice {
  margin: 0;
}
.rdq-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.grow {
  flex: 1;
}
.two-col {
  display: flex;
  gap: 16px;
}
.col-left {
  width: 60%;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}
.col-right {
  width: 40%;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}
.major-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.major-tab {
  border: none;
  background: transparent;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #909399;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.major-tab:hover {
  background: #f5f7fa;
}
.major-tab.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 500;
}
.col-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.scroll-area {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}
.loading {
  text-align: center;
  color: #a8abb2;
  font-size: 13px;
  padding: 24px 0;
}
.strong {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.dim {
  font-size: 12px;
  color: #a8abb2;
}
.ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.danger {
  color: #f56c6c;
}
.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selected-card {
  border: 1px solid #d9ecff;
  background: #f7fbff;
  border-radius: 8px;
  padding: 8px 10px;
}
.selected-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.selected-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-desc {
  margin: 2px 0 4px;
  font-size: 11px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.box {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px;
}
.box-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.box-head .box-title {
  margin: 0;
}
.box-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.box-head-actions {
  display: flex;
  gap: 8px;
}
.weight-pill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
}
.weight-pill.ok {
  background: #f0f9eb;
  color: #67c23a;
}
.weight-pill.bad {
  background: #fef0f0;
  color: #f56c6c;
}
.pill-tip {
  font-size: 10px;
  margin-left: 2px;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field {
  margin-bottom: 12px;
}
.field-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #909399;
}
.field-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #c0c4cc;
}
.switch-row {
  display: flex;
  gap: 20px;
  margin-top: 12px;
}
.switch-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.switch-text {
  font-size: 12px;
  color: #606266;
}
.mt-6 {
  margin-top: 6px;
}
.mt-12 {
  margin-top: 12px;
}
.mb-12 {
  margin-bottom: 12px;
}
.step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}
.step-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.step-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.step-text {
  min-width: 0;
}
.step-label {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}
.step-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: #a8abb2;
}
.step-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-weight {
  display: flex;
  align-items: center;
  gap: 4px;
}
.weight-input {
  width: 92px;
}
.step-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.mentor-box {
  margin-top: 8px;
  padding-left: 44px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mentor-title {
  margin: 0 0 2px;
  font-size: 11px;
  color: #909399;
}
.mentor-item {
  height: 22px;
}
.add-step {
  margin-top: 8px;
  padding: 12px;
  border: 1px dashed #a0cfff;
  border-radius: 8px;
  background: #fafcff;
}
.paper-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.paper-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.paper-row:hover {
  border-color: #c0c4cc;
}
.paper-row.active {
  border-color: #409eff;
  background: #f7fbff;
}
.paper-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.radio {
  width: 16px;
  height: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.radio.on {
  border-color: #409eff;
  background: #409eff;
}
.radio.on i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
}
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.preset-btn {
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}
.preset-btn:hover {
  border-color: #c0c4cc;
}
.preset-btn.active {
  border-color: #409eff;
  background: #f7fbff;
  color: #409eff;
}
.detail-item {
  margin-bottom: 12px;
}
.detail-value {
  margin: 4px 0 0;
  font-size: 13px;
  color: #303133;
}
.detail-value.pre {
  white-space: pre-wrap;
  color: #606266;
}
.detail-row {
  display: flex;
  gap: 24px;
}
</style>
