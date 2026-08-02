package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// GraduationStore 毕业设计持久化。
type GraduationStore struct {
	q Queryer
}

// NewGraduationStore 创建毕业设计 store。
func NewGraduationStore(q Queryer) *GraduationStore {
	return &GraduationStore{q: q}
}

// ListTopics 查询课题列表。
func (s *GraduationStore) ListTopics(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.GraduationProjectTopic]) ([]domain.GraduationProjectTopic, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanGraduationTopicRows)
}

// GetTopic 查询单个课题。
func (s *GraduationStore) GetTopic(ctx context.Context, id string) (*domain.GraduationProjectTopic, error) {
	t, err := s.fetchTopic(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

// CreateTopic 创建课题。
func (s *GraduationStore) CreateTopic(ctx context.Context, p *GraduationTopicParams) (*domain.GraduationProjectTopic, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO graduation_project_topics (id, tenant_id, name, career_position_id, college, source, status, capacity, applied_count,
			advisor_id, enterprise_mentor_id, start_date, end_date, description)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'draft', $6, 0, $7, $8, $9, $10, $11)
		RETURNING id
	`, p.TenantID, p.Name, p.CareerPositionID, p.College, p.Source, p.Capacity, p.AdvisorID, p.EnterpriseMentorID, p.StartDate, p.EndDate, p.Description).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetTopic(ctx, id)
}

// UpdateTopic 更新课题。
func (s *GraduationStore) UpdateTopic(ctx context.Context, id string, p *GraduationTopicParams) (*domain.GraduationProjectTopic, error) {
	if _, err := s.fetchTopic(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE graduation_project_topics SET name = $1, career_position_id = $2, college = $3, source = $4,
			capacity = $5, advisor_id = $6, enterprise_mentor_id = $7, start_date = $8, end_date = $9, description = $10
		WHERE id = $11
	`, p.Name, p.CareerPositionID, p.College, p.Source, p.Capacity, p.AdvisorID, p.EnterpriseMentorID, p.StartDate, p.EndDate, p.Description, id); err != nil {
		return nil, err
	}
	return s.GetTopic(ctx, id)
}

// DeleteTopic 删除课题（连带评价与档案，事务内）。
func (s *GraduationStore) DeleteTopic(ctx context.Context, tx Queryer, id string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM graduation_project_evaluations WHERE topic_id = $1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM graduation_project_archives WHERE topic_id = $1`, id); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `DELETE FROM graduation_project_topics WHERE id = $1`, id)
	return err
}

// ApplyTopic 申请课题（原子递增，防超员）。
func (s *GraduationStore) ApplyTopic(ctx context.Context, id string) (bool, error) {
	tag, err := s.q.Exec(ctx, `
		UPDATE graduation_project_topics SET applied_count = applied_count + 1 
		WHERE id = $1 AND applied_count < capacity
	`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// GraduationTopicParams 课题参数。
type GraduationTopicParams struct {
	TenantID           string
	Name               string
	CareerPositionID   string
	College            *string
	Source             *string
	Capacity           int
	AdvisorID          *string
	EnterpriseMentorID *string
	StartDate          *time.Time
	EndDate            *time.Time
	Description        *string
}

// ListArchives 查询档案列表。
func (s *GraduationStore) ListArchives(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.GraduationProjectArchive]) ([]domain.GraduationProjectArchive, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanGraduationArchiveRows)
}

// CreateArchive 创建档案。
func (s *GraduationStore) CreateArchive(ctx context.Context, tenantID, topicID, userID, phase string) (*domain.GraduationProjectArchive, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO graduation_project_archives (id, tenant_id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 'making', 0, NOW(), false)
		RETURNING id
	`, tenantID, topicID, userID, phase).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetArchive(ctx, id)
}

