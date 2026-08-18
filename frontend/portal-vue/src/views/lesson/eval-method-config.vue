<template>
  <div class="eval-method-config">
    <!-- ========== 1. 方法选择 ========== -->
    <div class="section">
      <h4 class="section-title">配置节点测评方式</h4>
      <div class="primary-tabs">
        <el-radio-group v-model="primaryTab" size="small">
          <el-radio-button value="platform">平台通用</el-radio-button>
          <el-radio-button value="industry">行业专属</el-radio-button>
        </el-radio-group>
      </div>
      <div class="secondary-tabs">
        <el-button
          v-for="tab in secondaryTabs"
          :key="tab"
          size="small"
          :type="secondaryTab === tab ? 'primary' : 'default'"
          :plain="secondaryTab !== tab"
          @click="secondaryTab = tab"
        >
          {{ tab }}
        </el-button>
      </div>
      <div class="method-grid">
        <div
          v-for="m in filteredMethodOptions"
          :key="m.key"
          class="method-card"
          :class="[!m.available ? 'disabled' : '', isMethodEnabled(m.key) ? 'enabled' : '']"
          @click="toggleMethod(m.key)"
        >
          <div v-if="!m.available" class="unavailable-mask">未开通</div>
          <div class="method-head">
            <div class="method-icon" :style="{ background: m.colorBg, color: m.color }">
              <el-icon :size="20"><component :is="m.icon" /></el-icon>
            </div>
            <div class="method-text">
              <p class="method-label">{{ m.label }}</p>
              <p class="method-desc">{{ m.desc }}</p>
            </div>
            <div class="method-state">
              <span v-if="isMethodEnabled(m.key)" class="enabled-badge">
                <el-icon color="#409eff"><CircleCheckFilled /></el-icon> 已开通
              </span>
              <el-tag v-if="!m.available" size="small" type="info" disable-transitions>未开通</el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 2. 方法权重 ========== -->
    <div class="section">
      <div class="section-head">
        <h4 class="section-title">测评方式权重</h4>
        <el-button size="small" @click="distributeWeights">平均分配</el-button>
      </div>
      <div v-if="local.evaluationMethods.length === 0" class="empty-tip">请先在上方选择至少一种测评方式</div>
      <el-table v-else :data="weightRows" size="small" class="weight-table">
        <el-table-column label="测评方式" min-width="140">
          <template #default="{ row }">{{ methodLabel(row.key) }}</template>
        </el-table-column>
        <el-table-column label="权重 (%)" width="200">
          <template #default="{ row }">
            <el-input-number v-model="row.weight" :min="0" :max="100" size="small" controls-position="right" @change="onWeightChange" />
          </template>
        </el-table-column>
      </el-table>
      <p v-if="local.evaluationMethods.length > 0" class="weight-total" :class="weightTotal === 100 ? 'ok' : 'warn'">
        权重合计：{{ weightTotal }}%{{ weightTotal === 100 ? '' : '（需等于 100%）' }}
      </p>
    </div>

    <!-- ========== 3. 全局设置 ========== -->
    <div class="section">
      <h4 class="section-title">全局测评设置</h4>
      <div class="global-row">
        <span class="field-label">测评对象</span>
        <el-radio-group v-model="local.evalObject" @change="emitChange">
          <el-radio value="individual">个人</el-radio>
          <el-radio value="group">小组</el-radio>
        </el-radio-group>
      </div>
      <div class="subjects-block">
        <p class="sub-title">评价主体（全局默认）</p>
        <div v-for="s in local.evalSubjects" :key="s.type" class="subject-row">
          <el-switch v-model="s.enabled" size="small" @change="emitChange" />
          <span class="subject-label">{{ subjectLabel(s.type) }}</span>
          <span class="subject-weight">权重</span>
          <el-input-number
            v-model="s.params!.weightPercent"
            :min="0"
            :max="100"
            size="small"
            controls-position="right"
            @change="emitChange"
          />
        </div>
      </div>
      <div class="grade-block">
        <p class="sub-title">等级映射</p>
        <el-table :data="local.gradeMapping" size="small" class="grade-table">
          <el-table-column label="等级" width="70">
            <template #default="{ row }"><el-input v-model="row.grade" size="small" /></template>
          </el-table-column>
          <el-table-column label="最低分" width="110">
            <template #default="{ row }"><el-input-number v-model="row.minScore" :min="0" :max="100" size="small" controls-position="right" @change="emitChange" /></template>
          </el-table-column>
          <el-table-column label="最高分" width="110">
            <template #default="{ row }"><el-input-number v-model="row.maxScore" :min="0" :max="100" size="small" controls-position="right" @change="emitChange" /></template>
          </el-table-column>
          <el-table-column label="说明" min-width="120">
            <template #default="{ row }"><el-input v-model="row.remark" size="small" @change="emitChange" /></template>
          </el-table-column>
        </el-table>
        <el-button size="small" class="reset-grade" @click="resetGradeMapping">恢复默认等级映射</el-button>
      </div>
    </div>

    <!-- ========== 4. 每个方法的配置 ========== -->
    <div v-for="mk in local.evaluationMethods" :key="mk" class="section method-section">
      <h4 class="section-title">{{ methodLabel(mk) }} 配置</h4>

      <!-- 测评对象 -->
      <div class="global-row">
        <span class="field-label">测评对象</span>
        <el-radio-group :model-value="methodEvalObject(mk)" @change="(v: string) => setMethodEvalObject(mk, v)">
          <el-radio value="individual">个人</el-radio>
          <el-radio value="group">小组</el-radio>
        </el-radio-group>
        <span class="inherit-tip">（继承全局设置）</span>
      </div>

      <!-- 评价主体 -->
      <div class="subjects-block">
        <div class="sub-head">
          <p class="sub-title">评价主体</p>
          <el-switch
            :model-value="!hasMethodSubjects(mk)"
            size="small"
            active-text="使用全局设置"
            @change="(v: boolean) => toggleMethodSubjects(mk, v)"
          />
        </div>
        <div v-if="!hasMethodSubjects(mk)" class="inherit-hint">当前方法沿用全局评价主体配置</div>
        <div v-else v-for="s in methodSubjectsOf(mk)" :key="s.type" class="subject-row">
          <el-switch v-model="s.enabled" size="small" @change="emitChange" />
          <span class="subject-label">{{ subjectLabel(s.type) }}</span>
          <span class="subject-weight">权重</span>
          <el-input-number v-model="s.params!.weightPercent" :min="0" :max="100" size="small" controls-position="right" @change="emitChange" />
        </div>
      </div>

      <!-- 评价标准 -->
      <div class="standard-block">
        <div class="sub-head">
          <p class="sub-title">评价标准</p>
          <el-select
            v-if="supportsStandard(mk)"
            :model-value="standardModeOf(mk)"
            size="small"
            style="width: 140px"
            @change="(v: string) => setStandardMode(mk, v)"
          >
            <el-option label="量规评分（评价点）" value="rubric" />
            <el-option label="评分规则（扣分制）" value="score_rule" />
          </el-select>
        </div>

        <!-- 量规：评价点 -->
        <template v-if="standardModeOf(mk) !== 'score_rule'">
          <div v-for="(point, idx) in evalPointsOf(mk)" :key="point.id" class="point-row">
            <div class="point-info">
              <span class="point-name">{{ point.name }}</span>
              <el-tag v-if="point.subType" size="small" type="info" disable-transitions>{{ subTypeLabel(point.subType) }}</el-tag>
              <span class="point-desc">{{ point.desc }}</span>
            </div>
            <span class="point-weight">权重 {{ point.weight ?? 0 }}</span>
            <div class="point-actions">
              <el-button link type="primary" size="small" @click="openPointDialog(mk, idx)">编辑</el-button>
              <el-button link type="danger" size="small" @click="removeEvalPoint(mk, idx)">删除</el-button>
            </div>
          </div>
          <el-button size="small" plain class="add-point" @click="openPointDialog(mk, -1)">
            <el-icon><Plus /></el-icon> 添加评价点
          </el-button>
        </template>

        <!-- 评分规则（扣分制） -->
        <template v-else>
          <div v-for="(sr, idx) in scoreRulesOf(mk)" :key="sr.id" class="point-row">
            <div class="point-info">
              <span class="point-name">{{ sr.name }}</span>
              <span class="point-desc">{{ sr.desc }}</span>
              <span v-if="sr.rule" class="point-rule">{{ sr.rule }}</span>
            </div>
            <span class="point-weight">权重 {{ sr.weight ?? 0 }}</span>
            <div class="point-actions">
              <el-button link type="primary" size="small" @click="openScoreRuleDialog(mk, idx)">编辑</el-button>
              <el-button link type="danger" size="small" @click="removeScoreRule(mk, idx)">删除</el-button>
            </div>
          </div>
          <el-button size="small" plain class="add-point" @click="openScoreRuleDialog(mk, -1)">
            <el-icon><Plus /></el-icon> 添加评分规则
          </el-button>
        </template>
      </div>

      <!-- 测评资源 -->
      <div v-if="resourcePanelOf(mk)" class="resource-block">
        <p class="sub-title">测评资源</p>

        <!-- paper：选择试卷 -->
        <template v-if="mk === 'paper'">
          <div class="resource-row">
            <span v-if="paperInfo" class="paper-name">{{ paperInfo.name }}</span>
            <span v-else class="paper-empty">未选择试卷</span>
            <el-button size="small" @click="openPaperDialog">选择试卷</el-button>
            <el-button v-if="paperInfo" size="small" @click="clearPaper">清除</el-button>
          </div>
        </template>

        <!-- question_bank / quiz：选择题目 -->
        <template v-else-if="mk === 'question_bank' || mk === 'quiz'">
          <div class="resource-row">
            <span class="resource-count">已选 {{ resourceFieldOf(mk).length }} 道题</span>
            <el-button size="small" @click="openQuestionDialog(mk)">选择题目</el-button>
            <el-button v-if="resourceFieldOf(mk).length > 0" size="small" @click="clearQuestions(mk)">清空</el-button>
          </div>
          <div v-if="resourceFieldOf(mk).length > 0" class="question-summary">
            <el-tag v-for="q in questionSummariesFor(mk)" :key="q.id" size="small" type="info" disable-transitions class="q-tag">
              {{ questionContent(q) }}
            </el-tag>
          </div>
        </template>

        <!-- random_draw：现场问答题 -->
        <template v-else-if="mk === 'random_draw'">
          <div class="resource-row">
            <span class="resource-count">已选 {{ local.randomDrawSelectedIds.length }} 道题</span>
            <el-button size="small" @click="openRdqDialog">选择现场问答题</el-button>
            <el-button size="small" @click="openCustomRdqDialog">自定义问答题</el-button>
          </div>
          <div v-if="local.randomDrawSelectedIds.length > 0" class="question-summary">
            <el-tag v-for="q in rdqSummaries" :key="q.id" size="small" type="info" disable-transitions class="q-tag">
              {{ q.name || q.id }}
            </el-tag>
          </div>
        </template>

        <!-- review：评审步骤 -->
        <template v-else-if="mk === 'review'">
          <div v-for="(step, idx) in local.reviewSteps" :key="step.id" class="step-row">
            <el-switch v-model="step.enabled" size="small" @change="emitChange" />
            <span class="step-label">{{ step.label }}</span>
            <span class="step-subject">{{ step.subjectType ? subjectLabel(step.subjectType) : '' }}</span>
            <span class="step-weight">权重 {{ step.weight }}</span>
            <div class="point-actions">
              <el-button link type="primary" size="small" @click="openStepDialog(idx)">编辑</el-button>
              <el-button link type="danger" size="small" @click="removeStep(idx)">删除</el-button>
            </div>
          </div>
          <el-button size="small" plain class="add-point" @click="openStepDialog(-1)">
            <el-icon><Plus /></el-icon> 添加评审步骤
          </el-button>
        </template>
      </div>
    </div>

    <!-- ========== 评价点编辑对话框 ========== -->
    <el-dialog v-model="pointDialog.open" :title="pointDialog.index >= 0 ? '编辑评价点' : '添加评价点'" width="560px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="评价点名称" required>
          <el-input v-model="pointDialog.form.name" placeholder="如：知识掌握、操作规范" />
        </el-form-item>
        <el-form-item label="评价维度">
          <el-select v-model="pointDialog.form.subType" clearable placeholder="选择评价维度" style="width: 100%">
            <el-option v-for="(label, key) in subTypeLabels" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="pointDialog.form.desc" type="textarea" :rows="2" placeholder="评价点说明" />
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="pointDialog.form.weight" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="评分方式">
          <el-select v-model="pointDialog.form.scoringMethod" style="width: 100%">
            <el-option label="按分数" value="score" />
            <el-option label="按等级" value="level" />
            <el-option label="按量规" value="rubric" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联知识点">
          <el-select
            v-model="pointDialog.form.knowledgePointIds"
            multiple
            filterable
            placeholder="选择知识点"
            style="width: 100%"
          >
            <el-option v-for="kp in knowledgePoints" :key="kp.id" :label="kp.name" :value="kp.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联能力点">
          <el-select
            v-model="pointDialog.form.abilityPointIds"
            multiple
            filterable
            placeholder="选择能力点"
            style="width: 100%"
          >
            <el-option v-for="ap in abilityPoints" :key="ap.id" :label="ap.name" :value="ap.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级映射">
          <div class="point-grade-list">
            <div v-for="g in pointDialog.form.gradeMapping" :key="g.id" class="point-grade-row">
              <el-input v-model="g.grade" size="small" style="width: 60px" />
              <el-input-number v-model="g.minScore" :min="0" :max="100" size="small" controls-position="right" />
              <span class="grade-sep">~</span>
              <el-input-number v-model="g.maxScore" :min="0" :max="100" size="small" controls-position="right" />
              <el-input v-model="g.remark" size="small" placeholder="说明" style="flex: 1" />
            </div>
            <el-button size="small" plain @click="resetPointGrades">使用默认等级</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointDialog.open = false">取消</el-button>
        <el-button type="primary" :disabled="!pointDialog.form.name.trim()" @click="savePointDialog">保存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 评分规则编辑对话框 ========== -->
    <el-dialog v-model="scoreRuleDialog.open" :title="scoreRuleDialog.index >= 0 ? '编辑评分规则' : '添加评分规则'" width="520px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="规则名称" required>
          <el-input v-model="scoreRuleDialog.form.name" placeholder="如：完整性" />
        </el-form-item>
        <el-form-item label="规则说明">
          <el-input v-model="scoreRuleDialog.form.desc" type="textarea" :rows="2" placeholder="规则描述" />
        </el-form-item>
        <el-form-item label="扣分规则">
          <el-input v-model="scoreRuleDialog.form.rule" placeholder="如：缺一项扣 5 分" />
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="scoreRuleDialog.form.weight" :min="0" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scoreRuleDialog.open = false">取消</el-button>
        <el-button type="primary" :disabled="!scoreRuleDialog.form.name.trim()" @click="saveScoreRuleDialog">保存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 试卷选择对话框 ========== -->
    <el-dialog v-model="paperDialog.open" title="选择试卷" width="640px" append-to-body>
      <el-input v-model="paperDialog.search" placeholder="搜索试卷名称..." clearable class="dialog-search">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div class="pick-list">
        <el-empty v-if="filteredPapers.length === 0" description="未找到匹配的试卷" :image-size="56" />
        <div
          v-for="p in filteredPapers"
          :key="p.id"
          class="pick-item"
          :class="{ selected: paperDialog.selected === p.id }"
          @click="paperDialog.selected = p.id"
        >
          <el-icon class="pick-check" :color="paperDialog.selected === p.id ? '#409eff' : '#c0c4cc'">
            <CircleCheck v-if="paperDialog.selected === p.id" />
            <CircleCheckFilled v-else class="unchecked" />
          </el-icon>
          <div class="pick-info">
            <p class="pick-name">{{ p.name }}</p>
            <p class="pick-sub">题目 {{ p.questionCount ?? 0 }} 道 · 总分 {{ p.totalScore ?? 0 }}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="paperDialog.open = false">取消</el-button>
        <el-button type="primary" :disabled="!paperDialog.selected" @click="confirmPaper">确定</el-button>
      </template>
    </el-dialog>

    <!-- ========== 题目选择对话框 ========== -->
    <el-dialog v-model="questionDialog.open" :title="questionDialog.method === 'quiz' ? '选择随堂测题目' : '选择题库题目'" width="720px" append-to-body>
      <div class="bank-step" v-if="!questionDialog.bankId">
        <p class="sub-title">选择题库</p>
        <div class="pick-list">
          <div
            v-for="b in banks"
            :key="b.id"
            class="pick-item"
            :class="{ selected: questionDialog.bankId === b.id }"
            @click="pickBank(b.id)"
          >
            <div class="pick-info">
              <p class="pick-name">{{ b.name }}</p>
              <p class="pick-sub">题目 {{ b.questionCount ?? 0 }} 道</p>
            </div>
          </div>
        </div>
      </div>
      <template v-else>
        <div class="bank-head">
          <el-button size="small" link @click="questionDialog.bankId = ''">← 返回题库</el-button>
          <el-input v-model="questionDialog.search" placeholder="搜索题目内容..." clearable class="dialog-search">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <div class="pick-list">
          <el-empty v-if="filteredQuestions.length === 0" description="该题库暂无题目" :image-size="56" />
          <div
            v-for="q in filteredQuestions"
            :key="q.id"
            class="pick-item"
            :class="{ selected: questionDialog.selectedIds.includes(q.id) }"
            @click="toggleQuestionSelect(q.id)"
          >
            <el-icon class="pick-check" :color="questionDialog.selectedIds.includes(q.id) ? '#409eff' : '#c0c4cc'">
              <CircleCheck v-if="questionDialog.selectedIds.includes(q.id)" />
              <CircleCheckFilled v-else class="unchecked" />
            </el-icon>
            <div class="pick-info">
              <p class="pick-name q-content">{{ questionContent(q) }}</p>
              <p class="pick-sub">{{ questionTypeLabel(q.type) }}{{ q.score ? ` · ${q.score} 分` : '' }}</p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="questionDialog.open = false">取消</el-button>
        <el-button type="primary" @click="confirmQuestions">确定（已选 {{ questionDialog.selectedIds.length }}）</el-button>
      </template>
    </el-dialog>

    <!-- ========== 现场问答题选择对话框 ========== -->
    <el-dialog v-model="rdqDialog.open" title="选择现场问答题" width="640px" append-to-body>
      <el-input v-model="rdqDialog.search" placeholder="搜索问题名称、描述..." clearable class="dialog-search">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div class="pick-list">
        <el-empty v-if="filteredRdqs.length === 0" description="未找到匹配的现场问答题" :image-size="56" />
        <div
          v-for="q in filteredRdqs"
          :key="q.id"
          class="pick-item"
          :class="{ selected: rdqDialog.selectedIds.includes(q.id) }"
          @click="toggleRdqSelect(q.id)"
        >
          <el-icon class="pick-check" :color="rdqDialog.selectedIds.includes(q.id) ? '#409eff' : '#c0c4cc'">
            <CircleCheck v-if="rdqDialog.selectedIds.includes(q.id)" />
            <CircleCheckFilled v-else class="unchecked" />
          </el-icon>
          <div class="pick-info">
            <p class="pick-name">{{ q.name }}</p>
            <p class="pick-sub">{{ q.description }}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="rdqDialog.open = false">取消</el-button>
        <el-button type="primary" @click="confirmRdqs">确定（已选 {{ rdqDialog.selectedIds.length }}）</el-button>
      </template>
    </el-dialog>

    <!-- ========== 自定义现场问答题对话框 ========== -->
    <el-dialog v-model="customRdqOpen" title="自定义现场问答题" width="520px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="问题名称" required>
          <el-input v-model="customRdqForm.name" placeholder="问题标题" />
        </el-form-item>
        <el-form-item label="问题描述">
          <el-input v-model="customRdqForm.description" type="textarea" :rows="2" placeholder="问题内容" />
        </el-form-item>
        <el-form-item label="参考答案">
          <el-input v-model="customRdqForm.answer" type="textarea" :rows="2" placeholder="参考答案（可选）" />
        </el-form-item>
        <el-form-item label="所属专业">
          <el-select v-model="customRdqForm.majorId" clearable placeholder="选择专业" style="width: 100%">
            <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customRdqOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!customRdqForm.name.trim()" :loading="savingRdq" @click="saveCustomRdq">保存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 评审步骤编辑对话框 ========== -->
    <el-dialog v-model="stepDialog.open" :title="stepDialog.index >= 0 ? '编辑评审步骤' : '添加评审步骤'" width="520px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="步骤名称" required>
          <el-input v-model="stepDialog.form.label" placeholder="如：学生自评" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="stepDialog.form.description" type="textarea" :rows="2" placeholder="步骤说明" />
        </el-form-item>
        <el-form-item label="评价主体">
          <el-select v-model="stepDialog.form.subjectType" placeholder="选择主体" style="width: 100%">
            <el-option v-for="(label, key) in subjectLabels" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="stepDialog.form.weight" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="stepDialog.form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stepDialog.open = false">取消</el-button>
        <el-button type="primary" :disabled="!stepDialog.form.label.trim()" @click="saveStepDialog">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { request, buildQuery } from '@/api/http';
