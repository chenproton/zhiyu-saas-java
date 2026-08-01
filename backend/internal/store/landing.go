package store

import (
	"context"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// LandingExam 落地考试（聚合 org/college）。
type LandingExam struct {
	ID            string
	Name          string
	Description   string
	Duration      int
	QuestionCount int
	StartTime     *time.Time
	EndTime       *time.Time
	OrgName       string
	CollegeName   string
}

// LandingStore 落地页持久化。
type LandingStore struct {
	q Queryer
}

// NewLandingStore 创建落地页 store。
func NewLandingStore(q Queryer) *LandingStore {
	return &LandingStore{q: q}
}

// ListExams 查询落地考试列表。
func (s *LandingStore) ListExams(ctx context.Context, tenantID string) ([]LandingExam, error) {
	rows, err := s.q.Query(ctx, `
		SELECT e.id, e.name, COALESCE(e.description, ''), e.duration,
			COALESCE((SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id), 0),
			eu.start_time, eu.end_time,
			COALESCE(org.name, ''),
			COALESCE(parent_org.name, '')
		FROM exams e
		JOIN exam_usages eu ON eu.exam_id = e.id
		LEFT JOIN LATERAL (
			SELECT o.id, o.name, o.parent_id
			FROM organizations o
			WHERE o.id = ANY(eu.target_ids)
			LIMIT 1
		) org ON TRUE
		LEFT JOIN organizations parent_org ON parent_org.id = org.parent_id
		WHERE e.status = 'published' AND e.is_temp = FALSE AND e.tenant_id = $1
		ORDER BY eu.start_time ASC NULLS LAST
		LIMIT 100
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []LandingExam
	for rows.Next() {
		var item LandingExam
		if err := rows.Scan(&item.ID, &item.Name, &item.Description, &item.Duration,
			&item.QuestionCount, &item.StartTime, &item.EndTime, &item.OrgName, &item.CollegeName); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

var _ = domain.JSONMap{}
