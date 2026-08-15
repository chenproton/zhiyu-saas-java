package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// 通用收藏目标类型（岗位收藏沿用 position_favorites 表，不在此表）。
const (
	FavoriteTypeScene        = "scene"
	FavoriteTypeCourse       = "course"
	FavoriteTypeQuestionBank = "question_bank"
	FavoriteTypeExam         = "exam"
	// AI 智能服务中心（spec ai-service-center.md §2.1）：仅已发布对象可收藏，私有内容不暴露存在性
	FavoriteTypeAIKB    = "ai_kb"
	FavoriteTypeAIAgent = "ai_agent"
)

// ValidFavoriteType 校验收藏目标类型是否受支持。
func ValidFavoriteType(targetType string) bool {
	switch targetType {
	case FavoriteTypeScene, FavoriteTypeCourse, FavoriteTypeQuestionBank, FavoriteTypeExam,
		FavoriteTypeAIKB, FavoriteTypeAIAgent:
		return true
	}
	return false
}

// FavoritesStore 通用收藏持久化（场景/课程/题库/试卷）。
type FavoritesStore struct {
	q        Queryer
	beginner txBeginner
}

// NewFavoritesStore 创建通用收藏 store。
func NewFavoritesStore(q Queryer, beginner txBeginner) *FavoritesStore {
	return &FavoritesStore{q: q, beginner: beginner}
}

// FavoriteTargetTenant 查询收藏目标的所属租户（归属校验用）。
func (s *FavoritesStore) FavoriteTargetTenant(ctx context.Context, targetType, targetID string) (string, error) {
	var tenantID string
	switch targetType {
	case FavoriteTypeScene:
		err := s.q.QueryRow(ctx, `SELECT tenant_id FROM scenarios WHERE id = $1`, targetID).Scan(&tenantID)
		return tenantID, err
	case FavoriteTypeCourse:
		err := s.q.QueryRow(ctx, `SELECT tenant_id FROM courses WHERE id = $1`, targetID).Scan(&tenantID)
		return tenantID, err
	case FavoriteTypeQuestionBank:
		err := s.q.QueryRow(ctx, `SELECT tenant_id FROM question_banks WHERE id = $1`, targetID).Scan(&tenantID)
		return tenantID, err
	case FavoriteTypeExam:
		err := s.q.QueryRow(ctx, `SELECT tenant_id FROM exams WHERE id = $1`, targetID).Scan(&tenantID)
		return tenantID, err
	case FavoriteTypeAIKB:
		// 仅 published 可收藏：私有/审核中/驳回的知识库对非可见者不暴露存在性（404 语义）
		err := s.q.QueryRow(ctx, `SELECT tenant_id FROM ai_knowledge_bases WHERE id = $1 AND status = 'published'`, targetID).Scan(&tenantID)
		return tenantID, err
	case FavoriteTypeAIAgent:
		err := s.q.QueryRow(ctx, `SELECT tenant_id FROM ai_agents WHERE id = $1 AND status = 'published'`, targetID).Scan(&tenantID)
		return tenantID, err
	}
	return "", pgx.ErrNoRows
}

