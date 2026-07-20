// Types
export interface Profession {
  id: string
  name: string
  positions: Position[]
}

export interface Position {
  id: string
  name: string
  professionId: string
}

export interface Batch {
  id: string
  name: string
  code: string
  departmentId: string
  departmentName: string
  professionId?: string
  professionName?: string
  workflowId: string
  workflowName: string
  scenarioCount: number
  createdAt: string
}

export interface ApprovalWorkflow {
  id: string
  name: string
  description: string
  steps: ApprovalStep[]
  createdAt: string
}

export interface ApprovalStep {
  id: string
  order: number
  name: string
  approverRole: string
}

export interface ApprovalItem {
  id: string
  scenarioId: string
  scenarioName: string
  scenarioCode: string
  version: string
  positionName?: string
  batchId: string
  batchName: string
  submitterId: string
  submitterName: string
  currentStep: number
  totalSteps: number
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  comments?: string
  rejectReason?: string
}

export interface TodoItem {
  id: string
  type: "rejected_draft" | "pending_approval"
  title: string
  description: string
  scenarioId?: string
  batchId?: string
  createdAt: string
}

export interface User {
  id: string
  name: string
  role: "admin" | "builder" | "reviewer"
  department: string
}

export interface Scenario {
  id: string
  name: string
  code: string
  coverImage: string
  positionId?: string
  positionName?: string
  professionId?: string
  professionName?: string
  industryId?: string
  industryName?: string
  batchId?: string
  batchName?: string
  difficulty: 1 | 2 | 3 | 4 | 5
  version: string
  status: "draft" | "pending" | "approved" | "rejected" | "published"
  background: string
  deliveryGoal: string
  creatorId: string
  creatorName: string
  coBuilders: { id: string; name: string }[]
  tasks: Task[]
  weightConfig: WeightConfig
  gradeMapping: GradeMapping[]
  createdAt: string
  updatedAt: string
  publishTime?: string
  viewCount?: number
  relatedScenesCount?: number
}

export interface TaskEvalPoint {
  id: string
  name: string
  desc: string
  weight: number
  maxScore: number
  scoringMethod?: "score" | "level" | "rubric"
  gradeMapping?: GradeMapping[]
  subType?: string
  types?: string[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
}

export interface ReviewStep {
  id: string
  label: string
  desc: string
  enabled: boolean
  subjectType: string | null
}

export interface Task {
  id: string
  name: string
  code: string
  order: number
  description: string
  detailedDescription?: string
  descriptionPdf?: string
  estimatedHours: number
  taskType: "assessment" | "training"
  difficulty: 1 | 2 | 3 | 4 | 5
  background: string
  dependencies: string[]
  resources: string[]
  deliverables: TaskDeliverable[]
  knowledgePoints: string[]
  abilityPoints: string[]
  assessment: Assessment | null
  isReferenced?: boolean
  sourceScenarioId?: string
  sourceScenarioName?: string
  evalPoints?: {
    randomDraw?: TaskEvalPoint[]
    review?: TaskEvalPoint[]
    paper?: TaskEvalPoint[]
    questionBank?: TaskEvalPoint[]
    outcome?: TaskEvalPoint[]
    homework?: TaskEvalPoint[]
    quiz?: TaskEvalPoint[]
  }
  reviewSteps?: ReviewStep[]
}

export interface TaskDeliverable {
  id: string
  type: "exercise" | "onsite_evaluation" | "result_file"
  name: string
  description: string
  evaluationPoints?: EvaluationPoint[]
}

export interface EvaluationPoint {
  id: string
  name: string
  description: string
  maxLevel: 5
}

export interface Resource {
  id: string
  name: string
  type: "document" | "video" | "link" | "file"
  url: string
  size?: string
}

export interface DeliverableType {
  id: string
  name: string
  type: "report" | "code" | "video" | "presentation" | "document" | "other"
  required: boolean
  description: string
}

export interface Assessment {
  type: "objective" | "subjective" | "mixed"
  objectiveConfig?: ObjectiveConfig
  subjectiveConfig?: SubjectiveConfig
  mixedWeights?: { objective: number; subjective: number }
}

export interface ObjectiveConfig {
  totalScore: number
  questions: QuestionItem[]
  randomDraw?: {
    enabled: boolean
    count: number
    fromPool: string
  }
}

export interface QuestionItem {
  id: string
  type: "single" | "multiple" | "judgment"
  content: string
  options?: string[]
  answer: string | string[]
  score: number
}

export interface SubjectiveConfig {
  totalScore: number
  rubricPoints: RubricPoint[]
  synthesisRule: "sum" | "weighted"
}

export interface RubricPoint {
  id: string
  name: string
  weight: number
  maxScore: number
  levels: RubricLevel[]
}

export interface RubricLevel {
  id: string
  name: string
  minScore: number
  maxScore: number
  description: string
  color: string
}

export interface WeightConfig {
  tasks: { taskId: string; weight: number }[]
}

export interface GradeMapping {
  id: string
  grade: string
  minScore: number
  maxScore: number
  color: string
  remark?: string
}

export interface GranularLesson {
  id: string
  name: string
  description: string
  code: string
}

export interface KnowledgePoint {
  id: string
  name: string
  description: string
  category?: string
  relatedResources?: string[]
  code?: string
  granularLessons?: string[]
}

export interface AbilityPoint {
  id: string
  name: string
  description: string
  category?: string
  domain?: string
  proficiencyDesc?: string
  code?: string
  positionIds?: string[]
  requiredLevel?: "了解" | "理解" | "掌握" | "熟练" | "精通"
}

export interface LearningResource {
  id: string
  name: string
  type: "document" | "spreadsheet" | "image" | "link" | "audio" | "video" | "archive" | "tool" | "venue" | "facility" | "software" | "other"
  url: string
  size?: string
  description?: string
  knowledgePoints: string[]
  uploadedAt: string
  uploadedBy: string
  thumbnail?: string
}

// Position Ability Types
export interface PositionAbility {
  id: string
  positionId: string
  name: string
  description: string
  weight: number // Percentage weight within the position (0-100)
  category: string
}

export interface TaskAbilityMapping {
  taskId: string
  abilityId: string
  contributionWeight: number // How much this task contributes to the ability (0-100)
}

export interface Student {
  id: string
  name: string
  studentNumber: string
  class: string
  department: string
  enrollmentYear: number
  avatar?: string
}

/** 学生心仪岗位场景（志愿/收藏） */
export interface StudentHeartScene {
  id: string
  studentId: string
  scenarioId: string
  scenarioName: string
  positionId?: string
  positionName?: string
  professionId?: string
  professionName?: string
  priority: number // 优先级：1 第一志愿，2 第二志愿……
  status: "draft" | "submitted" | "matched" | "confirmed" // 草稿/已提交/已匹配/已确认
  createdAt: string
  updatedAt: string
  matchedBatchId?: string
  matchedBatchName?: string
  teacherComment?: string
}

export interface StudentScenarioScore {
  id: string
  studentId: string
  scenarioId: string
  scenarioName: string
  positionId: string
  positionName: string
  totalScore: number
  taskScores: {
    taskId: string
    taskName: string
    score: number
    maxScore: number
  }[]
  completedAt: string
}

export interface StudentAbilityScore {
  studentId: string
  abilityId: string
  abilityName: string
  positionId: string
  score: number // 0-100
  level: "expert" | "proficient" | "familiar" | "beginner" // 精通/熟练/了解/待提升
  scenarioContributions: {
    scenarioId: string
    scenarioName: string
    contribution: number
  }[]
  updatedAt: string
}

// Mock Data
export const professions: Profession[] = [
  {
    id: "prof-1",
    name: "信息技术",
    positions: [
      { id: "pos-1", name: "前端开发工程师", professionId: "prof-1" },
      { id: "pos-2", name: "后端开发工程师", professionId: "prof-1" },
      { id: "pos-3", name: "全栈开发工程师", professionId: "prof-1" },
      { id: "pos-4", name: "数据分析师", professionId: "prof-1" },
    ],
  },
  {
    id: "prof-2",
    name: "电子商务",
    positions: [
      { id: "pos-5", name: "电商运营专员", professionId: "prof-2" },
      { id: "pos-6", name: "网络营销师", professionId: "prof-2" },
      { id: "pos-7", name: "客户服务主管", professionId: "prof-2" },
    ],
  },
  {
    id: "prof-3",
    name: "财务管理",
    positions: [
      { id: "pos-8", name: "会计师", professionId: "prof-3" },
      { id: "pos-9", name: "财务分析师", professionId: "prof-3" },
      { id: "pos-10", name: "审计专员", professionId: "prof-3" },
    ],
  },
  {
    id: "prof-4",
    name: "市场营销",
    positions: [
      { id: "pos-11", name: "市场专员", professionId: "prof-4" },
      { id: "pos-12", name: "品牌经理", professionId: "prof-4" },
    ],
  },
]

export const defaultRubricLevels: RubricLevel[] = [
  { id: "level-1", name: "优秀", minScore: 90, maxScore: 100, description: "表现卓越，超出预期", color: "bg-green-500" },
  { id: "level-2", name: "良好", minScore: 75, maxScore: 89, description: "表现良好，达到预期", color: "bg-blue-500" },
  { id: "level-3", name: "及格", minScore: 60, maxScore: 74, description: "基本合格，有待提升", color: "bg-yellow-500" },
  { id: "level-4", name: "不合格", minScore: 0, maxScore: 59, description: "未达标准，需要改进", color: "bg-red-500" },
]

const defaultGradeMapping: GradeMapping[] = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, color: "bg-green-500", remark: "表现卓越，完全超出预期要求，可作为标杆示范" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, color: "bg-blue-500", remark: "表现良好，达到预期要求，仅有少量可改进之处" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, color: "bg-yellow-500", remark: "基本达标，核心要求已满足，但存在明显不足" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, color: "bg-red-500", remark: "未达标准，核心要求未完成，需要重新学习或训练" },
]

// Industries
export const industries = [
  { id: "ind-1", name: "互联网/IT" },
  { id: "ind-2", name: "电子商务" },
  { id: "ind-3", name: "金融" },
  { id: "ind-4", name: "制造业" },
  { id: "ind-5", name: "服务业" },
]

// Approval Workflows
export const approvalWorkflows: ApprovalWorkflow[] = [
  {
    id: "wf-1",
    name: "教研组长审批",
    description: "仅需教研组长审批即可通过",
    steps: [
      { id: "step-1", order: 1, name: "教研组长审批", approverRole: "教研组长" },
    ],
    createdAt: "2024-01-01",
  },
  {
    id: "wf-2",
    name: "校企联合审批",
    description: "需经教研组长、系主任、企业导师三级审批",
    steps: [
      { id: "step-1", order: 1, name: "教研组长审批", approverRole: "教研组长" },
      { id: "step-2", order: 2, name: "系主任审批", approverRole: "系主任" },
      { id: "step-3", order: 3, name: "企业导师审批", approverRole: "企业导师" },
    ],
    createdAt: "2024-01-01",
  },
  {
    id: "wf-3",
    name: "部门审批",
    description: "教研组长和系主任两级审批",
    steps: [
      { id: "step-1", order: 1, name: "教研组长审批", approverRole: "教研组长" },
      { id: "step-2", order: 2, name: "系主任审批", approverRole: "系主任" },
    ],
    createdAt: "2024-01-05",
  },
]

// Batches
export const batches: Batch[] = [
  {
    id: "batch-1",
    name: "2026春季电商实训场景开发",
    code: "DH2DW3",
    departmentId: "dept-1",
    departmentName: "信息工程系",
    professionId: "prof-2",
    professionName: "电子商务",
    workflowId: "wf-2",
    workflowName: "多级校企联合审批",
    scenarioCount: 12,
    createdAt: "2026-01-15",
  },
  {
    id: "batch-2",
    name: "2026春季前端开发场景建设",
    code: "A1B2C3",
    departmentId: "dept-1",
    departmentName: "信息工程系",
    professionId: "prof-1",
    professionName: "信息技术",
    workflowId: "wf-1",
    workflowName: "单级教研组长审批",
    scenarioCount: 8,
    createdAt: "2026-01-10",
  },
  {
    id: "batch-3",
    name: "2025秋季财务管理场景",
    code: "X9Y8Z7",
    departmentId: "dept-2",
    departmentName: "经济管理系",
    professionId: "prof-3",
    professionName: "财务管理",
    workflowId: "wf-3",
    workflowName: "两级部门审批",
    scenarioCount: 6,
    createdAt: "2025-09-01",
  },
]

// Approval Items
export const approvalItems: ApprovalItem[] = [
  {
    id: "approval-1",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    scenarioCode: "SC-2026-0001",
    version: "v2.1",
    positionName: "前端开发工程师",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    submitterId: "user-1",
    submitterName: "张老师",
    currentStep: 1,
    totalSteps: 1,
    status: "pending",
    submittedAt: "2026-04-18",
  },
  {
    id: "approval-2",
    scenarioId: "scenario-4",
    scenarioName: "电商平台运营全流程",
    scenarioCode: "SC-2026-0004",
    version: "v3.0",
    positionName: "电商运营专员",
    batchId: "batch-1",
    batchName: "2026春季电商实训场景开发",
    submitterId: "user-2",
    submitterName: "李老师",
    currentStep: 2,
    totalSteps: 3,
    status: "pending",
    submittedAt: "2026-04-15",
  },
  {
    id: "approval-3",
    scenarioId: "scenario-3",
    scenarioName: "数据可视化分析实战",
    scenarioCode: "SC-2026-0003",
    version: "v1.2",
    positionName: "数据分析师",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    submitterId: "user-2",
    submitterName: "李老师",
    currentStep: 1,
    totalSteps: 1,
    status: "rejected",
    submittedAt: "2026-04-10",
    comments: "请补充数据清洗相关的任务节点",
    rejectReason: "场景任务链不完整，缺少数据清洗环节，请补充后再提交。",
  },
  {
    id: "approval-4",
    scenarioId: "scenario-5",
    scenarioName: "企业财务报表分析",
    scenarioCode: "SC-2025-0005",
    version: "v2.0",
    positionName: "会计师",
    batchId: "batch-3",
    batchName: "2025秋季财务管理场景",
    submitterId: "user-3",
    submitterName: "王老师",
    currentStep: 2,
    totalSteps: 2,
    status: "approved",
    submittedAt: "2026-03-20",
    comments: "内容完整，审核通过。",
  },
]

// Todo Items
export const todoItems: TodoItem[] = [
  {
    id: "todo-1",
    type: "rejected_draft",
    title: "数据可视化分析实战 - 需修改",
    description: "审批意见：请补充数据清洗相关的任务节点",
    scenarioId: "scenario-3",
    createdAt: "2026-04-17",
  },
  {
    id: "todo-2",
    type: "pending_approval",
    title: "待审批：企业级前端项目开发实战",
    description: "来自2026春季前端开发场景建设批次",
    scenarioId: "scenario-1",
    batchId: "batch-2",
    createdAt: "2026-04-18",
  },
]

// Users for co-builder selection
export const users: User[] = [
  { id: "user-1", name: "张老师", role: "builder", department: "信息工程系" },
  { id: "user-2", name: "李老师", role: "builder", department: "信息工程系" },
  { id: "user-3", name: "王老师", role: "reviewer", department: "经济管理系" },
  { id: "user-4", name: "赵老师", role: "builder", department: "经济管理系" },
  { id: "user-5", name: "刘老师", role: "admin", department: "教务处" },
]

// Dashboard stats
export const dashboardStats = {
  totalScenarios: 156,
  publishedScenarios: 98,
  draftScenarios: 42,
  pendingScenarios: 16,
  departmentDistribution: [
    { name: "信息工程系", count: 68, percentage: 43.6 },
    { name: "经济管理系", count: 45, percentage: 28.8 },
    { name: "艺术设计系", count: 28, percentage: 17.9 },
    { name: "其他", count: 15, percentage: 9.6 },
  ],
  professionDistribution: [
    { name: "信息技术", count: 42 },
    { name: "电子商务", count: 35 },
    { name: "财务管理", count: 28 },
    { name: "市场营销", count: 22 },
    { name: "其他", count: 29 },
  ],
  resourceCoverage: 78.5,
  abilityMappingCompleteness: 65.2,
}

