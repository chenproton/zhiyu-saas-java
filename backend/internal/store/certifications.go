package store

import (
	"context"
	"errors"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// CertificationStore 认证规则持久化。
type CertificationStore struct {
	q Queryer
}

// NewCertificationStore 创建认证 store。
func NewCertificationStore(q Queryer) *CertificationStore {
	return &CertificationStore{q: q}
}

// PublishedTarget 已发布认证规则对应的租户+岗位组合。
type PublishedTarget struct {
	TenantID   string
	PositionID string
}

// ListPublishedTargets 返回所有 published 规则的 tenant+position 组合。
func (s *CertificationStore) ListPublishedTargets(ctx context.Context) ([]PublishedTarget, error) {
	rows, err := s.q.Query(ctx, `
		SELECT DISTINCT tenant_id, career_position_id FROM certification_rules
		WHERE status = 'published' AND tenant_id IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var targets []PublishedTarget
	for rows.Next() {
		var t PublishedTarget
		if err := rows.Scan(&t.TenantID, &t.PositionID); err != nil {
			return nil, err
		}
		targets = append(targets, t)
	}
	return targets, rows.Err()
}

// ListRules 查询认证规则列表。
func (s *CertificationStore) ListRules(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.CertificationRule]) ([]domain.CertificationRule, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanCertificationRuleRows)
}

// GetRule 查询单个规则。
func (s *CertificationStore) GetRule(ctx context.Context, id string) (*domain.CertificationRule, error) {
	rule, err := s.fetchRule(ctx, id, "")
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return rule, nil
}

// FindRuleByPosition 按岗位查询已存在规则。
func (s *CertificationStore) FindRuleByPosition(ctx context.Context, tenantID, positionID string) (*domain.CertificationRule, error) {
	var id string
	if err := s.q.QueryRow(ctx, `
		SELECT id FROM certification_rules WHERE tenant_id = $1 AND career_position_id = $2 LIMIT 1
	`, tenantID, positionID).Scan(&id); err != nil {
		return nil, err
	}
	return s.GetRule(ctx, id)
}

// CreateRule 创建规则。
func (s *CertificationStore) CreateRule(ctx context.Context, tenantID, positionID, ruleSource string) (*domain.CertificationRule, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO certification_rules (id, tenant_id, career_position_id, status, rule_source)
		VALUES (gen_random_uuid(), $1, $2, 'draft', $3)
		RETURNING id
	`, tenantID, positionID, ruleSource).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetRule(ctx, id)
}

// UpdateRuleStatus 更新规则状态。
func (s *CertificationStore) UpdateRuleStatus(ctx context.Context, id, tenantID, status string) (*domain.CertificationRule, error) {
	if _, err := s.fetchRule(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE certification_rules SET status = $1, updated_at = NOW()
		WHERE id = $2 AND tenant_id = $3
	`, status, id, tenantID); err != nil {
		return nil, err
	}
	return s.GetRule(ctx, id)
}

// UpdateRule 更新规则。
func (s *CertificationStore) UpdateRule(ctx context.Context, id, positionID, ruleSource string) (*domain.CertificationRule, error) {
	if _, err := s.fetchRule(ctx, id, ""); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE certification_rules SET career_position_id = $1, rule_source = $2, updated_at = NOW()
		WHERE id = $3
	`, positionID, ruleSource, id); err != nil {
		return nil, err
	}
	return s.GetRule(ctx, id)
}

// DeleteRule 删除规则。
func (s *CertificationStore) DeleteRule(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM certification_rules WHERE id = $1`, id)
	return err
}

// ===== 能力项 =====

// ListItems 查询规则下能力项。
func (s *CertificationStore) ListItems(ctx context.Context, ruleID string) ([]domain.CertificationAbilityItem, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, rule_id, name, sort_order
		FROM certification_ability_items WHERE rule_id = $1 ORDER BY sort_order
	`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.CertificationAbilityItem
	for rows.Next() {
		var item domain.CertificationAbilityItem
		if err := rows.Scan(&item.ID, &item.RuleID, &item.Name, &item.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// GetItem 查询单个能力项。
func (s *CertificationStore) GetItem(ctx context.Context, id string) (*domain.CertificationAbilityItem, error) {
	item, err := s.fetchItem(ctx, id, "")
	if err != nil {
		return nil, err
	}
	return item, nil
}

// CreateItem 创建能力项。
func (s *CertificationStore) CreateItem(ctx context.Context, tenantID, ruleID, name string, sortOrder int) (*domain.CertificationAbilityItem, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO certification_ability_items (id, tenant_id, rule_id, name, sort_order)
		VALUES (gen_random_uuid(), $1, $2, $3, $4)
		RETURNING id
	`, tenantID, ruleID, name, sortOrder).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetItem(ctx, id)
}

// UpdateItem 更新能力项。
func (s *CertificationStore) UpdateItem(ctx context.Context, id, name string, sortOrder int) (*domain.CertificationAbilityItem, error) {
	if _, err := s.fetchItem(ctx, id, ""); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE certification_ability_items SET name = $1, sort_order = $2, updated_at = NOW()
		WHERE id = $3
	`, name, sortOrder, id); err != nil {
		return nil, err
	}
	return s.GetItem(ctx, id)
}

// DeleteItem 删除能力项（连带点数）。
func (s *CertificationStore) DeleteItem(ctx context.Context, id string) error {
	_, _ = s.q.Exec(ctx, `DELETE FROM certification_ability_points WHERE item_id = $1`, id)
	_, err := s.q.Exec(ctx, `DELETE FROM certification_ability_items WHERE id = $1`, id)
	return err
}

// ===== 能力点 =====

// ListPoints 查询项下能力点。
func (s *CertificationStore) ListPoints(ctx context.Context, itemID string) ([]domain.CertificationAbilityPoint, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight
		FROM certification_ability_points WHERE item_id = $1 ORDER BY id
	`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.CertificationAbilityPoint
	for rows.Next() {
		var point domain.CertificationAbilityPoint
		if err := rows.Scan(&point.ID, &point.ItemID, &point.AbilityPointID, &point.MappingType, &point.CustomLevelMapping, &point.RequiredLevel, &point.Weight); err != nil {
			return nil, err
		}
		items = append(items, point)
	}
	return items, rows.Err()
}

// GetPoint 查询单个能力点。
func (s *CertificationStore) GetPoint(ctx context.Context, id string) (*domain.CertificationAbilityPoint, error) {
	point, err := s.fetchPoint(ctx, id, "")
	if err != nil {
		return nil, err
	}
	return point, nil
}

// CreatePoint 创建能力点。
func (s *CertificationStore) CreatePoint(ctx context.Context, p *CertificationPointParams) (*domain.CertificationAbilityPoint, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO certification_ability_points (id, tenant_id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, p.TenantID, p.ItemID, p.AbilityPointID, p.MappingType, p.CustomLevelMapping, p.RequiredLevel, p.Weight).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetPoint(ctx, id)
}

// UpdatePoint 更新能力点。
func (s *CertificationStore) UpdatePoint(ctx context.Context, id, tenantID string, p *CertificationPointParams) (*domain.CertificationAbilityPoint, error) {
	if _, err := s.fetchPoint(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE certification_ability_points SET mapping_type = $1, custom_level_mapping = $2, required_level = $3, weight = $4, updated_at = NOW()
		WHERE id = $5 AND tenant_id = $6
	`, p.MappingType, p.CustomLevelMapping, p.RequiredLevel, p.Weight, id, tenantID); err != nil {
		return nil, err
	}
	return s.GetPoint(ctx, id)
}

// DeletePoint 删除能力点。
func (s *CertificationStore) DeletePoint(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM certification_ability_points WHERE id = $1`, id)
	return err
}

// CertificationPointParams 能力点参数。
type CertificationPointParams struct {
	TenantID           string
	ItemID             string
	AbilityPointID     string
	MappingType        string
	CustomLevelMapping domain.JSONSlice
	RequiredLevel      string
	Weight             float64
}

// ===== 关联任务 =====

// GetTask 查询单个关联任务。
func (s *CertificationStore) GetTask(ctx context.Context, id string) (*domain.CertificationRelatedTask, error) {
	task, err := s.fetchTask(ctx, id, "")
	if err != nil {
		return nil, err
	}
	return task, nil
}

// CreateTask 创建关联任务。
func (s *CertificationStore) CreateTask(ctx context.Context, tenantID, certPointID, taskID string, maxScore, weight float64) (*domain.CertificationRelatedTask, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO certification_related_tasks (id, tenant_id, cert_point_id, task_id, max_score, weight)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id
	`, tenantID, certPointID, taskID, maxScore, weight).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetTask(ctx, id)
}

// UpdateTask 更新关联任务。
func (s *CertificationStore) UpdateTask(ctx context.Context, id, tenantID string, taskID string, maxScore, weight float64) (*domain.CertificationRelatedTask, error) {
	if _, err := s.fetchTask(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE certification_related_tasks SET task_id = $1, max_score = $2, weight = $3, updated_at = NOW()
		WHERE id = $4 AND tenant_id = $5
	`, taskID, maxScore, weight, id, tenantID); err != nil {
		return nil, err
	}
	return s.GetTask(ctx, id)
}

// DeleteTask 删除关联任务。
func (s *CertificationStore) DeleteTask(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM certification_related_tasks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 聚合查询 =====

// FullItem 完整项。
type FullItem struct {
	ID          string
	Name        string
	SortOrder   int
	AbilityName string
}

// FullPoint 完整点。
type FullPoint struct {
	ID                 string
	ItemID             string
	Name               string
	Description        string
	MappingType        string
	CustomLevelMapping domain.JSONSlice
	RequiredLevel      string
	Weight             float64
}

// ListFullItems 查询完整项（含能力名）。
func (s *CertificationStore) ListFullItems(ctx context.Context, ruleID string) ([]FullItem, error) {
	rows, err := s.q.Query(ctx, `
		SELECT i.id, i.name, i.sort_order,
			COALESCE((SELECT name FROM ability_points WHERE id = p.ability_point_id LIMIT 1), '')
		FROM certification_ability_items i
		LEFT JOIN certification_ability_points p ON p.item_id = i.id
		WHERE i.rule_id = $1
		GROUP BY i.id, i.name, i.sort_order
		ORDER BY i.sort_order
	`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []FullItem
	for rows.Next() {
		var item FullItem
		if err := rows.Scan(&item.ID, &item.Name, &item.SortOrder, &item.AbilityName); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// ListFullPoints 查询完整点（含能力名/描述）。
func (s *CertificationStore) ListFullPoints(ctx context.Context, itemIDs []string) ([]FullPoint, error) {
	rows, err := s.q.Query(ctx, `
		SELECT p.id, p.item_id,
			COALESCE((SELECT name FROM ability_points WHERE id = p.ability_point_id), ''),
			COALESCE((SELECT description FROM ability_points WHERE id = p.ability_point_id), ''),
			p.mapping_type, p.custom_level_mapping, p.required_level, p.weight
		FROM certification_ability_points p
		WHERE p.item_id = ANY($1)
		ORDER BY p.item_id, p.id
	`, itemIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []FullPoint
	for rows.Next() {
		var p FullPoint
		if err := rows.Scan(&p.ID, &p.ItemID, &p.Name, &p.Description, &p.MappingType, &p.CustomLevelMapping, &p.RequiredLevel, &p.Weight); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// ListTasksByPointIDs 查询点下关联任务。
func (s *CertificationStore) ListTasksByPointIDs(ctx context.Context, pointIDs []string) ([]domain.CertificationRelatedTask, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, cert_point_id, task_id, max_score, weight
		FROM certification_related_tasks
		WHERE cert_point_id = ANY($1)
	`, pointIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.CertificationRelatedTask
	for rows.Next() {
		var t domain.CertificationRelatedTask
		if err := rows.Scan(&t.ID, &t.CertPointID, &t.TaskID, &t.MaxScore, &t.Weight); err == nil {
			items = append(items, t)
		}
	}
	return items, rows.Err()
}

// ===== 内部 =====

func (s *CertificationStore) fetchRule(ctx context.Context, id, tenantID string) (*domain.CertificationRule, error) {
	var rule domain.CertificationRule
	var err error
	if tenantID != "" {
		err = s.q.QueryRow(ctx, `
			SELECT id, career_position_id, status, rule_source, level_mapping, created_at, updated_at
			FROM certification_rules WHERE id = $1 AND tenant_id = $2
		`, id, tenantID).Scan(&rule.ID, &rule.CareerPositionID, &rule.Status, &rule.RuleSource, &rule.LevelMapping, &rule.CreatedAt, &rule.UpdatedAt)
	} else {
		err = s.q.QueryRow(ctx, `
			SELECT id, career_position_id, status, rule_source, level_mapping, created_at, updated_at
			FROM certification_rules WHERE id = $1
		`, id).Scan(&rule.ID, &rule.CareerPositionID, &rule.Status, &rule.RuleSource, &rule.LevelMapping, &rule.CreatedAt, &rule.UpdatedAt)
	}
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (s *CertificationStore) fetchItem(ctx context.Context, id, tenantID string) (*domain.CertificationAbilityItem, error) {
	var item domain.CertificationAbilityItem
	var err error
	if tenantID != "" {
		err = s.q.QueryRow(ctx, `
			SELECT id, rule_id, name, sort_order FROM certification_ability_items WHERE id = $1 AND tenant_id = $2
		`, id, tenantID).Scan(&item.ID, &item.RuleID, &item.Name, &item.SortOrder)
	} else {
		err = s.q.QueryRow(ctx, `
			SELECT id, rule_id, name, sort_order FROM certification_ability_items WHERE id = $1
		`, id).Scan(&item.ID, &item.RuleID, &item.Name, &item.SortOrder)
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *CertificationStore) fetchPoint(ctx context.Context, id, tenantID string) (*domain.CertificationAbilityPoint, error) {
	var point domain.CertificationAbilityPoint
	var err error
	if tenantID != "" {
		err = s.q.QueryRow(ctx, `
			SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight
			FROM certification_ability_points WHERE id = $1 AND tenant_id = $2
		`, id, tenantID).Scan(&point.ID, &point.ItemID, &point.AbilityPointID, &point.MappingType, &point.CustomLevelMapping, &point.RequiredLevel, &point.Weight)
	} else {
		err = s.q.QueryRow(ctx, `
			SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight
			FROM certification_ability_points WHERE id = $1
		`, id).Scan(&point.ID, &point.ItemID, &point.AbilityPointID, &point.MappingType, &point.CustomLevelMapping, &point.RequiredLevel, &point.Weight)
	}
	if err != nil {
		return nil, err
	}
	return &point, nil
}

func (s *CertificationStore) fetchTask(ctx context.Context, id, tenantID string) (*domain.CertificationRelatedTask, error) {
	var task domain.CertificationRelatedTask
	var err error
	if tenantID != "" {
		err = s.q.QueryRow(ctx, `
			SELECT id, cert_point_id, task_id, max_score, weight FROM certification_related_tasks WHERE id = $1 AND tenant_id = $2
		`, id, tenantID).Scan(&task.ID, &task.CertPointID, &task.TaskID, &task.MaxScore, &task.Weight)
	} else {
		err = s.q.QueryRow(ctx, `
			SELECT id, cert_point_id, task_id, max_score, weight FROM certification_related_tasks WHERE id = $1
		`, id).Scan(&task.ID, &task.CertPointID, &task.TaskID, &task.MaxScore, &task.Weight)
	}
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// GetRuleByTenant 查询规则（租户限定）。
func (s *CertificationStore) GetRuleByTenant(ctx context.Context, id, tenantID string) (*domain.CertificationRule, error) {
	rule, err := s.fetchRule(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return rule, nil
}

// ScanCertificationRuleRows 扫描规则行。
func ScanCertificationRuleRows(rows pgx.Rows) ([]domain.CertificationRule, error) {
	items := make([]domain.CertificationRule, 0)
	for rows.Next() {
		var rule domain.CertificationRule
		if err := rows.Scan(&rule.ID, &rule.CareerPositionID, &rule.Status, &rule.RuleSource, &rule.LevelMapping, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, rule)
	}
	return items, nil
}

// PutFullRuleItem 完整规则项。
type PutFullRuleItem struct {
	Name      string
	SortOrder int
	Points    []PutFullRulePoint
}

// PutFullRulePoint 完整规则点。
type PutFullRulePoint struct {
	AbilityPointID     string
	MappingType        string
	CustomLevelMapping domain.JSONSlice
	RequiredLevel      string
	Weight             float64
	Tasks              []PutFullRuleTask
}

// PutFullRuleTask 完整规则任务。
type PutFullRuleTask struct {
	TaskID   string
	MaxScore float64
	Weight   float64
}

// PutFullRule 全量保存规则（事务：更新规则→重建 items/points/tasks）。
func (s *CertificationStore) PutFullRule(ctx context.Context, tx Queryer, tenantID, ruleID, positionID, ruleSource string, levelMapping domain.JSONSlice, items []PutFullRuleItem) error {
	if levelMapping == nil {
		levelMapping = domain.JSONSlice{}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE certification_rules SET career_position_id = $1, rule_source = $2, level_mapping = $3, updated_at = NOW()
		WHERE id = $4 AND tenant_id = $5
	`, positionID, ruleSource, levelMapping, ruleID, tenantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM certification_ability_items WHERE rule_id = $1 AND tenant_id = $2
	`, ruleID, tenantID); err != nil {
		return err
	}
	for _, item := range items {
		itemID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO certification_ability_items (id, tenant_id, rule_id, name, sort_order)
			VALUES ($1, $2, $3, $4, $5)
		`, itemID, tenantID, ruleID, item.Name, item.SortOrder); err != nil {
			return err
		}
		for _, point := range item.Points {
			if point.CustomLevelMapping == nil {
				point.CustomLevelMapping = domain.JSONSlice{}
			}
			abilityPointUUID, err := uuid.Parse(point.AbilityPointID)
			if err != nil {
				abilityPointUUID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(point.AbilityPointID))
			}
			pointID := uuid.NewString()
			if _, err := tx.Exec(ctx, `
				INSERT INTO certification_ability_points (id, tenant_id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, pointID, tenantID, itemID, abilityPointUUID.String(), point.MappingType, point.CustomLevelMapping, point.RequiredLevel, point.Weight); err != nil {
				return err
			}
			for _, task := range point.Tasks {
				if _, err := tx.Exec(ctx, `
					INSERT INTO certification_related_tasks (id, tenant_id, cert_point_id, task_id, max_score, weight)
					VALUES ($1, $2, $3, $4, $5, $6)
				`, uuid.NewString(), tenantID, pointID, task.TaskID, task.MaxScore, task.Weight); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// FindPositionRule 查询岗位最新规则（无则 nil）。
func (s *CertificationStore) FindPositionRule(ctx context.Context, q Queryer, positionID, tenantID string) (*domain.CertificationRule, error) {
	var rule domain.CertificationRule
	err := q.QueryRow(ctx, `
		SELECT id, career_position_id, status, rule_source, level_mapping, created_at, updated_at
		FROM certification_rules
		WHERE tenant_id = $1 AND career_position_id = $2
		ORDER BY updated_at DESC LIMIT 1
	`, tenantID, positionID).Scan(&rule.ID, &rule.CareerPositionID, &rule.Status, &rule.RuleSource, &rule.LevelMapping, &rule.CreatedAt, &rule.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// PutWeights 保存权重（事务：自动建规则+整删整插）。
func (s *CertificationStore) PutWeights(ctx context.Context, tx Queryer, tenantID, positionID string, pointWeights, taskWeights []CertificationWeightItem) (string, error) {
	var ruleID string
	err := tx.QueryRow(ctx, `
		SELECT id FROM certification_rules
		WHERE tenant_id = $1 AND career_position_id = $2
		ORDER BY updated_at DESC LIMIT 1
	`, tenantID, positionID).Scan(&ruleID)
	if errors.Is(err, pgx.ErrNoRows) {
		ruleID = uuid.NewString()
		if _, err = tx.Exec(ctx, `
			INSERT INTO certification_rules (id, tenant_id, career_position_id, status, rule_source)
			VALUES ($1, $2, $3, 'draft', 'custom')
		`, ruleID, tenantID, positionID); err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM certification_weights WHERE rule_id = $1`, ruleID); err != nil {
		return "", err
	}
	for _, pw := range pointWeights {
		if _, err := tx.Exec(ctx, `
			INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, NULL, $4, $5)
		`, uuid.NewString(), ruleID, pw.AbilityPointID, pw.Weight, tenantID); err != nil {
			return "", err
		}
	}
	for _, tw := range taskWeights {
		if _, err := tx.Exec(ctx, `
			INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), ruleID, tw.AbilityPointID, tw.TaskID, tw.Weight, tenantID); err != nil {
			return "", err
		}
	}
	return ruleID, nil
}

// CertificationWeightItem 权重项。
type CertificationWeightItem struct {
	AbilityPointID string
	TaskID         *string
	Weight         float64
}

// LoadModel 组装岗位能力认定模型：关联链（岗位→能力域→能力点→关联任务）。
// 全部从已有数据读取，仅两级权重来自 certification_weights；ruleID 为空或权重缺失时
// 走默认均分（点按点数均分 100、点内任务按任务数均分 100，余数补第一个）。
func (s *CertificationStore) LoadModel(ctx context.Context, tenantID, positionID, ruleID string) ([]domain.CertificationModelDomain, error) {
	// 1. 岗位→能力域→能力点：读 position_ability_bindings，按 ability_point_id 去重
	bindRows, err := s.q.Query(ctx, `
		SELECT b.ability_point_id, COALESCE(b.domain, ''), b.required_level,
			COALESCE(b.rubric_description, ''), COALESCE(ap.name, ''), COALESCE(ap.description, '')
		FROM position_ability_bindings b
		LEFT JOIN ability_points ap ON ap.id = b.ability_point_id
		WHERE b.career_position_id = $1 AND b.tenant_id = $2
		ORDER BY b.id
	`, positionID, tenantID)
	if err != nil {
		return nil, err
	}
	defer bindRows.Close()

	type boundPoint struct {
		point      domain.CertificationModelPoint
		domainName string
	}
	points := make([]boundPoint, 0)
	pointIdx := map[string]int{}
	for bindRows.Next() {
		var p domain.CertificationModelPoint
		var domainName string
		if err := bindRows.Scan(&p.AbilityPointID, &domainName, &p.RequiredLevel, &p.RubricDescription, &p.Name, &p.Description); err != nil {
			return nil, err
		}
		if _, ok := pointIdx[p.AbilityPointID]; ok {
			continue
		}
		p.Tasks = []domain.CertificationModelTask{}
		pointIdx[p.AbilityPointID] = len(points)
		points = append(points, boundPoint{point: p, domainName: domainName})
	}
	if err := bindRows.Err(); err != nil {
		return nil, err
	}
	if len(points) == 0 {
		return []domain.CertificationModelDomain{}, nil
	}

	pointIDs := make([]string, len(points))
	for i, bp := range points {
		pointIDs[i] = bp.point.AbilityPointID
	}

	// 2. 能力点→关联任务：场景评分点关联链
	taskRows, err := s.q.Query(ctx, `
		SELECT DISTINCT u.ap_id, t.id, COALESCE(t.name, ''), COALESCE(s.name, '')
		FROM scenarios s
		JOIN scenario_tasks t ON t.scenario_id = s.id
		JOIN task_evaluation_methods m ON m.task_id = t.id AND m.is_enabled = TRUE
		JOIN task_eval_points p ON p.config_id = m.id
		CROSS JOIN LATERAL unnest(p.ability_point_ids) AS u(ap_id)
		WHERE s.career_position_id = $1 AND m.tenant_id = $2 AND u.ap_id = ANY($3)
		ORDER BY u.ap_id, t.id
	`, positionID, tenantID, pointIDs)
	if err != nil {
		return nil, err
	}
	defer taskRows.Close()
	for taskRows.Next() {
		var apID string
		var t domain.CertificationModelTask
		if err := taskRows.Scan(&apID, &t.TaskID, &t.TaskName, &t.ScenarioName); err != nil {
			return nil, err
		}
		t.TaskType = "scene"
		if i, ok := pointIdx[apID]; ok {
			points[i].point.Tasks = append(points[i].point.Tasks, t)
		}
	}
	if err := taskRows.Err(); err != nil {
		return nil, err
	}

	// 2a. 能力点→关联任务：scenario_tasks.ability_point_ids 直接关联
	taskDirectRows, err := s.q.Query(ctx, `
		SELECT DISTINCT u.ap_id, t.id, COALESCE(t.name, ''), COALESCE(s.name, '')
		FROM scenarios s
		JOIN scenario_tasks t ON t.scenario_id = s.id
		CROSS JOIN LATERAL unnest(t.ability_point_ids) AS u(ap_id)
		WHERE s.career_position_id = $1 AND u.ap_id = ANY($2)
		ORDER BY u.ap_id, t.id
	`, positionID, pointIDs)
	if err != nil {
		return nil, err
	}
	defer taskDirectRows.Close()
	for taskDirectRows.Next() {
		var apID string
		var t domain.CertificationModelTask
		if err := taskDirectRows.Scan(&apID, &t.TaskID, &t.TaskName, &t.ScenarioName); err != nil {
			return nil, err
		}
		t.TaskType = "scene"
		if i, ok := pointIdx[apID]; ok {
			dup := false
			for _, exist := range points[i].point.Tasks {
				if exist.TaskID == t.TaskID && exist.TaskType == "scene" {
					dup = true
					break
				}
			}
			if !dup {
				points[i].point.Tasks = append(points[i].point.Tasks, t)
			}
		}
	}
	if err := taskDirectRows.Err(); err != nil {
		return nil, err
	}

	// 2b. 能力点→关联课程：课程上 ability_point_ids 与岗位能力点匹配。
	courseRows, err := s.q.Query(ctx, `
		SELECT DISTINCT u.ap_id, c.id, COALESCE(c.name, '')
		FROM courses c
		CROSS JOIN LATERAL unnest(c.ability_point_ids) AS u(ap_id)
		WHERE c.tenant_id = $1 AND c.status = 'published' AND u.ap_id = ANY($2)
		ORDER BY u.ap_id, c.id
	`, tenantID, pointIDs)
	if err != nil {
		return nil, err
	}
	defer courseRows.Close()
	for courseRows.Next() {
		var apID string
		var t domain.CertificationModelTask
		if err := courseRows.Scan(&apID, &t.TaskID, &t.TaskName); err != nil {
			return nil, err
		}
		t.TaskType = "course"
		if i, ok := pointIdx[apID]; ok {
			points[i].point.Tasks = append(points[i].point.Tasks, t)
		}
	}
	if err := courseRows.Err(); err != nil {
		return nil, err
	}

	// 3. 两级权重：certification_weights（task_id 为 NULL 的行是能力点占岗位总分的权重）
	type weightKey struct {
		pointID, taskID string
	}
	stored := map[weightKey]float64{}
	if ruleID != "" {
		wRows, err := s.q.Query(ctx, `
			SELECT ability_point_id, task_id, weight FROM certification_weights WHERE rule_id = $1
		`, ruleID)
		if err != nil {
			return nil, err
		}
		defer wRows.Close()
		for wRows.Next() {
			var k weightKey
			var taskID *string
			var w float64
			if err := wRows.Scan(&k.pointID, &taskID, &w); err != nil {
				return nil, err
			}
			if taskID != nil {
				k.taskID = *taskID
			}
			stored[k] = w
		}
		if err := wRows.Err(); err != nil {
			return nil, err
		}
	}

	// 4. 应用权重：已存权重优先，缺省走均分兜底
	pointDefaults := splitEvenly(100, len(points))
	for i := range points {
		p := &points[i].point
		if w, ok := stored[weightKey{pointID: p.AbilityPointID}]; ok {
			p.Weight = w
		} else {
			p.Weight = pointDefaults[i]
		}
		taskDefaults := splitEvenly(100, len(p.Tasks))
		for j := range p.Tasks {
			if w, ok := stored[weightKey{pointID: p.AbilityPointID, taskID: p.Tasks[j].TaskID}]; ok {
				p.Tasks[j].Weight = w
			} else {
				p.Tasks[j].Weight = taskDefaults[j]
			}
		}
	}

	// 5. 按 domain 分组为能力域（保持绑定出现顺序）
	domains := make([]domain.CertificationModelDomain, 0)
	domainIdx := map[string]int{}
	for _, bp := range points {
		i, ok := domainIdx[bp.domainName]
		if !ok {
			i = len(domains)
			domainIdx[bp.domainName] = i
			domains = append(domains, domain.CertificationModelDomain{Name: bp.domainName, Points: []domain.CertificationModelPoint{}})
		}
		domains[i].Points = append(domains[i].Points, bp.point)
	}
	return domains, nil
}

// splitEvenly 把 total 均分为 n 份（两位小数，除不尽的余数补给第一份）。
func splitEvenly(total float64, n int) []float64 {
	parts := make([]float64, n)
	if n <= 0 {
		return parts
	}
	base := math.Floor(total/float64(n)*100) / 100
	for i := range parts {
		parts[i] = base
	}
	parts[0] = math.Round((total-base*float64(n-1))*100) / 100
	return parts
}

// FindRuleIDForPosition 返回该岗位最新的规则 ID（优先 published，无则任意）。
func (s *CertificationStore) FindRuleIDForPosition(ctx context.Context, tenantID, careerPositionID string) (string, error) {
	var ruleID string
	err := s.q.QueryRow(ctx, `
		SELECT id FROM certification_rules
		WHERE career_position_id = $1 AND tenant_id = $2 AND status = 'published'
		ORDER BY updated_at DESC LIMIT 1
	`, careerPositionID, tenantID).Scan(&ruleID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = s.q.QueryRow(ctx, `
			SELECT id FROM certification_rules
			WHERE career_position_id = $1 AND tenant_id = $2
			ORDER BY updated_at DESC LIMIT 1
		`, careerPositionID, tenantID).Scan(&ruleID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return ruleID, err
}
