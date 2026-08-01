package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Queryer 是数据访问的最小查询接口，*pgxpool.Pool 与 pgx.Tx 均满足。
// 领域 store 方法以 Queryer 为参数，天然支持事务内组合。
type Queryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Store 是数据访问层统一入口：持有查询器，提供事务模板。
// 各领域 store 类型（AllianceStore、RolesStore 等）延续独立类型模式；
// service 层通过 NewWithTx 获得基于同一事务的 Store，保证跨 store 原子性。
type Store struct {
	q              Queryer
	resourceLib    *ResourceLibraryStore
	tenants        *TenantStore
	tenantAdmins   *TenantAdminStore
	organizations  *OrganizationStore
	userExtFields  *UserExtensionFieldStore
	userRelations  *UserRelationStore
	users          *UserStore
	scenarioWeight *ScenarioWeightStore
	scenarioGrade  *ScenarioGradeStore
	taskBindings   *TaskKnowledgeAbilityStore
	knowledgePoint *KnowledgePointStore
	nodeHomework   *NodeHomeworkStore
	resourceBind   *ResourceBindingStore
	positionAbility *PositionAbilityStore
	positionResp    *PositionResponsibilityStore
	positionCert    *PositionCertificateStore
	positionClone   *PositionCloneStore
	scenarios       *ScenarioStore
	scenarioClone   *ScenarioCloneStore
	scenarioTasks   *ScenarioTaskStore
	nodeQuizzes     *NodeQuizStore
	courseClone     *CourseCloneStore
	courseNodes     *CourseNodeStore
	taskEval        *TaskEvaluationStore
	positions       *PositionStore
	courses         *CourseStore
	courseHomeworks *CourseHomeworkStore
	courseAssess    *CourseAssessmentStore
	questionBanks   *QuestionBankStore
	questions       *QuestionStore
	exams           *ExamStore
	examResults     *ExamResultStore
	examUsages      *ExamUsageStore
	randomDrawQ     *RandomDrawQuestionStore
	certGrades      *CertGradeStore
	scheduling      *SchedulingStore
	certifications  *CertificationStore
	evalMethods     *EvaluationMethodStore
	appeals         *AppealStore
	evalResults     *EvaluationResultStore
	studentPortrait *StudentPortraitStore
	jobAbilityRes   *JobAbilityResultStore
	graduations     *GraduationStore
}

// New 创建统一 store 入口（连接池模式）。
func New(db *pgxpool.Pool) *Store {
	return &Store{
		q:             db,
		resourceLib:   NewResourceLibraryStore(db),
		tenants:       NewTenantStore(db),
		tenantAdmins:  NewTenantAdminStore(db),
		organizations: NewOrganizationStore(db),
		userExtFields: NewUserExtensionFieldStore(db),
		userRelations: NewUserRelationStore(db),
		users:         NewUserStore(db),
		scenarioWeight: NewScenarioWeightStore(db),
		scenarioGrade:  NewScenarioGradeStore(db),
		taskBindings:   NewTaskKnowledgeAbilityStore(db),
		knowledgePoint: NewKnowledgePointStore(db),
		nodeHomework:   NewNodeHomeworkStore(db),
		resourceBind:   NewResourceBindingStore(db),
		positionAbility: NewPositionAbilityStore(db),
		positionResp:    NewPositionResponsibilityStore(db),
		positionCert:    NewPositionCertificateStore(db),
		positionClone:   NewPositionCloneStore(db),
		scenarios:       NewScenarioStore(db),
		scenarioClone:   NewScenarioCloneStore(db),
		scenarioTasks:   NewScenarioTaskStore(db),
		nodeQuizzes:     NewNodeQuizStore(db),
		courseClone:     NewCourseCloneStore(db),
		courseNodes:     NewCourseNodeStore(db),
		taskEval:        NewTaskEvaluationStore(db),
		positions:       NewPositionStore(db),
		courses:         NewCourseStore(db),
		courseHomeworks: NewCourseHomeworkStore(db),
		courseAssess:    NewCourseAssessmentStore(db),
		questionBanks:   NewQuestionBankStore(db),
		questions:       NewQuestionStore(db),
		exams:           NewExamStore(db),
		examResults:     NewExamResultStore(db),
		examUsages:      NewExamUsageStore(db),
		randomDrawQ:     NewRandomDrawQuestionStore(db),
		certGrades:      NewCertGradeStore(db),
		scheduling:      NewSchedulingStore(db),
		certifications:  NewCertificationStore(db),
		evalMethods:     NewEvaluationMethodStore(db),
		appeals:         NewAppealStore(db),
		evalResults:     NewEvaluationResultStore(db),
		studentPortrait: NewStudentPortraitStore(db),
		jobAbilityRes:   NewJobAbilityResultStore(db),
		graduations:     NewGraduationStore(db),
	}
}