import { examApi, questionBankApi, questionApi } from '@/api/evaluation';
import { majorApi } from '@/api/system';
import { fetchAllPages, uid, clone, buildDefaultReviewSteps, makeDefaultEvalRuleConfig, mergeEvalRuleMethods, DEFAULT_EVAL_RULE_GRADE_MAPPING, EVAL_SUBJECT_LABELS, EVAL_SUB_TYPE_LABELS, type EvalRuleConfig, type EvalRuleMethodKey, type EvalRulePoint, type EvalRuleScoreRule, type EvalRuleSubjectConfig, type EvalRuleReviewStepInput, type GradeMapping, type KnowledgePointItem, type AbilityPointItem } from './lesson-edit-utils';

const props = withDefaults(
  defineProps<{
    value: EvalRuleConfig | undefined;
    knowledgePoints?: KnowledgePointItem[];
    abilityPoints?: AbilityPointItem[];
  }>(),
  { value: undefined, knowledgePoints: () => [], abilityPoints: () => [] }
);

const emit = defineEmits<{
  (e: 'change', config: EvalRuleConfig): void;
}>();

/* ========== 方法选项 ========== */

interface MethodOption {
  key: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  colorBg: string;
  available: boolean;
  primaryCategory: 'platform' | 'industry';
  secondaryCategory: string;
}

