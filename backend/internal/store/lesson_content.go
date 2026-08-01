package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// KnowledgePointStore 知识点持久化（含颗粒课双向引用同步）。
type KnowledgePointStore struct {
	q Queryer
}

// NewKnowledgePointStore 创建知识点 store。
func NewKnowledgePointStore(q Queryer) *KnowledgePointStore {
	return &KnowledgePointStore{q: q}
}

// List 查询知识点列表。
func (s *KnowledgePointStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.KnowledgePoint]) ([]domain.KnowledgePoint, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanKnowledgePointRows)
}

// Get 查询单个知识点。
func (s *KnowledgePointStore) Get(ctx context.Context, id string) (*domain.KnowledgePoint, error) {
	kp, err := s.fetchKP(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return kp, nil
}

// Create 在事务内创建知识点并同步颗粒课引用。
func (s *KnowledgePointStore) Create(ctx context.Context, tx Queryer, tenantID string, p *KnowledgePointCreateParams) (*domain.KnowledgePoint, error) {
	id := uuid.NewString()
	granularIDs := p.GranularLessonIds
	if granularIDs == nil {
		granularIDs = domain.JSONSlice{}
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO knowledge_points (id, tenant_id, name, code, description, linked, granular_lesson_ids, creator_id, source_type, source_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, id, tenantID, p.Name, p.Code, p.Description, p.Linked, granularIDs, p.CreatorID, p.SourceType, p.SourceID); err != nil {
		return nil, err
	}
	SyncCourseKnowledgePoints(ctx, tx, tenantID, id, jsonSliceToStringSlice(granularIDs))
	return s.fetchKP(ctx, id)
}

// Update 在事务内更新知识点并同步颗粒课引用。
func (s *KnowledgePointStore) Update(ctx context.Context, tx Queryer, tenantID, id string, p *KnowledgePointUpdateParams) (*domain.KnowledgePoint, error) {
	granularIDs := p.GranularLessonIds
	if granularIDs == nil {
		granularIDs = domain.JSONSlice{}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE knowledge_points SET name = $1, code = $2, description = $3, linked = $4,
			granular_lesson_ids = $5, updated_at = NOW()
		WHERE id = $6
	`, p.Name, p.Code, p.Description, p.Linked, granularIDs, id); err != nil {
		return nil, err
	}
	SyncCourseKnowledgePoints(ctx, tx, tenantID, id, jsonSliceToStringSlice(granularIDs))
	return s.fetchKP(ctx, id)
}

// Delete 删除知识点。
func (s *KnowledgePointStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM knowledge_points WHERE id = $1`, id)
	return err
}

// KnowledgePointCreateParams 创建知识点参数。
type KnowledgePointCreateParams struct {
	Name              string
	Code              *string
	Description       *string
	Linked            bool
	GranularLessonIds domain.JSONSlice
	CreatorID         string
	SourceType        *string
	SourceID          *string
}

// KnowledgePointUpdateParams 更新知识点参数。
type KnowledgePointUpdateParams struct {
	Name              string
	Code              *string
	Description       *string
	Linked            bool
	GranularLessonIds domain.JSONSlice
}

func (s *KnowledgePointStore) fetchKP(ctx context.Context, id string) (*domain.KnowledgePoint, error) {
	var kp domain.KnowledgePoint
	err := s.q.QueryRow(ctx, `
		SELECT id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, source_type, source_id, created_at, updated_at
		FROM knowledge_points WHERE id = $1
	`, id).Scan(
		&kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked, &kp.GranularLessonIds,
		&kp.CreatorID, &kp.SourceType, &kp.SourceID, &kp.CreatedAt, &kp.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &kp, nil
}

func scanKnowledgePointRows(rows pgx.Rows) ([]domain.KnowledgePoint, error) {
	items := make([]domain.KnowledgePoint, 0)
	for rows.Next() {
		var kp domain.KnowledgePoint
		if err := rows.Scan(
			&kp.ID, &kp.Name, &kp.Code, &kp.Description, &kp.Linked, &kp.GranularLessonIds,
			&kp.CreatorID, &kp.SourceType, &kp.SourceID, &kp.CreatedAt, &kp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, kp)
	}
	return items, nil
}

// SyncCourseKnowledgePoints 维护颗粒课对知识点的双向引用。
func SyncCourseKnowledgePoints(ctx context.Context, q Queryer, tenantID, knowledgePointID string, courseIDs []string) {
	if tenantID == "" {
		return
	}
	_, _ = q.Exec(ctx, `
		UPDATE courses
		SET knowledge_point_ids = array_append(knowledge_point_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND id = ANY($3::uuid[]) AND NOT $1 = ANY(knowledge_point_ids)
	`, knowledgePointID, tenantID, courseIDs)
	_, _ = q.Exec(ctx, `
		UPDATE courses
		SET knowledge_point_ids = array_remove(knowledge_point_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND ($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))
		  AND $1 = ANY(knowledge_point_ids)
	`, knowledgePointID, tenantID, courseIDs)
}

func jsonSliceToStringSlice(ids domain.JSONSlice) []string {
	out := make([]string, 0, len(ids))
	for _, v := range ids {
		s, ok := v.(string)
		if !ok || s == "" {
			continue
		}
		out = append(out, s)
	}
	return out
}

// NodeHomeworkStore 节点作业持久化。
type NodeHomeworkStore struct {
	q Queryer
}

// NewNodeHomeworkStore 创建作业 store。
func NewNodeHomeworkStore(q Queryer) *NodeHomeworkStore {
	return &NodeHomeworkStore{q: q}
}

// List 查询作业列表。
func (s *NodeHomeworkStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.NodeHomework]) ([]domain.NodeHomework, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanNodeHomeworkRows)
}

// Get 查询单个作业。
func (s *NodeHomeworkStore) Get(ctx context.Context, id string) (*domain.NodeHomework, error) {
	hw, err := s.fetchHW(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return hw, nil
}

// Create 创建作业。
func (s *NodeHomeworkStore) Create(ctx context.Context, tenantID string, p *NodeHomeworkCreateParams) (*domain.NodeHomework, error) {
	id := uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment, deadline)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, p.NodeID, p.Title, p.Requirement, p.NeedAttachment, p.Deadline); err != nil {
		return nil, err
	}
	return s.fetchHW(ctx, id)
}