// GetFavorite 查询收藏状态。
func (s *FavoritesStore) GetFavorite(ctx context.Context, userID, targetType, targetID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM user_favorites
		WHERE user_id = $1 AND target_type = $2 AND target_id = $3)
	`, userID, targetType, targetID).Scan(&exists)
	return exists, err
}

// FavoriteCount 查询收藏数。
func (s *FavoritesStore) FavoriteCount(ctx context.Context, targetType, targetID string) (int, error) {
	var cnt int
	err := s.q.QueryRow(ctx, `
		SELECT COALESCE(cnt, 0) FROM favorite_counters
		WHERE target_type = $1 AND target_id = $2
	`, targetType, targetID).Scan(&cnt)
	return cnt, err
}

// ToggleFavorite 切换收藏，返回新状态。
func (s *FavoritesStore) ToggleFavorite(ctx context.Context, userID, targetType, targetID string) (bool, error) {
	// 收藏表与计数在同一事务内更新，避免并发下计数漂移
	var toggled bool
	err := withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM user_favorites
			WHERE user_id = $1 AND target_type = $2 AND target_id = $3)
		`, userID, targetType, targetID).Scan(&exists); err != nil {
			return err
		}
		if exists {
			tag, err := tx.Exec(ctx, `
				DELETE FROM user_favorites WHERE user_id = $1 AND target_type = $2 AND target_id = $3
			`, userID, targetType, targetID)
			if err != nil {
				return err
			}
			// 并发下该行可能已被另一事务取消收藏，仅在实际删除后才递减计数，避免漂移。
			if tag.RowsAffected() > 0 {
				if _, err := tx.Exec(ctx, `
					UPDATE favorite_counters SET cnt = GREATEST(cnt - 1, 0), updated_at = now()
					WHERE target_type = $1 AND target_id = $2
				`, targetType, targetID); err != nil {
					return err
				}
			}
			toggled = false
			return nil
		}
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_favorites (id, user_id, target_type, target_id)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, target_type, target_id) DO NOTHING
		`, uuid.NewString(), userID, targetType, targetID)
		if err != nil {
			return err
		}
		// 并发下该行可能已被另一事务插入（ON CONFLICT DO NOTHING 静默 no-op），
		// 仅在实际插入后才递增计数，避免计数漂移。
		if tag.RowsAffected() > 0 {
			if _, err := tx.Exec(ctx, `
				INSERT INTO favorite_counters (target_type, target_id, cnt)
				VALUES ($1, $2, 1)
				ON CONFLICT (target_type, target_id) DO UPDATE SET cnt = favorite_counters.cnt + 1, updated_at = now()
			`, targetType, targetID); err != nil {
				return err
			}
		}
		toggled = true
		return nil
	})
	return toggled, err
}

// ListScenes 查询用户收藏的场景（仅已发布）。
func (s *FavoritesStore) ListScenes(ctx context.Context, userID, tenantID string) ([]domain.Scenario, error) {
	return listFavoritesByType(ctx, s.q, userID, tenantID, FavoriteTypeScene,
		scenarioListFrom+" ON s.id = f.target_id"+scenarioListJoins,
		scenarioListSelectColumns, "s.tenant_id", " AND s.status = 'published'", scanScenarioRows)
}

// ListCourses 查询用户收藏的课程（仅已发布）。
func (s *FavoritesStore) ListCourses(ctx context.Context, userID, tenantID string) ([]domain.Course, error) {
	return listFavoritesByType(ctx, s.q, userID, tenantID, FavoriteTypeCourse,
		courseListFrom+" ON c.id = f.target_id"+courseListJoins,
		courseListSelectColumns, "c.tenant_id", " AND c.status = 'published'", ScanCourseRows)
}

// ListQuestionBanks 查询用户收藏的题库（仅已发布）。
func (s *FavoritesStore) ListQuestionBanks(ctx context.Context, userID, tenantID string) ([]domain.QuestionBank, error) {
	return listFavoritesByType(ctx, s.q, userID, tenantID, FavoriteTypeQuestionBank,
		questionBankListFrom+" ON qb.id = f.target_id"+questionBankListJoins,
		questionBankListSelectColumns, "qb.tenant_id", " AND qb.status = 'published'", ScanQuestionBankRows)
}

// ListExams 查询用户收藏的试卷（仅已发布、非临时）。
func (s *FavoritesStore) ListExams(ctx context.Context, userID, tenantID string) ([]domain.Exam, error) {
	return listFavoritesByType(ctx, s.q, userID, tenantID, FavoriteTypeExam,
		examListFrom+" ON e.id = f.target_id",
		examListSelectColumns, "e.tenant_id", " AND e.is_temp = FALSE AND e.status = 'published'", ScanExamRows)
}

func listFavoritesByType[T any](ctx context.Context, q Queryer, userID, tenantID, targetType, from, selectColumns, tenantColumn, extraFilter string, scan func(pgx.Rows) ([]T, error)) ([]T, error) {
	rows, err := q.Query(ctx, `
		SELECT `+selectColumns+`
		FROM user_favorites f JOIN `+from+`
		WHERE f.user_id = $1 AND f.target_type = $2 AND `+tenantColumn+` = $3`+extraFilter+`
		ORDER BY f.created_at DESC
	`, userID, targetType, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scan(rows)
}
