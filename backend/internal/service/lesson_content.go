package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// LessonContentService 课程内容配置业务编排（知识点/节点作业）。
type LessonContentService struct {
	*Service
	st *store.Store
}

// NewLessonContentService 创建课程内容服务。
func NewLessonContentService(s *Service) *LessonContentService {
	return &LessonContentService{Service: s, st: s.Store()}
}

// ListKnowledgePoints 查询知识点列表。
func (s *LessonContentService) ListKnowledgePoints(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.KnowledgePoint]) ([]domain.KnowledgePoint, int, error) {
	return s.st.KnowledgePoints().List(ctx, p, cfg)
}

// GetKnowledgePoint 查询单个知识点。
func (s *LessonContentService) GetKnowledgePoint(ctx context.Context, id, tenantID string) (*domain.KnowledgePoint, error) {
	return s.st.KnowledgePoints().Get(ctx, id, tenantID)
}

// CreateKnowledgePoint 创建知识点（事务内同步颗粒课引用）。
func (s *LessonContentService) CreateKnowledgePoint(ctx context.Context, tenantID string, p *store.KnowledgePointCreateParams) (*domain.KnowledgePoint, error) {
	var kp *domain.KnowledgePoint
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		k, err := txStore.KnowledgePoints().Create(ctx, txStore.Q(), tenantID, p)
		if err != nil {
			return err
		}
		kp = k
		return nil
	})
	return kp, err
}

// UpdateKnowledgePoint 更新知识点（事务内同步颗粒课引用）。
func (s *LessonContentService) UpdateKnowledgePoint(ctx context.Context, tenantID, id string, p *store.KnowledgePointUpdateParams) (*domain.KnowledgePoint, error) {
	var kp *domain.KnowledgePoint
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		k, err := txStore.KnowledgePoints().Update(ctx, txStore.Q(), tenantID, id, p)
		if err != nil {
			return err
		}
		kp = k
		return nil
	})
	return kp, err
}

// DeleteKnowledgePoint 删除知识点。
func (s *LessonContentService) DeleteKnowledgePoint(ctx context.Context, id, tenantID string) error {
	return s.st.KnowledgePoints().Delete(ctx, id, tenantID)
}

// KnowledgePointCitationStats 知识点引用次数分布（顶部指标卡片用）。
func (s *LessonContentService) KnowledgePointCitationStats(ctx context.Context, tenantID string) (store.CitationStats, error) {
	return s.st.KnowledgePoints().CitationStats(ctx, tenantID)
}

// ListUncitedKnowledgePoints 零引用知识点列表（弹窗：上传时段筛选 + 分页）。
func (s *LessonContentService) ListUncitedKnowledgePoints(ctx context.Context, tenantID string, from, to *time.Time, limit, offset int) ([]store.UncitedItem, int, error) {
	return s.st.KnowledgePoints().ListUncited(ctx, tenantID, from, to, limit, offset)
}

// ListQuizzes 查询测验列表。
func (s *LessonContentService) ListQuizzes(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.NodeQuiz]) ([]domain.NodeQuiz, int, error) {
	return s.st.NodeQuizzes().ListQuizzes(ctx, p, cfg)
}

// GetQuiz 查询单个测验（限定租户）。
func (s *LessonContentService) GetQuiz(ctx context.Context, id, tenantID string) (*domain.NodeQuiz, error) {
	return s.st.NodeQuizzes().GetQuiz(ctx, id, tenantID)
}

// CreateQuiz 创建测验。
func (s *LessonContentService) CreateQuiz(ctx context.Context, tenantID string, p *store.NodeQuizParams) (*domain.NodeQuiz, error) {
	return s.st.NodeQuizzes().CreateQuiz(ctx, tenantID, p)
}

// UpdateQuiz 更新测验（限定租户）。
func (s *LessonContentService) UpdateQuiz(ctx context.Context, id, tenantID string, p *store.NodeQuizUpdateParams) (*domain.NodeQuiz, error) {
	return s.st.NodeQuizzes().UpdateQuiz(ctx, id, tenantID, p)
}