// GetArchive 查询单个档案。
func (s *GraduationStore) GetArchive(ctx context.Context, id string) (*domain.GraduationProjectArchive, error) {
	var a domain.GraduationProjectArchive
	err := s.q.QueryRow(ctx, `
		SELECT id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification
		FROM graduation_project_archives WHERE id = $1
	`, id).Scan(&a.ID, &a.TopicID, &a.UserID, &a.Phase, &a.DocStatus, &a.DocCount, &a.LastUpdated, &a.HasRectification)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListEvaluations 查询评价列表。
func (s *GraduationStore) ListEvaluations(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.GraduationProjectEvaluation]) ([]domain.GraduationProjectEvaluation, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanGraduationEvaluationRows)
}

// CreateEvaluation 创建评价。
func (s *GraduationStore) CreateEvaluation(ctx context.Context, p *GraduationEvaluationParams) (*domain.GraduationProjectEvaluation, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO graduation_project_evaluations (id, tenant_id, topic_id, user_id, advisor_score,
			enterprise_score, defense_score, comprehensive_grade, is_excellent, status, evaluated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
		RETURNING id
	`, p.TenantID, p.TopicID, p.UserID, p.AdvisorScore, p.EnterpriseScore, p.DefenseScore, p.ComprehensiveGrade, p.IsExcellent).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetEvaluation(ctx, id)
}

// GetEvaluation 查询单个评价。
func (s *GraduationStore) GetEvaluation(ctx context.Context, id string) (*domain.GraduationProjectEvaluation, error) {
	var e domain.GraduationProjectEvaluation
	var advisorScore, enterpriseScore, defenseScore *float64
	var comprehensiveGrade *string
	err := s.q.QueryRow(ctx, `
		SELECT id, topic_id, user_id, advisor_score, enterprise_score, defense_score,
			comprehensive_grade, is_excellent, status, evaluated_at
		FROM graduation_project_evaluations WHERE id = $1
	`, id).Scan(&e.ID, &e.TopicID, &e.UserID, &advisorScore, &enterpriseScore, &defenseScore,
		&comprehensiveGrade, &e.IsExcellent, &e.Status, &e.EvaluatedAt)
	if err != nil {
		return nil, err
	}
	e.AdvisorScore = advisorScore
	e.EnterpriseScore = enterpriseScore
	e.DefenseScore = defenseScore
	e.ComprehensiveGrade = comprehensiveGrade
	return &e, nil
}

// GraduationEvaluationParams 评价参数。
type GraduationEvaluationParams struct {
	TenantID           string
	TopicID            string
	UserID             string
	AdvisorScore       *float64
	EnterpriseScore    *float64
	DefenseScore       *float64
	ComprehensiveGrade *string
	IsExcellent        bool
}

// QueryGraduationResults 查询毕业结果（分页）。
func (s *GraduationStore) QueryGraduationResults(ctx context.Context, tenantID string, limit, offset int) ([]domain.GraduationQueryResult, int, error) {
	var total int
	_ = s.q.QueryRow(ctx, "SELECT COUNT(*) FROM graduation_query_results gr WHERE gr.tenant_id = $1", tenantID).Scan(&total)
	rows, err := s.q.Query(ctx, `
		SELECT gr.id, gr.user_id, gr.class_name, COALESCE(m.name, '') AS major_name, gr.credit_completed, gr.credit_required,
			gr.scene_passed, gr.scene_required, gr.project_grade, gr.graduation_status, gr.ability_cert_status, gr.rectification_count, gr.updated_at
		FROM graduation_query_results gr
		LEFT JOIN majors m ON m.id = gr.major_id
		WHERE gr.tenant_id = $1
		ORDER BY gr.updated_at DESC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]domain.GraduationQueryResult, 0)
	for rows.Next() {
		var q domain.GraduationQueryResult
		var className, majorName, projectGrade *string
		if err := rows.Scan(&q.ID, &q.UserID, &className, &majorName, &q.CreditCompleted, &q.CreditRequired,
			&q.ScenePassed, &q.SceneRequired, &projectGrade, &q.GraduationStatus, &q.AbilityCertStatus, &q.RectificationCount, &q.UpdatedAt); err != nil {
			return nil, 0, err
		}
		q.ClassName = className
		q.MajorName = majorName
		q.ProjectGrade = projectGrade
		items = append(items, q)
	}
	return items, total, rows.Err()
}

