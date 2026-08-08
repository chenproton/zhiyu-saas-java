package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// QuestionBankStore 题库持久化。
type QuestionBankStore struct {
	q        Queryer
	beginner txBeginner
}

const questionBankListFrom = "question_banks qb"
const questionBankListJoins = " LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM questions q WHERE q.bank_id = qb.id) qcnt ON true LEFT JOIN users cr_u ON cr_u.id = qb.creator_id LEFT JOIN LATERAL (SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') AS ids FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) kparr ON true"
const questionBankListSelectColumns = "qb.id, qb.code, qb.name, qb.description, qb.cover_image, qb.status, COALESCE(qcnt.cnt, 0) AS question_count, qb.creator_id, COALESCE(cr_u.name, qb.creator_id::text) AS creator_name, qb.collaborator_ids, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool, COALESCE(kparr.ids, '{}') AS knowledge_point_ids, qb.created_at, qb.updated_at"

// ListConfig 返回题库列表查询配置，SQL 片段沉淀在 store 层。
func (s *QuestionBankStore) ListConfig() ListQueryConfig[domain.QuestionBank] {
	return ListQueryConfig[domain.QuestionBank]{
		CountTable:    questionBankListFrom,
		Table:         questionBankListFrom + questionBankListJoins,
		SelectColumns: questionBankListSelectColumns,
		TenantScoped:  true,
		TenantColumn:  "qb.tenant_id",
		SearchColumns: []string{"qb.name", "qb.description"},
		OrderBy:       "qb.is_draft_pool DESC, qb.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      ScanQuestionBankRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("qb.status = " + qb.NextArg(status))
			}
		},
	}
}

// NewQuestionBankStore 创建题库 store。
func NewQuestionBankStore(q Queryer) *QuestionBankStore {
	b, _ := q.(txBeginner)
	return &QuestionBankStore{q: q, beginner: b}
}

// List 查询题库列表。
func (s *QuestionBankStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.QuestionBank]) ([]domain.QuestionBank, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanQuestionBankRows)
}