export const scenarios: Scenario[] = [
  {
    id: "scenario-1",
    name: "企业级前端项目开发实战",
    code: "SC-2026-0001",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-1",
    positionName: "前端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    industryId: "ind-1",
    industryName: "互联网/IT",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    difficulty: 5,
    version: "v2.1",
    status: "published",
    publishTime: "2024-03-15 10:30:00",
    viewCount: 684,
    relatedScenesCount: 3,
    creatorId: "user-1",
    creatorName: "张老师",
    coBuilders: [{ id: "user-2", name: "李老师" }],
    background: "在现代企业级应用开发中，前端工程师需要具备完整的项目开发能力，包括技术选型、架构设计、组件开发、性能优化等多个方面。本场景模拟真实企业项目环境，让学员体验完整的前端开发流程。",
    deliveryGoal: "完成一个功能完整的企业级管理后台前端项目，包含用户认证、数据展示、表单处理、权限控制等核心功能模块。",
    tasks: [
      {
        id: "task-1-1",
        name: "项目初始化与架构搭建",
        code: "T-001-001",
        order: 1,
        description: "使用 React + TypeScript 技术栈搭建项目基础架构，配置开发环境和工具链。",
        detailedDescription: `任务描述\n\n你需要完成企业级前端项目初始化与架构搭建。该任务基于React+TypeScript技术栈,要求你从零开始搭建规范的项目基础框架。执行时请注意工程化配置完整性,确保理解需求后再开始。\n\n任务目标\n\n·核心目标:搭建一个符合企业规范的前端项目基础架构\n·目标一:完成项目脚手架初始化与目录结构设计\n·目标二:配置TypeScript、ESLint、Prettier等开发环境\n·目标三:集成路由、状态管理和UI组件库\n·成功标准:项目能正常启动运行,目录结构清晰规范\n\n任务结果\n\n请提交以下内容:\n\n·主交付物:项目代码仓库\n格式要求:Git仓库,包含完整的README文档\n·附属说明:技术选型理由、环境依赖版本说明\n篇幅要求:代码不少于300行,README不少于500字\n\n测评要求\n\n·准确性(30%):配置正确无误,项目可正常运行\n·完整性(25%):覆盖所有技术栈配置要求\n清晰度(20%):目录结构清晰,文档表达简洁\n·实用性(15%):工程化方案可复用,易于维护\n规范性(10%):代码规范,术语统一,无明显错误\n\n一票否决项:若出现抄袭他人项目架构或核心配置错误导致无法运行,视为未通过。`,
        estimatedHours: 8,
        taskType: "assessment",
        difficulty: 3,
        background: "在现代企业开发中，规范的项目初始化是保证代码质量的第一步。",
        dependencies: [],
        resources: ["lr-1", "lr-2"],
        deliverables: [
          { id: "del-1", type: "exercise", name: "架构知识测验", description: "完成项目架构相关的测试题目", evaluationPoints: [] },
          { id: "del-2", type: "result_file", name: "项目代码仓库", description: "包含完整项目初始化代码的 Git 仓库", evaluationPoints: [
            { id: "ep-1", name: "目录结构合理性", description: "项目目录结构清晰、符合规范", maxLevel: 5 },
            { id: "ep-2", name: "配置文件完整性", description: "各类配置文件完整且正确", maxLevel: 5 },
          ] },
        ],
        knowledgePoints: ["kp-1", "kp-2", "kp-7"],
        abilityPoints: ["ab-1", "ab-2", "ab-7"],
        assessment: {
          type: "objective",
          objectiveConfig: {
            totalScore: 100,
            questions: [
              { id: "q-1", type: "single", content: "React 18 中引入的并发特性主要解决什么问题？", options: ["性能优化", "代码复用", "状态管理", "路由控制"], answer: "性能优化", score: 10 },
              { id: "q-2", type: "judgment", content: "TypeScript 是 JavaScript 的超集", answer: "true", score: 10 },
              { id: "q-3", type: "multiple", content: "以下哪些是常用的 React 状态管理方案？", options: ["Redux", "MobX", "Zustand", "jQuery"], answer: ["Redux", "MobX", "Zustand"], score: 20 },
            ],
          },
        },
        evalPoints: {
          paper: [
            { id: "ep-p1-1", name: "架构理论知识", desc: "对软件架构模式（分层架构、微服务、CQRS 等）的理解深度，能否根据业务场景选择合适的架构方案", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-p1-2", name: "UML 建模能力", desc: "对 UML 各类图表（用例图、类图、时序图、活动图）的掌握程度，能否准确表达系统设计", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-p1-3", name: "数据库设计能力", desc: "对数据库范式、索引设计、事务隔离级别的理解，能否设计高效可扩展的数据库结构", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-p1-4", name: "技术选型分析", desc: "面对技术选型能否全面考虑性能、成本、团队能力、生态成熟度等因素，做出合理决策", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          questionBank: [
            { id: "ep-qb1-1", name: "需求分析能力", desc: "能否准确理解业务需求，识别核心功能模块和业务流程，梳理用户故事", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qb1-2", name: "设计模式理解", desc: "对常用设计模式（单例、工厂、观察者、策略等）的理解和适用场景判断", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qb1-3", name: "系统思维", desc: "能否从全局角度思考系统设计，平衡功能、性能、可维护性之间的关系", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qb1-4", name: "表达能力", desc: "回答是否条理清晰、逻辑严谨、能够准确传达设计思路和方案", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          review: [
            { id: "ep-r1-1", name: "文档规范性", desc: "需求文档、架构文档、设计文档的结构是否清晰、内容是否完整、表达是否准确", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-r1-2", name: "设计合理性", desc: "架构设计是否合理（分层、模块划分、技术选型），是否考虑了扩展性和可维护性", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-r1-3", name: "数据库设计质量", desc: "ER 图是否规范、表结构是否合理（范式、索引）、字段定义是否清晰", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-r1-4", name: "接口设计规范", desc: "API 接口规划是否符合 RESTful 规范，URL、参数、返回值设计是否合理", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          randomDraw: [
            { id: "ep-rd1-1", name: "业务理解深度", desc: "对电商业务场景的理解是否深入，能否准确描述各模块之间的关系和数据流转", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-rd1-2", name: "方案论证能力", desc: "面对技术方案选择时能否给出充分的理由和对比分析，考虑多种因素", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-rd1-3", name: "技术表达与沟通", desc: "口头阐述设计思路时是否逻辑清晰、论据充分、能够回应质疑", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-rd1-4", name: "临场应变能力", desc: "面对追问或意外场景假设时能否快速思考、灵活调整方案", weight: 15, maxScore: 15, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          outcome: [
            { id: "ep-oc-s1-1", name: "优化方案完整性", desc: "性能优化方案是否覆盖了前端、后端、数据库等多个维度", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-oc-s1-2", name: "实施效果可量化", desc: "优化前后是否有明确的数据对比（Lighthouse评分、加载时间、接口响应等）", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-oc-s1-3", name: "文档规范性", desc: "优化报告的结构是否清晰、数据是否准确、结论是否有依据", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-oc-s1-4", name: "创新性", desc: "是否提出了创新性的优化思路或采用了前沿的优化技术", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          homework: [
            { id: "ep-hw-s1-1", name: "测试用例完整性", desc: "是否覆盖了正常流程、边界条件、异常场景等主要测试场景", weight: 40, maxScore: 40, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-hw-s1-2", name: "代码规范", desc: "测试代码是否遵循规范，命名清晰，结构合理", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-hw-s1-3", name: "测试报告质量", desc: "报告是否包含测试概述、用例说明、执行结果、问题分析等内容", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          quiz: [
            { id: "ep-qz-s1-1", name: "前端基础知识", desc: "HTML/CSS/JS 基础知识、React 原理、TypeScript 语法等掌握程度", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qz-s1-2", name: "工程化知识", desc: "对构建工具、代码规范、Git 工作流、测试框架等工程化知识的理解", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qz-s1-3", name: "性能与安全", desc: "对前端性能优化手段、Web 安全漏洞及防范措施的理解", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qz-s1-4", name: "架构思维", desc: "对组件设计、状态管理、路由规划等前端架构相关知识的掌握", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
        },
        reviewSteps: [
          { id: "rs-1", label: "初评", desc: "由指导教师进行第一轮评审", enabled: true, subjectType: "teacher" },
          { id: "rs-2", label: "复评", desc: "由专家组进行第二轮复核", enabled: true, subjectType: "teacher" },
        ],
      },
      {
        id: "task-1-2",
        name: "用户认证模块开发",
        code: "T-001-002",
        order: 2,
        description: "实现用户登录、注册、权限验证等认证相关功能。",
        detailedDescription: `任务描述\n\n你需要完成用户认证模块的开发。该任务基于企业级管理后台场景,要求你实现完整的登录注册及权限验证功能。执行时请注意安全性约束,确保理解需求后再开始。\n\n任务目标\n\n·核心目标:实现安全可靠的用户认证系统\n·目标一:完成用户登录、注册功能的前端实现\n·目标二:实现JWT Token的获取、存储和自动刷新\n·目标三:完成路由级别的权限控制与页面守卫\n·成功标准:认证流程完整,无明显安全漏洞\n\n任务结果\n\n请提交以下内容:\n\n·主交付物:认证模块源代码\n格式要求:React组件+自定义Hooks,TypeScript类型完整\n·附属说明:安全策略说明、接口对接文档\n篇幅要求:核心代码不少于200行\n\n测评要求\n\n·准确性(30%):功能正确,认证逻辑清晰可靠\n·完整性(25%):覆盖登录、注册、登出、权限校验等场景\n清晰度(20%):代码结构分明,注释简洁清晰\n·实用性(15%):方案可落地,易于集成到现有项目\n规范性(10%):符合代码规范,术语统一,无明显错误\n\n一票否决项:若出现明文存储密码、Token硬编码等安全问题,视为未通过。`,
        estimatedHours: 12,
        taskType: "assessment",
        difficulty: 4,
        background: "用户认证是企业级应用的基础安全保障。",
        dependencies: ["task-1-1"],
        resources: ["lr-6"],
        deliverables: [
          { id: "del-3", type: "result_file", name: "认证模块代码", description: "包含登录注册功能的完整代码", evaluationPoints: [
            { id: "ep-3", name: "代码质量", description: "代码规范、可读性强", maxLevel: 5 },
            { id: "ep-4", name: "功能完整性", description: "登录注册功能完整", maxLevel: 5 },
            { id: "ep-5", name: "安全性考虑", description: "密码加密、XSS 防护等", maxLevel: 5 },
          ] },
        ],
        knowledgePoints: ["kp-1", "kp-6"],
        abilityPoints: ["ab-1", "ab-5", "ab-9"],
        assessment: {
          type: "subjective",
          subjectiveConfig: {
            totalScore: 100,
            rubricPoints: [
              { id: "rp-1", name: "代码质量", weight: 40, maxScore: 40, levels: defaultRubricLevels },
              { id: "rp-2", name: "功能完整性", weight: 35, maxScore: 35, levels: defaultRubricLevels },
              { id: "rp-3", name: "安全性考虑", weight: 25, maxScore: 25, levels: defaultRubricLevels },
            ],
            synthesisRule: "weighted",
          },
        },
        evalPoints: {
          review: [
            { id: "rev-1", name: "代码规范性", desc: "代码结构清晰、命名规范、注释完整，符合团队编码规范", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "rev-2", name: "功能实现完整性", desc: "登录、注册、权限验证等核心功能是否完整实现，边界场景是否考虑", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "rev-3", name: "安全设计意识", desc: "密码加密、XSS防护、CSRF防护、Token安全等安全措施是否到位", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "rev-4", name: "方案可维护性", desc: "代码是否易于扩展和维护，错误处理是否完善，日志是否规范", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          homework: [
            { id: "ep-hw-t2-1", name: "功能实现完整性", desc: "登录、注册、权限控制等功能是否完整实现，是否覆盖边界场景", weight: 35, maxScore: 35, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-hw-t2-2", name: "代码规范与可读性", desc: "代码结构是否清晰、命名是否规范、注释是否完整", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-hw-t2-3", name: "安全性考虑", desc: "密码加密、Token管理、XSS防护等安全措施是否到位", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-hw-t2-4", name: "用户体验", desc: "交互是否流畅、错误提示是否友好、表单校验是否完善", weight: 15, maxScore: 15, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
        },
        reviewSteps: [
          { id: "rs-1", label: "初评", desc: "由指导教师进行第一轮评审", enabled: true, subjectType: "teacher" },
          { id: "rs-2", label: "复评", desc: "由专家组进行第二轮复核", enabled: true, subjectType: "teacher" },
        ],
      },
      {
        id: "task-1-3",
        name: "核心业务组件开发",
        code: "T-001-003",
        order: 3,
        description: "开发数据表格、图表展示、表单处理等核心业务组件。",
        detailedDescription: `任务描述

你需要完成数据表格、图表展示、表单处理等核心业务组件的开发。该任务基于中后台管理系统场景,要求你开发一套可复用的高质量业务组件。执行时请注意组件设计规范,确保理解需求后再开始。

任务目标

·核心目标:开发一套高质量、可复用的核心业务组件库
·目标一:实现支持排序、筛选、分页的高级数据表格
·目标二:开发基于ECharts的数据可视化图表组件
·目标三:完成表单验证、动态表单项等复杂表单处理
·成功标准:组件功能完整,接口设计合理,文档齐全

任务结果

请提交以下内容:

·主交付物:组件源码及使用文档
格式要求:React组件,包含Storybook或Markdown文档
·附属说明:组件设计思路、接口说明、使用示例
篇幅要求:核心代码不少于400行

测评要求

·准确性(30%):组件功能正确,逻辑清晰
·完整性(25%):覆盖需求中所有组件类型
清晰度(20%):接口文档清晰,示例完整
·实用性(15%):组件可复用性强,易于扩展
规范性(10%):符合代码规范,命名统一,无明显错误

一票否决项:若出现严重Bug或组件完全无法使用,视为未通过。`,
        estimatedHours: 16,
        taskType: "training",
        difficulty: 4,
        background: "可复用的业务组件是提升开发效率的关键。",
        dependencies: ["task-1-1"],
        resources: ["lr-3"],
        deliverables: [
          { id: "del-4", type: "onsite_evaluation", name: "组件演示评审", description: "现场演示组件功能并接受评审", evaluationPoints: [
            { id: "ep-6", name: "组件设计", description: "组件接口设计合理", maxLevel: 5 },
            { id: "ep-7", name: "代码复用性", description: "组件可复用性强", maxLevel: 5 },
          ] },
        ],
        knowledgePoints: ["kp-1", "kp-3"],
        abilityPoints: ["ab-1", "ab-6"],
        assessment: {
          type: "mixed",
          objectiveConfig: {
            totalScore: 40,
            questions: [
              { id: "q-4", type: "single", content: "React 中 useMemo 的主要作用是？", options: ["缓存计算结果", "管理副作用", "处理事件", "路由跳转"], answer: "缓存计算结果", score: 20 },
            ],
          },
          subjectiveConfig: {
            totalScore: 60,
            rubricPoints: [
              { id: "rp-4", name: "组件设计", weight: 50, maxScore: 30, levels: defaultRubricLevels },
              { id: "rp-5", name: "代码复用性", weight: 50, maxScore: 30, levels: defaultRubricLevels },
            ],
            synthesisRule: "sum",
          },
          mixedWeights: { objective: 40, subjective: 60 },
        },
        evalPoints: {
          review: [
            { id: "rev-c-1", name: "组件设计合理性", desc: "组件接口设计是否清晰、props定义是否规范、组件拆分粒度是否合理", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "rev-c-2", name: "代码复用与封装", desc: "组件是否具有良好的复用性，逻辑复用是否合理（Hooks/高阶组件等）", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "rev-c-3", name: "功能完整度", desc: "数据表格、图表、表单等核心功能是否完整实现，交互体验是否流畅", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "rev-c-4", name: "文档与演示", desc: "使用文档是否清晰、演示是否流畅、能否准确表达设计思路", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
          quiz: [
            { id: "ep-qz-t3-1", name: "React核心概念", desc: "对Hooks、虚拟DOM、组件生命周期、状态管理等核心概念的理解", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qz-t3-2", name: "TypeScript类型系统", desc: "对基础类型、接口、泛型、类型推断等TypeScript特性的掌握", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qz-t3-3", name: "组件设计能力", desc: "对组件拆分、Props设计、状态提升、自定义Hooks等设计能力的掌握", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "ep-qz-t3-4", name: "工程化知识", desc: "对构建工具、代码规范、测试、Git工作流等前端工程化知识的理解", weight: 20, maxScore: 20, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
        },
        reviewSteps: [
          { id: "rs-1", label: "初评", desc: "由指导教师进行第一轮评审", enabled: true, subjectType: "teacher" },
          { id: "rs-2", label: "复评", desc: "由教研室主任进行复核", enabled: true, subjectType: "teacher" },
          { id: "rs-3", label: "终评", desc: "答辩委员会最终评定", enabled: false, subjectType: null },
        ],
      },
      {
        id: "task-1-4",
        name: "项目优化与部署",
        code: "T-001-004",
        order: 4,
        description: "进行性能优化、打包配置，完成项目部署上线。",
        detailedDescription: `任务描述

你需要完成前端项目的性能优化与生产环境部署。该任务基于已完成开发的管理后台项目,要求你对项目进行打包优化并成功部署上线。执行时请注意性能指标要求,确保理解需求后再开始。

任务目标

·核心目标:将项目优化至符合生产环境部署标准
·目标一:完成构建体积分析与优化,减少打包体积
·目标二:配置代码分割、懒加载、资源缓存等策略
·目标三:完成项目部署,提供可访问的线上地址
·成功标准:首屏加载时间小于2秒,构建体积合理

任务结果

请提交以下内容:

·主交付物:优化后的项目代码及部署报告
格式要求:Markdown文档+线上访问链接
·附属说明:优化措施说明、性能指标对比数据
篇幅要求:报告不少于800字

测评要求

·准确性(30%):优化措施有效,性能数据真实可靠
·完整性(25%):覆盖构建优化、运行时优化、部署方案
清晰度(20%):报告结构分明,数据表达清晰
·实用性(15%):优化方案可操作,建议可落地
规范性(10%):符合文档规范,术语统一,无明显错误

一票否决项:若出现虚假性能数据或项目无法正常访问,视为未通过。`,
        estimatedHours: 8,
        taskType: "assessment",
        difficulty: 3,
        background: "项目上线前的优化和部署是开发流程的最后关键环节。",
        dependencies: ["task-1-2", "task-1-3"],
        resources: [],
        deliverables: [
          { id: "del-5", type: "result_file", name: "部署报告", description: "项目部署过程和优化措施报告", evaluationPoints: [] },
        ],
        knowledgePoints: ["kp-7"],
        abilityPoints: ["ab-6", "ab-7"],
        assessment: null,
      },
    ],
    weightConfig: {
      tasks: [
        { taskId: "task-1-1", weight: 20 },
        { taskId: "task-1-2", weight: 30 },
        { taskId: "task-1-3", weight: 30 },
        { taskId: "task-1-4", weight: 20 },
      ],
    },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-01-10",
    updatedAt: "2024-01-15",
  },
  {
    id: "scenario-2",
    name: "RESTful API 设计与开发",
    code: "SC-2026-0002",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-2",
    positionName: "后端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    industryId: "ind-1",
    industryName: "互联网/IT",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    difficulty: 3,
    version: "v1.5",
    status: "published",
    publishTime: "2024-02-20 14:00:00",
    creatorId: "user-1",
    creatorName: "张老师",
    coBuilders: [],
    background: "RESTful API 是现代 Web 应用的基础，本场景帮助学员掌握 API 设计原则和最佳实践。",
    deliveryGoal: "设计并实现一套完整的 RESTful API，包含认证、CRUD 操作、错误处理等功能。",
    tasks: [
      {
        id: "task-2-1",
        name: "API 设计规范学习",
        code: "T-002-001",
        order: 1,
        description: "学习 RESTful API 设计原则和规范。",
        detailedDescription: `任务描述

你需要完成RESTful API设计规范的学习与实践。该任务基于后端服务开发场景,要求你掌握API设计原则并完成一套接口设计文档。执行时请注意RESTful规范约束,确保理解需求后再开始。

任务目标

·核心目标:掌握RESTful API设计规范并完成接口设计
·目标一:学习HTTP方法、状态码、资源命名等核心规范
·目标二:完成用户管理模块的API接口设计文档
·目标三:掌握API版本控制、分页、错误处理等最佳实践
·成功标准:接口设计符合RESTful规范,文档清晰完整

任务结果

请提交以下内容:

·主交付物:API接口设计文档
格式要求:Markdown或YAML格式,包含OpenAPI规范
·附属说明:设计思路、接口变更记录
篇幅要求:文档不少于1000字

测评要求

·准确性(30%):接口设计符合RESTful规范,URI命名合理
·完整性(25%):覆盖CRUD操作及错误处理场景
清晰度(20%):文档结构清晰,参数说明完整
·实用性(15%):接口设计可落地,易于前后端对接
规范性(10%):符合文档规范,术语统一,无明显错误

一票否决项:若出现严重违反RESTful原则或接口无法描述清楚,视为未通过。`,
        estimatedHours: 6,
        taskType: "training",
        difficulty: 2,
        background: "RESTful API 是现代 Web 服务的标准接口规范。",
        dependencies: [],
        resources: ["lr-4"],
        deliverables: [],
        knowledgePoints: ["kp-4"],
        abilityPoints: ["ab-3"],
        assessment: null,
        evalPoints: {
          questionBank: [
            { id: "qb-eval-1", name: "HTTP 规范掌握度", desc: "对 HTTP 方法、状态码、头部字段等基础规范的掌握程度", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "qb-eval-2", name: "接口设计合理性", desc: "URI 命名是否规范、资源划分是否合理、版本控制是否得当", weight: 30, maxScore: 30, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "qb-eval-3", name: "文档完整性", desc: "API 文档是否包含参数说明、示例、错误处理等必要内容", weight: 25, maxScore: 25, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
            { id: "qb-eval-4", name: "安全与异常意识", desc: "是否考虑了认证授权、输入校验、错误返回等安全因素", weight: 15, maxScore: 15, scoringMethod: "level", gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)) },
          ],
        },
      },
      {
        id: "task-2-2",
        name: "数据库设计",
        code: "T-002-002",
        order: 2,
        description: "设计数据库模型和关系。",
        detailedDescription: `任务描述

你需要完成电商后台管理系统的数据库设计。该任务基于业务系统开发场景,要求你设计高效规范的数据库表结构并建立正确关系。执行时请注意数据库范式要求,确保理解需求后再开始。

任务目标

·核心目标:设计一套规范、高效的电商系统数据库模型
·目标一:完成用户、商品、订单等核心实体的表结构设计
·目标二:建立正确的表间关系,配置外键约束和索引
·目标三:编写DDL脚本,包含建表语句和初始化数据
·成功标准:表结构符合三范式,关系设计合理,脚本可执行

任务结果

请提交以下内容:

·主交付物:数据库设计文档及DDL脚本
格式要求:Markdown文档+SQL文件
·附属说明:ER图说明、索引设计理由、数据字典
篇幅要求:文档不少于800字,SQL不少于100行

测评要求

·准确性(30%):表结构设计正确,关系建立无误
·完整性(25%):覆盖所有业务实体及关联关系
清晰度(20%):文档和脚本表达清晰,注释完整
·实用性(15%):设计方案可落地,易于扩展维护
规范性(10%):符合命名规范,术语统一,无明显错误

一票否决项:若出现严重违反数据库范式或脚本无法执行,视为未通过。`,
        estimatedHours: 8,
        taskType: "assessment",
        difficulty: 3,
        background: "合理的数据库设计是后端服务稳定运行的基础。",
        dependencies: ["task-2-1"],
        resources: ["lr-5"],
        deliverables: [],
        knowledgePoints: ["kp-5"],
        abilityPoints: ["ab-4"],
        assessment: null,
      },
    ],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-01-08",
    updatedAt: "2024-01-12",
  },
  {
    id: "scenario-3",
    name: "数据可视化分析实战",
    code: "SC-2026-0003",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-4",
    positionName: "数据分析师",
    professionId: "prof-1",
    professionName: "信息技术",
    industryId: "ind-1",
    industryName: "互联网/IT",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    difficulty: 3,
    version: "v1.2",
    status: "rejected",
    publishTime: "",
    creatorId: "user-2",
    creatorName: "李老师",
    coBuilders: [],
    background: "通过真实业务数据，学习数据处理、分析和可视化技术。",
    deliveryGoal: "完成一份完整的数据分析报告，包含数据清洗、分析和可视化展示。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-01-05",
    updatedAt: "2024-01-10",
  },
  {
    id: "scenario-4",
    name: "电商平台运营全流程",
    code: "SC-2026-0004",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-5",
    positionName: "电商运营专员",
    professionId: "prof-2",
    professionName: "电子商务",
    industryId: "ind-2",
    industryName: "电子商务",
    batchId: "batch-1",
    batchName: "2026春季电商实训场景开发",
    difficulty: 2,
    version: "v3.0",
    status: "pending",
    publishTime: "",
    creatorId: "user-2",
    creatorName: "李老师",
    coBuilders: [{ id: "user-4", name: "赵老师" }],
    background: "从店铺搭建到运营推广，完整体验电商运营全流程。",
    deliveryGoal: "独立完成一个电商店铺的搭建、商品上架、营销活动策划。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-08",
  },
  {
    id: "scenario-5",
    name: "企业财务报表分析",
    code: "SC-2025-0005",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-8",
    positionName: "会计师",
    professionId: "prof-3",
    professionName: "财务管理",
    industryId: "ind-3",
    industryName: "金融",
    batchId: "batch-3",
    batchName: "2025秋季财务管理场景",
    difficulty: 3,
    version: "v2.0",
    status: "published",
    publishTime: "2024-01-10 09:00:00",
    creatorId: "user-3",
    creatorName: "王老师",
    coBuilders: [],
    background: "学习企业财务报表的编制和分析方法。",
    deliveryGoal: "能够独立完成企业财务报表的编制和分析。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2023-12-20",
    updatedAt: "2024-01-05",
  },
  {
    id: "scenario-6",
    name: "品牌营销策划实战",
    code: "SC-2025-0006",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-12",
    positionName: "品牌经理",
    professionId: "prof-4",
    professionName: "市场营销",
    industryId: "ind-5",
    industryName: "服务业",
    batchId: "batch-1",
    batchName: "2026春季电商实训场景开发",
    difficulty: 4,
    version: "v1.8",
    status: "draft",
    publishTime: "",
    creatorId: "user-4",
    creatorName: "赵老师",
    coBuilders: [{ id: "user-1", name: "张老师" }],
    background: "从品牌定位到营销执行，全面学习品牌管理技能。",
    deliveryGoal: "制定一份完整的品牌营销策划方案。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2023-12-15",
    updatedAt: "2024-01-02",
  },
  {
    id: "scenario-7",
    name: "未分配岗位的测试草稿场景",
    code: "SC-2026-0007",
    coverImage: "/placeholder.svg?height=200&width=320",
    difficulty: 2,
    version: "v1.0",
    status: "draft",
    publishTime: "",
    creatorId: "user-1",
    creatorName: "张老师",
    coBuilders: [],
    background: "这是一个尚未关联岗位和批次的草稿场景。",
    deliveryGoal: "待补充。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-02-01",
    updatedAt: "2024-02-01",
  },
  {
    id: "scenario-8",
    name: "独立项目草稿 - 新媒体运营",
    code: "SC-2026-0008",
    coverImage: "/placeholder.svg?height=200&width=320",
    difficulty: 3,
    version: "v1.0",
    status: "draft",
    publishTime: "",
    creatorId: "user-2",
    creatorName: "李老师",
    coBuilders: [],
    background: "探索新媒体运营相关的实践场景设计。",
    deliveryGoal: "待补充。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-02-05",
    updatedAt: "2024-02-05",
  },
  {
    id: "scenario-9",
    name: "移动端电商 App 开发实战",
    code: "SC-2026-0009",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-3",
    positionName: "移动端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    industryId: "ind-2",
    industryName: "电子商务",
    batchId: "batch-1",
    batchName: "2026春季电商实训场景开发",
    difficulty: 4,
    version: "v1.0",
    status: "pending",
    publishTime: "",
    creatorId: "user-1",
    creatorName: "张老师",
    coBuilders: [{ id: "user-3", name: "王老师" }],
    background: "基于 Flutter 跨平台技术栈，完成一款电商 App 的核心功能开发，包括商品浏览、购物车、订单管理等模块。",
    deliveryGoal: "独立完成电商 App 的 UI 设计与核心功能编码，代码需通过单元测试并提交完整文档。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-03-10",
    updatedAt: "2024-03-12",
  },
  {
    id: "scenario-10",
    name: "云原生微服务架构设计",
    code: "SC-2026-0010",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-2",
    positionName: "后端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    industryId: "ind-1",
    industryName: "互联网/IT",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    difficulty: 5,
    version: "v1.0",
    status: "rejected",
    publishTime: "",
    creatorId: "user-1",
    creatorName: "张老师",
    coBuilders: [],
    background: "设计一套基于 Kubernetes 的云原生微服务架构，包含服务发现、负载均衡、熔断降级等核心能力。",
    deliveryGoal: "输出完整的架构设计文档，包含服务拆分策略、通信协议选型、部署流水线设计。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-03-01",
    updatedAt: "2024-03-05",
  },
  {
    id: "scenario-11",
    name: "智能客服机器人训练",
    code: "SC-2026-0011",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-6",
    positionName: "人工智能训练师",
    professionId: "prof-1",
    professionName: "信息技术",
    industryId: "ind-1",
    industryName: "互联网/IT",
    batchId: "batch-2",
    batchName: "2026春季前端开发场景建设",
    difficulty: 3,
    version: "v1.0",
    status: "approved",
    publishTime: "",
    creatorId: "user-1",
    creatorName: "张老师",
    coBuilders: [{ id: "user-2", name: "李老师" }],
    background: "基于大语言模型，完成智能客服机器人的意图识别、多轮对话和知识库配置训练。",
    deliveryGoal: "搭建可运行的智能客服 Demo，意图识别准确率不低于 85%，并输出训练报告。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-02-20",
    updatedAt: "2024-02-28",
  },
  {
    id: "scenario-12",
    name: "跨境电商物流方案设计",
    code: "SC-2026-0012",
    coverImage: "/placeholder.svg?height=200&width=320",
    positionId: "pos-5",
    positionName: "电商运营专员",
    professionId: "prof-2",
    professionName: "电子商务",
    industryId: "ind-2",
    industryName: "电子商务",
    batchId: "batch-1",
    batchName: "2026春季电商实训场景开发",
    difficulty: 2,
    version: "v1.0",
    status: "pending",
    publishTime: "",
    creatorId: "user-4",
    creatorName: "赵老师",
    coBuilders: [{ id: "user-1", name: "张老师" }],
    background: "针对跨境电商业务，设计覆盖仓储、通关、尾程配送的一体化物流解决方案。",
    deliveryGoal: "完成物流成本测算、时效对比分析，并给出可落地的服务商选型建议。",
    tasks: [],
    weightConfig: { tasks: [] },
    gradeMapping: defaultGradeMapping,
    createdAt: "2024-03-15",
    updatedAt: "2024-03-18",
  },
]

// Knowledge Points Library
export const granularLessons: GranularLesson[] = [
  { id: "gl-1", name: "React 基础入门", description: "React 核心概念与 Hooks 使用", code: "GL-001" },
  { id: "gl-2", name: "TypeScript 实战", description: "TS 类型系统与工程化实践", code: "GL-002" },
  { id: "gl-3", name: "CSS 布局精讲", description: "Flexbox 与 Grid 布局详解", code: "GL-003" },
  { id: "gl-4", name: "RESTful API 设计", description: "API 设计规范与最佳实践", code: "GL-004" },
  { id: "gl-5", name: "数据库设计基础", description: "关系型数据库建模方法", code: "GL-005" },
  { id: "gl-6", name: "Node.js 服务端开发", description: "Node.js 后端服务开发与性能优化", code: "GL-006" },
  { id: "gl-7", name: "Docker 容器化部署", description: "Docker 镜像构建与容器编排", code: "GL-007" },
  { id: "gl-8", name: "Redis 缓存策略", description: "Redis 数据结构与缓存设计模式", code: "GL-008" },
  { id: "gl-9", name: "Git 工作流与协作", description: "Git 分支策略与团队协作规范", code: "GL-009" },
  { id: "gl-10", name: "电商数据分析", description: "电商运营数据分析与指标拆解", code: "GL-010" },
]

export const knowledgePoints: KnowledgePoint[] = [
  { id: "kp-1", name: "React Hooks", description: "React 函数组件中的状态和副作用管理", category: "前端开发", relatedResources: ["lr-1", "lr-2"], code: "KP-001", granularLessons: ["gl-1", "gl-2", "gl-3"] },
  { id: "kp-2", name: "TypeScript 基础", description: "TypeScript 类型系统和基本语法", category: "前端开发", relatedResources: ["lr-2", "lr-3"], code: "KP-002", granularLessons: ["gl-2", "gl-4", "gl-6"] },
  { id: "kp-3", name: "CSS Flexbox", description: "CSS 弹性盒子布局", category: "前端开发", relatedResources: ["lr-3"], code: "KP-003", granularLessons: ["gl-3", "gl-1"] },
  { id: "kp-4", name: "RESTful API", description: "REST 风格的 API 设计原则", category: "后端开发", relatedResources: ["lr-4", "lr-5"], code: "KP-004", granularLessons: ["gl-4", "gl-6", "gl-8"] },
  { id: "kp-5", name: "数据库设计", description: "关系型数据库表结构设计", category: "后端开发", relatedResources: ["lr-5"], code: "KP-005", granularLessons: ["gl-5", "gl-8", "gl-10"] },
  { id: "kp-6", name: "JWT 认证", description: "JSON Web Token 身份验证机制", category: "安全", relatedResources: ["lr-6", "lr-4"], code: "KP-006", granularLessons: ["gl-4", "gl-5", "gl-6", "gl-8"] },
  { id: "kp-7", name: "Git 版本控制", description: "Git 分支管理和协作开发", category: "工具", relatedResources: ["lr-7"], code: "KP-007", granularLessons: ["gl-9", "gl-2"] },
  { id: "kp-8", name: "电商运营基础", description: "电商平台运营的基本概念和流程", category: "电子商务", relatedResources: ["lr-9", "lr-10"], code: "KP-008", granularLessons: ["gl-10", "gl-5", "gl-9"] },
  { id: "kp-9", name: "数据可视化", description: "使用图表展示数据的方法和技巧", category: "数据分析", relatedResources: ["lr-10"], code: "KP-009", granularLessons: ["gl-3", "gl-10", "gl-1"] },
  { id: "kp-10", name: "财务报表分析", description: "企业财务报表的编制和分析方法", category: "财务管理", relatedResources: ["lr-10"], code: "KP-010", granularLessons: ["gl-10", "gl-5", "gl-8", "gl-9"] },
]

// Ability Points Library (global)
export const abilityPoints: AbilityPoint[] = [
  { id: "ab-1", name: "组件封装能力", description: "能够将业务逻辑封装为可复用的组件", category: "开发能力", domain: "前端工程化", proficiencyDesc: "L1:能使用现有组件; L2:能修改组件适配需求; L3:能独立封装通用组件; L4:能设计组件库架构; L5:能制定团队组件规范", code: "AB-001", positionIds: ["pos-1", "pos-3"], requiredLevel: "精通" },
  { id: "ab-2", name: "状态管理能力", description: "合理使用状态管理方案管理应用数据", category: "开发能力", domain: "前端工程化", proficiencyDesc: "L1:了解useState/useReducer; L2:能使用Context; L3:能使用Redux/Zustand; L4:能设计状态架构; L5:能优化大规模状态性能", code: "AB-002", positionIds: ["pos-1", "pos-3"], requiredLevel: "熟练" },
  { id: "ab-3", name: "接口设计能力", description: "设计清晰、规范的 API 接口", category: "设计能力", domain: "系统设计", proficiencyDesc: "L1:能调用现成接口; L2:能编写简单CRUD; L3:能设计RESTful接口; L4:能设计版本兼容策略; L5:能设计高并发接口架构", code: "AB-003", positionIds: ["pos-2", "pos-3"], requiredLevel: "精通" },
  { id: "ab-4", name: "数据库建模能力", description: "设计高效、规范的数据库表结构", category: "设计能力", domain: "系统设计", proficiencyDesc: "L1:能写基本SQL; L2:能设计单表结构; L3:能设计多表关联; L4:能优化查询性能; L5:能设计分库分表方案", code: "AB-004", positionIds: ["pos-2", "pos-3", "pos-4"], requiredLevel: "熟练" },
  { id: "ab-5", name: "安全编码能力", description: "编写安全的代码，防范常见安全漏洞", category: "开发能力", domain: "质量保障", proficiencyDesc: "L1:了解常见漏洞概念; L2:能避免XSS/SQL注入; L3:能实施认证授权; L4:能进行安全审计; L5:能设计安全架构", code: "AB-005", positionIds: ["pos-1", "pos-2", "pos-3"], requiredLevel: "理解" },
  { id: "ab-6", name: "性能优化能力", description: "识别性能瓶颈并进行优化", category: "优化能力", domain: "质量保障", proficiencyDesc: "L1:能使用性能分析工具; L2:能优化渲染性能; L3:能优化网络请求; L4:能优化构建体积; L5:能设计性能监控体系", code: "AB-006", positionIds: ["pos-1", "pos-2", "pos-3"], requiredLevel: "掌握" },
  { id: "ab-7", name: "团队协作能力", description: "有效沟通、代码审查、文档编写", category: "软技能", domain: "职业素养", proficiencyDesc: "L1:能完成分配任务; L2:能主动沟通问题; L3:能进行代码审查; L4:能指导初级成员; L5:能推动团队协作文化", code: "AB-007", positionIds: ["pos-1", "pos-2", "pos-3", "pos-4", "pos-5", "pos-6", "pos-7", "pos-8", "pos-9", "pos-10", "pos-11", "pos-12"], requiredLevel: "理解" },
  { id: "ab-8", name: "数据分析能力", description: "使用数据驱动决策和分析", category: "分析能力", domain: "职业素养", proficiencyDesc: "L1:能查看基础报表; L2:能使用Excel分析; L3:能使用SQL取数; L4:能建立分析模型; L5:能搭建数据平台", code: "AB-008", positionIds: ["pos-4", "pos-5", "pos-9"], requiredLevel: "熟练" },
  { id: "ab-9", name: "问题排查能力", description: "定位和解决技术问题的能力", category: "开发能力", domain: "质量保障", proficiencyDesc: "L1:能根据报错搜索; L2:能使用调试工具; L3:能分析复杂链路; L4:能处理线上故障; L5:能设计容灾方案", code: "AB-009", positionIds: ["pos-1", "pos-2", "pos-3"], requiredLevel: "掌握" },
  { id: "ab-10", name: "项目管理能力", description: "规划、跟踪和交付项目任务", category: "软技能", domain: "职业素养", proficiencyDesc: "L1:能管理个人任务; L2:能协助跟踪进度; L3:能主导小型项目; L4:能管理跨团队项目; L5:能制定项目管理规范", code: "AB-010", positionIds: ["pos-1", "pos-2", "pos-3", "pos-5", "pos-11", "pos-12"], requiredLevel: "理解" },
  { id: "ab-11", name: "CSS 样式开发能力", description: "掌握现代 CSS 技术，实现复杂的页面布局和视觉效果", category: "开发能力", domain: "前端工程化", proficiencyDesc: "L1:能写基础样式; L2:能使用Flexbox/Grid; L3:能实现响应式布局; L4:能优化样式性能; L5:能设计CSS架构", code: "AB-011", positionIds: ["pos-1", "pos-3"], requiredLevel: "熟练" },
  { id: "ab-12", name: "前端构建工具配置", description: "配置和优化前端工程化工具链", category: "开发能力", domain: "前端工程化", proficiencyDesc: "L1:能使用现成脚手架; L2:能配置Webpack/Vite; L3:能优化构建配置; L4:能定制构建流程; L5:能设计工程化体系", code: "AB-012", positionIds: ["pos-1", "pos-3"], requiredLevel: "掌握" },
  { id: "ab-13", name: "服务端开发能力", description: "使用 Node.js 或其他服务端技术开发后端服务", category: "开发能力", domain: "服务端开发", proficiencyDesc: "L1:能写简单脚本; L2:能开发基础API; L3:能设计服务架构; L4:能优化服务性能; L5:能设计微服务架构", code: "AB-013", positionIds: ["pos-2", "pos-3"], requiredLevel: "熟练" },
  { id: "ab-14", name: "DevOps 运维能力", description: "掌握持续集成、持续部署和容器化技术", category: "工程能力", domain: "运维部署", proficiencyDesc: "L1:了解CI/CD概念; L2:能使用GitHub Actions; L3:能配置Docker; L4:能搭建K8s集群; L5:能设计DevOps体系", code: "AB-014", positionIds: ["pos-2", "pos-3"], requiredLevel: "理解" },
  { id: "ab-15", name: "数据可视化能力", description: "使用图表库实现数据的可视化展示", category: "分析能力", domain: "数据分析", proficiencyDesc: "L1:能使用基础图表; L2:能配置ECharts/D3; L3:能设计可视化方案; L4:能开发交互式大屏; L5:能设计可视化规范", code: "AB-015", positionIds: ["pos-4", "pos-1"], requiredLevel: "掌握" },
]

// Learning Resources Library
export const learningResources: LearningResource[] = [
  { id: "lr-1", name: "React 官方文档", type: "link", url: "https://react.dev", description: "React 框架官方中文文档", knowledgePoints: ["kp-1"], uploadedAt: "2024-01-10", uploadedBy: "张老师", thumbnail: "/placeholder.svg" },
  { id: "lr-2", name: "TypeScript 入门教程.pdf", type: "document", url: "/files/ts-guide.pdf", size: "2.3MB", description: "TypeScript 从入门到精通", knowledgePoints: ["kp-2"], uploadedAt: "2024-01-08", uploadedBy: "李老师", thumbnail: "/placeholder.svg" },
  { id: "lr-3", name: "CSS 布局实战视频", type: "video", url: "/videos/css-layout.mp4", size: "156MB", description: "CSS Flexbox 和 Grid 布局详解", knowledgePoints: ["kp-3"], uploadedAt: "2024-01-05", uploadedBy: "王老师", thumbnail: "/placeholder.svg" },
  { id: "lr-4", name: "API 设计规范文档.docx", type: "document", url: "/files/api-spec.docx", size: "1.2MB", description: "RESTful API 设计最佳实践", knowledgePoints: ["kp-4"], uploadedAt: "2024-01-12", uploadedBy: "张老师", thumbnail: "/placeholder.svg" },
  { id: "lr-5", name: "数据库建模工具", type: "tool", url: "https://dbdiagram.io", description: "在线数据库设计工具", knowledgePoints: ["kp-5"], uploadedAt: "2024-01-15", uploadedBy: "赵老师", thumbnail: "/placeholder.svg" },
  { id: "lr-6", name: "JWT 认证流程图.png", type: "image", url: "/images/jwt-flow.png", size: "0.5MB", description: "JWT 认证工作流程图解", knowledgePoints: ["kp-6"], uploadedAt: "2024-01-18", uploadedBy: "李老师", thumbnail: "/placeholder.svg" },
  { id: "lr-7", name: "Git 协作开发指南", type: "document", url: "/files/git-guide.pdf", size: "3.1MB", description: "团队 Git 工作流最佳实践", knowledgePoints: ["kp-7"], uploadedAt: "2024-01-20", uploadedBy: "王老师", thumbnail: "/placeholder.svg" },
  { id: "lr-8", name: "实训室 A-301", type: "venue", url: "", description: "计算机实训室，配备50台电脑", knowledgePoints: [], uploadedAt: "2024-01-01", uploadedBy: "管理员", thumbnail: "/placeholder.svg" },
  { id: "lr-9", name: "电商平台演示系统", type: "software", url: "https://demo.shop.edu", description: "电商运营模拟平台", knowledgePoints: ["kp-8"], uploadedAt: "2024-01-22", uploadedBy: "赵老师", thumbnail: "/placeholder.svg" },
  { id: "lr-10", name: "数据分析案例集", type: "document", url: "/files/data-cases.pdf", size: "5.6MB", description: "真实业务数据分析案例", knowledgePoints: ["kp-9"], uploadedAt: "2024-01-25", uploadedBy: "刘老师", thumbnail: "/placeholder.svg" },
  // New resource types for expanded coverage
  { id: "lr-11", name: "学生成绩统计表.xlsx", type: "spreadsheet", url: "/files/grades.xlsx", size: "0.8MB", description: "2024春季学期学生实训成绩汇总表", knowledgePoints: [], uploadedAt: "2024-02-01", uploadedBy: "教务老师", thumbnail: "/placeholder.svg" },
  { id: "lr-12", name: "项目需求讲解音频", type: "audio", url: "/audio/requirements.mp3", size: "12MB", description: "企业导师对项目需求的详细讲解录音", knowledgePoints: ["kp-1"], uploadedAt: "2024-02-05", uploadedBy: "企业导师", thumbnail: "/placeholder.svg" },
  { id: "lr-13", name: "前端开发工具包.zip", type: "archive", url: "/files/frontend-toolkit.zip", size: "45MB", description: "包含常用前端工具、脚手架和配置文件", knowledgePoints: ["kp-1", "kp-2"], uploadedAt: "2024-02-08", uploadedBy: "张老师", thumbnail: "/placeholder.svg" },
  { id: "lr-14", name: "VS Code 开发环境", type: "tool", url: "https://code.visualstudio.com", description: "推荐使用的代码编辑器及插件配置说明", knowledgePoints: ["kp-1"], uploadedAt: "2024-02-10", uploadedBy: "李老师", thumbnail: "/placeholder.svg" },
  { id: "lr-15", name: "3D打印机设备", type: "facility", url: "", description: "创想三维3D打印机，用于原型制作", knowledgePoints: [], uploadedAt: "2024-02-12", uploadedBy: "实验室管理员", thumbnail: "/placeholder.svg" },
  { id: "lr-16", name: "服务器集群", type: "facility", url: "", description: "4台高性能服务器，用于部署和测试", knowledgePoints: ["kp-5"], uploadedAt: "2024-02-15", uploadedBy: "IT管理员", thumbnail: "/placeholder.svg" },
  { id: "lr-17", name: "设计规范表格", type: "spreadsheet", url: "/files/design-spec.xlsx", size: "1.5MB", description: "UI设计规范参数对照表", knowledgePoints: ["kp-3"], uploadedAt: "2024-02-18", uploadedBy: "王老师", thumbnail: "/placeholder.svg" },
  { id: "lr-18", name: "代码审查清单", type: "document", url: "/files/code-review.pdf", size: "0.6MB", description: "团队代码审查标准检查清单", knowledgePoints: ["kp-7"], uploadedAt: "2024-02-20", uploadedBy: "张老师", thumbnail: "/placeholder.svg" },
  { id: "lr-19", name: "微服务架构讲解", type: "audio", url: "/audio/microservices.mp3", size: "28MB", description: "微服务架构设计原则讲解录音", knowledgePoints: ["kp-4"], uploadedAt: "2024-02-22", uploadedBy: "李老师", thumbnail: "/placeholder.svg" },
  { id: "lr-20", name: "项目素材压缩包", type: "archive", url: "/files/project-assets.zip", size: "120MB", description: "包含图片、图标、字体等项目素材", knowledgePoints: ["kp-3"], uploadedAt: "2024-02-25", uploadedBy: "王老师", thumbnail: "/placeholder.svg" },
  { id: "lr-21", name: "Postman API测试工具", type: "tool", url: "https://www.postman.com", description: "API接口测试与协作平台", knowledgePoints: ["kp-4"], uploadedAt: "2024-03-01", uploadedBy: "赵老师", thumbnail: "/placeholder.svg" },
  { id: "lr-22", name: "多媒体教室 B-205", type: "venue", url: "", description: "配备投影仪、音响和80个座位", knowledgePoints: [], uploadedAt: "2024-03-05", uploadedBy: "管理员", thumbnail: "/placeholder.svg" },
  { id: "lr-23", name: "无人机实训设备", type: "facility", url: "", description: "大疆无人机及配套飞行模拟器", knowledgePoints: [], uploadedAt: "2024-03-08", uploadedBy: "实验室管理员", thumbnail: "/placeholder.svg" },
  { id: "lr-24", name: "React 18 新特性视频教程", type: "video", url: "/videos/react18-features.mp4", size: "230MB", description: "深入讲解 React 18 并发特性和自动批处理", knowledgePoints: ["kp-1"], uploadedAt: "2024-03-10", uploadedBy: "张老师", thumbnail: "/placeholder.svg" },
  { id: "lr-25", name: "百度统计后台链接", type: "link", url: "https://tongji.baidu.com", description: "网站流量分析平台入口", knowledgePoints: ["kp-9"], uploadedAt: "2024-03-12", uploadedBy: "刘老师", thumbnail: "/placeholder.svg" },
]

// Extended users list for co-builder search
export const allTeachers: User[] = [
  { id: "user-1", name: "张老师", role: "builder", department: "信息工程系" },
  { id: "user-2", name: "李老师", role: "builder", department: "信息工程系" },
  { id: "user-3", name: "王老师", role: "reviewer", department: "经济管理系" },
  { id: "user-4", name: "赵老师", role: "builder", department: "经济管理系" },
  { id: "user-5", name: "刘老师", role: "admin", department: "教务处" },
  { id: "user-6", name: "陈老师", role: "builder", department: "信息工程系" },
  { id: "user-7", name: "杨老师", role: "builder", department: "信息工程系" },
  { id: "user-8", name: "黄老师", role: "reviewer", department: "艺术设计系" },
  { id: "user-9", name: "周老师", role: "builder", department: "艺术设计系" },
  { id: "user-10", name: "吴老师", role: "builder", department: "经济管理系" },
  { id: "user-11", name: "郑老师", role: "builder", department: "机械工程系" },
  { id: "user-12", name: "孙老师", role: "reviewer", department: "机械工程系" },
  { id: "user-13", name: "马老师", role: "builder", department: "外语系" },
  { id: "user-14", name: "林老师", role: "builder", department: "外语系" },
  { id: "user-15", name: "何老师", role: "admin", department: "教务处" },
]

// Question bank for objective assessments
export const questionBank = {
  frontend: [
    { id: "qb-1", name: "React Hooks 识别", type: "single" as const, content: "以下哪个不是 React Hooks？", options: ["useState", "useEffect", "useClass", "useCallback"], answer: "useClass", score: 10, difficulty: "easy" as const, source: "public" as const },
    { id: "qb-2", name: "CSS flex 属性", type: "single" as const, content: "CSS 中 flex: 1 等价于？", options: ["flex-grow: 1", "flex-shrink: 1", "flex-grow: 1; flex-shrink: 1; flex-basis: 0%", "flex-basis: 100%"], answer: "flex-grow: 1; flex-shrink: 1; flex-basis: 0%", score: 10, difficulty: "medium" as const, source: "public" as const },
    { id: "qb-3", name: "Virtual DOM 性能判断", type: "judgment" as const, content: "Virtual DOM 可以提升所有场景下的渲染性能", answer: "false", score: 10, difficulty: "medium" as const, source: "collab" as const },
    { id: "qb-4", name: "JS 基本数据类型", type: "multiple" as const, content: "以下哪些是 JavaScript 的基本数据类型？", options: ["String", "Number", "Array", "Boolean", "Object"], answer: ["String", "Number", "Boolean"], score: 15, difficulty: "hard" as const, source: "my" as const },
    { id: "qb-7", name: "React 生命周期理解", type: "subjective" as const, content: "请简述 React 类组件的生命周期方法及其执行顺序，并说明在函数组件中如何替代这些生命周期方法。", score: 20, difficulty: "hard" as const, source: "my" as const },
    { id: "qb-8", name: "CSS 盒模型", type: "single" as const, content: "标准盒模型中，元素的总宽度等于？", options: ["width + padding + border + margin", "width + padding + border", "width", "width + margin"], answer: "width + padding + border + margin", score: 10, difficulty: "easy" as const, source: "public" as const },
    { id: "qb-9", name: "Promise 机制", type: "judgment" as const, content: "Promise.prototype.finally() 无论 Promise 成功或失败都会执行", answer: "true", score: 10, difficulty: "medium" as const, source: "collab" as const },
    { id: "qb-10", name: "前端性能优化", type: "subjective" as const, content: "请列举至少 5 种前端性能优化的方法，并说明适用场景。", score: 20, difficulty: "medium" as const, source: "public" as const },
  ],
  backend: [
    { id: "qb-5", name: "HTTP 状态码", type: "single" as const, content: "HTTP 状态码 401 表示？", options: ["未找到", "未授权", "服务器错误", "请求成功"], answer: "未授权", score: 10, difficulty: "easy" as const, source: "public" as const },
    { id: "qb-6", name: "RESTful API 方法", type: "judgment" as const, content: "RESTful API 中，PUT 方法用于创建资源", answer: "false", score: 10, difficulty: "easy" as const, source: "collab" as const },
    { id: "qb-11", name: "数据库索引原理", type: "multiple" as const, content: "以下哪些属于数据库索引的优点？", options: ["加快查询速度", "减少磁盘 I/O", "自动维护数据一致性", "占用额外存储空间", "降低写操作性能"], answer: ["加快查询速度", "减少磁盘 I/O"], score: 15, difficulty: "hard" as const, source: "my" as const },
    { id: "qb-12", name: "微服务架构", type: "subjective" as const, content: "请阐述微服务架构相比单体架构的优势与挑战，并给出适用场景建议。", score: 25, difficulty: "hard" as const, source: "public" as const },
  ],
  draft: [
    { id: "qb-d1", name: "HTML5 新特性", type: "multiple" as const, content: "以下哪些是 HTML5 引入的新特性？", options: ["Canvas", "LocalStorage", "WebSocket", "Flash"], answer: ["Canvas", "LocalStorage", "WebSocket"], score: 15, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d2", name: "Git 分支管理", type: "single" as const, content: "Git 中合并分支使用的命令是？", options: ["git merge", "git branch", "git checkout", "git push"], answer: "git merge", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d3", name: "跨域请求", type: "judgment" as const, content: "CORS 是一种解决浏览器跨域请求的安全机制", answer: "true", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d4", name: "Docker 容器化", type: "single" as const, content: "Docker 中用于查看运行中容器的命令是？", options: ["docker ps", "docker images", "docker build", "docker run"], answer: "docker ps", score: 10, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d5", name: "TCP 与 UDP", type: "multiple" as const, content: "以下关于 TCP 和 UDP 的描述，正确的有？", options: ["TCP 是面向连接的", "UDP 传输效率更高", "TCP 保证数据顺序", "UDP 提供重传机制"], answer: ["TCP 是面向连接的", "UDP 传输效率更高", "TCP 保证数据顺序"], score: 15, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d6", name: "Linux 文件权限", type: "single" as const, content: "Linux 中设置文件权限为 755 的命令是？", options: ["chmod 755 file", "chown 755 file", "perm 755 file", "access 755 file"], answer: "chmod 755 file", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d7", name: "Web 安全 XSS", type: "judgment" as const, content: "XSS 攻击是指通过注入恶意脚本到网页中，从而窃取用户信息的攻击方式", answer: "true", score: 10, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d8", name: "敏捷开发 Scrum", type: "single" as const, content: "Scrum 中一个 Sprint 的时长通常是？", options: ["1-4 周", "1-2 天", "1-2 月", "6 个月"], answer: "1-4 周", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d9", name: "设计模式原则", type: "multiple" as const, content: "以下属于 SOLID 原则的有？", options: ["单一职责原则", "开闭原则", "依赖倒置原则", "快速迭代原则"], answer: ["单一职责原则", "开闭原则", "依赖倒置原则"], score: 15, difficulty: "hard" as const, source: "my" as const },
    { id: "qb-d10", name: "CI/CD 流程", type: "single" as const, content: "CI/CD 中的 CD 通常指？", options: ["持续交付/持续部署", "持续开发", "代码审查", "容器交付"], answer: "持续交付/持续部署", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d11", name: "OAuth2 授权", type: "judgment" as const, content: "OAuth2 是一种开放授权协议，允许第三方应用在不获取用户密码的情况下访问用户资源", answer: "true", score: 10, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d12", name: "网络 OSI 七层模型", type: "single" as const, content: "HTTP 协议工作在 OSI 七层模型的哪一层？", options: ["应用层", "传输层", "网络层", "会话层"], answer: "应用层", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d13", name: "Redis 缓存策略", type: "multiple" as const, content: "以下哪些是常见的 Redis 缓存淘汰策略？", options: ["LRU", "LFU", "FIFO", "Random"], answer: ["LRU", "LFU", "Random"], score: 15, difficulty: "hard" as const, source: "my" as const },
    { id: "qb-d14", name: "代码版本控制", type: "single" as const, content: "Git 中撤销工作区修改的命令是？", options: ["git checkout -- file", "git reset", "git revert", "git rm"], answer: "git checkout -- file", score: 10, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d15", name: "JSON 与 XML", type: "judgment" as const, content: "JSON 的数据格式比 XML 更轻量，解析效率更高", answer: "true", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d16", name: "敏捷开发实践", type: "subjective" as const, content: "请简述每日站会（Daily Stand-up）的目的和常见流程，并说明如何避免站会流于形式。", score: 20, difficulty: "medium" as const, source: "my" as const },
    { id: "qb-d17", name: "数据库事务", type: "single" as const, content: "ACID 中的 I 指的是？", options: ["隔离性", "一致性", "原子性", "持久性"], answer: "隔离性", score: 10, difficulty: "easy" as const, source: "my" as const },
    { id: "qb-d18", name: "前端工程化工具", type: "multiple" as const, content: "以下哪些工具常用于前端工程化？", options: ["Webpack", "Vite", "Gulp", "Photoshop"], answer: ["Webpack", "Vite", "Gulp"], score: 15, difficulty: "easy" as const, source: "my" as const },
  ],
}

// Position Abilities - Each position has a set of predefined abilities
export const positionAbilities: PositionAbility[] = [
  // 前端开发工程师 (pos-1)
  { id: "ability-1", positionId: "pos-1", name: "React 框架开发", description: "使用 React 构建现代 Web 应用的能力", weight: 25, category: "技术能力" },
  { id: "ability-2", positionId: "pos-1", name: "TypeScript 应用", description: "TypeScript 类型系统和高级特性的运用", weight: 20, category: "技术能力" },
  { id: "ability-3", positionId: "pos-1", name: "CSS 布局与样式", description: "CSS 响应式布局和现代样式技术", weight: 15, category: "技术能力" },
  { id: "ability-4", positionId: "pos-1", name: "前端工程化", description: "构建工具、代码规范、自动化测试", weight: 15, category: "工程能力" },
  { id: "ability-5", positionId: "pos-1", name: "性能优化", description: "Web 性能分析和优化技术", weight: 15, category: "工程能力" },
  { id: "ability-6", positionId: "pos-1", name: "团队协作", description: "代码审查、文档编写、沟通协调", weight: 10, category: "软技能" },
  
  // 后端开发工程师 (pos-2)
  { id: "ability-7", positionId: "pos-2", name: "API 设计与开发", description: "RESTful API 设计原则和实现", weight: 25, category: "技术能力" },
  { id: "ability-8", positionId: "pos-2", name: "数据库设计", description: "关系型数据库建模和 SQL 优化", weight: 25, category: "技术能力" },
  { id: "ability-9", positionId: "pos-2", name: "系统安全", description: "认证授权、数据安全、防攻击", weight: 20, category: "技术能力" },
  { id: "ability-10", positionId: "pos-2", name: "服务部署", description: "容器化、CI/CD、云服务", weight: 20, category: "工程能力" },
  { id: "ability-11", positionId: "pos-2", name: "问题排查", description: "日志分析、性能监控、故障处理", weight: 10, category: "工程能力" },
  
  // 电商运营专员 (pos-5)
  { id: "ability-12", positionId: "pos-5", name: "店铺运营", description: "电商平台店铺搭建和日常运营", weight: 30, category: "运营能力" },
  { id: "ability-13", positionId: "pos-5", name: "商品管理", description: "商品上架、定价、库存管理", weight: 25, category: "运营能力" },
  { id: "ability-14", positionId: "pos-5", name: "营销推广", description: "活动策划、推广投放、流量运营", weight: 25, category: "营销能力" },
  { id: "ability-15", positionId: "pos-5", name: "数据分析", description: "运营数据分析和决策支持", weight: 20, category: "分析能力" },
  
  // 数据分析师 (pos-4)
  { id: "ability-16", positionId: "pos-4", name: "数据处理", description: "数据清洗、转换、整合能力", weight: 25, category: "技术能力" },
  { id: "ability-17", positionId: "pos-4", name: "统计分析", description: "统计方法和假设检验应用", weight: 25, category: "分析能力" },
  { id: "ability-18", positionId: "pos-4", name: "数据可视化", description: "图表设计和数据故事讲述", weight: 25, category: "表达能力" },
  { id: "ability-19", positionId: "pos-4", name: "业务理解", description: "业务需求分析和指标设计", weight: 25, category: "业务能力" },
]

// Task to Ability Mappings - Which tasks contribute to which abilities
export const taskAbilityMappings: TaskAbilityMapping[] = [
  // Scenario 1 tasks -> Front-end abilities
  { taskId: "task-1-1", abilityId: "ability-1", contributionWeight: 30 },
  { taskId: "task-1-1", abilityId: "ability-2", contributionWeight: 40 },
  { taskId: "task-1-1", abilityId: "ability-4", contributionWeight: 50 },
  { taskId: "task-1-2", abilityId: "ability-1", contributionWeight: 40 },
  { taskId: "task-1-2", abilityId: "ability-9", contributionWeight: 60 },
  { taskId: "task-1-3", abilityId: "ability-1", contributionWeight: 50 },
  { taskId: "task-1-3", abilityId: "ability-3", contributionWeight: 70 },
  { taskId: "task-1-4", abilityId: "ability-5", contributionWeight: 80 },
  { taskId: "task-1-4", abilityId: "ability-6", contributionWeight: 40 },
]

// Students
export const students: Student[] = [
  { id: "stu-1", name: "张三", studentNumber: "2024001", class: "软件工程2401班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-2", name: "李四", studentNumber: "2024002", class: "软件工程2401班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-3", name: "王五", studentNumber: "2024003", class: "电子商务2401班", department: "经济管理系", enrollmentYear: 2024 },
  { id: "stu-4", name: "赵六", studentNumber: "2024004", class: "软件工程2402班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-5", name: "陈七", studentNumber: "2023001", class: "数据科学2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-6", name: "周八", studentNumber: "2023002", class: "数据科学2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-7", name: "孙八", studentNumber: "2024005", class: "软件工程2401班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-8", name: "吴九", studentNumber: "2024006", class: "软件工程2401班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-9", name: "郑十", studentNumber: "2024007", class: "软件工程2401班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-10", name: "王十一", studentNumber: "2024008", class: "软件工程2402班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-11", name: "冯十二", studentNumber: "2024009", class: "软件工程2402班", department: "信息工程系", enrollmentYear: 2024 },
  { id: "stu-12", name: "钱十三", studentNumber: "2024010", class: "电子商务2401班", department: "经济管理系", enrollmentYear: 2024 },
  { id: "stu-13", name: "卫十四", studentNumber: "2024011", class: "电子商务2401班", department: "经济管理系", enrollmentYear: 2024 },
  { id: "stu-14", name: "施十五", studentNumber: "2024012", class: "电子商务2401班", department: "经济管理系", enrollmentYear: 2024 },
  { id: "stu-15", name: "蒋十六", studentNumber: "2023003", class: "数据科学2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-16", name: "沈十七", studentNumber: "2023004", class: "数据科学2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-17", name: "韩十八", studentNumber: "2023005", class: "软件工程2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-18", name: "杨十九", studentNumber: "2023006", class: "软件工程2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-19", name: "朱二十", studentNumber: "2023007", class: "软件工程2301班", department: "信息工程系", enrollmentYear: 2023 },
  { id: "stu-20", name: "秦二十一", studentNumber: "2022001", class: "网络工程2201班", department: "信息工程系", enrollmentYear: 2022 },
  { id: "stu-21", name: "尤二十二", studentNumber: "2022002", class: "网络工程2201班", department: "信息工程系", enrollmentYear: 2022 },
  { id: "stu-22", name: "许二十三", studentNumber: "2022003", class: "网络工程2201班", department: "信息工程系", enrollmentYear: 2022 },
  { id: "stu-23", name: "何二十四", studentNumber: "2022004", class: "电子商务2201班", department: "经济管理系", enrollmentYear: 2022 },
  { id: "stu-24", name: "吕二十五", studentNumber: "2022005", class: "电子商务2201班", department: "经济管理系", enrollmentYear: 2022 },
]

// Student Heart Scenes - Students' favorite scenario selections for job positions
export const studentHeartScenes: StudentHeartScene[] = [
  {
    id: "heart-1",
    studentId: "stu-1",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    positionId: "pos-1",
    positionName: "前端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    priority: 1,
    status: "submitted",
    createdAt: "2026-04-10",
    updatedAt: "2026-04-10",
    matchedBatchId: "batch-2",
    matchedBatchName: "2026春季前端开发场景建设",
  },
  {
    id: "heart-2",
    studentId: "stu-1",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    positionId: "pos-2",
    positionName: "后端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    priority: 2,
    status: "submitted",
    createdAt: "2026-04-10",
    updatedAt: "2026-04-10",
  },
  {
    id: "heart-3",
    studentId: "stu-2",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    positionId: "pos-1",
    positionName: "前端开发工程师",
    professionId: "prof-1",
    professionName: "信息技术",
    priority: 1,
    status: "matched",
    createdAt: "2026-04-08",
    updatedAt: "2026-04-12",
    matchedBatchId: "batch-2",
    matchedBatchName: "2026春季前端开发场景建设",
    teacherComment: "已根据第一志愿分配至前端开发批次",
  },
  {
    id: "heart-4",
    studentId: "stu-3",
    scenarioId: "scenario-4",
    scenarioName: "电商平台运营全流程",
    positionId: "pos-5",
    positionName: "电商运营专员",
    professionId: "prof-2",
    professionName: "电子商务",
    priority: 1,
    status: "confirmed",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-15",
    matchedBatchId: "batch-1",
    matchedBatchName: "2026春季电商实训场景开发",
  },
  {
    id: "heart-5",
    studentId: "stu-3",
    scenarioId: "scenario-5",
    scenarioName: "企业财务报表分析",
    positionId: "pos-8",
    positionName: "会计师",
    professionId: "prof-3",
    professionName: "财务管理",
    priority: 2,
    status: "draft",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-05",
  },
]

// Student Scenario Scores - Records of students completing scenarios
export const studentScenarioScores: StudentScenarioScore[] = [
  {
    id: "score-1",
    studentId: "stu-1",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    positionId: "pos-1",
    positionName: "前端开发工程师",
    totalScore: 85,
    taskScores: [
      { taskId: "task-1-1", taskName: "项目初始化与架构搭建", score: 88, maxScore: 100 },
      { taskId: "task-1-2", taskName: "用户认证模块开发", score: 82, maxScore: 100 },
      { taskId: "task-1-3", taskName: "核心业务组件开发", score: 90, maxScore: 100 },
      { taskId: "task-1-4", taskName: "项目优化与部署", score: 80, maxScore: 100 },
    ],
    completedAt: "2026-04-15",
  },
  {
    id: "score-2",
    studentId: "stu-2",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    positionId: "pos-1",
    positionName: "前端开发工程师",
    totalScore: 72,
    taskScores: [
      { taskId: "task-1-1", taskName: "项目初始化与架构搭建", score: 75, maxScore: 100 },
      { taskId: "task-1-2", taskName: "用户认证模块开发", score: 68, maxScore: 100 },
      { taskId: "task-1-3", taskName: "核心业务组件开发", score: 78, maxScore: 100 },
      { taskId: "task-1-4", taskName: "项目优化与部署", score: 65, maxScore: 100 },
    ],
    completedAt: "2026-04-16",
  },
  {
    id: "score-3",
    studentId: "stu-1",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    positionId: "pos-2",
    positionName: "后端开发工程师",
    totalScore: 78,
    taskScores: [
      { taskId: "task-2-1", taskName: "API 设计规范学习", score: 85, maxScore: 100 },
      { taskId: "task-2-2", taskName: "数据库设计", score: 71, maxScore: 100 },
    ],
    completedAt: "2026-04-18",
  },
]

// Student Ability Scores - Calculated from scenario scores
export const studentAbilityScores: StudentAbilityScore[] = [
  {
    studentId: "stu-1",
    abilityId: "ability-1",
    abilityName: "React 框架开发",
    positionId: "pos-1",
    score: 87,
    level: "proficient",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 87 },
    ],
    updatedAt: "2026-04-15",
  },
  {
    studentId: "stu-1",
    abilityId: "ability-2",
    abilityName: "TypeScript 应用",
    positionId: "pos-1",
    score: 88,
    level: "proficient",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 88 },
    ],
    updatedAt: "2026-04-15",
  },
  {
    studentId: "stu-1",
    abilityId: "ability-3",
    abilityName: "CSS 布局与样式",
    positionId: "pos-1",
    score: 90,
    level: "expert",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 90 },
    ],
    updatedAt: "2026-04-15",
  },
  {
    studentId: "stu-1",
    abilityId: "ability-4",
    abilityName: "前端工程化",
    positionId: "pos-1",
    score: 88,
    level: "proficient",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 88 },
    ],
    updatedAt: "2026-04-15",
  },
  {
    studentId: "stu-1",
    abilityId: "ability-5",
    abilityName: "性能优化",
    positionId: "pos-1",
    score: 80,
    level: "proficient",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 80 },
    ],
    updatedAt: "2026-04-15",
  },
  {
    studentId: "stu-1",
    abilityId: "ability-6",
    abilityName: "团队协作",
    positionId: "pos-1",
    score: 80,
    level: "proficient",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 80 },
    ],
    updatedAt: "2026-04-15",
  },
  // Student 2 scores
  {
    studentId: "stu-2",
    abilityId: "ability-1",
    abilityName: "React 框架开发",
    positionId: "pos-1",
    score: 74,
    level: "familiar",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 74 },
    ],
    updatedAt: "2026-04-16",
  },
  {
    studentId: "stu-2",
    abilityId: "ability-2",
    abilityName: "TypeScript 应用",
    positionId: "pos-1",
    score: 75,
    level: "familiar",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 75 },
    ],
    updatedAt: "2026-04-16",
  },
  {
    studentId: "stu-2",
    abilityId: "ability-3",
    abilityName: "CSS 布局与样式",
    positionId: "pos-1",
    score: 78,
    level: "proficient",
    scenarioContributions: [
      { scenarioId: "scenario-1", scenarioName: "企业级前端项目开发实战", contribution: 78 },
    ],
    updatedAt: "2026-04-16",
  },
]

// Helper function to get ability level from score
export function getAbilityLevel(score: number): StudentAbilityScore["level"] {
  if (score >= 90) return "expert"      // 精通
  if (score >= 75) return "proficient"  // 熟练
  if (score >= 60) return "familiar"    // 了解
  return "beginner"                      // 待提升
}

// Helper function to get level label in Chinese
export function getAbilityLevelLabel(level: StudentAbilityScore["level"]): string {
  const labels = {
    expert: "精通",
    proficient: "熟练",
    familiar: "了解",
    beginner: "待提升",
  }
  return labels[level]
}

// Helper function to get level color
export function getAbilityLevelColor(level: StudentAbilityScore["level"]): string {
  const colors = {
    expert: "bg-green-500",
    proficient: "bg-blue-500",
    familiar: "bg-yellow-500",
    beginner: "bg-red-500",
  }
  return colors[level]
}

// ============================================================================
// 教师评分相关数据模型
// ============================================================================

/** 学生任务提交记录 */
export interface StudentSubmission {
  id: string
  studentId: string
  scenarioId: string
  scenarioName: string
  taskId: string
  taskName: string
  assessmentForm: string // 测评形式名称：试卷、题库、现场评审、现场问答、成果评价、作业、随堂测
  status: "pending" | "graded"
  submittedAt: string
  objectiveAnswers?: ObjectiveSubmissionAnswer[]
  subjectiveContent?: SubjectiveSubmissionContent
  rubricScores?: RubricScoreRecord[]
  drawnQuestions?: DrawnQuestion[] // 现场问答抽出的题目
  evalPointScores?: EvalPointScoreRecord[] // 评价点评分（用于现场问答、评审等）
  currentReviewPhaseIndex?: number // 当前评审阶段索引（用于现场评审）
  objectiveTotalScore?: number
  subjectiveTotalScore?: number
  totalScore?: number
  maxScore: number
  teacherComment?: string
  gradedAt?: string
  gradedBy?: string
}

/** 客观题学生作答记录 */
export interface ObjectiveSubmissionAnswer {
  questionId: string
  questionName?: string
  questionType: "single" | "multiple" | "judgment" | "text"
  questionContent: string
  options?: string[]
  correctAnswer: string | string[]
  studentAnswer: string | string[]
  score: number
  maxScore: number
  isCorrect: boolean
}

/** 主观题学生提交内容 */
export interface SubjectiveSubmissionContent {
  textAnswer?: string
  attachments?: SubmissionAttachment[]
}

/** 提交附件 */
export interface SubmissionAttachment {
  id: string
  name: string
  type: "document" | "code" | "video" | "image" | "other"
  url: string
  content?: string // 预览内容（Mock 数据使用）
}

/** 教师对主观题维度的评分记录 */
export interface RubricScoreRecord {
  rubricPointId: string
  rubricPointName: string
  weight: number
  maxScore: number
  levelId?: string
  levelName?: string
  score: number
  comment?: string
}

/** 现场问答抽出的题目 */
export interface DrawnQuestion {
  questionId: string
  questionName: string
  questionContent: string
  questionType: string
  options?: string[]
  correctAnswer: string | string[]
  studentOralAnswer?: string
}

/** 评价点评分记录（用于现场问答、评审等基于评价点的评分） */
export interface EvalPointScoreRecord {
  evalPointId: string
  evalPointName: string
  weight: number
  maxScore: number
  levelName?: string
  score: number
  comment?: string
}

// ============================================================================
// 教师评分 Mock 数据
// ============================================================================

export const studentSubmissions: StudentSubmission[] = [
  {
    id: "sub-1",
    studentId: "stu-1",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-20 14:30:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "q-1", questionName: "React 18 并发特性", questionType: "single", questionContent: "React 18 中引入的并发特性主要解决什么问题？", options: ["性能优化", "代码复用", "状态管理", "路由控制"], correctAnswer: "性能优化", studentAnswer: "性能优化", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-2", questionName: "TypeScript 基础判断", questionType: "judgment", questionContent: "TypeScript 是 JavaScript 的超集", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-3", questionName: "React 状态管理方案", questionType: "multiple", questionContent: "以下哪些是常用的 React 状态管理方案？", options: ["Redux", "MobX", "Zustand", "jQuery"], correctAnswer: ["Redux", "MobX", "Zustand"], studentAnswer: ["Redux", "MobX", "jQuery"], score: 3, maxScore: 5, isCorrect: false },
      { questionId: "q-4", questionName: "CSS 盒模型", questionType: "single", questionContent: "在 CSS 标准盒模型中，元素的宽度(width)包含哪些部分？", options: ["仅内容宽度", "内容+内边距", "内容+内边距+边框", "内容+内边距+边框+外边距"], correctAnswer: "仅内容宽度", studentAnswer: "内容+内边距+边框", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-5", questionName: "JS 事件循环", questionType: "single", questionContent: "JavaScript 中，setTimeout 的回调函数会在哪个阶段执行？", options: ["同步执行", "宏任务队列", "微任务队列", "渲染阶段"], correctAnswer: "宏任务队列", studentAnswer: "微任务队列", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-s1", questionName: "React 性能优化方法", questionType: "text", questionContent: "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", correctAnswer: "1. React.memo / PureComponent：避免不必要的重渲染，适用于组件接收相同 props 时；2. useMemo / useCallback：缓存计算结果和函数引用，适用于复杂计算和子组件传参；3. 代码分割（Code Splitting + lazy / Suspense）：减少首屏加载资源，适用于大型单页应用；4. 虚拟列表：仅渲染可视区域数据，适用于长列表场景。", studentAnswer: "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。这些方法在实际项目中都有应用，能够有效提升页面性能。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "q-6", questionName: "Promise 基础", questionType: "judgment", questionContent: "Promise.resolve(1).then(v => console.log(v)) 会立即同步输出 1", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-7", questionName: "HTTP 缓存策略", questionType: "multiple", questionContent: "以下哪些 HTTP 头部与缓存控制有关？", options: ["Cache-Control", "Expires", "Content-Type", "ETag"], correctAnswer: ["Cache-Control", "Expires", "ETag"], studentAnswer: ["Cache-Control", "ETag"], score: 3, maxScore: 5, isCorrect: false },
      { questionId: "q-8", questionName: "React Hooks 规则", questionType: "single", questionContent: "以下关于 React Hooks 的使用规则，哪项是正确的？", options: ["可以在循环中调用 useState", "可以在条件语句中调用 useEffect", "只能在函数组件顶层调用", "可以在普通函数中调用 useContext"], correctAnswer: "只能在函数组件顶层调用", studentAnswer: "只能在函数组件顶层调用", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-9", questionName: "Git 工作流", questionType: "judgment", questionContent: "git rebase 操作会改写提交历史", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-10", questionName: "前端安全", questionType: "multiple", questionContent: "以下哪些属于常见的前端安全漏洞？", options: ["XSS", "CSRF", "SQL 注入", "点击劫持"], correctAnswer: ["XSS", "CSRF", "点击劫持"], studentAnswer: ["XSS", "CSRF", "SQL 注入", "点击劫持"], score: 2, maxScore: 5, isCorrect: false },
      { questionId: "q-11", questionName: "Webpack 作用", questionType: "single", questionContent: "Webpack 的主要作用是什么？", options: ["代码运行时解释执行", "模块打包与资源优化", "数据库连接管理", "服务器端渲染"], correctAnswer: "模块打包与资源优化", studentAnswer: "模块打包与资源优化", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-12", questionName: "闭包特性", questionType: "judgment", questionContent: "JavaScript 闭包可以访问外部函数的变量，即使外部函数已经执行完毕", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-13", questionName: "RESTful 设计", questionType: "multiple", questionContent: "以下哪些 HTTP 方法在 RESTful API 中具有幂等性？", options: ["GET", "POST", "PUT", "DELETE"], correctAnswer: ["GET", "PUT", "DELETE"], studentAnswer: ["GET", "PUT"], score: 3, maxScore: 5, isCorrect: false },
      { questionId: "q-14", questionName: "虚拟 DOM", questionType: "single", questionContent: "React 中虚拟 DOM 的主要优势是什么？", options: ["直接操作真实 DOM 更快", "减少不必要的真实 DOM 操作", "不需要写 CSS", "自动处理服务端请求"], correctAnswer: "减少不必要的真实 DOM 操作", studentAnswer: "减少不必要的真实 DOM 操作", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-15", questionName: "TypeScript 接口", questionType: "judgment", questionContent: "TypeScript 中的 interface 和 type 在功能上完全等价，没有区别", correctAnswer: "false", studentAnswer: "true", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-s2", questionName: "前端工程化实践", questionType: "text", questionContent: "请结合实际项目经验，阐述前端工程化的核心目标和常用工具链。", correctAnswer: "前端工程化的核心目标包括：1. 规范化（代码规范、Git 规范、目录结构）；2. 自动化（构建、测试、部署流水线）；3. 模块化（组件化、微前端）；4. 性能优化（打包优化、资源管理）。常用工具链：Webpack/Vite（构建）、ESLint/Prettier（规范）、Jest/Vitest（测试）、Docker/CI（部署）。", studentAnswer: "前端工程化主要是为了让代码更规范、开发更高效。我们团队使用了 ESLint 来保证代码风格一致，使用 Webpack 来打包项目，还配置了 Jenkins 来实现自动化部署。这些工具大大提升了我们的开发效率。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "q-16", questionName: "浏览器存储", questionType: "multiple", questionContent: "以下哪些是浏览器端可用的存储方案？", options: ["localStorage", "sessionStorage", "IndexedDB", "Cookie"], correctAnswer: ["localStorage", "sessionStorage", "IndexedDB", "Cookie"], studentAnswer: ["localStorage", "sessionStorage", "Cookie"], score: 4, maxScore: 5, isCorrect: false },
      { questionId: "q-17", questionName: "ES6 箭头函数", questionType: "single", questionContent: "箭头函数与普通函数的主要区别不包括以下哪项？", options: ["没有自己的 this", "不能作为构造函数", "不能使用 yield 关键字", "默认拥有 arguments 对象"], correctAnswer: "默认拥有 arguments 对象", studentAnswer: "默认拥有 arguments 对象", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-18", questionName: "跨域请求", questionType: "judgment", questionContent: "CORS 是一种服务器端的安全机制，浏览器会自动允许所有跨域请求", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-19", questionName: "性能优化手段", questionType: "multiple", questionContent: "以下哪些手段可以优化前端首屏加载速度？", options: ["代码分割(Code Splitting)", "懒加载(Lazy Loading)", "增加更多 HTTP 请求", "资源预加载(Preload)"], correctAnswer: ["代码分割(Code Splitting)", "懒加载(Lazy Loading)", "资源预加载(Preload)"], studentAnswer: ["代码分割(Code Splitting)", "懒加载(Lazy Loading)", "资源预加载(Preload)"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-20", questionName: "DOM 事件委托", questionType: "single", questionContent: "事件委托(Event Delegation)的核心原理是什么？", options: ["每个子元素都绑定独立事件", "利用事件冒泡机制在父元素统一处理", "使用定时器轮询检测", "通过 MutationObserver 监听 DOM 变化"], correctAnswer: "利用事件冒泡机制在父元素统一处理", studentAnswer: "利用事件冒泡机制在父元素统一处理", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-21", questionName: "NPM 包管理", questionType: "judgment", questionContent: "package-lock.json 文件应该被提交到版本控制中", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-22", questionName: "CSS 优先级", questionType: "single", questionContent: "以下 CSS 选择器中，优先级最高的是？", options: [".class", "#id", "div", "[attr]"], correctAnswer: "#id", studentAnswer: "#id", score: 5, maxScore: 5, isCorrect: true },
    ],
  },
  {
    id: "sub-2",
    studentId: "stu-2",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-21 09:15:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：\n\n1. 登录页面：包含表单验证、密码加密传输\n2. 注册功能：邮箱验证、密码强度检测\n3. 权限控制：基于 JWT 的鉴权机制\n4. 路由守卫：未登录用户自动跳转登录页\n\n代码仓库地址：https://github.com/stu2/auth-demo",
      attachments: [
        {
          id: "att-1",
          name: "auth-module.zip",
          type: "code",
          url: "#",
        },
        {
          id: "att-2",
          name: "项目演示视频.mp4",
          type: "video",
          url: "#",
        },
      ],
    },
  },
  {
    id: "sub-3",
    studentId: "stu-1",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-22 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "我开发了一个可复用的数据表格组件和图表展示组件。数据表格支持排序、筛选、分页功能；图表组件基于 ECharts 封装，支持柱状图、折线图、饼图三种类型。",
      attachments: [
        {
          id: "att-3",
          name: "components-demo.zip",
          type: "code",
          url: "#",
        },
      ],
    },
  },
  {
    id: "sub-4",
    studentId: "stu-3",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-18 10:00:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "qb-1", questionName: "HTTP 方法语义", questionType: "single", questionContent: "RESTful 设计中，PUT 方法的主要语义是什么？", options: ["创建资源", "更新资源", "删除资源", "查询资源"], correctAnswer: "更新资源", studentAnswer: "更新资源", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-2", questionName: "状态码 401 含义", questionType: "judgment", questionContent: "HTTP 状态码 401 表示请求参数格式错误", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-3", questionName: "幂等性方法", questionType: "multiple", questionContent: "以下哪些 HTTP 方法具有幂等性？", options: ["GET", "POST", "PUT", "PATCH"], correctAnswer: ["GET", "PUT"], studentAnswer: ["GET", "PUT"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-4", questionName: "JWT 结构", questionType: "single", questionContent: "JWT (JSON Web Token) 由哪三部分组成？", options: ["Header.Payload.Signature", "Key.Value.Secret", "Auth.Token.Session", "ID.Data.Hash"], correctAnswer: "Header.Payload.Signature", studentAnswer: "Header.Payload.Signature", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-5", questionName: "SQL 注入", questionType: "judgment", questionContent: "使用参数化查询可以有效防止 SQL 注入攻击", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-6", questionName: "数据库事务", questionType: "multiple", questionContent: "数据库事务的 ACID 特性包括哪些？", options: ["原子性", "一致性", "隔离性", "持久性"], correctAnswer: ["原子性", "一致性", "隔离性", "持久性"], studentAnswer: ["原子性", "一致性", "隔离性"], score: 4, maxScore: 5, isCorrect: false },
      { questionId: "qb-7", questionName: "OAuth2 角色", questionType: "single", questionContent: "在 OAuth2.0 授权框架中，负责颁发访问令牌的是？", options: ["资源所有者", "客户端", "授权服务器", "资源服务器"], correctAnswer: "授权服务器", studentAnswer: "授权服务器", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-8", questionName: "索引优化", questionType: "judgment", questionContent: "数据库表中索引越多越好，不会影响写入性能", correctAnswer: "false", studentAnswer: "true", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-9", questionName: "API 版本控制", questionType: "multiple", questionContent: "常见的 RESTful API 版本控制策略有哪些？", options: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version", "Cookie 中存放版本"], correctAnswer: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version"], studentAnswer: ["URL 路径版本号", "查询参数 version"], score: 3, maxScore: 5, isCorrect: false },
      { questionId: "qb-10", questionName: "ORM 作用", questionType: "single", questionContent: "ORM (对象关系映射) 的主要作用是什么？", options: ["将对象映射到关系数据库", "优化网络传输", "缓存查询结果", "管理服务器负载"], correctAnswer: "将对象映射到关系数据库", studentAnswer: "将对象映射到关系数据库", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-11", questionName: "HTTPS 原理", questionType: "judgment", questionContent: "HTTPS 协议在 HTTP 基础上增加了 SSL/TLS 加密层", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-12", questionName: "NoSQL 特点", questionType: "multiple", questionContent: "以下哪些是 NoSQL 数据库的典型特点？", options: ["灵活的数据模型", "支持水平扩展", "强事务一致性", "适合大规模数据"], correctAnswer: ["灵活的数据模型", "支持水平扩展", "适合大规模数据"], studentAnswer: ["灵活的数据模型", "支持水平扩展", "适合大规模数据"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-13", questionName: "中间件概念", questionType: "single", questionContent: "在 Express/Koa 等框架中，中间件(Middleware)的执行顺序是？", options: ["随机执行", "后进先出", "先进先出（洋葱模型）", "并行执行"], correctAnswer: "先进先出（洋葱模型）", studentAnswer: "先进先出（洋葱模型）", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-14", questionName: "缓存穿透", questionType: "judgment", questionContent: "缓存穿透是指查询一个数据库中不存在的数据，导致每次请求都打到数据库", correctAnswer: "true", studentAnswer: "false", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-15", questionName: "微服务通信", questionType: "multiple", questionContent: "微服务架构中常见的服务间通信方式有哪些？", options: ["HTTP REST", "gRPC", "消息队列", "共享内存"], correctAnswer: ["HTTP REST", "gRPC", "消息队列"], studentAnswer: ["HTTP REST", "gRPC", "消息队列"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-s2", questionName: "数据库索引设计", questionType: "text", questionContent: "请说明数据库索引的作用、适用场景，以及创建索引时需要注意的问题。", correctAnswer: "索引作用：加速数据查询，通过 B+Tree 等数据结构减少磁盘 I/O。适用场景：高频查询字段、WHERE/JOIN/ORDER BY 涉及的列、外键关联字段。注意事项：1. 索引不是越多越好，过多索引会降低写入性能；2. 区分度低的字段不适合建索引；3. 联合索引要注意最左前缀原则；4. 定期分析和优化索引。", studentAnswer: "数据库索引的作用是提高查询速度。适合在经常查询的字段上建索引，比如用户表的用户名字段。但是索引也有缺点，会降低插入和更新的速度，所以不能乱建索引。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "qb-16", questionName: "Docker 容器", questionType: "single", questionContent: "Docker 容器与虚拟机(VM)相比，主要优势是什么？", options: ["完全隔离更安全", "启动更快、资源占用更少", "支持更多操作系统", "配置更简单"], correctAnswer: "启动更快、资源占用更少", studentAnswer: "启动更快、资源占用更少", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-17", questionName: "CAP 定理", questionType: "judgment", questionContent: "根据 CAP 定理，分布式系统最多只能同时满足一致性、可用性和分区容错性中的两项", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-18", questionName: "Redis 数据类型", questionType: "multiple", questionContent: "Redis 支持以下哪些数据类型？", options: ["String", "Hash", "List", "Graph"], correctAnswer: ["String", "Hash", "List"], studentAnswer: ["String", "Hash", "List", "Graph"], score: 2, maxScore: 5, isCorrect: false },
      { questionId: "qb-19", questionName: "负载均衡", questionType: "single", questionContent: "Nginx 作为反向代理和负载均衡器，默认使用的负载均衡算法是？", options: ["轮询(Round Robin)", "最少连接", "IP 哈希", "加权轮询"], correctAnswer: "轮询(Round Robin)", studentAnswer: "轮询(Round Robin)", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-20", questionName: "跨域 CORS", questionType: "judgment", questionContent: "简单请求(Simple Request)触发 CORS 预检请求(Preflight)", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-21", questionName: "数据库范式", questionType: "multiple", questionContent: "以下关于数据库范式的描述，正确的有哪些？", options: ["第一范式要求原子性", "第二范式消除部分函数依赖", "第三范式消除传递函数依赖", "BCNF 比第三范式要求更宽松"], correctAnswer: ["第一范式要求原子性", "第二范式消除部分函数依赖", "第三范式消除传递函数依赖"], studentAnswer: ["第一范式要求原子性", "第二范式消除部分函数依赖", "第三范式消除传递函数依赖"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-22", questionName: "Git 分支策略", questionType: "single", questionContent: "Git Flow 工作流中，用于发布生产版本的长期分支是？", options: ["develop", "feature", "release", "master/main"], correctAnswer: "master/main", studentAnswer: "master/main", score: 5, maxScore: 5, isCorrect: true },
    ],
  },
  {
    id: "sub-5",
    studentId: "stu-4",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-22 11:20:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "q-1", questionName: "React 18 并发特性", questionType: "single", questionContent: "React 18 中引入的并发特性主要解决什么问题？", options: ["性能优化", "代码复用", "状态管理", "路由控制"], correctAnswer: "性能优化", studentAnswer: "状态管理", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-2", questionName: "TypeScript 基础判断", questionType: "judgment", questionContent: "TypeScript 是 JavaScript 的超集", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-3", questionName: "React 状态管理方案", questionType: "multiple", questionContent: "以下哪些是常用的 React 状态管理方案？", options: ["Redux", "MobX", "Zustand", "jQuery"], correctAnswer: ["Redux", "MobX", "Zustand"], studentAnswer: ["Redux", "MobX", "Zustand"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-4", questionName: "CSS 盒模型", questionType: "single", questionContent: "在 CSS 标准盒模型中，元素的宽度(width)包含哪些部分？", options: ["仅内容宽度", "内容+内边距", "内容+内边距+边框", "内容+内边距+边框+外边距"], correctAnswer: "仅内容宽度", studentAnswer: "仅内容宽度", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-5", questionName: "JS 事件循环", questionType: "single", questionContent: "JavaScript 中，setTimeout 的回调函数会在哪个阶段执行？", options: ["同步执行", "宏任务队列", "微任务队列", "渲染阶段"], correctAnswer: "宏任务队列", studentAnswer: "宏任务队列", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-s1", questionName: "React 性能优化方法", questionType: "text", questionContent: "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", correctAnswer: "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", studentAnswer: "React 性能优化的方法包括使用 memo、useMemo、懒加载等。memo 可以避免子组件重复渲染，useMemo 可以缓存计算结果，懒加载可以减少首屏加载时间。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "q-6", questionName: "Promise 基础", questionType: "judgment", questionContent: "Promise.resolve(1).then(v => console.log(v)) 会立即同步输出 1", correctAnswer: "false", studentAnswer: "true", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-7", questionName: "HTTP 缓存策略", questionType: "multiple", questionContent: "以下哪些 HTTP 头部与缓存控制有关？", options: ["Cache-Control", "Expires", "Content-Type", "ETag"], correctAnswer: ["Cache-Control", "Expires", "ETag"], studentAnswer: ["Cache-Control", "Expires", "ETag"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-8", questionName: "React Hooks 规则", questionType: "single", questionContent: "以下关于 React Hooks 的使用规则，哪项是正确的？", options: ["可以在循环中调用 useState", "可以在条件语句中调用 useEffect", "只能在函数组件顶层调用", "可以在普通函数中调用 useContext"], correctAnswer: "只能在函数组件顶层调用", studentAnswer: "可以在普通函数中调用 useContext", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-9", questionName: "Git 工作流", questionType: "judgment", questionContent: "git rebase 操作会改写提交历史", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-10", questionName: "前端安全", questionType: "multiple", questionContent: "以下哪些属于常见的前端安全漏洞？", options: ["XSS", "CSRF", "SQL 注入", "点击劫持"], correctAnswer: ["XSS", "CSRF", "点击劫持"], studentAnswer: ["XSS", "CSRF", "点击劫持"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-11", questionName: "Webpack 作用", questionType: "single", questionContent: "Webpack 的主要作用是什么？", options: ["代码运行时解释执行", "模块打包与资源优化", "数据库连接管理", "服务器端渲染"], correctAnswer: "模块打包与资源优化", studentAnswer: "模块打包与资源优化", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-12", questionName: "闭包特性", questionType: "judgment", questionContent: "JavaScript 闭包可以访问外部函数的变量，即使外部函数已经执行完毕", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-13", questionName: "RESTful 设计", questionType: "multiple", questionContent: "以下哪些 HTTP 方法在 RESTful API 中具有幂等性？", options: ["GET", "POST", "PUT", "DELETE"], correctAnswer: ["GET", "PUT", "DELETE"], studentAnswer: ["GET", "PUT", "DELETE"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-14", questionName: "虚拟 DOM", questionType: "single", questionContent: "React 中虚拟 DOM 的主要优势是什么？", options: ["直接操作真实 DOM 更快", "减少不必要的真实 DOM 操作", "不需要写 CSS", "自动处理服务端请求"], correctAnswer: "减少不必要的真实 DOM 操作", studentAnswer: "减少不必要的真实 DOM 操作", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-15", questionName: "TypeScript 接口", questionType: "judgment", questionContent: "TypeScript 中的 interface 和 type 在功能上完全等价，没有区别", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-s2", questionName: "前端工程化实践", questionType: "text", questionContent: "请结合实际项目经验，阐述前端工程化的核心目标和常用工具链。", correctAnswer: "前端工程化的核心目标包括规范化、自动化、模块化和性能优化。常用工具链：Webpack/Vite（构建）、ESLint/Prettier（规范）、Jest（测试）、Docker/CI（部署）。", studentAnswer: "前端工程化主要是为了让代码更规范、开发更高效。我们团队使用了 ESLint 来保证代码风格一致，使用 Webpack 来打包项目，还配置了 Jenkins 来实现自动化部署。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "q-16", questionName: "浏览器存储", questionType: "multiple", questionContent: "以下哪些是浏览器端可用的存储方案？", options: ["localStorage", "sessionStorage", "IndexedDB", "Cookie"], correctAnswer: ["localStorage", "sessionStorage", "IndexedDB", "Cookie"], studentAnswer: ["localStorage", "sessionStorage", "IndexedDB"], score: 4, maxScore: 5, isCorrect: false },
      { questionId: "q-17", questionName: "ES6 箭头函数", questionType: "single", questionContent: "箭头函数与普通函数的主要区别不包括以下哪项？", options: ["没有自己的 this", "不能作为构造函数", "不能使用 yield 关键字", "默认拥有 arguments 对象"], correctAnswer: "默认拥有 arguments 对象", studentAnswer: "不能使用 yield 关键字", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-18", questionName: "跨域请求", questionType: "judgment", questionContent: "CORS 是一种服务器端的安全机制，浏览器会自动允许所有跨域请求", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-19", questionName: "性能优化手段", questionType: "multiple", questionContent: "以下哪些手段可以优化前端首屏加载速度？", options: ["代码分割(Code Splitting)", "懒加载(Lazy Loading)", "增加更多 HTTP 请求", "资源预加载(Preload)"], correctAnswer: ["代码分割(Code Splitting)", "懒加载(Lazy Loading)", "资源预加载(Preload)"], studentAnswer: ["代码分割(Code Splitting)", "懒加载(Lazy Loading)", "资源预加载(Preload)"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-20", questionName: "DOM 事件委托", questionType: "single", questionContent: "事件委托(Event Delegation)的核心原理是什么？", options: ["每个子元素都绑定独立事件", "利用事件冒泡机制在父元素统一处理", "使用定时器轮询检测", "通过 MutationObserver 监听 DOM 变化"], correctAnswer: "利用事件冒泡机制在父元素统一处理", studentAnswer: "每个子元素都绑定独立事件", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "q-21", questionName: "NPM 包管理", questionType: "judgment", questionContent: "package-lock.json 文件应该被提交到版本控制中", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "q-22", questionName: "CSS 优先级", questionType: "single", questionContent: "以下 CSS 选择器中，优先级最高的是？", options: [".class", "#id", "div", "[attr]"], correctAnswer: "#id", studentAnswer: ".class", score: 0, maxScore: 5, isCorrect: false },
    ],
  },
  {
    id: "sub-6",
    studentId: "stu-5",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-23 09:00:00",
    maxScore: 100,
    drawnQuestions: [
      {
        questionId: "qb-7",
        questionName: "React 生命周期理解",
        questionContent: "请简述 React 类组件的生命周期方法及其执行顺序，并说明在函数组件中如何替代这些生命周期方法。",
        questionType: "subjective",
        correctAnswer: "React 类组件生命周期分为三个阶段：挂载阶段（constructor → render → componentDidMount）、更新阶段（shouldComponentUpdate → render → componentDidUpdate）、卸载阶段（componentWillUnmount）。在函数组件中，使用 useEffect Hook 来替代生命周期方法：useEffect(() => { ... }, []) 替代 componentDidMount；useEffect(() => { ... }, [deps]) 替代 componentDidUpdate；useEffect 返回的清理函数替代 componentWillUnmount。",
      },
      {
        questionId: "qb-10",
        questionName: "前端性能优化",
        questionContent: "请列举至少 5 种前端性能优化的方法，并说明适用场景。",
        questionType: "subjective",
        correctAnswer: "1. 代码分割（Code Splitting）：使用动态 import 或 React.lazy 按需加载模块，适用于大型单页应用。2. 图片优化：使用 WebP 格式、懒加载、响应式图片，适用于图片密集型页面。3. 缓存策略：合理设置 HTTP 缓存头、使用 Service Worker，适用于频繁访问的静态资源。4. 减少重排重绘：避免频繁操作 DOM、使用 CSS transform 代替位置属性，适用于动画和交互密集型页面。5. 资源预加载：使用 preload、prefetch 预加载关键资源，适用于首屏加载优化。",
      },
    ],
    evalPointScores: [],
  },
  {
    id: "sub-7",
    studentId: "stu-6",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-24 14:00:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "qb-1", questionName: "HTTP 方法语义", questionType: "single", questionContent: "RESTful 设计中，PUT 方法的主要语义是什么？", options: ["创建资源", "更新资源", "删除资源", "查询资源"], correctAnswer: "更新资源", studentAnswer: "创建资源", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-2", questionName: "状态码 401 含义", questionType: "judgment", questionContent: "HTTP 状态码 401 表示请求参数格式错误", correctAnswer: "false", studentAnswer: "true", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-3", questionName: "幂等性方法", questionType: "multiple", questionContent: "以下哪些 HTTP 方法具有幂等性？", options: ["GET", "POST", "PUT", "PATCH"], correctAnswer: ["GET", "PUT"], studentAnswer: ["GET", "POST", "PUT"], score: 2, maxScore: 5, isCorrect: false },
      { questionId: "qb-4", questionName: "JWT 结构", questionType: "single", questionContent: "JWT (JSON Web Token) 由哪三部分组成？", options: ["Header.Payload.Signature", "Key.Value.Secret", "Auth.Token.Session", "ID.Data.Hash"], correctAnswer: "Header.Payload.Signature", studentAnswer: "Header.Payload.Signature", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-5", questionName: "SQL 注入", questionType: "judgment", questionContent: "使用参数化查询可以有效防止 SQL 注入攻击", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-s1", questionName: "RESTful API 设计原则", questionType: "text", questionContent: "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", correctAnswer: "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作，使用名词复数，如 /users、/orders/{id}；2. HTTP 方法表达操作：GET 查询、POST 创建、PUT 更新、DELETE 删除；3. 无状态：每个请求独立，服务端不保存客户端状态；4. 统一接口：一致的响应格式和状态码。", studentAnswer: "RESTful API 设计应该以资源为中心，URI 使用名词表示资源，比如 /users 表示用户列表。HTTP 方法对应 CRUD 操作，GET 获取资源，POST 创建资源。这样做的好处是接口语义清晰，易于理解和维护。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "qb-6", questionName: "数据库事务", questionType: "multiple", questionContent: "数据库事务的 ACID 特性包括哪些？", options: ["原子性", "一致性", "隔离性", "持久性"], correctAnswer: ["原子性", "一致性", "隔离性", "持久性"], studentAnswer: ["原子性", "一致性", "隔离性", "持久性"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-7", questionName: "OAuth2 角色", questionType: "single", questionContent: "在 OAuth2.0 授权框架中，负责颁发访问令牌的是？", options: ["资源所有者", "客户端", "授权服务器", "资源服务器"], correctAnswer: "授权服务器", studentAnswer: "资源服务器", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-8", questionName: "索引优化", questionType: "judgment", questionContent: "数据库表中索引越多越好，不会影响写入性能", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-9", questionName: "API 版本控制", questionType: "multiple", questionContent: "常见的 RESTful API 版本控制策略有哪些？", options: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version", "Cookie 中存放版本"], correctAnswer: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version"], studentAnswer: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-10", questionName: "ORM 作用", questionType: "single", questionContent: "ORM (对象关系映射) 的主要作用是什么？", options: ["将对象映射到关系数据库", "优化网络传输", "缓存查询结果", "管理服务器负载"], correctAnswer: "将对象映射到关系数据库", studentAnswer: "将对象映射到关系数据库", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-11", questionName: "HTTPS 原理", questionType: "judgment", questionContent: "HTTPS 协议在 HTTP 基础上增加了 SSL/TLS 加密层", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-12", questionName: "NoSQL 特点", questionType: "multiple", questionContent: "以下哪些是 NoSQL 数据库的典型特点？", options: ["灵活的数据模型", "支持水平扩展", "强事务一致性", "适合大规模数据"], correctAnswer: ["灵活的数据模型", "支持水平扩展", "适合大规模数据"], studentAnswer: ["灵活的数据模型", "支持水平扩展", "适合大规模数据"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-13", questionName: "中间件概念", questionType: "single", questionContent: "在 Express/Koa 等框架中，中间件(Middleware)的执行顺序是？", options: ["随机执行", "后进先出", "先进先出（洋葱模型）", "并行执行"], correctAnswer: "先进先出（洋葱模型）", studentAnswer: "后进先出", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-14", questionName: "缓存穿透", questionType: "judgment", questionContent: "缓存穿透是指查询一个数据库中不存在的数据，导致每次请求都打到数据库", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-15", questionName: "微服务通信", questionType: "multiple", questionContent: "微服务架构中常见的服务间通信方式有哪些？", options: ["HTTP REST", "gRPC", "消息队列", "共享内存"], correctAnswer: ["HTTP REST", "gRPC", "消息队列"], studentAnswer: ["HTTP REST", "gRPC", "消息队列"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-s2", questionName: "数据库索引设计", questionType: "text", questionContent: "请说明数据库索引的作用、适用场景，以及创建索引时需要注意的问题。", correctAnswer: "索引作用：加速查询。适用场景：高频查询字段、WHERE/JOIN/ORDER BY 涉及的列。注意事项：1. 不是越多越好；2. 区分度低的字段不适合；3. 联合索引注意最左前缀原则。", studentAnswer: "索引能提高查询速度，适合在经常查询的字段上建。但是会降低写入速度，不能乱建。", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "qb-16", questionName: "Docker 容器", questionType: "single", questionContent: "Docker 容器与虚拟机(VM)相比，主要优势是什么？", options: ["完全隔离更安全", "启动更快、资源占用更少", "支持更多操作系统", "配置更简单"], correctAnswer: "启动更快、资源占用更少", studentAnswer: "启动更快、资源占用更少", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-17", questionName: "CAP 定理", questionType: "judgment", questionContent: "根据 CAP 定理，分布式系统最多只能同时满足一致性、可用性和分区容错性中的两项", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-18", questionName: "Redis 数据类型", questionType: "multiple", questionContent: "Redis 支持以下哪些数据类型？", options: ["String", "Hash", "List", "Graph"], correctAnswer: ["String", "Hash", "List"], studentAnswer: ["String", "Hash", "List"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-19", questionName: "负载均衡", questionType: "single", questionContent: "Nginx 作为反向代理和负载均衡器，默认使用的负载均衡算法是？", options: ["轮询(Round Robin)", "最少连接", "IP 哈希", "加权轮询"], correctAnswer: "轮询(Round Robin)", studentAnswer: "最少连接", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-20", questionName: "跨域 CORS", questionType: "judgment", questionContent: "简单请求(Simple Request)触发 CORS 预检请求(Preflight)", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-21", questionName: "数据库范式", questionType: "multiple", questionContent: "以下关于数据库范式的描述，正确的有哪些？", options: ["第一范式要求原子性", "第二范式消除部分函数依赖", "第三范式消除传递函数依赖", "BCNF 比第三范式要求更宽松"], correctAnswer: ["第一范式要求原子性", "第二范式消除部分函数依赖", "第三范式消除传递函数依赖"], studentAnswer: ["第一范式要求原子性", "第二范式消除部分函数依赖", "第三范式消除传递函数依赖"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-22", questionName: "Git 分支策略", questionType: "single", questionContent: "Git Flow 工作流中，用于发布生产版本的长期分支是？", options: ["develop", "feature", "release", "master/main"], correctAnswer: "master/main", studentAnswer: "release", score: 0, maxScore: 5, isCorrect: false },
    ],
  },
  // 现场问答 - 混合题型（单选+判断+主观）
  {
    id: "sub-8",
    studentId: "stu-3",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-25 10:30:00",
    maxScore: 100,
    drawnQuestions: [
      {
        questionId: "dq-1",
        questionName: "HTTP 安全方法",
        questionContent: "在 HTTP 协议中，以下哪个方法被认为是安全的（Safe Method），即不会引起服务器状态变化？",
        questionType: "single",
        options: ["GET", "POST", "DELETE", "PATCH"],
        correctAnswer: "GET",
      },
      {
        questionId: "dq-2",
        questionName: "RESTful URI 设计",
        questionContent: "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？",
        questionType: "single",
        options: ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"],
        correctAnswer: "GET /users/123/orders",
      },
      {
        questionId: "dq-3",
        questionName: "幂等性判断",
        questionContent: "PATCH 方法在 RESTful 设计中具有幂等性，多次执行结果相同。",
        questionType: "judgment",
        correctAnswer: "false",
      },
      {
        questionId: "dq-4",
        questionName: "状态码选择",
        questionContent: "当客户端请求的资源不存在时，服务器应该返回哪个 HTTP 状态码？",
        questionType: "single",
        options: ["400 Bad Request", "401 Unauthorized", "403 Forbidden", "404 Not Found"],
        correctAnswer: "404 Not Found",
      },
      {
        questionId: "dq-5",
        questionName: "API 限流策略",
        questionContent: "请说明 API 限流（Rate Limiting）的常见实现策略，以及如何在响应中告知客户端限流信息。",
        questionType: "subjective",
        correctAnswer: "常见限流策略：1. 令牌桶（Token Bucket）：允许一定突发流量，平均速率恒定；2. 漏桶（Leaky Bucket）：流量输出速率恒定，无突发；3. 固定窗口计数器：按时间窗口统计请求数；4. 滑动窗口日志：精确控制，但内存开销大。响应头中通常使用 X-RateLimit-Limit（总限额）、X-RateLimit-Remaining（剩余次数）、X-RateLimit-Reset（重置时间）、Retry-After（重试等待时间）来告知客户端。",
      },
    ],
    evalPointScores: [],
  },
  // 现场问答 - 客观题为主+1道主观题
  {
    id: "sub-9",
    studentId: "stu-4",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-25 14:00:00",
    maxScore: 100,
    drawnQuestions: [
      {
        questionId: "dq-6",
        questionName: "React key 属性",
        questionContent: "在 React 列表渲染中，使用数组索引作为 key 值在任何情况下都是安全的。",
        questionType: "judgment",
        correctAnswer: "false",
      },
      {
        questionId: "dq-7",
        questionName: "CSS 层叠优先级",
        questionContent: "以下 CSS 选择器中，优先级最高的是？",
        questionType: "single",
        options: [".container .item", "#app .item", "div.item", ".item[data-active]"],
        correctAnswer: "#app .item",
      },
      {
        questionId: "dq-8",
        questionName: "JS 异步执行顺序",
        questionContent: "以下代码的输出顺序是什么？\nconsole.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');",
        questionType: "single",
        options: ["A B C D", "A D C B", "A D B C", "A C D B"],
        correctAnswer: "A D C B",
      },
      {
        questionId: "dq-9",
        questionName: "Webpack Loader",
        questionContent: "Webpack 中的 Loader 执行顺序是从右到左（从后往前）。",
        questionType: "judgment",
        correctAnswer: "true",
      },
      {
        questionId: "dq-10",
        questionName: "前端安全防御",
        questionContent: "请结合实际场景，说明 XSS 和 CSRF 攻击的区别，以及前端分别可以采取哪些防御措施。",
        questionType: "subjective",
        correctAnswer: "XSS（跨站脚本攻击）：攻击者向页面注入恶意脚本，在用户浏览器执行。防御：1. 输入过滤和输出转义；2. 使用 Content-Security-Policy；3. 对 Cookie 设置 HttpOnly。CSRF（跨站请求伪造）：攻击者诱导用户浏览器发起非预期的请求。防御：1. CSRF Token 验证；2. 双重 Cookie 验证；3. SameSite Cookie 属性设置；4. 验证 Referer/Origin 头。",
      },
    ],
    evalPointScores: [],
  },
  // 评审 - 带图片和文档附件
  {
    id: "sub-10",
    studentId: "stu-5",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-24 09:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "我使用 Swagger/OpenAPI 3.0 规范完成了用户管理模块的接口文档撰写，包含以下接口：\n\n1. GET /api/v1/users - 用户列表查询（支持分页、排序、筛选）\n2. POST /api/v1/users - 创建用户\n3. GET /api/v1/users/{id} - 用户详情\n4. PUT /api/v1/users/{id} - 更新用户信息\n5. DELETE /api/v1/users/{id} - 删除用户\n\n文档中详细描述了每个接口的请求参数、响应结构、错误码定义和示例数据。",
      attachments: [
        {
          id: "att-4",
          name: "API接口架构图.png",
          type: "image",
          url: "https://placehold.co/800x600/e2e8f0/475569?text=API+Architecture+Diagram",
        },
        {
          id: "att-5",
          name: "接口设计规范文档.md",
          type: "document",
          url: "#",
          content: "# 接口设计规范文档\n\n## 1. 命名规范\n- URI 使用小写字母，单词间用中划线分隔\n- 资源名使用复数形式，如 /users、/orders\n- 动作使用 HTTP 方法表示，不在 URI 中使用动词\n\n## 2. 请求规范\n- Content-Type: application/json\n- 分页参数：page、pageSize，默认 pageSize=20\n- 排序参数：sort=field:asc|desc\n\n## 3. 响应规范\n- 统一包装格式：{ code, message, data, timestamp }\n- 成功 code 为 200，业务错误以 4xx 表示\n- 时间戳使用 ISO 8601 格式\n\n## 4. 错误码定义\n| 错误码 | 说明 |\n|--------|------|\n| 40001 | 参数校验失败 |\n| 40002 | 资源不存在 |\n| 40003 | 权限不足 |\n| 50001 | 服务器内部错误 |",
        },
        {
          id: "att-6",
          name: "user-api.yaml",
          type: "code",
          url: "#",
          content: `openapi: 3.0.0\ninfo:\n  title: User Management API\n  version: 1.0.0\npaths:\n  /api/v1/users:\n    get:\n      summary: List users\n      parameters:\n        - name: page\n          in: query\n          schema:\n            type: integer\n            default: 1\n        - name: pageSize\n          in: query\n          schema:\n            type: integer\n            default: 20\n      responses:\n        '200':\n          description: OK\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  code:\n                    type: integer\n                  data:\n                    type: object\n                    properties:\n                      list:\n                        type: array\n                        items:\n                          $ref: '#/components/schemas/User'\n                      total:\n                        type: integer\n    post:\n      summary: Create user\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: '#/components/schemas/UserCreate'\n      responses:\n        '201':\n          description: Created`,
        },
      ],
    },
    evalPointScores: [],
  },
  // 评审 - 带视频和代码附件
  {
    id: "sub-11",
    studentId: "stu-2",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 11:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "我重新设计并实现了用户认证模块 v2.0 版本，主要改进点：\n\n1. 采用 OAuth2 + JWT 双令牌机制（Access Token + Refresh Token）\n2. 新增多因素认证（MFA）支持，集成 TOTP 算法\n3. 实现 RBAC 权限模型，支持动态角色分配\n4. 添加登录审计日志，记录 IP、设备、时间等信息\n5. 密码策略升级：最小 12 位，必须包含大小写字母、数字和特殊字符\n\n所有代码均包含单元测试，覆盖率 > 85%。",
      attachments: [
        {
          id: "att-7",
          name: "认证模块演示.mp4",
          type: "video",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        },
        {
          id: "att-8",
          name: "auth-service.ts",
          type: "code",
          url: "#",
          content: `import jwt from 'jsonwebtoken';\nimport bcrypt from 'bcrypt';\nimport { User, Role, Permission } from './types';\n\nconst ACCESS_TOKEN_EXPIRY = '15m';\nconst REFRESH_TOKEN_EXPIRY = '7d';\nconst SALT_ROUNDS = 12;\n\nexport class AuthService {\n  async login(email: string, password: string, deviceInfo: DeviceInfo) {\n    const user = await this.userRepository.findByEmail(email);\n    if (!user) throw new AuthenticationError('用户不存在');\n    \n    const valid = await bcrypt.compare(password, user.passwordHash);\n    if (!valid) {\n      await this.auditLog.record({\n        userId: user.id,\n        action: 'LOGIN_FAILED',\n        ip: deviceInfo.ip,\n        userAgent: deviceInfo.userAgent,\n      });\n      throw new AuthenticationError('密码错误');\n    }\n    \n    if (user.mfaEnabled) {\n      return { mfaRequired: true, tempToken: this.generateTempToken(user.id) };\n    }\n    \n    const tokens = await this.generateTokenPair(user);\n    await this.auditLog.record({\n      userId: user.id,\n      action: 'LOGIN_SUCCESS',\n      ip: deviceInfo.ip,\n    });\n    \n    return { user: this.sanitizeUser(user), ...tokens };\n  }\n  \n  private async generateTokenPair(user: User) {\n    const accessToken = jwt.sign(\n      { sub: user.id, roles: user.roles },\n      process.env.JWT_SECRET!,\n      { expiresIn: ACCESS_TOKEN_EXPIRY }\n    );\n    const refreshToken = jwt.sign(\n      { sub: user.id, type: 'refresh' },\n      process.env.JWT_REFRESH_SECRET!,\n      { expiresIn: REFRESH_TOKEN_EXPIRY }\n    );\n    await this.refreshTokenStore.save(user.id, refreshToken);\n    return { accessToken, refreshToken };\n  }\n}`,
        },
        {
          id: "att-9",
          name: "测试报告.pdf",
          type: "document",
          url: "#",
          content: `# 用户认证模块 v2.0 测试报告\n\n## 测试概述\n- 测试时间：2026-04-20 至 2026-04-25\n- 测试人员：李四\n- 测试环境：Node.js 20.x, Jest 29.x, PostgreSQL 15\n\n## 覆盖率统计\n| 模块 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 | 行覆盖率 |\n|------|-----------|-----------|-----------|---------|\n| auth-service.ts | 94.2% | 88.5% | 100% | 94.2% |\n| mfa-service.ts | 91.7% | 85.0% | 100% | 91.7% |\n| rbac-service.ts | 89.3% | 82.1% | 100% | 89.3% |\n| audit-service.ts | 96.0% | 90.0% | 100% | 96.0% |\n| **总计** | **92.8%** | **86.4%** | **100%** | **92.8%** |\n\n## 主要测试用例\n1. ✅ 正常登录流程（邮箱+密码）\n2. ✅ 错误密码锁定机制（5次错误后锁定30分钟）\n3. ✅ JWT Token 刷新机制\n4. ✅ TOTP 多因素认证验证\n5. ✅ RBAC 权限校验（允许/拒绝场景）\n6. ✅ 审计日志完整性验证`,
        },
      ],
    },
    evalPointScores: [],
  },
  {
    id: "sub-12",
    studentId: "stu-7",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-26 09:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "代码复用", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "true", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX", "jQuery"], "score": 2, "maxScore": 5, "isCorrect": true}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-13",
    studentId: "stu-2",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-26 15:30:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "性能优化", "score": 0, "maxScore": 5, "isCorrect": true}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "true", "score": 5, "maxScore": 5, "isCorrect": false}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX"], "score": 3, "maxScore": 5, "isCorrect": false}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-14",
    studentId: "stu-12",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-21 14:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "性能优化", "score": 5, "maxScore": 5, "isCorrect": false}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "true", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX", "jQuery"], "score": 3, "maxScore": 5, "isCorrect": true}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-15",
    studentId: "stu-11",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "graded",
    submittedAt: "2026-04-26 09:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "代码复用", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "false", "score": 0, "maxScore": 5, "isCorrect": true}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX", "jQuery"], "score": 5, "maxScore": 5, "isCorrect": false}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
    totalScore: 67,
    gradedAt: "2026-04-26 10:00:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-16",
    studentId: "stu-21",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-21 14:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "性能优化", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "true", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX", "jQuery"], "score": 3, "maxScore": 5, "isCorrect": true}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-17",
    studentId: "stu-8",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-23 10:30:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "代码复用", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "false", "score": 0, "maxScore": 5, "isCorrect": true}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX", "Zustand"], "score": 3, "maxScore": 5, "isCorrect": false}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-18",
    studentId: "stu-15",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "试卷",
    status: "pending",
    submittedAt: "2026-04-26 10:30:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "q-1", "questionName": "React 18 并发特性", "questionType": "single", "questionContent": "React 18 中引入的并发特性主要解决什么问题？", "options": ["性能优化", "代码复用", "状态管理", "路由控制"], "correctAnswer": "性能优化", "studentAnswer": "代码复用", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-2", "questionName": "TypeScript 基础判断", "questionType": "judgment", "questionContent": "TypeScript 是 JavaScript 的超集", "correctAnswer": "true", "studentAnswer": "true", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-3", "questionName": "React 状态管理方案", "questionType": "multiple", "questionContent": "以下哪些是常用的 React 状态管理方案？", "options": ["Redux", "MobX", "Zustand", "jQuery"], "correctAnswer": ["Redux", "MobX", "Zustand"], "studentAnswer": ["Redux", "MobX"], "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "q-s1", "questionName": "React 性能优化方法", "questionType": "text", "questionContent": "请简述 React 中常用的性能优化方法，至少列举 3 种并说明适用场景。", "correctAnswer": "1. React.memo / PureComponent：避免不必要的重渲染；2. useMemo / useCallback：缓存计算结果和函数引用；3. 代码分割：减少首屏加载资源。", "studentAnswer": "我了解到的性能优化方法有：使用 PureComponent 减少渲染次数，使用虚拟列表处理大数据量，以及使用 Webpack 进行代码分割。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-19",
    studentId: "stu-13",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-19-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-19-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-20",
    studentId: "stu-9",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-27 15:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: `我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：

1. 登录页面：包含表单验证、密码加密传输
2. 注册功能：邮箱验证、密码强度检测
3. 权限控制：基于 JWT 的鉴权机制
4. 路由守卫：未登录用户自动跳转登录页`,
      attachments: [{"id": "att-20-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-20-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-21",
    studentId: "stu-18",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-23 10:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。",
      attachments: [{"id": "att-21-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-21-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 69,
    gradedAt: "2026-04-23 11:30:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-22",
    studentId: "stu-15",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-19 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-22-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-22-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 92,
    gradedAt: "2026-04-19 10:00:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-23",
    studentId: "stu-17",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-20 10:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-23-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-23-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-24",
    studentId: "stu-7",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-27 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: `我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：

1. 登录页面：包含表单验证、密码加密传输
2. 注册功能：邮箱验证、密码强度检测
3. 权限控制：基于 JWT 的鉴权机制
4. 路由守卫：未登录用户自动跳转登录页`,
      attachments: [{"id": "att-24-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-24-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 77,
    gradedAt: "2026-04-27 10:00:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-25",
    studentId: "stu-11",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-27 15:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。",
      attachments: [{"id": "att-25-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-25-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 81,
    gradedAt: "2026-04-27 16:30:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-26",
    studentId: "stu-5",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-26-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-26-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-27",
    studentId: "stu-5",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-18 14:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-27-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-27-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 81,
    gradedAt: "2026-04-18 15:00:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-28",
    studentId: "stu-23",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: `我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：

1. 登录页面：包含表单验证、密码加密传输
2. 注册功能：邮箱验证、密码强度检测
3. 权限控制：基于 JWT 的鉴权机制
4. 路由守卫：未登录用户自动跳转登录页`,
      attachments: [{"id": "att-28-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-28-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-29",
    studentId: "stu-19",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。",
      attachments: [{"id": "att-29-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-29-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-30",
    studentId: "stu-10",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-20 14:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-30-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-30-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-31",
    studentId: "stu-12",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-31-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-31-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-32",
    studentId: "stu-24",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-27 14:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: `我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：

1. 登录页面：包含表单验证、密码加密传输
2. 注册功能：邮箱验证、密码强度检测
3. 权限控制：基于 JWT 的鉴权机制
4. 路由守卫：未登录用户自动跳转登录页`,
      attachments: [{"id": "att-32-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-32-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-33",
    studentId: "stu-11",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-18 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。",
      attachments: [{"id": "att-33-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-33-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 94,
    gradedAt: "2026-04-18 10:00:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-34",
    studentId: "stu-15",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-22 10:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-34-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-34-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-35",
    studentId: "stu-4",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-3",
    taskName: "核心业务组件开发",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-21 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-35-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-35-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-36",
    studentId: "stu-3",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-22 16:45:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
  },
  {
    id: "sub-37",
    studentId: "stu-17",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "graded",
    submittedAt: "2026-04-21 16:45:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
    totalScore: 89,
    gradedAt: "2026-04-21 17:45:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-38",
    studentId: "stu-24",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-22 15:30:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
  },
  {
    id: "sub-39",
    studentId: "stu-19",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-25 16:45:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
  },
  {
    id: "sub-40",
    studentId: "stu-6",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "graded",
    submittedAt: "2026-04-19 10:30:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
    totalScore: 72,
    gradedAt: "2026-04-19 11:30:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-41",
    studentId: "stu-20",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-23 09:00:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
  },
  {
    id: "sub-42",
    studentId: "stu-23",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-4",
    taskName: "性能优化与部署",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-27 10:30:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
  },
  {
    id: "sub-43",
    studentId: "stu-4",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-19 16:45:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "qb-1", "questionName": "HTTP 方法语义", "questionType": "single", "questionContent": "RESTful 设计中，PUT 方法的主要语义是什么？", "options": ["创建资源", "更新资源", "删除资源", "查询资源"], "correctAnswer": "更新资源", "studentAnswer": "更新资源", "score": 0, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-2", "questionName": "状态码 401 含义", "questionType": "judgment", "questionContent": "HTTP 状态码 401 表示请求参数格式错误", "correctAnswer": "false", "studentAnswer": "false", "score": 5, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-3", "questionName": "幂等性方法", "questionType": "multiple", "questionContent": "以下哪些 HTTP 方法具有幂等性？", "options": ["GET", "POST", "PUT", "PATCH"], "correctAnswer": ["GET", "PUT"], "studentAnswer": ["GET", "PUT"], "score": 2, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-s1", "questionName": "RESTful API 设计原则", "questionType": "text", "questionContent": "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", "correctAnswer": "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作；2. HTTP 方法表达操作；3. 无状态；4. 统一接口。", "studentAnswer": "RESTful API 设计应该以资源为中心，URI 使用名词表示资源。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-44",
    studentId: "stu-23",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-19 09:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "qb-1", "questionName": "HTTP 方法语义", "questionType": "single", "questionContent": "RESTful 设计中，PUT 方法的主要语义是什么？", "options": ["创建资源", "更新资源", "删除资源", "查询资源"], "correctAnswer": "更新资源", "studentAnswer": "创建资源", "score": 0, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-2", "questionName": "状态码 401 含义", "questionType": "judgment", "questionContent": "HTTP 状态码 401 表示请求参数格式错误", "correctAnswer": "false", "studentAnswer": "true", "score": 0, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-3", "questionName": "幂等性方法", "questionType": "multiple", "questionContent": "以下哪些 HTTP 方法具有幂等性？", "options": ["GET", "POST", "PUT", "PATCH"], "correctAnswer": ["GET", "PUT"], "studentAnswer": ["GET", "PUT"], "score": 5, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-s1", "questionName": "RESTful API 设计原则", "questionType": "text", "questionContent": "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", "correctAnswer": "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作；2. HTTP 方法表达操作；3. 无状态；4. 统一接口。", "studentAnswer": "RESTful API 设计应该以资源为中心，URI 使用名词表示资源。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-45",
    studentId: "stu-2",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-19 10:30:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "qb-1", "questionName": "HTTP 方法语义", "questionType": "single", "questionContent": "RESTful 设计中，PUT 方法的主要语义是什么？", "options": ["创建资源", "更新资源", "删除资源", "查询资源"], "correctAnswer": "更新资源", "studentAnswer": "更新资源", "score": 5, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-2", "questionName": "状态码 401 含义", "questionType": "judgment", "questionContent": "HTTP 状态码 401 表示请求参数格式错误", "correctAnswer": "false", "studentAnswer": "false", "score": 0, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-3", "questionName": "幂等性方法", "questionType": "multiple", "questionContent": "以下哪些 HTTP 方法具有幂等性？", "options": ["GET", "POST", "PUT", "PATCH"], "correctAnswer": ["GET", "PUT"], "studentAnswer": ["GET", "POST", "PUT"], "score": 2, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-s1", "questionName": "RESTful API 设计原则", "questionType": "text", "questionContent": "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", "correctAnswer": "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作；2. HTTP 方法表达操作；3. 无状态；4. 统一接口。", "studentAnswer": "RESTful API 设计应该以资源为中心，URI 使用名词表示资源。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-46",
    studentId: "stu-10",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-25 16:45:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "qb-1", "questionName": "HTTP 方法语义", "questionType": "single", "questionContent": "RESTful 设计中，PUT 方法的主要语义是什么？", "options": ["创建资源", "更新资源", "删除资源", "查询资源"], "correctAnswer": "更新资源", "studentAnswer": "更新资源", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-2", "questionName": "状态码 401 含义", "questionType": "judgment", "questionContent": "HTTP 状态码 401 表示请求参数格式错误", "correctAnswer": "false", "studentAnswer": "false", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-3", "questionName": "幂等性方法", "questionType": "multiple", "questionContent": "以下哪些 HTTP 方法具有幂等性？", "options": ["GET", "POST", "PUT", "PATCH"], "correctAnswer": ["GET", "PUT"], "studentAnswer": ["GET", "POST", "PUT"], "score": 2, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-s1", "questionName": "RESTful API 设计原则", "questionType": "text", "questionContent": "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", "correctAnswer": "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作；2. HTTP 方法表达操作；3. 无状态；4. 统一接口。", "studentAnswer": "RESTful API 设计应该以资源为中心，URI 使用名词表示资源。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-47",
    studentId: "stu-24",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-24 09:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "qb-1", "questionName": "HTTP 方法语义", "questionType": "single", "questionContent": "RESTful 设计中，PUT 方法的主要语义是什么？", "options": ["创建资源", "更新资源", "删除资源", "查询资源"], "correctAnswer": "更新资源", "studentAnswer": "更新资源", "score": 0, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-2", "questionName": "状态码 401 含义", "questionType": "judgment", "questionContent": "HTTP 状态码 401 表示请求参数格式错误", "correctAnswer": "false", "studentAnswer": "true", "score": 0, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-3", "questionName": "幂等性方法", "questionType": "multiple", "questionContent": "以下哪些 HTTP 方法具有幂等性？", "options": ["GET", "POST", "PUT", "PATCH"], "correctAnswer": ["GET", "PUT"], "studentAnswer": ["GET", "POST", "PUT"], "score": 2, "maxScore": 5, "isCorrect": false}, {"questionId": "qb-s1", "questionName": "RESTful API 设计原则", "questionType": "text", "questionContent": "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", "correctAnswer": "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作；2. HTTP 方法表达操作；3. 无状态；4. 统一接口。", "studentAnswer": "RESTful API 设计应该以资源为中心，URI 使用名词表示资源。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-48",
    studentId: "stu-22",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-21 14:00:00",
    maxScore: 100,
    objectiveAnswers: [{"questionId": "qb-1", "questionName": "HTTP 方法语义", "questionType": "single", "questionContent": "RESTful 设计中，PUT 方法的主要语义是什么？", "options": ["创建资源", "更新资源", "删除资源", "查询资源"], "correctAnswer": "更新资源", "studentAnswer": "更新资源", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-2", "questionName": "状态码 401 含义", "questionType": "judgment", "questionContent": "HTTP 状态码 401 表示请求参数格式错误", "correctAnswer": "false", "studentAnswer": "true", "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-3", "questionName": "幂等性方法", "questionType": "multiple", "questionContent": "以下哪些 HTTP 方法具有幂等性？", "options": ["GET", "POST", "PUT", "PATCH"], "correctAnswer": ["GET", "PUT"], "studentAnswer": ["GET", "POST", "PUT"], "score": 5, "maxScore": 5, "isCorrect": true}, {"questionId": "qb-s1", "questionName": "RESTful API 设计原则", "questionType": "text", "questionContent": "请阐述 RESTful API 设计的核心原则，并结合实例说明 URI 命名规范。", "correctAnswer": "RESTful API 核心原则：1. 资源导向：URI 表示资源而非动作；2. HTTP 方法表达操作；3. 无状态；4. 统一接口。", "studentAnswer": "RESTful API 设计应该以资源为中心，URI 使用名词表示资源。", "score": 0, "maxScore": 10, "isCorrect": false}],
  },
  {
    id: "sub-49",
    studentId: "stu-4",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-27 16:45:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
  },
  {
    id: "sub-50",
    studentId: "stu-7",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-27 09:00:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
  },
  {
    id: "sub-51",
    studentId: "stu-24",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "graded",
    submittedAt: "2026-04-27 16:45:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
    totalScore: 81,
    gradedAt: "2026-04-27 17:45:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-52",
    studentId: "stu-21",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-22 10:30:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
  },
  {
    id: "sub-53",
    studentId: "stu-22",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-21 14:00:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
  },
  {
    id: "sub-54",
    studentId: "stu-9",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "graded",
    submittedAt: "2026-04-20 14:00:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
    totalScore: 79,
    gradedAt: "2026-04-20 15:00:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-55",
    studentId: "stu-14",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-19 09:00:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
  },
  {
    id: "sub-56",
    studentId: "stu-5",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "graded",
    submittedAt: "2026-04-27 16:45:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-1", "questionName": "React 生命周期理解", "questionContent": "请简述 React 类组件的生命周期方法及其执行顺序。", "questionType": "subjective", "correctAnswer": "挂载阶段：constructor → render → componentDidMount；更新阶段：shouldComponentUpdate → render → componentDidUpdate；卸载阶段：componentWillUnmount。"}, {"questionId": "dq-2", "questionName": "前端性能优化", "questionContent": "请列举至少 3 种前端性能优化的方法，并说明适用场景。", "questionType": "subjective", "correctAnswer": "1. 代码分割（Code Splitting）；2. 图片优化；3. 缓存策略；4. 减少重排重绘；5. 资源预加载。"}],
    evalPointScores: [],
    totalScore: 68,
    gradedAt: "2026-04-27 17:45:00",
    gradedBy: "张老师",
  },
  {
    id: "sub-57",
    studentId: "stu-16",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-2",
    taskName: "API 接口实现与测试",
    assessmentForm: "现场问答",
    status: "pending",
    submittedAt: "2026-04-26 10:30:00",
    maxScore: 100,
    drawnQuestions: [{"questionId": "dq-3", "questionName": "HTTP 安全方法", "questionContent": "在 HTTP 协议中，以下哪个方法被认为是安全的？", "questionType": "single", "options": ["GET", "POST", "DELETE", "PATCH"], "correctAnswer": "GET"}, {"questionId": "dq-4", "questionName": "RESTful URI 设计", "questionContent": "RESTful API 中，获取用户 ID 为 123 的订单列表，以下哪个 URI 设计最符合规范？", "questionType": "single", "options": ["GET /getUserOrders?id=123", "GET /users/123/orders", "GET /users/orders/123", "POST /users/123/orders"], "correctAnswer": "GET /users/123/orders"}, {"questionId": "dq-5", "questionName": "API 限流策略", "questionContent": "请说明 API 限流的常见实现策略。", "questionType": "subjective", "correctAnswer": "常见限流策略：1. 令牌桶；2. 漏桶；3. 固定窗口计数器；4. 滑动窗口日志。"}],
    evalPointScores: [],
  },
  {
    id: "sub-58",
    studentId: "stu-10",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-27 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-58-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-58-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-59",
    studentId: "stu-6",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 14:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-59-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-59-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-60",
    studentId: "stu-13",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-20 14:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: `我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：

1. 登录页面：包含表单验证、密码加密传输
2. 注册功能：邮箱验证、密码强度检测
3. 权限控制：基于 JWT 的鉴权机制
4. 路由守卫：未登录用户自动跳转登录页`,
      attachments: [{"id": "att-60-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-60-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-61",
    studentId: "stu-3",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-19 16:45:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。",
      attachments: [{"id": "att-61-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-61-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-62",
    studentId: "stu-9",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-22 14:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-62-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-62-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-63",
    studentId: "stu-22",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-23 10:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "采用敏捷开发流程，完成了需求分析、技术选型、编码实现、测试验证、部署上线等完整流程。项目代码已通过 Code Review 并合并到主分支。",
      attachments: [{"id": "att-63-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-63-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-64",
    studentId: "stu-11",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-26 15:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: `我使用 React + TypeScript 完成了用户认证模块的开发。主要实现了以下功能：

1. 登录页面：包含表单验证、密码加密传输
2. 注册功能：邮箱验证、密码强度检测
3. 权限控制：基于 JWT 的鉴权机制
4. 路由守卫：未登录用户自动跳转登录页`,
      attachments: [{"id": "att-64-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-64-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-65",
    studentId: "stu-7",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-18 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。",
      attachments: [{"id": "att-65-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-65-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-66",
    studentId: "stu-20",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-3",
    taskName: "接口文档撰写",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-22 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我使用 Node.js + Express 搭建了后端服务，实现了完整的 RESTful API。包含用户认证、数据 CRUD、文件上传下载等功能模块。",
      attachments: [{"id": "att-66-1", "name": "项目代码.zip", "type": "code", "url": "#"}, {"id": "att-66-2", "name": "设计文档.md", "type": "document", "url": "#"}],
    },
    evalPointScores: [],
    totalScore: 65,
    gradedAt: "2026-04-22 10:00:00",
    gradedBy: "张老师",
  },
  // 成果评价模拟数据
  {
    id: "sub-67",
    studentId: "stu-1",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "成果评价",
    status: "pending",
    submittedAt: "2026-04-25 14:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我完成了前端性能优化方案的设计与实施，包括代码分割、懒加载、图片优化、缓存策略等。通过 Lighthouse 评分从 62 分提升至 92 分。",
      attachments: [{"id": "att-67-1", "name": "性能优化报告.pdf", "type": "document", "url": "#"}, {"id": "att-67-2", "name": "优化前后对比.png", "type": "image", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-68",
    studentId: "stu-2",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "成果评价",
    status: "graded",
    submittedAt: "2026-04-24 10:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "完成了 Webpack 构建优化、组件懒加载、图片资源压缩、CDN 加速配置等工程化实践，首屏加载时间减少了 60%。",
      attachments: [{"id": "att-68-1", "name": "工程化实践文档.pdf", "type": "document", "url": "#"}],
    },
    evalPointScores: [
      { evalPointId: "ep-oc-s1-1", evalPointName: "优化方案完整性", weight: 30, maxScore: 30, score: 26, comment: "方案较为完整，覆盖了主要优化手段" },
      { evalPointId: "ep-oc-s1-2", evalPointName: "实施效果可量化", weight: 30, maxScore: 30, score: 28, comment: "数据对比清晰，效果显著" },
      { evalPointId: "ep-oc-s1-3", evalPointName: "文档规范性", weight: 20, maxScore: 20, score: 18, comment: "文档结构清晰，但部分细节可补充" },
      { evalPointId: "ep-oc-s1-4", evalPointName: "创新性", weight: 20, maxScore: 20, score: 16, comment: "使用了常规优化手段，缺少创新性方案" },
    ],
    totalScore: 88,
    gradedAt: "2026-04-24 11:00:00",
    gradedBy: "张老师",
  },
  // 作业模拟数据
  {
    id: "sub-69",
    studentId: "stu-3",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "作业",
    status: "pending",
    submittedAt: "2026-04-26 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "完成了 React 组件的单元测试编写，使用 Jest + React Testing Library 实现了核心组件的测试覆盖率达到 85% 以上。",
      attachments: [{"id": "att-69-1", "name": "单元测试作业.zip", "type": "code", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-70",
    studentId: "stu-4",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "作业",
    status: "graded",
    submittedAt: "2026-04-25 16:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "编写了完整的单元测试用例，包含正向测试、边界测试和异常测试，测试报告已生成。",
      attachments: [{"id": "att-70-1", "name": "测试作业提交.docx", "type": "document", "url": "#"}],
    },
    evalPointScores: [
      { evalPointId: "ep-hw-s1-1", evalPointName: "测试用例完整性", weight: 40, maxScore: 40, score: 35, comment: "覆盖了主要场景，缺少部分边界条件" },
      { evalPointId: "ep-hw-s1-2", evalPointName: "代码规范", weight: 30, maxScore: 30, score: 28, comment: "代码规范良好" },
      { evalPointId: "ep-hw-s1-3", evalPointName: "测试报告质量", weight: 30, maxScore: 30, score: 26, comment: "报告内容完整，但分析深度可加强" },
    ],
    totalScore: 89,
    gradedAt: "2026-04-25 17:00:00",
    gradedBy: "张老师",
  },
  // 随堂测模拟数据
  {
    id: "sub-71",
    studentId: "stu-5",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "随堂测",
    status: "pending",
    submittedAt: "2026-04-27 10:00:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "qz-1", questionName: "ECharts 基础", questionType: "single", questionContent: "ECharts 中，以下哪个配置项用于设置图表标题？", options: ["title", "legend", "tooltip", "series"], correctAnswer: "title", studentAnswer: "title", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-2", questionName: "数据可视化类型", questionType: "multiple", questionContent: "以下哪些图表类型适合展示趋势变化？", options: ["折线图", "饼图", "柱状图", "散点图"], correctAnswer: ["折线图", "柱状图"], studentAnswer: ["折线图", "柱状图"], score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-3", questionName: "React 状态管理", questionType: "judgment", questionContent: "useState 的更新是异步的，多次调用会被合并。", correctAnswer: "true", studentAnswer: "true", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-4", questionName: "CSS 选择器", questionType: "single", questionContent: "以下哪个 CSS 选择器优先级最高？", options: [".class", "#id", "div", "[attr]"], correctAnswer: "#id", studentAnswer: "#id", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-5", questionName: "Promise 链式调用", questionType: "judgment", questionContent: "Promise.catch() 可以捕获链式调用中任意位置的异常。", correctAnswer: "true", studentAnswer: "false", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "qz-6", questionName: "TypeScript 接口", questionType: "multiple", questionContent: "TypeScript 中 interface 可以描述哪些类型？", options: ["对象形状", "函数签名", "类实现", "枚举"], correctAnswer: ["对象形状", "函数签名", "类实现"], studentAnswer: ["对象形状", "函数签名", "类实现"], score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-7", questionName: "Git 分支策略", questionType: "single", questionContent: "Git Flow 中，用于发布生产的分支是？", options: ["master/main", "develop", "feature", "hotfix"], correctAnswer: "master/main", studentAnswer: "master/main", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-8", questionName: "前端安全", questionType: "judgment", questionContent: "Content Security Policy (CSP) 可以有效防止 XSS 攻击。", correctAnswer: "true", studentAnswer: "true", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-9", questionName: "HTTP 缓存", questionType: "single", questionContent: "以下哪个 HTTP 头用于控制强缓存？", options: ["Cache-Control", "ETag", "Last-Modified", "Vary"], correctAnswer: "Cache-Control", studentAnswer: "Cache-Control", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-10", questionName: "模块化规范", questionType: "judgment", questionContent: "ES Module 的 import 语句可以出现在代码块内部。", correctAnswer: "false", studentAnswer: "false", score: 10, maxScore: 10, isCorrect: true },
    ],
    evalPointScores: [],
  },
  {
    id: "sub-72",
    studentId: "stu-6",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "随堂测",
    status: "graded",
    submittedAt: "2026-04-26 14:00:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "qz-1", questionName: "ECharts 基础", questionType: "single", questionContent: "ECharts 中，以下哪个配置项用于设置图表标题？", options: ["title", "legend", "tooltip", "series"], correctAnswer: "title", studentAnswer: "title", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-2", questionName: "数据可视化类型", questionType: "multiple", questionContent: "以下哪些图表类型适合展示趋势变化？", options: ["折线图", "饼图", "柱状图", "散点图"], correctAnswer: ["折线图", "柱状图"], studentAnswer: ["折线图", "饼图"], score: 5, maxScore: 10, isCorrect: false },
      { questionId: "qz-3", questionName: "React 状态管理", questionType: "judgment", questionContent: "useState 的更新是异步的，多次调用会被合并。", correctAnswer: "true", studentAnswer: "true", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-4", questionName: "CSS 选择器", questionType: "single", questionContent: "以下哪个 CSS 选择器优先级最高？", options: [".class", "#id", "div", "[attr]"], correctAnswer: "#id", studentAnswer: "#id", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-5", questionName: "Promise 链式调用", questionType: "judgment", questionContent: "Promise.catch() 可以捕获链式调用中任意位置的异常。", correctAnswer: "true", studentAnswer: "true", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-6", questionName: "TypeScript 接口", questionType: "multiple", questionContent: "TypeScript 中 interface 可以描述哪些类型？", options: ["对象形状", "函数签名", "类实现", "枚举"], correctAnswer: ["对象形状", "函数签名", "类实现"], studentAnswer: ["对象形状", "类实现"], score: 5, maxScore: 10, isCorrect: false },
      { questionId: "qz-7", questionName: "Git 分支策略", questionType: "single", questionContent: "Git Flow 中，用于发布生产的分支是？", options: ["master/main", "develop", "feature", "hotfix"], correctAnswer: "master/main", studentAnswer: "master/main", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-8", questionName: "前端安全", questionType: "judgment", questionContent: "Content Security Policy (CSP) 可以有效防止 XSS 攻击。", correctAnswer: "true", studentAnswer: "true", score: 10, maxScore: 10, isCorrect: true },
      { questionId: "qz-9", questionName: "HTTP 缓存", questionType: "single", questionContent: "以下哪个 HTTP 头用于控制强缓存？", options: ["Cache-Control", "ETag", "Last-Modified", "Vary"], correctAnswer: "Cache-Control", studentAnswer: "ETag", score: 0, maxScore: 10, isCorrect: false },
      { questionId: "qz-10", questionName: "模块化规范", questionType: "judgment", questionContent: "ES Module 的 import 语句可以出现在代码块内部。", correctAnswer: "false", studentAnswer: "false", score: 10, maxScore: 10, isCorrect: true },
    ],
    evalPointScores: [],
    totalScore: 80,
    gradedAt: "2026-04-26 15:00:00",
    gradedBy: "张老师",
  },
  // 题库模拟数据
  {
    id: "sub-73",
    studentId: "stu-7",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "题库",
    status: "pending",
    submittedAt: "2026-04-28 10:00:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "qb-1", questionName: "HTTP 方法语义", questionType: "single", questionContent: "RESTful 设计中，PUT 方法的主要语义是什么？", options: ["创建资源", "更新资源", "删除资源", "查询资源"], correctAnswer: "更新资源", studentAnswer: "更新资源", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-2", questionName: "状态码 401 含义", questionType: "judgment", questionContent: "HTTP 状态码 401 表示请求参数格式错误", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-3", questionName: "幂等性方法", questionType: "multiple", questionContent: "以下哪些 HTTP 方法具有幂等性？", options: ["GET", "POST", "PUT", "PATCH"], correctAnswer: ["GET", "PUT"], studentAnswer: ["GET", "PUT"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-4", questionName: "JWT 结构", questionType: "single", questionContent: "JWT (JSON Web Token) 由哪三部分组成？", options: ["Header.Payload.Signature", "Key.Value.Secret", "Auth.Token.Session", "ID.Data.Hash"], correctAnswer: "Header.Payload.Signature", studentAnswer: "Header.Payload.Signature", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-5", questionName: "SQL 注入", questionType: "judgment", questionContent: "使用参数化查询可以有效防止 SQL 注入攻击", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-6", questionName: "数据库事务", questionType: "multiple", questionContent: "数据库事务的 ACID 特性包括哪些？", options: ["原子性", "一致性", "隔离性", "持久性"], correctAnswer: ["原子性", "一致性", "隔离性", "持久性"], studentAnswer: ["原子性", "一致性", "隔离性"], score: 4, maxScore: 5, isCorrect: false },
      { questionId: "qb-7", questionName: "OAuth2 角色", questionType: "single", questionContent: "在 OAuth2.0 授权框架中，负责颁发访问令牌的是？", options: ["资源所有者", "客户端", "授权服务器", "资源服务器"], correctAnswer: "授权服务器", studentAnswer: "授权服务器", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-8", questionName: "索引优化", questionType: "judgment", questionContent: "数据库表中索引越多越好，不会影响写入性能", correctAnswer: "false", studentAnswer: "true", score: 0, maxScore: 5, isCorrect: false },
      { questionId: "qb-9", questionName: "API 版本控制", questionType: "multiple", questionContent: "常见的 RESTful API 版本控制策略有哪些？", options: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version", "Cookie 中存放版本"], correctAnswer: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version"], studentAnswer: ["URL 路径版本号", "查询参数 version"], score: 3, maxScore: 5, isCorrect: false },
      { questionId: "qb-10", questionName: "ORM 作用", questionType: "single", questionContent: "ORM (对象关系映射) 的主要作用是什么？", options: ["将对象映射到关系数据库", "优化网络传输", "缓存查询结果", "管理服务器负载"], correctAnswer: "将对象映射到关系数据库", studentAnswer: "将对象映射到关系数据库", score: 5, maxScore: 5, isCorrect: true },
    ],
    evalPointScores: [],
  },
  {
    id: "sub-74",
    studentId: "stu-8",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "题库",
    status: "graded",
    submittedAt: "2026-04-27 14:00:00",
    maxScore: 100,
    objectiveAnswers: [
      { questionId: "qb-1", questionName: "HTTP 方法语义", questionType: "single", questionContent: "RESTful 设计中，PUT 方法的主要语义是什么？", options: ["创建资源", "更新资源", "删除资源", "查询资源"], correctAnswer: "更新资源", studentAnswer: "更新资源", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-2", questionName: "状态码 401 含义", questionType: "judgment", questionContent: "HTTP 状态码 401 表示请求参数格式错误", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-3", questionName: "幂等性方法", questionType: "multiple", questionContent: "以下哪些 HTTP 方法具有幂等性？", options: ["GET", "POST", "PUT", "PATCH"], correctAnswer: ["GET", "PUT"], studentAnswer: ["GET", "PUT"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-4", questionName: "JWT 结构", questionType: "single", questionContent: "JWT (JSON Web Token) 由哪三部分组成？", options: ["Header.Payload.Signature", "Key.Value.Secret", "Auth.Token.Session", "ID.Data.Hash"], correctAnswer: "Header.Payload.Signature", studentAnswer: "Header.Payload.Signature", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-5", questionName: "SQL 注入", questionType: "judgment", questionContent: "使用参数化查询可以有效防止 SQL 注入攻击", correctAnswer: "true", studentAnswer: "true", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-6", questionName: "数据库事务", questionType: "multiple", questionContent: "数据库事务的 ACID 特性包括哪些？", options: ["原子性", "一致性", "隔离性", "持久性"], correctAnswer: ["原子性", "一致性", "隔离性", "持久性"], studentAnswer: ["原子性", "一致性", "隔离性", "持久性"], score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-7", questionName: "OAuth2 角色", questionType: "single", questionContent: "在 OAuth2.0 授权框架中，负责颁发访问令牌的是？", options: ["资源所有者", "客户端", "授权服务器", "资源服务器"], correctAnswer: "授权服务器", studentAnswer: "授权服务器", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-8", questionName: "索引优化", questionType: "judgment", questionContent: "数据库表中索引越多越好，不会影响写入性能", correctAnswer: "false", studentAnswer: "false", score: 5, maxScore: 5, isCorrect: true },
      { questionId: "qb-9", questionName: "API 版本控制", questionType: "multiple", questionContent: "常见的 RESTful API 版本控制策略有哪些？", options: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version", "Cookie 中存放版本"], correctAnswer: ["URL 路径版本号", "请求头 Accept 字段", "查询参数 version"], studentAnswer: ["URL 路径版本号", "请求头 Accept 字段"], score: 3, maxScore: 5, isCorrect: false },
      { questionId: "qb-10", questionName: "ORM 作用", questionType: "single", questionContent: "ORM (对象关系映射) 的主要作用是什么？", options: ["将对象映射到关系数据库", "优化网络传输", "缓存查询结果", "管理服务器负载"], correctAnswer: "将对象映射到关系数据库", studentAnswer: "将对象映射到关系数据库", score: 5, maxScore: 5, isCorrect: true },
    ],
    evalPointScores: [],
    totalScore: 48,
    gradedAt: "2026-04-27 15:00:00",
    gradedBy: "张老师",
  },
  // 现场评审模拟数据
  {
    id: "sub-75",
    studentId: "stu-9",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "pending",
    submittedAt: "2026-04-28 09:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "我完成了电商平台的系统架构设计，采用前后端分离架构。前端使用 React 18 + TypeScript + Vite，后端使用 Node.js + Express + MySQL。设计了用户、商品、订单、库存等核心表结构，并规划了完整的 RESTful API 接口。",
      attachments: [{"id": "att-75-1", "name": "架构设计文档.pdf", "type": "document", "url": "#"}, {"id": "att-75-2", "name": "数据库ER图.png", "type": "image", "url": "#"}],
    },
    evalPointScores: [],
  },
  {
    id: "sub-76",
    studentId: "stu-10",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "现场评审",
    currentReviewPhaseIndex: 1,
    status: "graded",
    submittedAt: "2026-04-27 10:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer: "本项目采用微前端架构，将大型应用拆分为多个独立部署的子应用。每个子应用使用独立的代码仓库和技术栈，通过 qiankun 框架进行集成。数据库采用分库分表策略，支持高并发场景。",
      attachments: [{"id": "att-76-1", "name": "设计文档.md", "type": "document", "url": "#"}, {"id": "att-76-2", "name": "项目源码.zip", "type": "code", "url": "#"}],
    },
    evalPointScores: [
      { evalPointId: "ep-r1-1", evalPointName: "文档规范性", weight: 25, maxScore: 25, score: 22, comment: "文档结构清晰，内容较完整" },
      { evalPointId: "ep-r1-2", evalPointName: "设计合理性", weight: 30, maxScore: 30, score: 27, comment: "架构设计合理，考虑了扩展性" },
      { evalPointId: "ep-r1-3", evalPointName: "数据库设计质量", weight: 25, maxScore: 25, score: 23, comment: "ER图规范，表结构设计合理" },
      { evalPointId: "ep-r1-4", evalPointName: "接口设计规范", weight: 20, maxScore: 20, score: 18, comment: "接口规划符合RESTful规范" },
    ],
    totalScore: 90,
    gradedAt: "2026-04-27 11:00:00",
    gradedBy: "张老师",
  },
  // ============================================================================
  // 作业类型演示数据
  // ============================================================================
  // 作业 - 有评价标准（scenario-1 / task-1-1 配置了 homework 评价点）
  {
    id: "sub-69a",
    studentId: "stu-3",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-1",
    taskName: "项目初始化与架构搭建",
    assessmentForm: "作业",
    status: "pending",
    submittedAt: "2026-04-28 10:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "本次作业完成了项目测试用例设计与测试报告撰写。\n\n1. 测试用例设计：\n   - 编写了 25 条测试用例，覆盖正常流程 12 条、边界条件 8 条、异常场景 5 条\n   - 使用等价类划分和边界值分析法设计用例\n   - 包含功能测试、兼容性测试、性能测试三类\n\n2. 测试执行：\n   - 在 Chrome、Firefox、Safari 三个浏览器执行兼容性测试\n   - 使用 Lighthouse 进行性能基准测试\n   - 所有用例执行通过率 92%\n\n3. 测试报告：\n   - 包含测试概述、测试范围、用例清单、执行结果、缺陷统计、改进建议六个章节\n   - 发现 3 个缺陷，均已记录并分类（1 个严重、2 个一般）",
      attachments: [
        { id: "att-69a-1", name: "测试用例设计表.xlsx", type: "document", url: "#" },
        { id: "att-69a-2", name: "测试报告.pdf", type: "document", url: "#" },
        { id: "att-69a-3", name: "缺陷跟踪表.md", type: "document", url: "#" },
      ],
    },
    evalPointScores: [],
  },
  // 作业 - 有评价标准（scenario-1 / task-1-2 配置了 homework 评价点）
  {
    id: "sub-69b",
    studentId: "stu-5",
    scenarioId: "scenario-1",
    scenarioName: "企业级前端项目开发实战",
    taskId: "task-1-2",
    taskName: "用户认证模块开发",
    assessmentForm: "作业",
    status: "pending",
    submittedAt: "2026-04-28 14:30:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "本次作业完成了用户认证模块的前端开发，包含以下功能：\n\n1. 登录功能：\n   - 邮箱/密码登录表单，包含前端校验（邮箱格式、密码长度）\n   - 集成 reCAPTCHA 防止暴力破解\n   - 登录成功后存储 JWT Token 到 httpOnly Cookie\n   - 错误提示：邮箱不存在、密码错误、账号锁定\n\n2. 注册功能：\n   - 分步注册流程：填写信息 → 邮箱验证 → 设置密码\n   - 密码强度实时检测，要求包含大小写字母、数字、特殊字符\n   - 邮箱验证码 5 分钟有效期\n\n3. 权限控制：\n   - 基于角色的权限控制（RBAC）\n   - 路由守卫：未登录跳转登录页，无权限跳转 403 页面\n   - 动态菜单渲染根据用户角色\n\n4. 安全考虑：\n   - 密码使用 bcrypt 加密存储\n   - XSS 防护：对用户输入进行转义\n   - CSRF 防护：使用双重 Cookie 验证",
      attachments: [
        { id: "att-69b-1", name: "auth-module.zip", type: "code", url: "#" },
        { id: "att-69b-2", name: "功能演示视频.mp4", type: "video", url: "#" },
      ],
    },
    evalPointScores: [],
  },
  // 作业 - 无评价标准（scenario-2 / task-2-1 未配置 homework 评价点）
  {
    id: "sub-69c",
    studentId: "stu-4",
    scenarioId: "scenario-2",
    scenarioName: "RESTful API 设计与开发",
    taskId: "task-2-1",
    taskName: "API 设计规范学习",
    assessmentForm: "作业",
    status: "pending",
    submittedAt: "2026-04-28 16:00:00",
    maxScore: 100,
    subjectiveContent: {
      textAnswer:
        "本次作业是阅读并总结 RESTful API 设计规范，完成以下任务：\n\n1. 阅读材料：\n   - 《RESTful Web APIs》第 1-3 章\n   - 公司内部 API 设计规范文档\n   - Google API Design Guide 中文版\n\n2. 学习笔记总结：\n   - REST 架构风格的六个约束：客户端-服务器、无状态、可缓存、分层系统、统一接口、按需代码\n   - URI 设计原则：使用名词复数、小写字母、中划线分隔，避免动词\n   - HTTP 方法语义：GET 幂等安全、POST 创建、PUT 全量更新、PATCH 部分更新、DELETE 删除\n   - 状态码使用规范：2xx 成功、3xx 重定向、4xx 客户端错误、5xx 服务器错误\n   - 版本控制策略：URL 路径版本号（推荐）、请求头 Accept 字段\n\n3. 案例分析：\n   - 分析了 GitHub API v3 的设计优点\n   - 指出了某旧项目 API 设计中的 5 处不规范问题",
      attachments: [
        { id: "att-69c-1", name: "RESTful学习笔记.md", type: "document", url: "#" },
        { id: "att-69c-2", name: "API设计案例分析.pdf", type: "document", url: "#" },
      ],
    },
    evalPointScores: [],
  },
]

// 测评形式配置（用于评分页面展示）
export const assessmentFormConfig: Record<
  string,
  { label: string; category: string; icon: string; description: string }
> = {
  paper: { label: "试卷", category: "基础考核", icon: "fileText", description: "使用固定试卷进行考核" },
  question_bank: { label: "题库", category: "基础考核", icon: "database", description: "从题库选题组成测评资源" },
  quiz: { label: "随堂测", category: "基础考核", icon: "clipboardList", description: "课堂即时测验" },
  ai_qa: { label: "AI 问答", category: "智能评测", icon: "bot", description: "AI 智能问答评测" },
  random_draw: { label: "现场问答", category: "综合评估", icon: "mic", description: "从题库抽取题目，教师现场提问" },
  review: { label: "评审", category: "综合评估", icon: "clipboardCheck", description: "教师根据表现/材料给评价点打分" },
  outcome: { label: "成果评价", category: "综合评估", icon: "trophy", description: "对学习成果进行综合评价" },
  peer: { label: "学生互评", category: "综合评估", icon: "users", description: "学生之间相互评价" },
  defense: { label: "答辩", category: "互动评价", icon: "presentation", description: "学生答辩，教师评分" },
  debate: { label: "辩论", category: "互动评价", icon: "messageSquare", description: "学生辩论表现评价" },
  presentation: { label: "汇报", category: "互动评价", icon: "presentation", description: "学生汇报展示评价" },
  practical: { label: "现场实操", category: "互动评价", icon: "wrench", description: "现场实际操作考核" },
  roleplay: { label: "角色扮演", category: "互动评价", icon: "userCog", description: "角色扮演情境考核" },
}