const METHOD_OPTIONS: MethodOption[] = [
  { key: 'question_bank', label: '题库', desc: '从题库选题组成测评资源', icon: 'Collection', color: '#e6a23c', colorBg: '#fdf6ec', available: true, primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'paper', label: '试卷', desc: '使用固定试卷进行考核', icon: 'Tickets', color: '#67c23a', colorBg: '#f0f9eb', available: true, primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'quiz', label: '随堂测', desc: '课堂即时测验', icon: 'EditPen', color: '#f56c6c', colorBg: '#fef0f0', available: true, primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'random_draw', label: '现场问答', desc: '从题库抽取题目，教师现场提问', icon: 'ChatLineRound', color: '#409eff', colorBg: '#ecf5ff', available: true, primaryCategory: 'platform', secondaryCategory: '过程评价' },
  { key: 'review', label: '现场评审', desc: '教师根据表现/材料给评价点打分', icon: 'Stamp', color: '#9c27b0', colorBg: '#f5eef9', available: true, primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'outcome', label: '成果评价', desc: '对学生成果进行评价', icon: 'FolderChecked', color: '#13c2c2', colorBg: '#e6fffb', available: true, primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'homework', label: '作业', desc: '学生提交作业进行评价', icon: 'Notebook', color: '#eb2f96', colorBg: '#fff0f6', available: true, primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'wms_inbound', label: 'WMS(入库单)自动化评分', desc: '基于 WMS 入库单操作的自动化评分', icon: 'Box', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'wms_outbound', label: 'WMS(出库单)自动化评分', desc: '基于 WMS 出库单操作的自动化评分', icon: 'Box', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'wms_wave', label: 'WMS(波次分拣)自动化评分', desc: '基于 WMS 波次分拣操作的自动化评分', icon: 'Box', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'network_traffic', label: '网络流量分析自助评价', desc: '基于网络流量分析的自助评价', icon: 'Odometer', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '网络安全' },
  { key: 'cyber_range', label: '网络靶场自助评价', desc: '基于网络靶场环境的自助评价', icon: 'Odometer', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '网络安全' }
];

