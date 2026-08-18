package store

import (
	"github.com/zhiyu-saas/backend/internal/domain"
)

type OnSiteQuestionLibraryStore struct {
	*DictStore[domain.OnSiteQuestionLibraryItem]
}

func NewOnSiteQuestionLibraryStore(q Queryer) *OnSiteQuestionLibraryStore {
	return &OnSiteQuestionLibraryStore{DictStore: NewDictStore(q, DictConfig[domain.OnSiteQuestionLibraryItem]{
		Table:         "on_site_question_library",
		SelectColumns: "id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at",
		CreateSQL:     `INSERT INTO on_site_question_library (id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		UpdateSQL:     `UPDATE on_site_question_library SET question_text=$1, answer=$2, question_type=$3, score=$4, difficulty=$5, knowledge_point_ids=$6, tags=$7, updated_at=NOW() WHERE id=$8`,
		GetByIDSQL:    `SELECT id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at FROM on_site_question_library WHERE id = $1`,
		DeleteSQL:     `DELETE FROM on_site_question_library WHERE id = $1`,
		TenantScoped:  true,
		SearchColumns: []string{"question_text", "answer"},
	})}
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

func (p OnSiteQuestionLibraryCreateParams) Tenant() string { return p.TenantID }

func (p OnSiteQuestionLibraryCreateParams) Args() []any {
	return []any{p.QuestionText, p.Answer, p.QuestionType, p.Score, p.Difficulty, p.KnowledgePointIDs, p.Tags, p.CreatorID}
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

func (p OnSiteQuestionLibraryUpdateParams) Args() []any {
	return []any{p.QuestionText, p.Answer, p.QuestionType, p.Score, p.Difficulty, p.KnowledgePointIDs, p.Tags}
}
