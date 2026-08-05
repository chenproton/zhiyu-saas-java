package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// manualExamUsageTargetTypesSQL 手动创建（"创建考试使用"按钮）的考试安排目标类型。
// 场景任务测评(task)/课程节点测评(node)/历史课程级(course) 自动生成的临时考试不在此列，
// 不会出现在考试管理与学生工作台（工作台首页、测评认证）等公开列表中。
const manualExamUsageTargetTypesSQL = "'class', 'major', 'department', 'public'"

// ExamUsageStore 考试安排持久化。
type ExamUsageStore struct {
	q Queryer
}

// NewExamUsageStore 创建考试安排 store。
func NewExamUsageStore(q Queryer) *ExamUsageStore {
	return &ExamUsageStore{q: q}
}

// List 查询考试安排列表。
func (s *ExamUsageStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ExamUsage]) ([]domain.ExamUsage, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanExamUsageRows)
}

// ListConfig 返回考试安排列表查询配置，SQL 片段沉淀在 store 层。
func (s *ExamUsageStore) ListConfig() ListQueryConfig[domain.ExamUsage] {
	return ListQueryConfig[domain.ExamUsage]{
		Table:         "exam_usages",
		SelectColumns: "id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ScanRows:      ScanExamUsageRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			qb.AddCondition("target_type IN (" + manualExamUsageTargetTypesSQL + ")")
			if examID := p.Values["examId"]; examID != "" {
				qb.AddCondition("exam_id = " + qb.NextArg(examID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
}

// Get 查询单个考试安排。
func (s *ExamUsageStore) Get(ctx context.Context, id string) (*domain.ExamUsage, error) {
	u, err := s.fetchExamUsage(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// Create 创建考试安排。
func (s *ExamUsageStore) Create(ctx context.Context, p *ExamUsageCreateParams) (*domain.ExamUsage, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
		RETURNING id
	`, p.TenantID, p.ExamID, p.Name, p.Description, p.StartTime, p.EndTime, p.Duration, p.TargetType, p.TargetIDs, p.CreatorID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新考试安排。
func (s *ExamUsageStore) Update(ctx context.Context, id string, p *ExamUsageCreateParams) (*domain.ExamUsage, error) {
	if _, err := s.fetchExamUsage(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE exam_usages SET name = $1, description = $2, start_time = $3, end_time = $4,
			duration = $5, target_type = $6, target_ids = $7, updated_at = NOW()
		WHERE id = $8
	`, p.Name, p.Description, p.StartTime, p.EndTime, p.Duration, p.TargetType, p.TargetIDs, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除考试安排。
func (s *ExamUsageStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM exam_usages WHERE id = $1`, id)
	return err
}

// SetStatus 更新考试安排状态。
func (s *ExamUsageStore) SetStatus(ctx context.Context, id, status string) error {
	_, err := s.q.Exec(ctx, `UPDATE exam_usages SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	return err
}

// ExamCenterItemRow 考试中心查询行。
type ExamCenterItemRow struct {
	ID            string
	ExamID        string
	UsageName     string
	ExamName      string
	Description   string
	StartTime     *string
	EndTime       *string
	Duration      *int
	Status        string
	QuestionCount int
	TotalScore    float64
	ClassMatch    bool
	Submitted     bool
	Score         *float64
}

// ListExamCenter 考试中心列表：租户内所有手动考试安排（published/in_progress/finished），
// 附带当前用户的班级命中（target_type=class 且班级在 target_ids）、交卷状态与得分。
func (s *ExamUsageStore) ListExamCenter(ctx context.Context, tenantID, userID string, classNodeID string) ([]ExamCenterItemRow, error) {
	query := `
		SELECT eu.id::text, eu.exam_id::text, eu.name, COALESCE(e.name, ''), COALESCE(e.description, ''),
			eu.start_time, eu.end_time, eu.duration, eu.status,
			(SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = eu.exam_id),
			COALESCE(e.total_score, 0),
			COALESCE(eu.target_type <> 'class' OR $2::uuid = ANY(eu.target_ids), false),
			(er.id IS NOT NULL), er.score
		FROM exam_usages eu
		JOIN exams e ON e.id = eu.exam_id
		LEFT JOIN exam_results er ON er.exam_usage_id = eu.id AND er.user_id = $1::uuid
		WHERE eu.status IN ('published', 'in_progress', 'finished')
		  AND eu.target_type IN (` + manualExamUsageTargetTypesSQL + `)
		  AND eu.tenant_id = $3::uuid
		ORDER BY eu.start_time ASC NULLS LAST
		LIMIT 100`
	args := []any{userID, nil, tenantID}
	if classNodeID != "" {
		args[1] = classNodeID
	}
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ExamCenterItemRow
	for rows.Next() {
		var r ExamCenterItemRow
		var startTime, endTime *time.Time
		if err := rows.Scan(&r.ID, &r.ExamID, &r.UsageName, &r.ExamName, &r.Description,
			&startTime, &endTime, &r.Duration, &r.Status, &r.QuestionCount, &r.TotalScore,
			&r.ClassMatch, &r.Submitted, &r.Score); err != nil {
			continue
		}
		if startTime != nil {
			ts := startTime.Format(time.RFC3339)
			r.StartTime = &ts
		}
		if endTime != nil {
			te := endTime.Format(time.RFC3339)
			r.EndTime = &te
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// ExamUsageCreateParams 创建/更新考试安排参数。
type ExamUsageCreateParams struct {
	TenantID    string
	ExamID      string
	Name        string
	Description *string
	StartTime   *string
	EndTime     *string
	Duration    *int
	TargetType  *string
	TargetIDs   []string
	CreatorID   string
}

func (s *ExamUsageStore) fetchExamUsage(ctx context.Context, id string) (*domain.ExamUsage, error) {
	var u domain.ExamUsage
	var description, targetType *string
	var startTime, endTime *time.Time
	var duration *int
	var creatorID *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id, created_at, updated_at
		FROM exam_usages WHERE id = $1
	`, id).Scan(
		&u.ID, &u.TenantID, &u.ExamID, &u.Name, &description, &startTime, &endTime, &duration, &targetType, &u.TargetIDs, &u.Status, &creatorID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	u.Description = description
	if startTime != nil {
		s := startTime.Format(time.RFC3339)
		u.StartTime = &s
	}
	if endTime != nil {
		s := endTime.Format(time.RFC3339)
		u.EndTime = &s
	}
	u.Duration = duration
	u.TargetType = targetType
	u.CreatorID = creatorID
	return &u, nil
}

// ScanExamUsageRows 扫描考试安排行。
func ScanExamUsageRows(rows pgx.Rows) ([]domain.ExamUsage, error) {
	items := make([]domain.ExamUsage, 0)
	for rows.Next() {
		var u domain.ExamUsage
		var description, targetType *string
		var startTime, endTime *time.Time
		var duration *int
		var creatorID *string
		if err := rows.Scan(
			&u.ID, &u.TenantID, &u.ExamID, &u.Name, &description, &startTime, &endTime, &duration, &targetType, &u.TargetIDs, &u.Status, &creatorID, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		u.Description = description
		if startTime != nil {
			s := startTime.Format(time.RFC3339)
			u.StartTime = &s
		}
		if endTime != nil {
			s := endTime.Format(time.RFC3339)
			u.EndTime = &s
		}
		u.Duration = duration
		u.TargetType = targetType
		u.CreatorID = creatorID
		items = append(items, u)
	}
	return items, rows.Err()
}