const secondaryTabsMap: Record<string, string[]> = {
  platform: ['全部', '知识评价', '过程评价', '成果评价'],
  industry: ['全部', '智慧物流', '网络安全']
};

const primaryTab = ref<'platform' | 'industry'>('platform');
const secondaryTab = ref('全部');

const secondaryTabs = computed(() => secondaryTabsMap[primaryTab.value]);
const filteredMethodOptions = computed(() =>
  METHOD_OPTIONS.filter((m) => {
    if (m.primaryCategory !== primaryTab.value) return false;
    if (secondaryTab.value === '全部') return true;
    return m.secondaryCategory === secondaryTab.value;
  })
);

const methodLabelMap: Record<string, string> = {};
METHOD_OPTIONS.forEach((m) => (methodLabelMap[m.key] = m.label));

function methodLabel(key: string): string {
  return methodLabelMap[key] || key;
}

/* ========== 本地状态 ========== */

const local = ref<EvalRuleConfig>(makeDefaultEvalRuleConfig([]));

watch(
  () => props.value,
  (v) => {
    if (v) {
      const methods = (v.evaluationMethods || []).map((m) =>
        (m as string) === 'exam' ? 'homework' : (m as EvalRuleMethodKey)
      );
      const base = makeDefaultEvalRuleConfig(methods);
      local.value = { ...base, ...clone(v), evaluationMethods: methods };
    }
  },
  { immediate: true, deep: true }
);