// DeleteQuiz 删除测验（事务内连带题目，限定租户）。
func (s *LessonContentService) DeleteQuiz(ctx context.Context, id, tenantID string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.NodeQuizzes().DeleteQuiz(ctx, txStore.Q(), id, tenantID)
	})
}

// ListQuizQuestions 查询题目（限定租户，limit<=0 时默认 500）。
func (s *LessonContentService) ListQuizQuestions(ctx context.Context, quizID, tenantID string, limit, offset int) ([]domain.NodeQuizQuestion, int, error) {
	return s.st.NodeQuizzes().ListQuestions(ctx, quizID, tenantID, limit, offset)
}

// AddQuizQuestion 添加题目。
func (s *LessonContentService) AddQuizQuestion(ctx context.Context, tenantID, quizID string, p *store.NodeQuizQuestionParams) (*domain.NodeQuizQuestion, error) {
	return s.st.NodeQuizzes().AddQuestion(ctx, tenantID, quizID, p)
}

// UpdateQuizQuestion 更新题目（限定租户）。
func (s *LessonContentService) UpdateQuizQuestion(ctx context.Context, questionID, tenantID string, p *store.NodeQuizQuestionParams) (*domain.NodeQuizQuestion, error) {
	return s.st.NodeQuizzes().UpdateQuestion(ctx, questionID, tenantID, p)
}

// DeleteQuizQuestion 删除题目（限定租户）。
func (s *LessonContentService) DeleteQuizQuestion(ctx context.Context, questionID, tenantID string) error {
	return s.st.NodeQuizzes().DeleteQuestion(ctx, questionID, tenantID)
}

// GetQuizQuestion 查询单个题目（限定租户）。
func (s *LessonContentService) GetQuizQuestion(ctx context.Context, questionID, tenantID string) (*domain.NodeQuizQuestion, error) {
	return s.st.NodeQuizzes().GetQuestion(ctx, questionID, tenantID)
}

// CloneCourse 克隆课程及全部关联（绑定/体系课节点/节点子表），返回新课程 ID。
func (s *LessonContentService) CloneCourse(ctx context.Context, tenantID, oldCourseID, newName, createdBy string) (string, error) {
	src, err := s.st.CourseClone().FetchSource(ctx, oldCourseID)
	if err != nil {
		return "", err
	}
	if src.TenantID != nil && *src.TenantID != tenantID {
		return "", ErrCourseNotInTenant
	}
	if newName == "" {
		newName = src.Name + " (克隆)"
	}
	prefix := "XT"
	if src.Type == "granular" {
		prefix = "KL"
	}
	var newID string
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		code, err := store.GenerateUniqueEntityCode(ctx, txStore.Q(), prefix, "courses", tenantID)
		if err != nil {
			return err
		}
		newID, err = txStore.CourseClone().CloneCourse(ctx, txStore.Q(), tenantID, oldCourseID, newName, src, createdBy, code)
		return err
	})
	if err != nil {
		return "", err
	}
	return newID, nil
}

// GetCourse 查询完整课程。
func (s *LessonContentService) GetCourse(ctx context.Context, id string) (*domain.Course, error) {
	c, err := s.st.CourseClone().FetchCourse(ctx, id)
	if err != nil {
		return nil, err
	}
	s.st.Courses().PopulateCourseKnowledgePointNames(ctx, c)
	return c, nil
}

// ErrCourseNotInTenant 课程不属于当前租户。
var ErrCourseNotInTenant = errors.New("course not in tenant")

// ListNodeBases 查询节点基础行。
func (s *LessonContentService) ListNodeBases(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[store.CourseNodeBase]) ([]store.CourseNodeBase, int, error) {
	return s.st.CourseNodes().List(ctx, p, cfg)
}

// GetNodeBase 查询单个节点基础行。
func (s *LessonContentService) GetNodeBase(ctx context.Context, id, tenantID string) (*store.CourseNodeBase, error) {
	return s.st.CourseNodes().Get(ctx, id, tenantID)
}

