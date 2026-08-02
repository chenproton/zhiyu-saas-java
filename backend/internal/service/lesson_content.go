package service

import (
	"context"
	"errors"
	"fmt"

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
func (s *LessonContentService) GetKnowledgePoint(ctx context.Context, id string) (*domain.KnowledgePoint, error) {
	return s.st.KnowledgePoints().Get(ctx, id)
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
func (s *LessonContentService) DeleteKnowledgePoint(ctx context.Context, id string) error {
	return s.st.KnowledgePoints().Delete(ctx, id)
}

// ListNodeHomeworks 查询作业列表。
func (s *LessonContentService) ListNodeHomeworks(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.NodeHomework]) ([]domain.NodeHomework, int, error) {
	return s.st.NodeHomeworks().List(ctx, p, cfg)
}

// GetNodeHomework 查询单个作业。
func (s *LessonContentService) GetNodeHomework(ctx context.Context, id string) (*domain.NodeHomework, error) {
	return s.st.NodeHomeworks().Get(ctx, id)
}

// CreateNodeHomework 创建作业。
func (s *LessonContentService) CreateNodeHomework(ctx context.Context, tenantID string, p *store.NodeHomeworkCreateParams) (*domain.NodeHomework, error) {
	return s.st.NodeHomeworks().Create(ctx, tenantID, p)
}

// UpdateNodeHomework 更新作业。
func (s *LessonContentService) UpdateNodeHomework(ctx context.Context, id string, p *store.NodeHomeworkUpdateParams) (*domain.NodeHomework, error) {
	return s.st.NodeHomeworks().Update(ctx, id, p)
}

// DeleteNodeHomework 删除作业。
func (s *LessonContentService) DeleteNodeHomework(ctx context.Context, id string) error {
	return s.st.NodeHomeworks().Delete(ctx, id)
}

// ListQuizzes 查询测验列表。
func (s *LessonContentService) ListQuizzes(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.NodeQuiz]) ([]domain.NodeQuiz, int, error) {
	return s.st.NodeQuizzes().ListQuizzes(ctx, p, cfg)
}

// GetQuiz 查询单个测验。
func (s *LessonContentService) GetQuiz(ctx context.Context, id string) (*domain.NodeQuiz, error) {
	return s.st.NodeQuizzes().GetQuiz(ctx, id)
}

// CreateQuiz 创建测验。
func (s *LessonContentService) CreateQuiz(ctx context.Context, tenantID string, p *store.NodeQuizParams) (*domain.NodeQuiz, error) {
	return s.st.NodeQuizzes().CreateQuiz(ctx, tenantID, p)
}

// UpdateQuiz 更新测验。
func (s *LessonContentService) UpdateQuiz(ctx context.Context, id string, p *store.NodeQuizUpdateParams) (*domain.NodeQuiz, error) {
	return s.st.NodeQuizzes().UpdateQuiz(ctx, id, p)
}

// DeleteQuiz 删除测验（事务内连带题目）。
func (s *LessonContentService) DeleteQuiz(ctx context.Context, id string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.NodeQuizzes().DeleteQuiz(ctx, txStore.Q(), id)
	})
}

// ListQuizQuestions 查询题目。
func (s *LessonContentService) ListQuizQuestions(ctx context.Context, quizID string) ([]domain.NodeQuizQuestion, int, error) {
	return s.st.NodeQuizzes().ListQuestions(ctx, quizID)
}

// AddQuizQuestion 添加题目。
func (s *LessonContentService) AddQuizQuestion(ctx context.Context, tenantID, quizID string, p *store.NodeQuizQuestionParams) (*domain.NodeQuizQuestion, error) {
	return s.st.NodeQuizzes().AddQuestion(ctx, tenantID, quizID, p)
}

// UpdateQuizQuestion 更新题目。
func (s *LessonContentService) UpdateQuizQuestion(ctx context.Context, questionID string, p *store.NodeQuizQuestionParams) (*domain.NodeQuizQuestion, error) {
	return s.st.NodeQuizzes().UpdateQuestion(ctx, questionID, p)
}

// DeleteQuizQuestion 删除题目。
func (s *LessonContentService) DeleteQuizQuestion(ctx context.Context, questionID string) error {
	return s.st.NodeQuizzes().DeleteQuestion(ctx, questionID)
}

// GetQuizQuestion 查询单个题目。
func (s *LessonContentService) GetQuizQuestion(ctx context.Context, questionID string) (*domain.NodeQuizQuestion, error) {
	return s.st.NodeQuizzes().GetQuestion(ctx, questionID)
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
	return s.st.CourseClone().FetchCourse(ctx, id)
}

// ErrCourseNotInTenant 课程不属于当前租户。
var ErrCourseNotInTenant = errors.New("course not in tenant")

// ListNodeBases 查询节点基础行。
func (s *LessonContentService) ListNodeBases(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[store.CourseNodeBase]) ([]store.CourseNodeBase, int, error) {
	return s.st.CourseNodes().List(ctx, p, cfg)
}