function emitChange() {
  emit('change', clone(local.value));
}

function patch(p: Partial<EvalRuleConfig>) {
  local.value = { ...local.value, ...p };
  emitChange();
}

/* ========== 方法选择 ========== */

function isMethodEnabled(key: string): boolean {
  return (local.value.evaluationMethods as string[]).includes(key);
}

function toggleMethod(key: string) {
  const opt = METHOD_OPTIONS.find((o) => o.key === key);
  if (!opt || !opt.available) return;
  const enabled = isMethodEnabled(key);
  const next = enabled
    ? local.value.evaluationMethods.filter((m) => m !== key)
    : [...local.value.evaluationMethods, key as EvalRuleMethodKey];
  local.value = mergeEvalRuleMethods(local.value, next);
  emitChange();
}

/* ========== 权重 ========== */

const weightRows = computed(() =>
  local.value.evaluationMethods.map((k) => ({
    key: k,
    weight: local.value.methodWeights[k] || 0
  }))
);

const weightTotal = computed(() =>
  weightRows.value.reduce((sum, r) => sum + (r.weight || 0), 0)
);

function onWeightChange() {
  const weights: Record<string, number> = {};
  weightRows.value.forEach((r) => (weights[r.key] = r.weight || 0));
  patch({ methodWeights: weights });
}

function distributeWeights() {
  const methods = local.value.evaluationMethods;
  const count = methods.length;
  if (count === 0) return;
  const weights: Record<string, number> = {};
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  methods.forEach((m, i) => {
    weights[m] = base + (i < remainder ? 1 : 0);
  });
  patch({ methodWeights: weights });
}

/* ========== 全局 / 方法级设置 ========== */

const subjectLabels: Record<string, string> = EVAL_SUBJECT_LABELS;
const subTypeLabels: Record<string, string> = EVAL_SUB_TYPE_LABELS;

function subjectLabel(type: string): string {
  return subjectLabels[type] || type;
}
function subTypeLabel(type: string): string {
  return subTypeLabels[type] || type;
}

function methodEvalObject(mk: string): string {
  return local.value.methodEvalObjects[mk] || local.value.evalObject || 'individual';
}

function setMethodEvalObject(mk: string, v: string) {
  patch({ methodEvalObjects: { ...local.value.methodEvalObjects, [mk]: v as EvalRuleConfig['evalObject'] } });
}

function hasMethodSubjects(mk: string): boolean {
  return !!local.value.methodEvalSubjects[mk] && local.value.methodEvalSubjects[mk].length > 0;
}

function methodSubjectsOf(mk: string): EvalRuleSubjectConfig[] {
  return local.value.methodEvalSubjects[mk] || [];
}

function toggleMethodSubjects(mk: string, useGlobal: boolean) {
  if (useGlobal) {
    const next = { ...local.value.methodEvalSubjects };
    delete next[mk];
    patch({ methodEvalSubjects: next });
  } else {
    const cloneGlobal = clone(local.value.evalSubjects) as EvalRuleSubjectConfig[];
    patch({ methodEvalSubjects: { ...local.value.methodEvalSubjects, [mk]: cloneGlobal } });
  }
}

function resetGradeMapping() {
  patch({ gradeMapping: clone(DEFAULT_EVAL_RULE_GRADE_MAPPING) });
}

/* ========== 评价标准（量规 / 评分规则） ========== */

const STANDARD_METHODS = ['random_draw', 'review', 'outcome', 'homework'];

function supportsStandard(mk: string): boolean {
  return STANDARD_METHODS.includes(mk);
}

function standardModeOf(mk: string): string {
  const map: Record<string, string | undefined> = {
    random_draw: local.value.randomDrawStandardMode,
    review: local.value.reviewStandardMode,
    outcome: local.value.outcomeStandardMode,
    homework: local.value.homeworkStandardMode
  };
  return map[mk] || 'rubric';
}

function setStandardMode(mk: string, mode: string) {
  const p: Record<string, any> = {};
  if (mk === 'random_draw') p.randomDrawStandardMode = mode;
  if (mk === 'review') p.reviewStandardMode = mode;
  if (mk === 'outcome') p.outcomeStandardMode = mode;
  if (mk === 'homework') p.homeworkStandardMode = mode;
  patch(p);
}

const evalPointFieldMap: Record<string, keyof EvalRuleConfig> = {
  random_draw: 'randomDrawEvalPoints',
  review: 'reviewEvalPoints',
  paper: 'paperEvalPoints',
  question_bank: 'questionBankEvalPoints',
  outcome: 'outcomeEvalPoints',
  homework: 'homeworkEvalPoints',
  quiz: 'quizEvalPoints'
};

