package store

import (
	"context"
	"errors"
	"time"

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

var _ = time.Time{}

// PutFullRuleItem 完整规则项。
type PutFullRuleItem struct {
	Name       string
	SortOrder  int
	Points     []PutFullRulePoint
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
