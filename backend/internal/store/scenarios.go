package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ScenarioStore 场景方案持久化。
type ScenarioStore struct {
	q Queryer
}

// NewScenarioStore 创建场景 store。
func NewScenarioStore(q Queryer) *ScenarioStore {
	return &ScenarioStore{q: q}
}

// List 查询场景列表。
func (s *ScenarioStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Scenario]) ([]domain.Scenario, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanScenarioRows)
}

// ListConfig 返回场景列表查询配置，SQL 片段沉淀在 store 层。
func (s *ScenarioStore) ListConfig() ListQueryConfig[domain.Scenario] {
	return ListQueryConfig[domain.Scenario]{
		Table:         "scenarios s LEFT JOIN LATERAL (SELECT COALESCE(array_agg(i.name), '{}') AS names FROM industries i WHERE i.id::text = ANY(s.industry_ids)) ind ON true LEFT JOIN LATERAL (SELECT COALESCE(array_agg(m2.name), '{}') AS names FROM majors m2 WHERE m2.id = ANY(s.profession_ids)) prof ON true LEFT JOIN view_counters vc ON vc.target_type = 'scenario' AND vc.target_id = s.id LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM scenario_tasks t WHERE t.scenario_id = s.id) tcnt ON true",
		SelectColumns: "s.id, s.name, s.code, s.cover_image, s.career_position_id, s.industry_ids, COALESCE(ind.names, '{}') AS industry_names, s.profession_ids, COALESCE(prof.names, '{}') AS profession_names, s.batch_id, s.difficulty, s.version, s.status, s.background, s.delivery_goal, s.creator_id, s.co_builder_ids, s.tenant_id, s.created_at, s.updated_at, s.publish_time, COALESCE(vc.cnt, 0) AS view_count, COALESCE(tcnt.cnt, 0) AS task_count",
		TenantScoped:  true,
		TenantColumn:  "s.tenant_id",
		SearchColumns: []string{"s.name", "s.code"},
		SearchParam:   "search",
		OrderBy:       "s.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      scanScenarioRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			status := p.Values["status"]
			batchID := p.Values["batchId"]
			careerPositionID := p.Values["careerPositionId"]
			if status != "" {
				qb.AddCondition("s.status = " + qb.NextArg(status))
			} else {
				qb.AddCondition("s.status != " + qb.NextArg("archived"))
			}
			if batchID != "" {
				qb.AddCondition("s.batch_id = " + qb.NextArg(batchID))
			}
			if careerPositionID != "" {
				qb.AddCondition("s.career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
}

// Get 查询单个场景。
func (s *ScenarioStore) Get(ctx context.Context, id string) (*domain.Scenario, error) {
	sc, err := s.fetchScenario(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return sc, nil
}

// Create 创建场景（draft 状态）。
func (s *ScenarioStore) Create(ctx context.Context, tenantID string, p *ScenarioCreateParams) (*domain.Scenario, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_ids,
			profession_ids, batch_id, difficulty, version, status, background,
			delivery_goal, creator_id, co_builder_ids, tenant_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12, $13, $14, $15)
	`, id, p.Name, p.Code, p.CoverImage, p.CareerPositionID, p.IndustryIDs,
		p.ProfessionIDs, p.BatchID, p.Difficulty, p.Version, p.Background,
		p.DeliveryGoal, p.CreatorID, p.CoBuilderIDs, tenantID)
	if err != nil {
		return nil, err
	}
	return s.fetchScenario(ctx, id)
}

// Update 更新场景。
func (s *ScenarioStore) Update(ctx context.Context, id string, p *ScenarioUpdateParams) (*domain.Scenario, error) {
	if _, err := s.fetchScenario(ctx, id); err != nil {
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE scenarios SET name = $1, cover_image = $2, career_position_id = $3,
			industry_ids = $4, profession_ids = $5,
			batch_id = $6, difficulty = $7, version = $8, background = $9, delivery_goal = $10,
			co_builder_ids = $11, updated_at = NOW()
		WHERE id = $12
	`, p.Name, p.CoverImage, p.CareerPositionID, p.IndustryIDs,
		p.ProfessionIDs, p.BatchID, p.Difficulty, p.Version, p.Background,
		p.DeliveryGoal, p.CoBuilderIDs, id)
	if err != nil {
		return nil, err
	}
	return s.fetchScenario(ctx, id)
}

// Delete 删除场景（先解绑引用）。
func (s *ScenarioStore) Delete(ctx context.Context, id string) error {
	_, _ = s.q.Exec(ctx, `UPDATE training_program_courses SET scenario_id = NULL WHERE scenario_id = $1`, id)
	_, _ = s.q.Exec(ctx, `UPDATE teaching_plan_entries SET scenario_id = NULL WHERE scenario_id = $1`, id)
	_, _ = s.q.Exec(ctx, `UPDATE schedule_entries SET scenario_id = NULL WHERE scenario_id = $1`, id)
	_, err := s.q.Exec(ctx, `DELETE FROM scenarios WHERE id = $1`, id)
	return err
}

// IncrementView 记录场景浏览。
func (s *ScenarioStore) IncrementView(ctx context.Context, targetID string, userID any, tenantID any) error {
	return RecordView(ctx, s.q, "scenario", targetID, userID, tenantID)
}

// ScenarioCreateParams 创建场景参数。
type ScenarioCreateParams struct {
	Name             string
	Code             string
	CoverImage       *string
	CareerPositionID *string
	IndustryIDs      []string
	ProfessionIDs    []string
	BatchID          *string
	Difficulty       int
	Version          string
	Background       *string
	DeliveryGoal     *string
	CreatorID        string
	CoBuilderIDs     []string
}

// ScenarioUpdateParams 更新场景参数（已解析 nullable 后的最终值）。
type ScenarioUpdateParams struct {
	Name             string
	CoverImage       *string
	CareerPositionID *string
	IndustryIDs      []string
	ProfessionIDs    []string
	BatchID          *string
	Difficulty       int
	Version          string
	Background       *string
	DeliveryGoal     *string
	CoBuilderIDs     []string
}

func (s *ScenarioStore) fetchScenario(ctx context.Context, id string) (*domain.Scenario, error) {
	var sc domain.Scenario
	err := s.q.QueryRow(ctx, `
		SELECT s.id, s.name, s.code, s.cover_image, s.career_position_id,
			s.industry_ids, COALESCE((SELECT array_agg(i.name) FROM industries i WHERE i.id::text = ANY(s.industry_ids)), '{}') AS industry_names,
			s.profession_ids, COALESCE((SELECT array_agg(m.name) FROM majors m WHERE m.id = ANY(s.profession_ids)), '{}') AS profession_names,
			s.batch_id, s.difficulty, s.version, s.status, s.background,
			s.delivery_goal, s.creator_id, s.co_builder_ids, s.tenant_id, s.created_at, s.updated_at, s.publish_time,
			COALESCE(vc.cnt, 0) AS view_count
		FROM scenarios s
		LEFT JOIN view_counters vc ON vc.target_type = 'scenario' AND vc.target_id = s.id
		WHERE s.id = $1
	`, id).Scan(
		&sc.ID, &sc.Name, &sc.Code, &sc.CoverImage, &sc.CareerPositionID, &sc.IndustryIDs, &sc.IndustryNames,
		&sc.ProfessionIDs, &sc.ProfessionNames, &sc.BatchID, &sc.Difficulty, &sc.Version, &sc.Status, &sc.Background,
		&sc.DeliveryGoal, &sc.CreatorID, &sc.CoBuilderIDs, &sc.TenantID, &sc.CreatedAt, &sc.UpdatedAt, &sc.PublishTime, &sc.ViewCount,
	)
	if err != nil {
		return nil, err
	}
	return &sc, nil
}

func scanScenarioRows(rows pgx.Rows) ([]domain.Scenario, error) {
	items := make([]domain.Scenario, 0)
	for rows.Next() {
		var sc domain.Scenario
		if err := rows.Scan(
			&sc.ID, &sc.Name, &sc.Code, &sc.CoverImage, &sc.CareerPositionID, &sc.IndustryIDs, &sc.IndustryNames,
			&sc.ProfessionIDs, &sc.ProfessionNames, &sc.BatchID, &sc.Difficulty, &sc.Version, &sc.Status, &sc.Background,
			&sc.DeliveryGoal, &sc.CreatorID, &sc.CoBuilderIDs, &sc.TenantID, &sc.CreatedAt, &sc.UpdatedAt, &sc.PublishTime, &sc.ViewCount, &sc.TaskCount,
		); err != nil {
			return nil, err
		}
		items = append(items, sc)
	}
	return items, nil
}

// RecordView 记录浏览日志并累加计数（多个内容实体共用）。
func RecordView(ctx context.Context, q Queryer, targetType, targetID string, userID, tenantID any) error {
	_, err := q.Exec(ctx, `
		INSERT INTO view_logs (target_type, target_id, user_id, tenant_id)
		VALUES ($1, $2, $3, $4)
	`, targetType, targetID, userID, tenantID)
	if err != nil {
		return err
	}
	_, _ = q.Exec(ctx, `
		INSERT INTO view_counters (target_type, target_id, cnt)
		VALUES ($1, $2, 1)
		ON CONFLICT (target_type, target_id) DO UPDATE SET cnt = view_counters.cnt + 1, updated_at = now()
	`, targetType, targetID)
	return nil
}