function evalPointsOf(mk: string): EvalRulePoint[] {
  const field = evalPointFieldMap[mk];
  return field ? (local.value[field] as EvalRulePoint[]) || [] : [];
}

function setEvalPoints(mk: string, points: EvalRulePoint[]) {
  const field = evalPointFieldMap[mk];
  if (!field) return;
  patch({ [field]: points } as Partial<EvalRuleConfig>);
}

const scoreRulesFieldMap: Record<string, keyof EvalRuleConfig> = {
  random_draw: 'randomDrawScoreRules',
  review: 'reviewScoreRules',
  outcome: 'outcomeScoreRules',
  homework: 'homeworkScoreRules'
};

function scoreRulesOf(mk: string): EvalRuleScoreRule[] {
  const field = scoreRulesFieldMap[mk];
  return field ? (local.value[field] as EvalRuleScoreRule[]) || [] : [];
}

function setScoreRules(mk: string, rules: EvalRuleScoreRule[]) {
  const field = scoreRulesFieldMap[mk];
  if (!field) return;
  patch({ [field]: rules } as Partial<EvalRuleConfig>);
}

/* ---------- 评价点对话框 ---------- */

interface PointDialogState {
  open: boolean;
  method: string;
  index: number;
  form: {
    id: string;
    name: string;
    desc: string;
    subType: string;
    weight: number;
    scoringMethod: 'score' | 'level' | 'rubric';
    knowledgePointIds: string[];
    abilityPointIds: string[];
    gradeMapping: GradeMapping[];
  };
}

const pointDialog = ref<PointDialogState>({
  open: false,
  method: '',
  index: -1,
  form: { id: '', name: '', desc: '', subType: '', weight: 0, scoringMethod: 'level', knowledgePointIds: [], abilityPointIds: [], gradeMapping: [] }
});

function openPointDialog(mk: string, index: number) {
  const points = evalPointsOf(mk);
  const existing = index >= 0 ? points[index] : undefined;
  pointDialog.value = {
    open: true,
    method: mk,
    index,
    form: {
      id: existing?.id || uid('ep'),
      name: existing?.name || '',
      desc: existing?.desc || '',
      subType: existing?.subType || '',
      weight: existing?.weight ?? 0,
      scoringMethod: existing?.scoringMethod || 'level',
      knowledgePointIds: existing?.knowledgePointIds || [],
      abilityPointIds: existing?.abilityPointIds || [],
      gradeMapping: existing?.gradeMapping
        ? clone(existing.gradeMapping)
        : clone(DEFAULT_EVAL_RULE_GRADE_MAPPING)
    }
  };
}

function resetPointGrades() {
  pointDialog.value.form.gradeMapping = clone(DEFAULT_EVAL_RULE_GRADE_MAPPING);
}

function savePointDialog() {
  const d = pointDialog.value;
  const point: EvalRulePoint = {
    id: d.form.id,
    name: d.form.name.trim(),
    desc: d.form.desc.trim(),
    subType: d.form.subType || undefined,
    weight: d.form.weight,
    scoringMethod: d.form.scoringMethod,
    knowledgePointIds: d.form.knowledgePointIds,
    abilityPointIds: d.form.abilityPointIds,
    gradeMapping: d.form.gradeMapping
  };
  const points = [...evalPointsOf(d.method)];
  if (d.index >= 0 && points[d.index]) {
    points[d.index] = point;
  } else {
    points.push(point);
  }
  setEvalPoints(d.method, points);
  d.open = false;
}

function removeEvalPoint(mk: string, index: number) {
  const points = [...evalPointsOf(mk)];
  points.splice(index, 1);
  setEvalPoints(mk, points);
}

/* ---------- 评分规则对话框 ---------- */

interface ScoreRuleDialogState {
  open: boolean;
  method: string;
  index: number;
  form: { id: string; name: string; desc: string; rule: string; weight: number };
}

const scoreRuleDialog = ref<ScoreRuleDialogState>({
  open: false,
  method: '',
  index: -1,
  form: { id: '', name: '', desc: '', rule: '', weight: 0 }
});

function openScoreRuleDialog(mk: string, index: number) {
  const rules = scoreRulesOf(mk);
  const existing = index >= 0 ? rules[index] : undefined;
  scoreRuleDialog.value = {
    open: true,
    method: mk,
    index,
    form: {
      id: existing?.id || uid('sr'),
      name: existing?.name || '',
      desc: existing?.desc || '',
      rule: existing?.rule || '',
      weight: existing?.weight ?? 0
    }
  };
}

function saveScoreRuleDialog() {
  const d = scoreRuleDialog.value;
  const rule: EvalRuleScoreRule = {
    id: d.form.id,
    name: d.form.name.trim(),
    desc: d.form.desc.trim(),
    rule: d.form.rule.trim() || undefined,
    weight: d.form.weight
  };
  const rules = [...scoreRulesOf(d.method)];
  if (d.index >= 0 && rules[d.index]) {
    rules[d.index] = rule;
  } else {
    rules.push(rule);
  }
  setScoreRules(d.method, rules);
  d.open = false;
}

function removeScoreRule(mk: string, index: number) {
  const rules = [...scoreRulesOf(mk)];
  rules.splice(index, 1);
  setScoreRules(mk, rules);
}

/* ========== 测评资源 ========== */

function resourcePanelOf(mk: string): boolean {
  return ['paper', 'question_bank', 'quiz', 'random_draw', 'review'].includes(mk);
}

function resourceFieldOf(mk: string): string[] {
  if (mk === 'question_bank') return local.value.questionBankQuestions;
  if (mk === 'quiz') return local.value.quizQuestions;
  return [];
}

function clearQuestions(mk: string) {
  if (mk === 'question_bank') patch({ questionBankQuestions: [] });
  if (mk === 'quiz') patch({ quizQuestions: [] });
}

/* ---------- 试卷 ---------- */

const papers = ref<any[]>([]);
const paperDialog = ref<{ open: boolean; search: string; selected: string }>({ open: false, search: '', selected: '' });