// CreateNode 创建节点（事务内绑定知识点/资源）。
func (s *LessonContentService) CreateNode(ctx context.Context, tenantID string, p *store.CourseNodeCreateParams, kpIDs, resIDs []string) (*store.CourseNodeBase, error) {
	var node *store.CourseNodeBase
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		n, err := txStore.CourseNodes().Create(ctx, txStore.Q(), tenantID, p, kpIDs, resIDs)
		if err != nil {
			return err
		}
		node = n
		return nil
	})
	return node, err
}

// UpdateNode 更新节点（事务内重绑知识点/资源）。
func (s *LessonContentService) UpdateNode(ctx context.Context, id, tenantID string, p *store.CourseNodeUpdateParams, kpIDs, resIDs []string) (*store.CourseNodeBase, error) {
	var node *store.CourseNodeBase
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		n, err := txStore.CourseNodes().Update(ctx, txStore.Q(), id, tenantID, p, kpIDs, resIDs)
		if err != nil {
			return err
		}
		node = n
		return nil
	})
	return node, err
}

// DeleteNode 删除节点：事务内先行清理节点级考试安排（无 FK，防幽灵考试残留）。
func (s *LessonContentService) DeleteNode(ctx context.Context, id, tenantID string) error {
	return s.st.WithTx(ctx, func(txStore *store.Store) error {
		if err := store.CleanupNodeExamUsages(ctx, txStore.Q(), id); err != nil {
			return err
		}
		return txStore.CourseNodes().Delete(ctx, id, tenantID)
	})
}

// ReorderNodes 批量重排节点（事务内）。
func (s *LessonContentService) ReorderNodes(ctx context.Context, courseID string, nodeIDs []string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.CourseNodes().Reorder(ctx, txStore.Q(), courseID, nodeIDs)
	})
}

// NodeEnrichData 节点富化查询（知识点/资源/测验/作业/original 继承）。
type NodeEnrichData struct {
	KnowledgePoints map[string]store.NodeKnowledgePoint
	Resources       map[string]store.NodeResource
	Quizzes         []domain.NodeQuiz
	OriginalKP      map[string][]store.NodeKnowledgePoint
	OriginalRes     map[string][]store.NodeResource
}

// EnrichNodes 批量查询节点富化数据。
func (s *LessonContentService) EnrichNodes(ctx context.Context, nodeIDs []string, allKPIDs, allResIDs, originalSourceIDs []string) (*NodeEnrichData, error) {
	kp, err := s.st.CourseNodes().KnowledgePointsByIDs(ctx, allKPIDs)
	if err != nil {
		return nil, err
	}
	res, err := s.st.CourseNodes().ResourcesByIDs(ctx, allResIDs)
	if err != nil {
		return nil, err
	}
	quizzes, err := s.st.CourseNodes().QuizzesByNodeIDs(ctx, nodeIDs)
	if err != nil {
		return nil, err
	}
	origKP, err := s.st.CourseNodes().OriginalSourceKnowledgePoints(ctx, originalSourceIDs)
	if err != nil {
		return nil, err
	}
	origRes, err := s.st.CourseNodes().OriginalSourceResources(ctx, originalSourceIDs)
	if err != nil {
		return nil, err
	}
	return &NodeEnrichData{
		KnowledgePoints: kp,
		Resources:       res,
		Quizzes:         quizzes,
		OriginalKP:      origKP,
		OriginalRes:     origRes,
	}, nil
}

// ListCourses 查询课程列表。
func (s *LessonContentService) ListCourses(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Course]) ([]domain.Course, int, error) {
	items, total, err := s.st.Courses().List(ctx, p, cfg)
	if err != nil {
		return nil, 0, err
	}
	s.st.Courses().PopulateKnowledgePointNames(ctx, items)
	return items, total, nil
}

// GetCourseDetail 查询单个课程。
func (s *LessonContentService) GetCourseDetail(ctx context.Context, id string) (*domain.Course, error) {
	c, err := s.st.Courses().GetUnscoped(ctx, id)
	if err != nil {
		return nil, err
	}
	s.st.Courses().PopulateCourseKnowledgePointNames(ctx, c)
	return c, nil
}

