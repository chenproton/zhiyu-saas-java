package store

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// LandingStore 落地页持久化。
type LandingStore struct {
	q Queryer
}

// NewLandingStore 创建落地页 store。
func NewLandingStore(q Queryer) *LandingStore {
	return &LandingStore{q: q}
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