// GetNodeBase 查询单个节点基础行。
func (s *LessonContentService) GetNodeBase(ctx context.Context, id string) (*store.CourseNodeBase, error) {
	return s.st.CourseNodes().Get(ctx, id)
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
func (s *LessonContentService) UpdateNode(ctx context.Context, id string, p *store.CourseNodeUpdateParams, kpIDs, resIDs []string) (*store.CourseNodeBase, error) {
	var node *store.CourseNodeBase
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		n, err := txStore.CourseNodes().Update(ctx, txStore.Q(), id, p, kpIDs, resIDs)
		if err != nil {
			return err
		}
		node = n
		return nil
	})
	return node, err
}

// DeleteNode 删除节点。
func (s *LessonContentService) DeleteNode(ctx context.Context, id string) error {
	return s.st.CourseNodes().Delete(ctx, id)
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
	Homeworks       []domain.NodeHomework
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
	homeworks, err := s.st.CourseNodes().HomeworksByNodeIDs(ctx, nodeIDs)
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
		Homeworks:       homeworks,
		OriginalKP:      origKP,
		OriginalRes:     origRes,
	}, nil
}

// ListCourses 查询课程列表。
func (s *LessonContentService) ListCourses(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Course]) ([]domain.Course, int, error) {
	return s.st.Courses().List(ctx, p, cfg)
}

// GetCourseDetail 查询单个课程。
func (s *LessonContentService) GetCourseDetail(ctx context.Context, id string) (*domain.Course, error) {
	return s.st.Courses().Get(ctx, id)
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
		c, err := txStore.Courses().Update(ctx, id, p)
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

// DeleteCourse 删除课程。
func (s *LessonContentService) DeleteCourse(ctx context.Context, id string) error {
	return s.st.Courses().Delete(ctx, id)
}

// Queryer 暴露底层查询器。
func (s *LessonContentService) Queryer() store.Queryer {
	return s.st.Q()
}

// ===== 课程/节点作业 =====

// SubmitCourseHomework 提交课程作业。
func (s *LessonContentService) SubmitCourseHomework(ctx context.Context, tenantID, courseID, homeworkID, studentID, content string, attachmentURLs []string) (string, error) {
	return s.st.CourseHomeworks().SubmitCourseHomework(ctx, tenantID, courseID, homeworkID, studentID, content, attachmentURLs)
}

// ListCourseHomeworkSubmissions 查询课程作业提交。
func (s *LessonContentService) ListCourseHomeworkSubmissions(ctx context.Context, tenantID, courseID, homeworkID string) ([]store.HomeworkSubmissionItem, error) {
	return s.st.CourseHomeworks().ListCourseHomeworkSubmissions(ctx, tenantID, courseID, homeworkID)
}

// GradeCourseHomework 批改课程作业。
func (s *LessonContentService) GradeCourseHomework(ctx context.Context, graderID, tenantID, courseID, homeworkID, submissionID string, score float64, comment string) error {
	_, _, err := s.st.CourseHomeworks().GradeCourseHomework(ctx, graderID, tenantID, courseID, homeworkID, submissionID, score, comment)
	return err
}

// SubmitNodeHomework 提交节点作业。
func (s *LessonContentService) SubmitNodeHomework(ctx context.Context, tenantID, nodeID, homeworkID, studentID, content string, attachmentURLs []string) (string, error) {
	return s.st.CourseHomeworks().SubmitNodeHomework(ctx, tenantID, nodeID, homeworkID, studentID, content, attachmentURLs)
}

// ListNodeHomeworkSubmissions 查询节点作业提交。
func (s *LessonContentService) ListNodeHomeworkSubmissions(ctx context.Context, tenantID, nodeID, homeworkID string) ([]store.HomeworkSubmissionItem, error) {
	return s.st.CourseHomeworks().ListNodeHomeworkSubmissions(ctx, tenantID, nodeID, homeworkID)
}

// GradeNodeHomework 批改节点作业。
func (s *LessonContentService) GradeNodeHomework(ctx context.Context, graderID, tenantID, nodeID, homeworkID, submissionID string, score float64, comment string) error {
	_, _, err := s.st.CourseHomeworks().GradeNodeHomework(ctx, graderID, tenantID, nodeID, homeworkID, submissionID, score, comment)
	return err
}

// ===== 课程评估生成（发布 hook）=====

// GenerateCourseAssessments 发布课程时生成节点测评（考试/作业）。
func (s *LessonContentService) GenerateCourseAssessments(ctx context.Context, txStore *store.Store, courseID string) error {
	q := txStore.Q()
	info, err := txStore.CourseAssessments().FetchCourseInfo(ctx, q, courseID)
	if err != nil {
		return err
	}
	if info.Type != "system" {
		return nil
	}

	nodes, err := txStore.CourseAssessments().ListNodeEvalData(ctx, q, courseID)
	if err != nil {
		return err
	}

	for _, n := range nodes {
		ruleConfig := extractEvalRuleConfig(n.EvalData)
		if ruleConfig == nil {
			continue
		}
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
					return err
				}
				methodResourceConfigs[methodKey] = newRC
				updated = true
			case "question_bank", "quiz":
				newRC, err := s.ensureNodeQuestionExam(ctx, q, n, info, methodKey, rc, ruleConfig)
				if err != nil {
					return err
				}
				methodResourceConfigs[methodKey] = newRC
				updated = true
			case "homework":
				if err := s.ensureNodeHomework(ctx, q, n, info); err != nil {
					return err
				}
			}
		}

		if updated {
			ruleConfig["methodResourceConfigs"] = methodResourceConfigs
			n.EvalData["evalRuleConfig"] = ruleConfig
			if err := txStore.CourseAssessments().UpdateNodeEvalData(ctx, q, n.ID, n.EvalData); err != nil {
				return err
			}
		}
	}

	return txStore.CourseAssessments().CleanupCourseLevelAssessments(ctx, q, courseID)
}

