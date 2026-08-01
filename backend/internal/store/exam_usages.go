package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

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

// Get 查询单个考试安排。
func (s *ExamUsageStore) Get(ctx context.Context, id string) (*domain.ExamUsage, error) {
	u, err := s.fetchExamUsage(ctx, id)
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
	return items, nil
}
