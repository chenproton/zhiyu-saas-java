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

// ListTargetPositions 查询学生目标岗位。
// 目标岗位唯一来源：人培方案（专业×岗位）。链路为
// 学生班级节点 → 组织树向上找「专业」节点 → 名称匹配 majors → 该专业已发布方案 → 方案岗位课程 → 已发布岗位。
func (s *LandingStore) ListTargetPositions(ctx context.Context, tenantID, userID string) ([]domain.CareerPosition, error) {
	rows, err := s.q.Query(ctx, `
		WITH RECURSIVE up_tree AS (
			SELECT o.id, o.type_id, o.parent_id
			FROM organizations o
			WHERE o.id = (SELECT org_node_id FROM users WHERE id = $2)
			UNION ALL
			SELECT o.id, o.type_id, o.parent_id
			FROM organizations o
			JOIN up_tree ut ON o.id = ut.parent_id
		)
		SELECT DISTINCT `+positionSelectColumns+`
		FROM `+positionListFrom+`
		JOIN training_program_courses pc ON pc.position_id = cp.id
		JOIN training_programs tp ON tp.id = pc.program_id AND tp.status = 'published'
		JOIN majors m ON m.id = tp.major_id AND m.tenant_id = $1
		JOIN organizations maj_org ON maj_org.tenant_id = $1 AND maj_org.name = m.name
		JOIN org_types mt ON mt.id = maj_org.type_id AND mt.name = '专业'
		JOIN up_tree ut ON ut.id = maj_org.id
		WHERE cp.tenant_id = $1 AND cp.status = 'published'
		ORDER BY cp.created_at DESC
	`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return ScanPositionRows(rows)
}