const paperInfo = computed(() => papers.value.find((p) => p.id === local.value.paperIds[0]) || null);
const filteredPapers = computed(() => {
  const kw = paperDialog.value.search.trim();
  return papers.value.filter((p) => !kw || p.name.includes(kw));
});

async function openPaperDialog() {
  paperDialog.value = { open: true, search: '', selected: local.value.paperIds[0] || '' };
  if (papers.value.length === 0) {
    try {
      papers.value = await fetchAllPages(({ limit, offset }) => examApi.list({ limit, offset }));
    } catch {
      papers.value = [];
    }
  }
}

function confirmPaper() {
  const id = paperDialog.value.selected;
  if (!id) return;
  const weights = { ...local.value.paperWeights, [id]: local.value.paperWeights[id] ?? 100 };
  patch({ paperIds: [id], paperWeights: weights });
  paperDialog.value.open = false;
}

function clearPaper() {
  patch({ paperIds: [], paperWeights: {} });
}

/* ---------- 题库题目 ---------- */

const banks = ref<any[]>([]);
const bankQuestions = ref<any[]>([]);
const questionDialog = ref<{ open: boolean; method: string; bankId: string; search: string; selectedIds: string[] }>({
  open: false,
  method: '',
  bankId: '',
  search: '',
  selectedIds: []
});

const filteredQuestions = computed(() => {
  const kw = questionDialog.value.search.trim();
  return bankQuestions.value.filter(
    (q) => !kw || (q.content || '').includes(kw) || (q.name || '').includes(kw)
  );
});

function questionContent(q: any): string {
  const raw = q.content || q.name || '';
  const stripped = String(raw).replace(/<[^>]+>/g, '');
  return stripped.length > 60 ? stripped.slice(0, 60) + '...' : stripped;
}

function questionTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    judge: '判断题',
    essay: '简答题',
    fill: '填空题',
    choice: '选择题'
  };
  return type ? map[type] || type : '';
}

async function openQuestionDialog(mk: string) {
  const current = mk === 'quiz' ? local.value.quizQuestions : local.value.questionBankQuestions;
  questionDialog.value = { open: true, method: mk, bankId: '', search: '', selectedIds: [...current] };
  if (banks.value.length === 0) {
    try {
      banks.value = await fetchAllPages(({ limit, offset }) => questionBankApi.list({ limit, offset }));
    } catch {
      banks.value = [];
    }
  }
}

async function pickBank(bankId: string) {
  questionDialog.value.bankId = bankId;
  questionDialog.value.search = '';
  bankQuestions.value = [];
  try {
    const res = await questionApi.list({ bankId, limit: 1000 });
    bankQuestions.value = res.items || [];
  } catch {
    bankQuestions.value = [];
  }
}

function toggleQuestionSelect(qid: string) {
  const ids = questionDialog.value.selectedIds;
  questionDialog.value.selectedIds = ids.includes(qid)
    ? ids.filter((x) => x !== qid)
    : [...ids, qid];
}

function questionSummariesFor(mk: string): any[] {
  const ids = resourceFieldOf(mk);
  const all = bankQuestions.value;
  return all.filter((q) => ids.includes(q.id));
}

function confirmQuestions() {
  const d = questionDialog.value;
  if (d.method === 'quiz') patch({ quizQuestions: [...d.selectedIds] });
  else patch({ questionBankQuestions: [...d.selectedIds] });
  d.open = false;
}

/* ---------- 现场问答题 ---------- */

const rdqQuestions = ref<any[]>([]);
const rdqDialog = ref<{ open: boolean; search: string; selectedIds: string[] }>({ open: false, search: '', selectedIds: [] });
const majors = ref<{ id: string; name: string }[]>([]);
const customRdqOpen = ref(false);
const savingRdq = ref(false);
const customRdqForm = ref({ name: '', description: '', answer: '', majorId: '' });

const filteredRdqs = computed(() => {
  const kw = rdqDialog.value.search.trim();
  return rdqQuestions.value.filter(
    (q) => !kw || (q.name || '').includes(kw) || (q.description || '').includes(kw)
  );
});

const rdqSummaries = computed(() =>
  rdqQuestions.value.filter((q) => local.value.randomDrawSelectedIds.includes(q.id))
);

async function loadRdqQuestions() {
  try {
    rdqQuestions.value = await fetchAllPages(({ limit, offset }) =>
      request<{ items: any[]; total: number }>(`/evaluation/random-draw-questions${buildQuery({ limit, offset })}`)
    );
  } catch {
    rdqQuestions.value = [];
  }
}

async function openRdqDialog() {
  rdqDialog.value = { open: true, search: '', selectedIds: [...local.value.randomDrawSelectedIds] };
  if (rdqQuestions.value.length === 0) await loadRdqQuestions();
}

function toggleRdqSelect(qid: string) {
  const ids = rdqDialog.value.selectedIds;
  rdqDialog.value.selectedIds = ids.includes(qid) ? ids.filter((x) => x !== qid) : [...ids, qid];
}

function confirmRdqs() {
  patch({ randomDrawSelectedIds: [...rdqDialog.value.selectedIds] });
  rdqDialog.value.open = false;
}

function openCustomRdqDialog() {
  customRdqForm.value = { name: '', description: '', answer: '', majorId: '' };
  customRdqOpen.value = true;
  if (majors.value.length === 0) {
    majorApi
      .list({ limit: 1000 })
      .then((res) => {
        majors.value = (res.items || []).map((m: any) => ({ id: m.id, name: m.name }));
      })
      .catch(() => {
        majors.value = [];
      });
  }
}

async function saveCustomRdq() {
  if (!customRdqForm.value.name.trim()) return;
  savingRdq.value = true;
  try {
    const created = await request<any>('/evaluation/random-draw-questions', {
      method: 'POST',
      body: JSON.stringify({
        name: customRdqForm.value.name.trim(),
        description: customRdqForm.value.description.trim() || undefined,
        answer: customRdqForm.value.answer.trim() || undefined,
        majorId: customRdqForm.value.majorId || undefined
      })
    });
    customRdqOpen.value = false;
    await loadRdqQuestions();
    const ids = [...local.value.randomDrawSelectedIds, created.id];
    patch({ randomDrawSelectedIds: ids });
  } catch (e) {
    ElMessage.error((e as Error).message || '现场问答题保存失败');
  } finally {
    savingRdq.value = false;
  }
}