// NewWithTx 创建基于既有事务的 store 入口（pgx.Tx 满足 Queryer）。
func NewWithTx(tx pgx.Tx) *Store {
	return &Store{
		q:             tx,
		resourceLib:   NewResourceLibraryStore(tx),
		tenants:       NewTenantStore(tx),
		tenantAdmins:  NewTenantAdminStore(tx),
		organizations: NewOrganizationStore(tx),
		userExtFields: NewUserExtensionFieldStore(tx),
		userRelations: NewUserRelationStore(tx),
		users:         NewUserStore(tx),
		scenarioWeight: NewScenarioWeightStore(tx),
		scenarioGrade:  NewScenarioGradeStore(tx),
		taskBindings:   NewTaskKnowledgeAbilityStore(tx),
		knowledgePoint: NewKnowledgePointStore(tx),
		nodeHomework:   NewNodeHomeworkStore(tx),
		resourceBind:   NewResourceBindingStore(tx),
		positionAbility: NewPositionAbilityStore(tx),
		positionResp:    NewPositionResponsibilityStore(tx),
		positionCert:    NewPositionCertificateStore(tx),
		positionClone:   NewPositionCloneStore(tx),
		scenarios:       NewScenarioStore(tx),
		scenarioClone:   NewScenarioCloneStore(tx),
		scenarioTasks:   NewScenarioTaskStore(tx),
		nodeQuizzes:     NewNodeQuizStore(tx),
		courseClone:     NewCourseCloneStore(tx),
		courseNodes:     NewCourseNodeStore(tx),
		taskEval:        NewTaskEvaluationStore(tx),
		positions:       NewPositionStore(tx),
		courses:         NewCourseStore(tx),
		courseHomeworks: NewCourseHomeworkStore(tx),
		courseAssess:    NewCourseAssessmentStore(tx),
		questionBanks:   NewQuestionBankStore(tx),
		questions:       NewQuestionStore(tx),
		exams:           NewExamStore(tx),
		examResults:     NewExamResultStore(tx),
		examUsages:      NewExamUsageStore(tx),
		randomDrawQ:     NewRandomDrawQuestionStore(tx),
		certGrades:      NewCertGradeStore(tx),
		scheduling:      NewSchedulingStore(tx),
		certifications:  NewCertificationStore(tx),
		evalMethods:     NewEvaluationMethodStore(tx),
		appeals:         NewAppealStore(tx),
		evalResults:     NewEvaluationResultStore(tx),
		studentPortrait: NewStudentPortraitStore(tx),
		jobAbilityRes:   NewJobAbilityResultStore(tx),
		graduations:     NewGraduationStore(tx),
	}
}

// Q 暴露查询器，供各领域 store 方法执行 SQL。
func (s *Store) Q() Queryer {
	return s.q
}

// ResourceLibrary 返回资源库 store。
func (s *Store) ResourceLibrary() *ResourceLibraryStore {
	return s.resourceLib
}

// Tenants 返回租户 store。
func (s *Store) Tenants() *TenantStore {
	return s.tenants
}

// TenantAdmins 返回学校管理员 store。
func (s *Store) TenantAdmins() *TenantAdminStore {
	return s.tenantAdmins
}

// Organizations 返回组织 store。
func (s *Store) Organizations() *OrganizationStore {
	return s.organizations
}

// UserExtensionFields 返回扩展字段 store。
func (s *Store) UserExtensionFields() *UserExtensionFieldStore {
	return s.userExtFields
}

// UserRelations 返回用户关系 store。
func (s *Store) UserRelations() *UserRelationStore {
	return s.userRelations
}

// Users 返回用户 store。
func (s *Store) Users() *UserStore {
	return s.users
}

// ScenarioWeights 返回场景权重 store。
func (s *Store) ScenarioWeights() *ScenarioWeightStore {
	return s.scenarioWeight
}

// ScenarioGrades 返回场景等级映射 store。
func (s *Store) ScenarioGrades() *ScenarioGradeStore {
	return s.scenarioGrade
}

// TaskBindings 返回任务知识/能力绑定 store。
func (s *Store) TaskBindings() *TaskKnowledgeAbilityStore {
	return s.taskBindings
}

// KnowledgePoints 返回知识点 store。
func (s *Store) KnowledgePoints() *KnowledgePointStore {
	return s.knowledgePoint
}

// NodeHomeworks 返回节点作业 store。
func (s *Store) NodeHomeworks() *NodeHomeworkStore {
	return s.nodeHomework
}