// ensureNodePaperUsage 生成节点试卷安排。
func (s *LessonContentService) ensureNodePaperUsage(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo, rc map[string]interface{}, ruleConfig map[string]interface{}) (map[string]interface{}, error) {
	paperIDs := store.GetStringSliceFromJSONMap(ruleConfig, "paperIds")
	if len(paperIDs) == 0 {
		return rc, nil
	}
	for _, paperID := range paperIDs {
		if paperID == "" {
			continue
		}
		examName, err := s.st.CourseAssessments().PaperExamName(ctx, q, paperID, info.TenantID)
		if err != nil {
			return rc, err
		}
		usageID, err := s.st.CourseAssessments().FindNodeUsage(ctx, q, paperID, n.ID)
		if err != nil {
			return rc, err
		}
		if usageID == "" {
			usageID, err = s.st.CourseAssessments().CreateNodeUsage(ctx, q, info.TenantID, paperID, n.ID, fmt.Sprintf("%s-%s-%s", info.Name, n.Name, examName), info.CreatorID)
			if err != nil {
				return rc, err
			}
			rc["usageId"] = usageID
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

	if examID == "" {
		duration := 90
		if d, ok := rc["duration"].(float64); ok && d > 0 {
			duration = int(d)
		} else if d, ok := rc["timeLimit"].(float64); ok && d > 0 {
			duration = int(d)
		}
		newID, err := s.st.CourseAssessments().CreateTempExam(ctx, q, info.TenantID, fmt.Sprintf("%s-%s-%s", info.Name, n.Name, label), duration, info.CreatorID)
		if err != nil {
			return rc, err
		}
		examID = newID
		rc["examId"] = examID
	}

	if err := s.st.CourseAssessments().EnsureExamQuestions(ctx, q, info.TenantID, examID, questionIDs); err != nil {
		return rc, err
	}

	if usageID == "" {
		newID, err := s.st.CourseAssessments().CreateExamUsage(ctx, q, info.TenantID, examID, "node", n.ID, fmt.Sprintf("%s-%s-%s", info.Name, n.Name, label), info.CreatorID)
		if err != nil {
			return rc, err
		}
		usageID = newID
		rc["usageId"] = usageID
	}
	return rc, nil
}

// ensureNodeHomework 生成节点作业。
func (s *LessonContentService) ensureNodeHomework(ctx context.Context, q store.Queryer, n store.NodeEvalRow, info *store.CourseInfo) error {
	exists, err := s.st.CourseAssessments().NodeHomeworkExists(ctx, q, n.ID)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return s.st.CourseAssessments().CreateNodeHomework(ctx, q, info.TenantID, n.ID, fmt.Sprintf("%s-%s-节点作业", info.Name, n.Name), info.CreatorID)
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

// ListCourseExamUsages 查询课程考试安排。
func (s *LessonContentService) ListCourseExamUsages(ctx context.Context, courseID, tenantID string) ([]store.CourseExamUsage, error) {
	return s.st.CourseAssessments().ListCourseExamUsages(ctx, tenantID, courseID)
}

// ListCourseHomeworks 查询课程作业列表。
func (s *LessonContentService) ListCourseHomeworks(ctx context.Context, courseID, tenantID string) ([]store.CourseHomework, error) {
	return s.st.CourseAssessments().ListCourseHomeworks(ctx, tenantID, courseID)
}

// CourseHomeworkExists 校验课程作业存在。
func (s *LessonContentService) CourseHomeworkExists(ctx context.Context, homeworkID, courseID, tenantID string) (bool, error) {
	return s.st.CourseHomeworks().CourseHomeworkExists(ctx, homeworkID, courseID, tenantID)
}

// NodeHomeworkExists 校验节点作业存在。
func (s *LessonContentService) NodeHomeworkExists(ctx context.Context, homeworkID, nodeID, tenantID string) (bool, error) {
	return s.st.CourseHomeworks().NodeHomeworkExists(ctx, homeworkID, nodeID, tenantID)
}