/* ---------- 评审步骤 ---------- */

const stepDialog = ref<{ open: boolean; index: number; form: { id: string; label: string; description: string; subjectType: string; weight: number; enabled: boolean } }>({
  open: false,
  index: -1,
  form: { id: '', label: '', description: '', subjectType: '', weight: 0, enabled: true }
});

function ensureReviewSteps() {
  if (local.value.reviewSteps.length === 0) {
    patch({ reviewSteps: buildDefaultReviewSteps() });
  }
}

function openStepDialog(index: number) {
  ensureReviewSteps();
  const steps = local.value.reviewSteps;
  const existing = index >= 0 ? steps[index] : undefined;
  stepDialog.value = {
    open: true,
    index,
    form: {
      id: existing?.id || uid('rs'),
      label: existing?.label || '',
      description: existing?.description || '',
      subjectType: existing?.subjectType || '',
      weight: existing?.weight ?? 0,
      enabled: existing?.enabled ?? true
    }
  };
}

function saveStepDialog() {
  const d = stepDialog.value;
  const step: EvalRuleReviewStepInput = {
    id: d.form.id,
    label: d.form.label.trim(),
    description: d.form.description.trim() || null,
    subjectType: d.form.subjectType || null,
    assignedUserIds: [],
    weight: d.form.weight,
    sortOrder: 0,
    enabled: d.form.enabled
  };
  const steps = [...local.value.reviewSteps];
  if (d.index >= 0 && steps[d.index]) {
    steps[d.index] = { ...step, sortOrder: d.index };
  } else {
    step.sortOrder = steps.length;
    steps.push(step);
  }
  steps.forEach((s, i) => (s.sortOrder = i));
  patch({ reviewSteps: steps });
  d.open = false;
}

function removeStep(index: number) {
  const steps = [...local.value.reviewSteps];
  steps.splice(index, 1);
  steps.forEach((s, i) => (s.sortOrder = i));
  patch({ reviewSteps: steps });
}
</script>

<style scoped>
.section {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-head .section-title {
  margin: 0;
}
.primary-tabs {
  margin-bottom: 10px;
}
.secondary-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.method-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.method-card {
  position: relative;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;
}
.method-card:hover {
  border-color: #a0cfff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.method-card.enabled {
  border-color: #409eff;
  background: #fafcff;
}
.method-card.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.unavailable-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  pointer-events: none;
}
.unavailable-mask::before {
  content: '未开通';
  font-size: 18px;
  font-weight: 700;
  color: rgba(144, 147, 153, 0.5);
  border: 2px solid rgba(144, 147, 153, 0.35);
  padding: 2px 10px;
  border-radius: 6px;
  transform: rotate(-12deg);
  background: rgba(255, 255, 255, 0.6);
}
.method-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.method-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.method-text {
  flex: 1;
  min-width: 0;
}
.method-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
.method-desc {
  font-size: 11px;
  color: #909399;
  margin: 2px 0 0;
}
.method-state {
  flex-shrink: 0;
}
.enabled-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 8px;
  border-radius: 10px;
}
.empty-tip {
  font-size: 13px;
  color: #c0c4cc;
  padding: 12px 0;
}
.weight-table {
  margin-bottom: 8px;
}
.weight-total {
  font-size: 12px;
  margin: 8px 0 0;
}
.weight-total.ok {
  color: #67c23a;
}
.weight-total.warn {
  color: #e6a23c;
}
.global-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.field-label {
  font-size: 13px;
  color: #606266;
  width: 70px;
  flex-shrink: 0;
}
.inherit-tip {
  font-size: 11px;
  color: #c0c4cc;
}
.subjects-block {
  margin-bottom: 12px;
}
.sub-title {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  margin: 0 0 8px;
}
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sub-head .sub-title {
  margin: 0;
}
.subject-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.subject-label {
  font-size: 13px;
  color: #303133;
  width: 90px;
}
.subject-weight {
  font-size: 12px;
  color: #c0c4cc;
}
.inherit-hint {
  font-size: 12px;
  color: #c0c4cc;
  padding: 4px 0;
}
.grade-table {
  margin-bottom: 8px;
}
.reset-grade {
  font-size: 12px;
}
.method-section {
  border-color: #e8f1fd;
}
.standard-block,
.resource-block {
  margin-bottom: 12px;
}
.point-row,
.step-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #fafafa;
}
.point-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.point-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.point-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
.point-rule {
  font-size: 12px;
  color: #e6a23c;
}
.point-weight {
  font-size: 12px;
  color: #606266;
  flex-shrink: 0;
}
.point-actions {
  flex-shrink: 0;
}
.add-point {
  font-size: 12px;
}
.resource-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}
.paper-name {
  font-size: 13px;
  color: #303133;
  flex: 1;
}
.paper-empty {
  font-size: 13px;
  color: #c0c4cc;
  flex: 1;
}
.resource-count {
  font-size: 13px;
  color: #606266;
  flex: 1;
}
.question-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.q-tag {
  max-width: 200px;
}
.q-tag :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-label {
  font-size: 13px;
  color: #303133;
  min-width: 80px;
}
.step-subject {
  font-size: 12px;
  color: #909399;
  flex: 1;
}
.step-weight {
  font-size: 12px;
  color: #606266;
  flex-shrink: 0;
}
.dialog-search {
  margin-bottom: 10px;
}
.pick-list {
  max-height: 360px;
  overflow-y: auto;
}
.pick-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.pick-item:hover {
  border-color: #a0cfff;
}
.pick-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.pick-check {
  margin-top: 2px;
  flex-shrink: 0;
}
.pick-check .unchecked {
  color: #dcdfe6;
}
.pick-info {
  flex: 1;
  min-width: 0;
}
.pick-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin: 0;
}
.q-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick-sub {
  font-size: 12px;
  color: #909399;
  margin: 4px 0 0;
}
.bank-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.bank-head .dialog-search {
  flex: 1;
  margin: 0;
}
.point-grade-list {
  width: 100%;
}
.point-grade-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.grade-sep {
  color: #c0c4cc;
}
</style>