// ResourceBindings 返回资源绑定 store。
func (s *Store) ResourceBindings() *ResourceBindingStore {
	return s.resourceBind
}

// PositionAbilities 返回岗位能力绑定 store。
func (s *Store) PositionAbilities() *PositionAbilityStore {
	return s.positionAbility
}

// PositionResponsibilities 返回岗位职责 store。
func (s *Store) PositionResponsibilities() *PositionResponsibilityStore {
	return s.positionResp
}

// PositionCertificates 返回岗位证书 store。
func (s *Store) PositionCertificates() *PositionCertificateStore {
	return s.positionCert
}

// PositionClone 返回岗位克隆 store。
func (s *Store) PositionClone() *PositionCloneStore {
	return s.positionClone
}

// Scenarios 返回场景 store。
func (s *Store) Scenarios() *ScenarioStore {
	return s.scenarios
}

// ScenarioClone 返回场景克隆 store。
func (s *Store) ScenarioClone() *ScenarioCloneStore {
	return s.scenarioClone
}

// ScenarioTasks 返回场景任务 store。
func (s *Store) ScenarioTasks() *ScenarioTaskStore {
	return s.scenarioTasks
}

// NodeQuizzes 返回节点测验 store。
func (s *Store) NodeQuizzes() *NodeQuizStore {
	return s.nodeQuizzes
}

// CourseClone 返回课程克隆 store。
func (s *Store) CourseClone() *CourseCloneStore {
	return s.courseClone
}

// CourseNodes 返回课程节点 store。
func (s *Store) CourseNodes() *CourseNodeStore {
	return s.courseNodes
}

// TaskEval 返回任务测评 store。
func (s *Store) TaskEval() *TaskEvaluationStore {
	return s.taskEval
}

// Positions 返回岗位 store。
func (s *Store) Positions() *PositionStore {
	return s.positions
}

// Courses 返回课程 store。
func (s *Store) Courses() *CourseStore {
	return s.courses
}

// CourseHomeworks 返回作业 store。
func (s *Store) CourseHomeworks() *CourseHomeworkStore {
	return s.courseHomeworks
}

// CourseAssessments 返回评估生成 store。
func (s *Store) CourseAssessments() *CourseAssessmentStore {
	return s.courseAssess
}

// QuestionBanks 返回题库 store。
func (s *Store) QuestionBanks() *QuestionBankStore {
	return s.questionBanks
}

// Questions 返回题目 store。
func (s *Store) Questions() *QuestionStore {
	return s.questions
}

// Exams 返回试卷 store。
func (s *Store) Exams() *ExamStore {
	return s.exams
}

// ExamResults 返回考试结果 store。
func (s *Store) ExamResults() *ExamResultStore {
	return s.examResults
}

// ExamUsages 返回考试安排 store。
func (s *Store) ExamUsages() *ExamUsageStore {
	return s.examUsages
}

// RandomDrawQuestions 返回随机抽题 store。
func (s *Store) RandomDrawQuestions() *RandomDrawQuestionStore {
	return s.randomDrawQ
}

// CertGrades 返回岗位认证等级 store。
func (s *Store) CertGrades() *CertGradeStore {
	return s.certGrades
}

// Scheduling 返回排课 store。
func (s *Store) Scheduling() *SchedulingStore {
	return s.scheduling
}

// Certifications 返回认证 store。
func (s *Store) Certifications() *CertificationStore {
	return s.certifications
}

// EvaluationMethods 返回评价方法 store。
func (s *Store) EvaluationMethods() *EvaluationMethodStore {
	return s.evalMethods
}

// Appeals 返回申诉 store。
func (s *Store) Appeals() *AppealStore {
	return s.appeals
}

// EvaluationResults 返回评价结果 store。
func (s *Store) EvaluationResults() *EvaluationResultStore {
	return s.evalResults
}

// StudentPortraits 返回学生画像 store。
func (s *Store) StudentPortraits() *StudentPortraitStore {
	return s.studentPortrait
}

// JobAbilityResults 返回岗位能力结果 store。
func (s *Store) JobAbilityResults() *JobAbilityResultStore {
	return s.jobAbilityRes
}

// Graduations 返回毕业设计 store。
func (s *Store) Graduations() *GraduationStore {
	return s.graduations
}

// Begin 开启事务，供 service 层 WithTx 使用。
func (s *Store) Begin(ctx context.Context) (pgx.Tx, error) {
	pool, ok := s.q.(*pgxpool.Pool)
	if !ok {
		return nil, pgx.ErrTxClosed
	}
	return pool.Begin(ctx)
}