func (s *GraduationStore) fetchTopic(ctx context.Context, id string) (*domain.GraduationProjectTopic, error) {
	var t domain.GraduationProjectTopic
	var tenantID, college, advisorID, enterpriseMentorID, description *string
	var startDate, endDate *time.Time
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, career_position_id, college, source, status, capacity, applied_count,
			advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at
		FROM graduation_project_topics WHERE id = $1
	`, id).Scan(
		&t.ID, &tenantID, &t.Name, &t.CareerPositionID, &college, &t.Source, &t.Status, &t.Capacity, &t.AppliedCount,
		&advisorID, &enterpriseMentorID, &startDate, &endDate, &description, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.TenantID = tenantID
	t.College = college
	t.AdvisorID = advisorID
	t.EnterpriseMentorID = enterpriseMentorID
	if startDate != nil {
		s := startDate.Format("2006-01-02")
		t.StartDate = &s
	}
	if endDate != nil {
		s := endDate.Format("2006-01-02")
		t.EndDate = &s
	}
	t.Description = description
	return &t, nil
}

// ScanGraduationTopicRows 扫描课题行。
func ScanGraduationTopicRows(rows pgx.Rows) ([]domain.GraduationProjectTopic, error) {
	items := make([]domain.GraduationProjectTopic, 0)
	for rows.Next() {
		var t domain.GraduationProjectTopic
		var tenantID, college, advisorID, enterpriseMentorID, description *string
		var startDate, endDate *time.Time
		if err := rows.Scan(
			&t.ID, &tenantID, &t.Name, &t.CareerPositionID, &college, &t.Source, &t.Status, &t.Capacity, &t.AppliedCount,
			&advisorID, &enterpriseMentorID, &startDate, &endDate, &description, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		t.TenantID = tenantID
		t.College = college
		t.AdvisorID = advisorID
		t.EnterpriseMentorID = enterpriseMentorID
		if startDate != nil {
			s := startDate.Format("2006-01-02")
			t.StartDate = &s
		}
		if endDate != nil {
			s := endDate.Format("2006-01-02")
			t.EndDate = &s
		}
		t.Description = description
		items = append(items, t)
	}
	return items, nil
}

// ScanGraduationArchiveRows 扫描档案行。
func ScanGraduationArchiveRows(rows pgx.Rows) ([]domain.GraduationProjectArchive, error) {
	items := make([]domain.GraduationProjectArchive, 0)
	for rows.Next() {
		var a domain.GraduationProjectArchive
		if err := rows.Scan(&a.ID, &a.TopicID, &a.UserID,
			&a.Phase, &a.DocStatus, &a.DocCount, &a.LastUpdated, &a.HasRectification); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, nil
}

// ScanGraduationEvaluationRows 扫描评价行。
func ScanGraduationEvaluationRows(rows pgx.Rows) ([]domain.GraduationProjectEvaluation, error) {
	items := make([]domain.GraduationProjectEvaluation, 0)
	for rows.Next() {
		var e domain.GraduationProjectEvaluation
		var advisorScore, enterpriseScore, defenseScore *float64
		var comprehensiveGrade *string
		if err := rows.Scan(&e.ID, &e.TopicID, &e.UserID, &advisorScore, &enterpriseScore, &defenseScore,
			&comprehensiveGrade, &e.IsExcellent, &e.Status, &e.EvaluatedAt); err != nil {
			return nil, err
		}
		e.AdvisorScore = advisorScore
		e.EnterpriseScore = enterpriseScore
		e.DefenseScore = defenseScore
		e.ComprehensiveGrade = comprehensiveGrade
		items = append(items, e)
	}
	return items, nil
}