// GetCourseDetailInTenant 查询单个课程（租户限定）。
func (s *LessonContentService) GetCourseDetailInTenant(ctx context.Context, id, tenantID string) (*domain.Course, error) {
	c, err := s.st.Courses().Get(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	s.st.Courses().PopulateCourseKnowledgePointNames(ctx, c)
	return c, nil
}

// CreateCourse 创建课程（主记录、绑定、知识点引用在同一事务）。
func (s *LessonContentService) CreateCourse(ctx context.Context, tenantID string, p *store.CourseCreateParams) (*domain.Course, error) {
	var course *domain.Course
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		c, err := txStore.Courses().Create(ctx, tenantID, p)
		if err != nil {
			return err
		}
		if err := txStore.Courses().ReplaceCourseBindings(ctx, c.ID, tenantID, p.CreatorID, p.KnowledgePointIds, p.ResourceIds); err != nil {
			return err
		}
		if err := txStore.Courses().SyncKnowledgePointGranularLessons(ctx, tenantID, c.ID, p.KnowledgePointIds); err != nil {
			return err
		}
		course = c
		return nil
	})
	return course, err
}

// UpdateCourse 更新课程（主记录、绑定、知识点引用在同一事务）。
func (s *LessonContentService) UpdateCourse(ctx context.Context, id, tenantID, userID string, p *store.CourseUpdateParams, replaceBindings bool, kpIDs, resIDs []string) (*domain.Course, error) {
	var course *domain.Course
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		c, err := txStore.Courses().Update(ctx, id, tenantID, p)
		if err != nil {
			return err
		}
		if replaceBindings {
			if err := txStore.Courses().ReplaceCourseBindings(ctx, id, tenantID, userID, kpIDs, resIDs); err != nil {
				return err
			}
			if err := txStore.Courses().SyncKnowledgePointGranularLessons(ctx, tenantID, id, kpIDs); err != nil {
				return err
			}
		}
		course = c
		return nil
	})
	return course, err
}

// DeleteCourse 删除课程（限定租户）。
func (s *LessonContentService) DeleteCourse(ctx context.Context, id, tenantID string) error {
	return s.st.Courses().Delete(ctx, id, tenantID)
}

// ===== 课程评估生成（发布 hook）=====

// GenerateCourseAssessments 发布课程时生成节点测评（考试/作业）。
// 体系课读取节点 eval_data.evalRuleConfig；混合课读取 eval_data.hybridEvalRules
// 的三个子规则（preQuiz/inClassQuiz/homework），各自独立生成测评实体。
func (s *LessonContentService) GenerateCourseAssessments(ctx context.Context, txStore *store.Store, courseID string) error {
	q := txStore.Q()
	info, err := txStore.CourseAssessments().FetchCourseInfo(ctx, q, courseID)
	if err != nil {
		return err
	}
	if info.Type != "system" && info.Type != "hybrid" {
		return nil
	}

	nodes, err := txStore.CourseAssessments().ListNodeEvalData(ctx, q, courseID)
	if err != nil {
		return err
	}

	for _, n := range nodes {
		updated, err := s.generateNodeAssessments(ctx, q, n, info)
		if err != nil {
			return err
		}
		if updated {
			if err := txStore.CourseAssessments().UpdateNodeEvalData(ctx, q, n.ID, n.EvalData); err != nil {
				return err
			}
		}
	}

	return txStore.CourseAssessments().CleanupCourseLevelAssessments(ctx, q, courseID)
}

// generateNodeAssessments 按课程类型生成单节点测评，返回是否有写回。
func (s *LessonContentService) generateNodeAssessments(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo) (bool, error) {
	if info.Type == "hybrid" {
		return s.generateHybridNodeAssessments(ctx, q, n, info)
	}
	ruleConfig := extractEvalRuleConfig(n.EvalData)
	if ruleConfig == nil {
		return false, nil
	}
	updated, err := s.applyRuleConfig(ctx, q, n, info, ruleConfig)
	if err != nil {
		return false, err
	}
	if updated {
		n.EvalData["evalRuleConfig"] = ruleConfig
	}
	return updated, nil
}