// Get 查询单个题库。
func (s *QuestionBankStore) Get(ctx context.Context, id string) (*domain.QuestionBank, error) {
	b, err := s.fetchBank(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

// GetScoped 查询单个题库（限定租户）。
func (s *QuestionBankStore) GetScoped(ctx context.Context, id, tenantID string) (*domain.QuestionBank, error) {
	b, err := s.fetchBankScoped(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

// IsDraftPool 查询是否草稿池。
func (s *QuestionBankStore) IsDraftPool(ctx context.Context, id string) (bool, error) {
	var isDraftPool bool
	err := s.q.QueryRow(ctx, `SELECT is_draft_pool FROM question_banks WHERE id = $1`, id).Scan(&isDraftPool)
	return isDraftPool, err
}

// Create 创建题库。
func (s *QuestionBankStore) Create(ctx context.Context, tenantID string, p *QuestionBankCreateParams) (*domain.QuestionBank, error) {
	var id string
	err := withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			INSERT INTO question_banks (id, tenant_id, code, name, description, cover_image, status, question_count, creator_id,
				collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, is_draft_pool)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'draft', 0, $6, $7, $8, $9, 'v1.0', 'mine', FALSE)
			RETURNING id
		`, tenantID, p.Code, p.Name, p.Description, p.CoverImage, p.CreatorID,
			p.CollaboratorIDs, p.CollaboratorDeptIDs, p.BatchID).Scan(&id)
		if err != nil {
			return err
		}
		for _, kpID := range p.KnowledgePointIDs {
			if kpID == "" {
				continue
			}
			if _, err := tx.Exec(ctx, `
					INSERT INTO question_bank_knowledge_points (id, question_bank_id, knowledge_point_id)
					VALUES (gen_random_uuid(), $1, $2)
					ON CONFLICT (question_bank_id, knowledge_point_id) DO NOTHING
				`, id, kpID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新题库（保留原列语义：不含 version/owner_type，限定租户）。
func (s *QuestionBankStore) Update(ctx context.Context, id, tenantID string, p *QuestionBankUpdateParams) (*domain.QuestionBank, error) {
	if _, err := s.fetchBankScoped(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if s.beginner == nil {
		return nil, errors.New("question bank store: queryer does not support transactions")
	}
	err := withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			UPDATE question_banks SET name = $1, description = $2, cover_image = $3,
				collaborator_ids = $4, collaborator_dept_ids = $5, batch_id = $6, updated_at = NOW()
			WHERE id = $7 AND tenant_id = $8
		`, p.Name, p.Description, p.CoverImage, p.CollaboratorIDs, p.CollaboratorDeptIDs, p.BatchID, id, tenantID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM question_bank_knowledge_points WHERE question_bank_id = $1`, id); err != nil {
			return err
		}
		for _, kpID := range p.KnowledgePointIDs {
			if kpID == "" {
				continue
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO question_bank_knowledge_points (id, question_bank_id, knowledge_point_id)
				VALUES (gen_random_uuid(), $1, $2)
				ON CONFLICT (question_bank_id, knowledge_point_id) DO NOTHING
			`, id, kpID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除题库（连带题目与知识点绑定，限定租户；事务内执行防孤儿数据）。
func (s *QuestionBankStore) Delete(ctx context.Context, id, tenantID string) error {
	if _, err := s.fetchBankScoped(ctx, id, tenantID); err != nil {
		return err
	}
	if s.beginner == nil {
		return errors.New("question bank store: queryer does not support transactions")
	}
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM question_bank_knowledge_points WHERE question_bank_id = $1`, id); err != nil {
			return fmt.Errorf("delete bank knowledge points: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM questions WHERE bank_id = $1`, id); err != nil {
			return fmt.Errorf("delete bank questions: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM question_banks WHERE id = $1 AND tenant_id = $2`, id, tenantID); err != nil {
			return err
		}
		return nil
	})
}

// EnsureDraftPool 为用户创建默认草稿池（不存在时）。
func (s *QuestionBankStore) EnsureDraftPool(ctx context.Context, tenantID, userID string) error {
	var count int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM question_banks WHERE tenant_id = $1 AND creator_id = $2 AND is_draft_pool = true`,
		tenantID, userID,
	).Scan(&count)
	if err != nil {
		return fmt.Errorf("check draft pool: %w", err)
	}
	if count > 0 {
		return nil
	}
	code, err := GenerateUniqueEntityCode(ctx, s.q, "TK", "question_banks", tenantID)
	if err != nil {
		code = GenerateEntityCode("TK")
	}
	_, err = s.q.Exec(ctx, `
		INSERT INTO question_banks (id, tenant_id, code, name, description, status, question_count, creator_id,
			collaborator_ids, collaborator_dept_ids, version, owner_type, is_draft_pool)
		VALUES (gen_random_uuid(), $1, $2, '我的草稿库', '', 'draft', 0, $3, '{}', '{}', 'v1.0', 'mine', true)
	`, tenantID, code, userID)
	return err
}

// QuestionBankCreateParams 创建题库参数。
type QuestionBankCreateParams struct {
	Code                string
	Name                string
	Description         *string
	CoverImage          *string
	CreatorID           string
	CollaboratorIDs     []string
	CollaboratorDeptIDs []string
	BatchID             *string
	KnowledgePointIDs   []string
}

// QuestionBankUpdateParams 更新题库参数。
type QuestionBankUpdateParams struct {
	TenantID            string
	Name                string
	Description         *string
	CoverImage          *string
	CollaboratorIDs     []string
	CollaboratorDeptIDs []string
	BatchID             *string
	KnowledgePointIDs   []string
}

func (s *QuestionBankStore) fetchBank(ctx context.Context, id string) (*domain.QuestionBank, error) {
	var version *string

	var desc *string

	var b domain.QuestionBank
	var coverImage, creatorID, batchID *string
	err := s.q.QueryRow(ctx, `
		SELECT qb.id, qb.code, qb.name, qb.description, qb.cover_image, qb.status,
                (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) AS question_count,
                qb.creator_id,
			COALESCE((SELECT u.name FROM users u WHERE u.id = qb.creator_id), qb.creator_id::text) AS creator_name,
			qb.collaborator_ids,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool,
			(SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) AS knowledge_point_ids,
			qb.created_at, qb.updated_at
		FROM question_banks qb WHERE qb.id = $1
	`, id).Scan(
		&b.ID, &b.Code, &b.Name, &desc, &coverImage, &b.Status, &b.QuestionCount, &creatorID,
		&b.CreatorName, &b.CollaboratorIDs, &b.CollaboratorNames,
		&b.CollaboratorDeptIDs, &batchID, &version, &b.OwnerType, &b.IsDraftPool,
		&b.KnowledgePointIDs, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	b.CoverImage = coverImage
	b.Description = desc
	b.Version = version
	b.CreatorID = creatorID
	b.BatchID = batchID
	return &b, nil
}

// fetchBankScoped 查询单个题库（限定租户）。
func (s *QuestionBankStore) fetchBankScoped(ctx context.Context, id, tenantID string) (*domain.QuestionBank, error) {
	var version *string

	var desc *string

	var b domain.QuestionBank
	var coverImage, creatorID, batchID *string
	err := s.q.QueryRow(ctx, `
		SELECT qb.id, qb.code, qb.name, qb.description, qb.cover_image, qb.status,
                (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) AS question_count,
                qb.creator_id,
			COALESCE((SELECT u.name FROM users u WHERE u.id = qb.creator_id), qb.creator_id::text) AS creator_name,
			qb.collaborator_ids,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool,
			(SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) AS knowledge_point_ids,
			qb.created_at, qb.updated_at
		FROM question_banks qb WHERE qb.id = $1 AND qb.tenant_id = $2
	`, id, tenantID).Scan(
		&b.ID, &b.Code, &b.Name, &desc, &coverImage, &b.Status, &b.QuestionCount, &creatorID,
		&b.CreatorName, &b.CollaboratorIDs, &b.CollaboratorNames,
		&b.CollaboratorDeptIDs, &batchID, &version, &b.OwnerType, &b.IsDraftPool,
		&b.KnowledgePointIDs, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	b.CoverImage = coverImage
	b.Description = desc
	b.Version = version
	b.CreatorID = creatorID
	b.BatchID = batchID
	return &b, nil
}

// ScanQuestionBankRows 扫描题库行。
func ScanQuestionBankRows(rows pgx.Rows) ([]domain.QuestionBank, error) {
	var version *string

	var desc *string

	items := make([]domain.QuestionBank, 0)
	for rows.Next() {
		var b domain.QuestionBank
		var coverImage, creatorID, batchID *string
		if err := rows.Scan(
			&b.ID, &b.Code, &b.Name, &desc, &coverImage, &b.Status, &b.QuestionCount, &creatorID,
			&b.CreatorName, &b.CollaboratorIDs, &b.CollaboratorNames,
			&b.CollaboratorDeptIDs, &batchID, &version, &b.OwnerType, &b.IsDraftPool,
			&b.KnowledgePointIDs, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		b.CoverImage = coverImage
		b.Description = desc
	b.Version = version
		b.CreatorID = creatorID
		b.BatchID = batchID
		items = append(items, b)
	}
	return items, rows.Err()
}
