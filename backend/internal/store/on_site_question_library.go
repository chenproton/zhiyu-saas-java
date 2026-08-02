package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type OnSiteQuestionLibraryStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *OnSiteQuestionLibraryStore) Q() Queryer {
	return s.q
}

func NewOnSiteQuestionLibraryStore(q Queryer) *OnSiteQuestionLibraryStore {
	return &OnSiteQuestionLibraryStore{q: q}
}

type OnSiteQuestionLibraryCreateParams struct {
	TenantID          string
	QuestionText      string
	Answer            *string
	QuestionType      string
	Score             float64
	Difficulty        *string
	KnowledgePointIDs []string
	Tags              []string
	CreatorID         string
}

type OnSiteQuestionLibraryUpdateParams struct {
	QuestionText      string
	Answer            *string
	QuestionType      string
	Score             float64
	Difficulty        *string
	KnowledgePointIDs []string
	Tags              []string
}

func (s *OnSiteQuestionLibraryStore) GetByID(ctx context.Context, id string) (domain.OnSiteQuestionLibraryItem, error) {
	var item domain.OnSiteQuestionLibraryItem
	var answer, difficulty, creatorID *string
	var kpIDs, tags []string
	err := s.q.QueryRow(ctx,
		`SELECT id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at FROM on_site_question_library WHERE id = $1`, id,
	).Scan(&item.ID, &item.TenantID, &item.QuestionText, &answer, &item.QuestionType, &item.Score, &difficulty, &kpIDs, &tags, &creatorID, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return item, err
	}
	item.Answer = answer
	item.Difficulty = difficulty
	item.KnowledgePointIDs = kpIDs
	item.Tags = tags
	item.CreatorID = creatorID
	return item, nil
}

func (s *OnSiteQuestionLibraryStore) Create(ctx context.Context, p OnSiteQuestionLibraryCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx,
		`INSERT INTO on_site_question_library (id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		id, p.TenantID, p.QuestionText, p.Answer, p.QuestionType, p.Score, p.Difficulty, p.KnowledgePointIDs, p.Tags, p.CreatorID,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *OnSiteQuestionLibraryStore) Update(ctx context.Context, id string, p OnSiteQuestionLibraryUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE on_site_question_library SET question_text=$1, answer=$2, question_type=$3, score=$4, difficulty=$5, knowledge_point_ids=$6, tags=$7, updated_at=NOW() WHERE id=$8`,
		p.QuestionText, p.Answer, p.QuestionType, p.Score, p.Difficulty, p.KnowledgePointIDs, p.Tags, id,
	)
	return err
}

func (s *OnSiteQuestionLibraryStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM on_site_question_library WHERE id = $1`, id)
	return err
}

func (s *OnSiteQuestionLibraryStore) ScanRows(rows pgx.Rows) ([]domain.OnSiteQuestionLibraryItem, error) {
	items := make([]domain.OnSiteQuestionLibraryItem, 0)
	for rows.Next() {
		var item domain.OnSiteQuestionLibraryItem
		var answer, difficulty, creatorID *string
		var kpIDs, tags []string
		if err := rows.Scan(&item.ID, &item.TenantID, &item.QuestionText, &answer, &item.QuestionType, &item.Score, &difficulty, &kpIDs, &tags, &creatorID, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.Answer = answer
		item.Difficulty = difficulty
		item.KnowledgePointIDs = kpIDs
		item.Tags = tags
		item.CreatorID = creatorID
		items = append(items, item)
	}
	return items, nil
}
