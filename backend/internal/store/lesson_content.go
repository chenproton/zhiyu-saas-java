package store

import (
	"context"
	"errors"
	"fmt"
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

// CitationStats 知识点引用次数分布（引用源：课程/颗粒课、节点、题库、试题）。
func (s *KnowledgePointStore) CitationStats(ctx context.Context, tenantID string) (CitationStats, error) {
	rows, err := s.q.Query(ctx, `
		SELECT `+citationBucketCase+`, COUNT(*) AS cnt
		FROM (
			SELECT kp.id,
				COALESCE((SELECT COUNT(*) FROM courses c WHERE kp.id = ANY(c.knowledge_point_ids)), 0)
				+ COALESCE((SELECT COUNT(*) FROM node_knowledge_point_bindings nb WHERE nb.knowledge_point_id = kp.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM question_bank_knowledge_points qb WHERE qb.knowledge_point_id = kp.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM questions q WHERE kp.id = ANY(q.knowledge_point_ids)), 0) AS ref_count
			FROM knowledge_points kp
			WHERE kp.tenant_id = $1
		) refs
		GROUP BY bucket
	`, tenantID)
	if err != nil {
		return CitationStats{}, err
	}
	defer rows.Close()
	return scanCitationStats(rows)
}

// ListUncited 零引用知识点列表（弹窗：上传时段筛选 + 分页）。
func (s *KnowledgePointStore) ListUncited(ctx context.Context, tenantID string, from, to *time.Time, limit, offset int) ([]UncitedItem, int, error) {
	where := "kp.tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2
	if from != nil {
		where += " AND kp.created_at >= $" + Itoa(argIdx)
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		where += " AND kp.created_at < $" + Itoa(argIdx)
		args = append(args, *to)
		argIdx++
	}
	uncited := `
		AND NOT EXISTS (SELECT 1 FROM courses c WHERE kp.id = ANY(c.knowledge_point_ids))
		AND NOT EXISTS (SELECT 1 FROM node_knowledge_point_bindings nb WHERE nb.knowledge_point_id = kp.id)
		AND NOT EXISTS (SELECT 1 FROM question_bank_knowledge_points qb WHERE qb.knowledge_point_id = kp.id)
		AND NOT EXISTS (SELECT 1 FROM questions q WHERE kp.id = ANY(q.knowledge_point_ids))`

	var total int
	if err := s.q.QueryRow(ctx, "SELECT COUNT(*) FROM knowledge_points kp WHERE "+where+uncited, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	rows, err := s.q.Query(ctx, `
		SELECT kp.id, kp.name, kp.created_at
		FROM knowledge_points kp
		WHERE `+where+uncited+`
		ORDER BY kp.created_at DESC
		LIMIT $`+Itoa(argIdx)+` OFFSET $`+Itoa(argIdx+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]UncitedItem, 0, limit)
	for rows.Next() {
		var it UncitedItem
		if err := rows.Scan(&it.ID, &it.Name, &it.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}

// ListConfig 返回知识点列表查询配置，SQL 片段沉淀在 store 层。
func (s *KnowledgePointStore) ListConfig() ListQueryConfig[domain.KnowledgePoint] {
	return ListQueryConfig[domain.KnowledgePoint]{
		Table:         "knowledge_points",
		SelectColumns: "id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, source_type, source_id, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if linkedStr := p.Values["linked"]; linkedStr != "" {
				qb.AddCondition("linked = " + qb.NextArg(linkedStr == "true"))
			}
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
			AddTagFilter(qb, p.TenantID, domain.TagResourceTypeKnowledgePoint, "knowledge_points.id", SplitTagIDs(p.Values["tagIds"]))
		},
	}
}

// Get 查询单个知识点。
func (s *KnowledgePointStore) Get(ctx context.Context, id, tenantID string) (*domain.KnowledgePoint, error) {
	kp, err := s.fetchKP(ctx, id, tenantID)
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
	if err := SyncCourseKnowledgePoints(ctx, tx, tenantID, id, jsonSliceToStringSlice(granularIDs)); err != nil {
		return nil, err
	}
	return s.fetchKPWith(ctx, tx, id, tenantID)
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
		WHERE id = $6 AND tenant_id = $7
	`, p.Name, p.Code, p.Description, p.Linked, granularIDs, id, tenantID); err != nil {
		return nil, err
	}
	if err := SyncCourseKnowledgePoints(ctx, tx, tenantID, id, jsonSliceToStringSlice(granularIDs)); err != nil {
		return nil, err
	}
	return s.fetchKPWith(ctx, tx, id, tenantID)
}

// Delete 删除知识点。
func (s *KnowledgePointStore) Delete(ctx context.Context, id, tenantID string) error {
	if err := DeleteResourceTags(ctx, s.q, domain.TagResourceTypeKnowledgePoint, id); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `DELETE FROM knowledge_points WHERE id = $1 AND tenant_id = $2`, id, tenantID)
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

func (s *KnowledgePointStore) fetchKP(ctx context.Context, id, tenantID string) (*domain.KnowledgePoint, error) {
	return s.fetchKPWith(ctx, s.q, id, tenantID)
}

// fetchKPWith 用指定 Queryer（事务内用 tx，保证读到未提交行）查询知识点。
func (s *KnowledgePointStore) fetchKPWith(ctx context.Context, q Queryer, id, tenantID string) (*domain.KnowledgePoint, error) {
	var kp domain.KnowledgePoint
	err := q.QueryRow(ctx, `
		SELECT id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, source_type, source_id, created_at, updated_at
		FROM knowledge_points WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(
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
	return items, rows.Err()
}

// SyncCourseKnowledgePoints 维护颗粒课对知识点的双向引用。
func SyncCourseKnowledgePoints(ctx context.Context, q Queryer, tenantID, knowledgePointID string, courseIDs []string) error {
	if tenantID == "" {
		return nil
	}
	if _, err := q.Exec(ctx, `
		UPDATE courses
		SET knowledge_point_ids = array_append(knowledge_point_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND id = ANY($3::uuid[]) AND NOT $1 = ANY(knowledge_point_ids)
	`, knowledgePointID, tenantID, courseIDs); err != nil {
		return fmt.Errorf("append kp to courses: %w", err)
	}
	if _, err := q.Exec(ctx, `
		UPDATE courses
		SET knowledge_point_ids = array_remove(knowledge_point_ids, $1),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND ($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))
		  AND $1 = ANY(knowledge_point_ids)
	`, knowledgePointID, tenantID, courseIDs); err != nil {
		return fmt.Errorf("remove kp from courses: %w", err)
	}
	return nil
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

// ListConfig 返回作业列表查询配置，SQL 片段沉淀在 store 层。
func (s *NodeHomeworkStore) ListConfig() ListQueryConfig[domain.NodeHomework] {
	return ListQueryConfig[domain.NodeHomework]{
		Table:         "node_homeworks",
		SelectColumns: "id, node_id, title, requirement, need_attachment, deadline",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		NoPagination:  true,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if p.Values["nodeId"] != "" {
				qb.AddCondition("node_id = " + qb.NextArg(p.Values["nodeId"]))
			}
		},
	}
}

// Get 查询单个作业。
func (s *NodeHomeworkStore) Get(ctx context.Context, id, tenantID string) (*domain.NodeHomework, error) {
	hw, err := s.fetchHW(ctx, id, tenantID)
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
	return s.fetchHW(ctx, id, tenantID)
}

// Update 更新作业。
func (s *NodeHomeworkStore) Update(ctx context.Context, id, tenantID string, p *NodeHomeworkUpdateParams) (*domain.NodeHomework, error) {
	if _, err := s.fetchHW(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE node_homeworks SET title = $1, requirement = $2, need_attachment = $3, deadline = $4
		WHERE id = $5 AND tenant_id = $6
	`, p.Title, p.Requirement, p.NeedAttachment, p.Deadline, id, tenantID); err != nil {
		return nil, err
	}
	return s.fetchHW(ctx, id, tenantID)
}

// Delete 删除作业。
func (s *NodeHomeworkStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM node_homeworks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
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

func (s *NodeHomeworkStore) fetchHW(ctx context.Context, id, tenantID string) (*domain.NodeHomework, error) {
	var hw domain.NodeHomework
	err := s.q.QueryRow(ctx, `
		SELECT id, node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&hw.ID, &hw.NodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline)
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
	return items, rows.Err()
}