// generateHybridNodeAssessments 混合课：对课前测验/随堂测验/课后作业三个子规则分别生成。
func (s *LessonContentService) generateHybridNodeAssessments(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo) (bool, error) {
	hybridRules, _ := n.EvalData["hybridEvalRules"].(map[string]interface{})
	if hybridRules == nil {
		return false, nil
	}
	updated := false
	for _, moduleKey := range []string{"preQuiz", "inClassQuiz", "homework"} {
		part, _ := hybridRules[moduleKey].(map[string]interface{})
		if part == nil {
			continue
		}
		ruleConfig, _ := part["evalRuleConfig"].(map[string]interface{})
		if ruleConfig == nil {
			continue
		}
		changed, err := s.applyRuleConfig(ctx, q, n, info, ruleConfig)
		if err != nil {
			return false, err
		}
		if changed {
			part["evalRuleConfig"] = ruleConfig
			hybridRules[moduleKey] = part
			updated = true
		}
	}
	if updated {
		n.EvalData["hybridEvalRules"] = hybridRules
	}
	return updated, nil
}

// applyRuleConfig 按规则配置生成测评（试卷安排/题库考试/作业），写回 methodResourceConfigs。
func (s *LessonContentService) applyRuleConfig(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo, ruleConfig map[string]interface{}) (bool, error) {
	methods := store.GetStringSliceFromJSONMap(ruleConfig, "evaluationMethods")
	methodResourceConfigs, _ := ruleConfig["methodResourceConfigs"].(map[string]interface{})
	if methodResourceConfigs == nil {
		methodResourceConfigs = make(map[string]interface{})
	}

	updated := false
	for _, methodKey := range methods {
		rc, _ := methodResourceConfigs[methodKey].(map[string]interface{})
		if rc == nil {
			rc = make(map[string]interface{})
		}
		switch methodKey {
		case "paper":
			newRC, err := s.ensureNodePaperUsage(ctx, q, n, info, rc, ruleConfig)
			if err != nil {
				return false, err
			}
			methodResourceConfigs[methodKey] = newRC
			updated = true
		case "question_bank", "quiz":
			newRC, err := s.ensureNodeQuestionExam(ctx, q, n, info, methodKey, rc, ruleConfig)
			if err != nil {
				return false, err
			}
			methodResourceConfigs[methodKey] = newRC
			updated = true
		}
	}

	if updated {
		ruleConfig["methodResourceConfigs"] = methodResourceConfigs
	}
	return updated, nil
}

// ensureNodePaperUsage 生成节点试卷安排。
func (s *LessonContentService) ensureNodePaperUsage(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo, rc map[string]interface{}, ruleConfig map[string]interface{}) (map[string]interface{}, error) {
	paperIDs := store.GetStringSliceFromJSONMap(ruleConfig, "paperIds")
	if len(paperIDs) == 0 {
		return rc, nil
	}
	startTime, endTime := store.ExtractExamUsageWindow(rc)
	duration := store.ExtractExamUsageDuration(rc, "paper")
	activationMode := store.ResolveActivationMode(rc, "paper")
	for _, paperID := range paperIDs {
		if paperID == "" {
			continue
		}
		usageID, err := s.st.CourseAssessments().FindNodeUsage(ctx, q, paperID, n.ID)
		if err != nil {
			return rc, err
		}
		if usageID == "" {
			// 名称：课程名-节点名-试卷-{YYYYMMDD}-{序号}
			usageName, err := store.NextAutoUsageName(ctx, q, info.TenantID, "node", fmt.Sprintf("%s-%s", info.Name, n.Name), "试卷")
			if err != nil {
				return rc, err
			}
			usageID, err = s.st.CourseAssessments().CreateNodeUsage(ctx, q, info.TenantID, paperID, n.ID, usageName, info.CreatorID, startTime, endTime, duration, activationMode)
			if err != nil {
				return rc, err
			}
			rc["usageId"] = usageID
		} else if startTime != nil || endTime != nil || duration != nil || rc["activationMode"] != nil {
			if err := s.st.CourseAssessments().UpdateUsageWindow(ctx, q, usageID, startTime, endTime, duration, activationMode); err != nil {
				return rc, err
			}
		}
	}
	return rc, nil
}

