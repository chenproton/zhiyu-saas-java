package store

import (
	"context"
	"errors"
	"fmt"

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

// ErrNestedTransaction 表示在事务上下文（pgx.Tx）上再次尝试开启事务。
// 事务内组合应使用 NewWithTx，而非对同一 Store 再次 Begin。
var ErrNestedTransaction = errors.New("store: cannot begin a transaction inside another transaction")

// Store 是数据访问层统一入口：持有查询器，提供事务模板。
// 各领域 store 类型（AllianceStore、RolesStore 等）延续独立类型模式；
// service 层通过 NewWithTx 获得基于同一事务的 Store，保证跨 store 原子性。
type Store struct {
	q                Queryer
	resourceLib      *ResourceLibraryStore
	tenants          *TenantStore
	tenantAdmins     *TenantAdminStore
	organizations    *OrganizationStore
	userExtFields    *UserExtensionFieldStore
	userRelations    *UserRelationStore
	users            *UserStore
	scenarioWeight   *ScenarioWeightStore
	scenarioGrade    *ScenarioGradeStore
	taskBindings     *TaskKnowledgeAbilityStore
	knowledgePoint   *KnowledgePointStore
	nodeHomework     *NodeHomeworkStore
	resourceBind     *ResourceBindingStore
	positionAbility  *PositionAbilityStore
	positionResp     *PositionResponsibilityStore
	positionCert     *PositionCertificateStore
	positionClone    *PositionCloneStore
	scenarios        *ScenarioStore
	scenarioClone    *ScenarioCloneStore
	scenarioTasks    *ScenarioTaskStore
	nodeQuizzes      *NodeQuizStore
	courseClone      *CourseCloneStore
	courseNodes      *CourseNodeStore
	taskEval         *TaskEvaluationStore
	positions        *PositionStore
	courses          *CourseStore
	courseHomeworks  *CourseHomeworkStore
	courseAssess     *CourseAssessmentStore
	questionBanks    *QuestionBankStore
	questions        *QuestionStore
	exams            *ExamStore
	examResults      *ExamResultStore
	examUsages       *ExamUsageStore
	randomDrawQ      *RandomDrawQuestionStore
	certGrades       *CertGradeStore
	scheduling       *SchedulingStore
	certifications   *CertificationStore
	evalMethods      *EvaluationMethodStore
	appeals          *AppealStore
	evalResults      *EvaluationResultStore
	nodeEvalResults  *NodeEvaluationResultStore
	studentPortrait  *StudentPortraitStore
	studentHonors    *StudentHonorStore
	jobAbilityRes    *JobAbilityResultStore
	graduations      *GraduationStore
	abilities        *AbilityStore
	abilityDomains   *AbilityDomainStore
	banners          *BannerStore
	terms            *TermStore
	batches          *BatchStore
	workflows        *WorkflowStore
	subscriptions    *SubscriptionStore
	resourceCodes    *ResourceCodeStore
	recommends       *RecommendStore
	hybridModules    *HybridModuleStore
	lessonBehaviors  *LessonBehaviorStore
	landing          *LandingStore
	approvals        *ApprovalStore
	teachingPlans    *TeachingPlanStore
	portal           *PortalStore
	auth             *AuthStore
	trainingPrograms *TrainingProgramStore
	contentActions   *ContentActionStore
	orgTypes         *OrgTypesStore
	roles            *RolesStore
	majors           *MajorsStore
	industries       *IndustriesStore
	staffTitles      *StaffTitlesStore
	learnRoads       *LearnRoadsStore
	certLib          *CertificateLibraryStore
	microCerts       *MicroCertStore
	onSiteQuestions  *OnSiteQuestionLibraryStore
	alliance         *AllianceStore
	allianceLinks    *AllianceEnterpriseLinkStore
	partner          *PartnerStore
	community        *CommunityStore
	favorites        *FavoritesStore
	platformSettings *PlatformSettingsStore
	tags             *TagStore
}

// newStore 装配全部领域 store（连接池模式与事务模式共用，仅查询器不同）。
func newStore(q Queryer) *Store {
	// 仅连接池提供独立事务启动能力；事务模式（pgx.Tx）下保持 nil，
	// 与历史 NewWithTx 行为一致（事务内组合不再次开启事务）。
	var beginner txBeginner
	if pool, ok := q.(*pgxpool.Pool); ok {
		beginner = pool
	} else if conn, ok := q.(*pgxpool.Conn); ok {
		// 单连接模式（如调度任务专用连接）同样支持事务
		beginner = conn
	}
	return &Store{
		q:                q,
		resourceLib:      NewResourceLibraryStore(q, beginner),
		tenants:          NewTenantStore(q),
		tenantAdmins:     NewTenantAdminStore(q),
		organizations:    NewOrganizationStore(q),
		userExtFields:    NewUserExtensionFieldStore(q),
		userRelations:    NewUserRelationStore(q),
		users:            NewUserStore(q, beginner),
		scenarioWeight:   NewScenarioWeightStore(q),
		scenarioGrade:    NewScenarioGradeStore(q),
		taskBindings:     NewTaskKnowledgeAbilityStore(q),
		knowledgePoint:   NewKnowledgePointStore(q),
		nodeHomework:     NewNodeHomeworkStore(q),
		resourceBind:     NewResourceBindingStore(q, beginner),
		positionAbility:  NewPositionAbilityStore(q),
		positionResp:     NewPositionResponsibilityStore(q),
		positionCert:     NewPositionCertificateStore(q),
		positionClone:    NewPositionCloneStore(q),
		scenarios:        NewScenarioStore(q, beginner),
		scenarioClone:    NewScenarioCloneStore(q),
		scenarioTasks:    NewScenarioTaskStore(q),
		nodeQuizzes:      NewNodeQuizStore(q),
		courseClone:      NewCourseCloneStore(q),
		courseNodes:      NewCourseNodeStore(q),
		taskEval:         NewTaskEvaluationStore(q),
		positions:        NewPositionStore(q, beginner),
		courses:          NewCourseStore(q, beginner),
		courseHomeworks:  NewCourseHomeworkStore(q, beginner),
		courseAssess:     NewCourseAssessmentStore(q),
		questionBanks:    NewQuestionBankStore(q),
		questions:        NewQuestionStore(q),
		exams:            NewExamStore(q),
		examResults:      NewExamResultStore(q),
		examUsages:       NewExamUsageStore(q),
		randomDrawQ:      NewRandomDrawQuestionStore(q, beginner),
		certGrades:       NewCertGradeStore(q),
		scheduling:       NewSchedulingStore(q),
		certifications:   NewCertificationStore(q, beginner),
		evalMethods:      NewEvaluationMethodStore(q),
		appeals:          NewAppealStore(q),
		evalResults:      NewEvaluationResultStore(q),
		nodeEvalResults:  NewNodeEvaluationResultStore(q),
		studentPortrait:  NewStudentPortraitStore(q),
		studentHonors:    NewStudentHonorStore(q),
		jobAbilityRes:    NewJobAbilityResultStore(q),
		graduations:      NewGraduationStore(q, beginner),
		abilities:        NewAbilityStore(q),
		abilityDomains:   NewAbilityDomainStore(q),
		banners:          NewBannerStore(q),
		terms:            NewTermStore(q),
		batches:          NewBatchStore(q),
		workflows:        NewWorkflowStore(q),
		subscriptions:    NewSubscriptionStore(q),
		resourceCodes:    NewResourceCodeStore(q),
		recommends:       NewRecommendStore(q),
		hybridModules:    NewHybridModuleStore(q),
		lessonBehaviors:  NewLessonBehaviorStore(q),
		landing:          NewLandingStore(q),
		approvals:        NewApprovalStore(q),
		teachingPlans:    NewTeachingPlanStore(q, beginner),
		portal:           NewPortalStore(q),
		auth:             NewAuthStore(q),
		trainingPrograms: NewTrainingProgramStore(q),
		contentActions:   NewContentActionStore(q, beginner),
		orgTypes:         NewOrgTypesStore(q),
		roles:            NewRolesStore(q, beginner),
		majors:           NewMajorsStore(q),
		industries:       NewIndustriesStore(q),
		staffTitles:      NewStaffTitlesStore(q),
		learnRoads:       NewLearnRoadsStore(q),
		certLib:          NewCertificateLibraryStore(q),
		microCerts:       NewMicroCertStore(q, beginner),
		onSiteQuestions:  NewOnSiteQuestionLibraryStore(q),
		alliance:         NewAllianceStore(q),
		allianceLinks:    NewAllianceEnterpriseLinkStore(q),
		partner:          NewPartnerStore(q),
		community:        NewCommunityStore(q),
		favorites:        NewFavoritesStore(q, beginner),
		platformSettings: NewPlatformSettingsStore(q),
		tags:             NewTagStore(q, beginner),
	}
}

// New 创建统一 store 入口（连接池模式）。
func New(db *pgxpool.Pool) *Store {
	return newStore(db)
}

// NewConn 创建基于单条连接（会话级设置如 statement_timeout 生效）的 store 入口。
func NewConn(conn *pgxpool.Conn) *Store {
	return newStore(conn)
}

// NewWithTx 创建基于既有事务的 store 入口（pgx.Tx 满足 Queryer）。
func NewWithTx(tx pgx.Tx) *Store {
	return newStore(tx)
}

// Q 暴露查询器，供各领域 store 方法执行 SQL。
func (s *Store) Q() Queryer {
	return s.q
}

// WithTx 开启事务，并在同一事务的 Store 上执行 fn（唯一事务模板）。
// fn 返回 error 时自动回滚；所有跨 store 的组合操作必须经由 WithTx。
// *Store.Begin 自带嵌套事务防护（事务模式下返回 ErrNestedTransaction）。
func (s *Store) WithTx(ctx context.Context, fn func(txStore *Store) error) error {
	return withTxStore(ctx, s, func(tx pgx.Tx) error {
		return fn(NewWithTx(tx))
	})
}

// withTxStore 在 beginner 上开启事务，统一 Begin/Rollback/Commit 模板。
// 供单个领域 store 内部多语句组合使用（如 RolesStore.Delete）；
// service 层跨 store 组合请使用 Store.WithTx。
func withTxStore(ctx context.Context, beginner txBeginner, fn func(tx pgx.Tx) error) error {
	tx, err := beginner.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Begin 开启事务，供 WithTx 使用。
// 在事务上下文（pgx.Tx）上调用会返回 ErrNestedTransaction，
// 事务内应直接使用传入的 txStore，而非再次 Begin。
func (s *Store) Begin(ctx context.Context) (pgx.Tx, error) {
	pool, ok := s.q.(*pgxpool.Pool)
	if !ok {
		return nil, fmt.Errorf("%w: current queryer is %T", ErrNestedTransaction, s.q)
	}
	return pool.Begin(ctx)
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

// NodeEvaluationResults 返回节点测评结果 store。
func (s *Store) NodeEvaluationResults() *NodeEvaluationResultStore {
	return s.nodeEvalResults
}

// StudentPortraits 返回学生画像 store。
func (s *Store) StudentPortraits() *StudentPortraitStore {
	return s.studentPortrait
}

// StudentHonors 返回学生荣誉 store。
func (s *Store) StudentHonors() *StudentHonorStore {
	return s.studentHonors
}

// JobAbilityResults 返回岗位能力结果 store。
func (s *Store) JobAbilityResults() *JobAbilityResultStore {
	return s.jobAbilityRes
}

// Graduations 返回毕业设计 store。
func (s *Store) Graduations() *GraduationStore {
	return s.graduations
}

// Abilities 返回能力点 store。
func (s *Store) Abilities() *AbilityStore {
	return s.abilities
}

// AbilityDomains 返回能力域 store。
func (s *Store) AbilityDomains() *AbilityDomainStore {
	return s.abilityDomains
}

// Banners 返回轮播图 store。
func (s *Store) Banners() *BannerStore {
	return s.banners
}

// Terms 返回学期 store。
func (s *Store) Terms() *TermStore {
	return s.terms
}

// Batches 返回批次 store。
func (s *Store) Batches() *BatchStore {
	return s.batches
}

// Workflows 返回审批流程 store。
func (s *Store) Workflows() *WorkflowStore {
	return s.workflows
}

// Subscriptions 返回订阅 store。
func (s *Store) Subscriptions() *SubscriptionStore {
	return s.subscriptions
}

// ResourceCodes 返回资源码 store。
func (s *Store) ResourceCodes() *ResourceCodeStore {
	return s.resourceCodes
}

// Recommends 返回推荐位 store。
func (s *Store) Recommends() *RecommendStore {
	return s.recommends
}

// HybridModules 返回混合模块 store。
func (s *Store) HybridModules() *HybridModuleStore {
	return s.hybridModules
}

// LessonBehaviors 返回课堂行为 store。
func (s *Store) LessonBehaviors() *LessonBehaviorStore {
	return s.lessonBehaviors
}

// Landing 返回落地页 store。
func (s *Store) Landing() *LandingStore {
	return s.landing
}

// Approvals 返回审批 store。
func (s *Store) Approvals() *ApprovalStore {
	return s.approvals
}

// TeachingPlans 返回教学计划 store。
func (s *Store) TeachingPlans() *TeachingPlanStore {
	return s.teachingPlans
}

// Portal 返回工作台 store。
func (s *Store) Portal() *PortalStore {
	return s.portal
}

// Auth 返回认证 store。
func (s *Store) Auth() *AuthStore {
	return s.auth
}

// TrainingPrograms 返回人培方案 store。
func (s *Store) TrainingPrograms() *TrainingProgramStore {
	return s.trainingPrograms
}

// ContentActions 返回内容型实体共享动作 store。
func (s *Store) ContentActions() *ContentActionStore {
	return s.contentActions
}

// OrgTypes 返回组织类型 store。
func (s *Store) OrgTypes() *OrgTypesStore {
	return s.orgTypes
}

// Roles 返回角色 store。
func (s *Store) Roles() *RolesStore {
	return s.roles
}

// Majors 返回专业 store。
func (s *Store) Majors() *MajorsStore {
	return s.majors
}

// Industries 返回行业 store。
func (s *Store) Industries() *IndustriesStore {
	return s.industries
}

// StaffTitles 返回职称 store。
func (s *Store) StaffTitles() *StaffTitlesStore {
	return s.staffTitles
}

// LearnRoads 返回学习路径 store。
func (s *Store) LearnRoads() *LearnRoadsStore {
	return s.learnRoads
}

// CertificateLibrary 返回证书库 store。
func (s *Store) CertificateLibrary() *CertificateLibraryStore {
	return s.certLib
}

// MicroCerts 返回微证书 store。
func (s *Store) MicroCerts() *MicroCertStore {
	return s.microCerts
}

// OnSiteQuestions 返回现场问答库 store。
func (s *Store) OnSiteQuestions() *OnSiteQuestionLibraryStore {
	return s.onSiteQuestions
}

// Alliance 返回联盟 store。
func (s *Store) Alliance() *AllianceStore {
	return s.alliance
}

// AllianceEnterpriseLinks 返回学校-企业合作关联 store。
func (s *Store) AllianceEnterpriseLinks() *AllianceEnterpriseLinkStore {
	return s.allianceLinks
}

// Partner 返回企业平台 store。
func (s *Store) Partner() *PartnerStore {
	return s.partner
}

// Community 返回学习社区 store。
func (s *Store) Community() *CommunityStore {
	return s.community
}

// Favorites 返回通用收藏 store。
func (s *Store) Favorites() *FavoritesStore {
	return s.favorites
}

// PlatformSettings 返回平台级配置 store。
func (s *Store) PlatformSettings() *PlatformSettingsStore {
	return s.platformSettings
}

// Tags 返回标签 store。
func (s *Store) Tags() *TagStore {
	return s.tags
}

// WithTxRaw 开启独立事务并暴露 pgx.Tx（存量 import 代码过渡用；
// 新代码应使用 WithTx + 领域 store 方法，不要直接使用本方法）。
func (s *Store) WithTxRaw(ctx context.Context) (pgx.Tx, error) {
	return s.Begin(ctx)
}
