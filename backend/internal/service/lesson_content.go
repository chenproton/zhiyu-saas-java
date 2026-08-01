package service

import (
	"context"
	"errors"

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

// CreateCourse 创建课程。
func (s *LessonContentService) CreateCourse(ctx context.Context, tenantID string, p *store.CourseCreateParams) (*domain.Course, error) {
	course, err := s.st.Courses().Create(ctx, tenantID, p)
	if err != nil {
		return nil, err
	}
	s.st.Courses().ReplaceCourseBindings(ctx, course.ID, tenantID, p.CreatorID, p.KnowledgePointIds, p.ResourceIds)
	s.st.Courses().SyncKnowledgePointGranularLessons(ctx, tenantID, course.ID, p.KnowledgePointIds)
	return course, nil
}

// UpdateCourse 更新课程。
func (s *LessonContentService) UpdateCourse(ctx context.Context, id, tenantID, userID string, p *store.CourseUpdateParams, replaceBindings bool, kpIDs, resIDs []string) (*domain.Course, error) {
	course, err := s.st.Courses().Update(ctx, id, p)
	if err != nil {
		return nil, err
	}
	if replaceBindings {
		s.st.Courses().ReplaceCourseBindings(ctx, id, tenantID, userID, kpIDs, resIDs)
		s.st.Courses().SyncKnowledgePointGranularLessons(ctx, tenantID, id, kpIDs)
	}
	return course, nil
}

// DeleteCourse 删除课程。
func (s *LessonContentService) DeleteCourse(ctx context.Context, id string) error {
	return s.st.Courses().Delete(ctx, id)
}


// Queryer 暴露底层查询器。
func (s *LessonContentService) Queryer() store.Queryer {
	return s.st.Q()
}