// Update 更新作业。
func (s *NodeHomeworkStore) Update(ctx context.Context, id string, p *NodeHomeworkUpdateParams) (*domain.NodeHomework, error) {
	if _, err := s.fetchHW(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE node_homeworks SET title = $1, requirement = $2, need_attachment = $3, deadline = $4
		WHERE id = $5
	`, p.Title, p.Requirement, p.NeedAttachment, p.Deadline, id); err != nil {
		return nil, err
	}
	return s.fetchHW(ctx, id)
}

// Delete 删除作业。
func (s *NodeHomeworkStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM node_homeworks WHERE id = $1`, id)
	return err
}

// NodeHomeworkCreateParams 创建作业参数。
type NodeHomeworkCreateParams struct {
	NodeID         string
	Title          string
	Requirement    *string
	NeedAttachment bool
	Deadline       *time.Time
}

// NodeHomeworkUpdateParams 更新作业参数。
type NodeHomeworkUpdateParams struct {
	Title          string
	Requirement    *string
	NeedAttachment bool
	Deadline       *time.Time
}

func (s *NodeHomeworkStore) fetchHW(ctx context.Context, id string) (*domain.NodeHomework, error) {
	var hw domain.NodeHomework
	err := s.q.QueryRow(ctx, `
		SELECT id, node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks WHERE id = $1
	`, id).Scan(&hw.ID, &hw.NodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline)
	if err != nil {
		return nil, err
	}
	return &hw, nil
}

func scanNodeHomeworkRows(rows pgx.Rows) ([]domain.NodeHomework, error) {
	items := make([]domain.NodeHomework, 0)
	for rows.Next() {
		var hw domain.NodeHomework
		if err := rows.Scan(&hw.ID, &hw.NodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline); err != nil {
			return nil, err
		}
		items = append(items, hw)
	}
	return items, nil
}