// ensureNodeQuestionExam 生成节点题库/随堂测考试。
func (s *LessonContentService) ensureNodeQuestionExam(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo, methodKey string, rc map[string]interface{}, ruleConfig map[string]interface{}) (map[string]interface{}, error) {
	field := map[string]string{
		"question_bank": "questionBankQuestions",
		"quiz":          "quizQuestions",
	}[methodKey]
	questionIDs := store.GetStringSliceFromJSONMap(ruleConfig, field)
	if len(questionIDs) == 0 {
		return rc, nil
	}
	label := map[string]string{
		"question_bank": "题库",
		"quiz":          "随堂测",
	}[methodKey]

	examID, _ := rc["examId"].(string)
	usageID, _ := rc["usageId"].(string)
	startTime, endTime := store.ExtractExamUsageWindow(rc)
	duration := store.ExtractExamUsageDuration(rc, methodKey)
	activationMode := store.ResolveActivationMode(rc, methodKey)

	if examID == "" {
		examDuration := 90
		if d, ok := rc["duration"].(float64); ok && d > 0 {
			examDuration = int(d)
		} else if d, ok := rc["timeLimit"].(float64); ok && d > 0 {
			examDuration = int(d)
		}
		newID, err := s.st.CourseAssessments().CreateTempExam(ctx, q, info.TenantID, fmt.Sprintf("%s-%s-%s", info.Name, n.Name, label), examDuration, info.CreatorID)
		if err != nil {
			return rc, err
		}
		examID = newID
		rc["examId"] = examID
	}

	changed, err := store.SyncExamQuestions(ctx, q, info.TenantID, examID, questionIDs, nil)
	if err != nil {
		return rc, err
	}
	// temp exam 兜底（文档 5.1 末条）：不走 Transition，同步点维护版本+快照；
	// 内部会把引用该试卷的全部 exam_usages.exam_version 刷新为最终版本（覆盖复用分支）。
	if _, err := store.NewSnapshotStore(q).SyncTempExamSnapshot(ctx, info.TenantID, examID, changed); err != nil {
		return rc, err
	}

	if usageID == "" {
		// 复用该节点已生成的考试安排（重新发布/编辑测评规则后配置丢失的场景），避免重复创建
		found, err := s.st.CourseAssessments().FindNodeUsage(ctx, q, examID, n.ID)
		if err != nil {
			return rc, err
		}
		usageID = found
		if usageID != "" {
			// 复用分支同样写回：后续 window 更新/学生作答依赖该 id
			rc["usageId"] = usageID
		}
	}

	if usageID == "" {
		// 名称：课程名-节点名-{测评类型}-{YYYYMMDD}-{序号}
		usageName, err := store.NextAutoUsageName(ctx, q, info.TenantID, "node", fmt.Sprintf("%s-%s", info.Name, n.Name), label)
		if err != nil {
			return rc, err
		}
		newID, err := s.st.CourseAssessments().CreateExamUsage(ctx, q, info.TenantID, examID, "node", n.ID, usageName, info.CreatorID, startTime, endTime, duration, activationMode)
		if err != nil {
			return rc, err
		}
		usageID = newID
		rc["usageId"] = usageID
	} else if startTime != nil || endTime != nil || duration != nil || rc["activationMode"] != nil {
		if err := s.st.CourseAssessments().UpdateUsageWindow(ctx, q, usageID, startTime, endTime, duration, activationMode); err != nil {
			return rc, err
		}
	}
	return rc, nil
}

// extractEvalRuleConfig 提取节点评估规则配置。
func extractEvalRuleConfig(evalData map[string]interface{}) map[string]interface{} {
	if evalData == nil {
		return nil
	}
	if rc, ok := evalData["evalRuleConfig"].(map[string]interface{}); ok {
		return rc
	}
	return nil
}
