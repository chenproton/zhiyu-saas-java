package handler

import (
	"errors"
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CertificationHandler struct {
	DB *pgxpool.Pool
}

type CertificationRuleListResponse struct {
	Items []domain.CertificationRule `json:"items"`
	Total int                        `json:"total"`
}

type CreateCertificationRuleRequest struct {
	CareerPositionID string `json:"careerPositionId"`
	RuleSource       string `json:"ruleSource"`
}

type CertificationItemListResponse struct {
	Items []domain.CertificationAbilityItem `json:"items"`
	Total int                               `json:"total"`
}

type CreateCertificationItemRequest struct {
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

type CertificationPointListResponse struct {
	Items []domain.CertificationAbilityPoint `json:"items"`
	Total int                                `json:"total"`
}

type CreateCertificationPointRequest struct {
	AbilityPointID     string           `json:"abilityPointId"`
	MappingType        string           `json:"mappingType"`
	CustomLevelMapping domain.JSONSlice `json:"customLevelMapping"`
	RequiredLevel      string           `json:"requiredLevel"`
	Weight             float64          `json:"weight"`
}

func (h *CertificationHandler) ListRules(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.CertificationRule]{
		Table:         "certification_rules",
		SelectColumns: "id, career_position_id, status, rule_source, created_at, updated_at",
		TenantScoped:  true,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status := r.URL.Query().Get("status"); status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.scanRuleRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, CertificationRuleListResponse{Items: items, Total: total})
}

func (h *CertificationHandler) GetRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	rule, err := h.fetchRule(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}
	respondJSON(w, http.StatusOK, rule)
}

func (h *CertificationHandler) CreateRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateCertificationRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO certification_rules (id, tenant_id, career_position_id, status, rule_source)
		VALUES ($1, $2, $3, 'draft', $4)
	`, id, tenantID, req.CareerPositionID, req.RuleSource)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建认证规则失败")
		return
	}

	rule, _ := h.fetchRule(r.Context(), id)
	respondJSON(w, http.StatusCreated, rule)
}

func (h *CertificationHandler) UpdateRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	var req CreateCertificationRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE certification_rules SET career_position_id = $1, rule_source = $2, updated_at = NOW()
		WHERE id = $3
	`, req.CareerPositionID, req.RuleSource, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新认证规则失败")
		return
	}

	rule, _ := h.fetchRule(r.Context(), id)
	respondJSON(w, http.StatusOK, rule)
}

func (h *CertificationHandler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM certification_rules WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除认证规则失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificationHandler) ConfigItems(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	ruleID := chi.URLParam(r, "ruleId")
	if _, err := h.fetchRule(r.Context(), ruleID); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateCertificationItemRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "无效请求体")
			return
		}
		if req.Name == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}

		tenantID, ok := requireTenant(w, r); if !ok { return }

		id := uuid.NewString()
		_, err := h.DB.Exec(r.Context(), `
			INSERT INTO certification_ability_items (id, tenant_id, rule_id, name, sort_order)
			VALUES ($1, $2, $3, $4, $5)
		`, id, tenantID, ruleID, req.Name, req.SortOrder)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建认证项失败")
			return
		}

		item, _ := h.fetchItem(r.Context(), id)
		respondJSON(w, http.StatusCreated, item)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, rule_id, name, sort_order
		FROM certification_ability_items WHERE rule_id = $1 ORDER BY sort_order
	`, ruleID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询认证项失败")
		return
	}
	defer rows.Close()

	items := make([]domain.CertificationAbilityItem, 0)
	for rows.Next() {
		var item domain.CertificationAbilityItem
		if err := rows.Scan(&item.ID, &item.RuleID, &item.Name, &item.SortOrder); err != nil {
			respondError(w, http.StatusInternalServerError, "读取认证项失败")
			return
		}
		items = append(items, item)
	}
	respondJSON(w, http.StatusOK, CertificationItemListResponse{Items: items, Total: len(items)})
}

func (h *CertificationHandler) ConfigPoints(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	itemID := chi.URLParam(r, "itemId")
	if _, err := h.fetchItem(r.Context(), itemID); err != nil {
		respondError(w, http.StatusNotFound, "认证项不存在")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateCertificationPointRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "无效请求体")
			return
		}
		if req.AbilityPointID == "" || req.RequiredLevel == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}

		tenantID, ok := requireTenant(w, r); if !ok { return }

		id := uuid.NewString()
		if req.CustomLevelMapping == nil {
			req.CustomLevelMapping = domain.JSONSlice{}
		}
		abilityPointUUID, err := uuid.Parse(req.AbilityPointID)
		if err != nil {
			abilityPointUUID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(req.AbilityPointID))
		}
		_, err = h.DB.Exec(r.Context(), `
			INSERT INTO certification_ability_points (id, tenant_id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, id, tenantID, itemID, abilityPointUUID.String(), req.MappingType, req.CustomLevelMapping, req.RequiredLevel, req.Weight)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建认证点失败")
			return
		}

		point, _ := h.fetchPoint(r.Context(), id)
		respondJSON(w, http.StatusCreated, point)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight
		FROM certification_ability_points WHERE item_id = $1 ORDER BY id
	`, itemID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询认证点失败")
		return
	}
	defer rows.Close()

	items := make([]domain.CertificationAbilityPoint, 0)
	for rows.Next() {
		var point domain.CertificationAbilityPoint
		if err := rows.Scan(&point.ID, &point.ItemID, &point.AbilityPointID, &point.MappingType, &point.CustomLevelMapping, &point.RequiredLevel, &point.Weight); err != nil {
			respondError(w, http.StatusInternalServerError, "读取认证点失败")
			return
		}
		items = append(items, point)
	}
	respondJSON(w, http.StatusOK, CertificationPointListResponse{Items: items, Total: len(items)})
}

func (h *CertificationHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchItem(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证项不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM certification_ability_items WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除认证项失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificationHandler) DeletePoint(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证点不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM certification_ability_points WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除认证点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificationHandler) fetchRule(ctx context.Context, id string) (domain.CertificationRule, error) {
	var rule domain.CertificationRule
	err := h.DB.QueryRow(ctx, `
		SELECT id, career_position_id, status, rule_source, created_at, updated_at
		FROM certification_rules WHERE id = $1
	`, id).Scan(&rule.ID, &rule.CareerPositionID, &rule.Status, &rule.RuleSource, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return rule, err
	}
	return rule, nil
}

func (h *CertificationHandler) scanRuleRows(rows pgx.Rows) ([]domain.CertificationRule, error) {
	items := make([]domain.CertificationRule, 0)
	for rows.Next() {
		var rule domain.CertificationRule
		if err := rows.Scan(&rule.ID, &rule.CareerPositionID, &rule.Status, &rule.RuleSource, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, rule)
	}
	return items, nil
}

type CertificationFullItem struct {
	ID          string                    `json:"id"`
	Name        string                    `json:"name"`
	SortOrder   int                       `json:"sortOrder"`
	AbilityName string                    `json:"abilityName,omitempty"`
	Points      []CertificationFullPoint  `json:"points"`
}

type CertificationFullPoint struct {
	ID                 string                      `json:"id"`
	Name               string                      `json:"name"`
	Description        string                      `json:"description"`
	MappingType        string                      `json:"mappingType"`
	CustomLevelMapping domain.JSONSlice            `json:"customLevelMapping,omitempty"`
	RequiredLevel      string                      `json:"requiredLevel"`
	Weight             float64                     `json:"weight"`
	Tasks              []domain.CertificationRelatedTask `json:"tasks,omitempty"`
}

func (h *CertificationHandler) GetFullRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	ruleID := chi.URLParam(r, "id")
	rule, err := h.fetchRule(r.Context(), ruleID)
	if err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	itemRows, err := h.DB.Query(r.Context(), `
		SELECT i.id, i.name, i.sort_order,
			COALESCE((SELECT name FROM ability_points WHERE id = p.ability_point_id LIMIT 1), '')
		FROM certification_ability_items i
		LEFT JOIN certification_ability_points p ON p.item_id = i.id
		WHERE i.rule_id = $1
		GROUP BY i.id, i.name, i.sort_order
		ORDER BY i.sort_order
	`, ruleID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询项失败")
		return
	}
	defer itemRows.Close()

	var items []CertificationFullItem
	var itemIDs []string
	for itemRows.Next() {
		var item CertificationFullItem
		if err := itemRows.Scan(&item.ID, &item.Name, &item.SortOrder, &item.AbilityName); err != nil {
			continue
		}
		item.Points = []CertificationFullPoint{}
		items = append(items, item)
		itemIDs = append(itemIDs, item.ID)
	}

	if len(itemIDs) > 0 {
		pointRows, err := h.DB.Query(r.Context(), `
			SELECT p.id, p.item_id,
				COALESCE((SELECT name FROM ability_points WHERE id = p.ability_point_id), ''),
				COALESCE((SELECT description FROM ability_points WHERE id = p.ability_point_id), ''),
				p.mapping_type, p.custom_level_mapping, p.required_level, p.weight
			FROM certification_ability_points p
			WHERE p.item_id = ANY($1)
			ORDER BY p.item_id, p.id
		`, itemIDs)
		if err == nil {
			defer pointRows.Close()
			itemPointMap := make(map[string][]CertificationFullPoint)
			for pointRows.Next() {
				var p CertificationFullPoint
				var itemID string
				if err := pointRows.Scan(&p.ID, &itemID, &p.Name, &p.Description, &p.MappingType, &p.CustomLevelMapping, &p.RequiredLevel, &p.Weight); err != nil {
					continue
				}
				p.Tasks = []domain.CertificationRelatedTask{}
				itemPointMap[itemID] = append(itemPointMap[itemID], p)
			}

			var pointIDs []string
			for _, pts := range itemPointMap {
				for _, p := range pts {
					pointIDs = append(pointIDs, p.ID)
				}
			}

			if len(pointIDs) > 0 {
				taskRows, err := h.DB.Query(r.Context(), `
					SELECT id, cert_point_id, task_id, max_score, weight
					FROM certification_related_tasks
					WHERE cert_point_id = ANY($1)
				`, pointIDs)
				if err == nil {
					defer taskRows.Close()
					pointTaskMap := make(map[string][]domain.CertificationRelatedTask)
					for taskRows.Next() {
						var t domain.CertificationRelatedTask
						if err := taskRows.Scan(&t.ID, &t.CertPointID, &t.TaskID, &t.MaxScore, &t.Weight); err == nil {
							pointTaskMap[t.CertPointID] = append(pointTaskMap[t.CertPointID], t)
						}
					}
					for i, item := range items {
						if pts, ok := itemPointMap[item.ID]; ok {
							for j, p := range pts {
								if tasks, ok := pointTaskMap[p.ID]; ok {
									items[i].Points[j].Tasks = tasks
								}
							}
							items[i].Points = pts
						}
					}
				}
			} else {
				for i, item := range items {
					if pts, ok := itemPointMap[item.ID]; ok {
						items[i].Points = pts
					}
				}
			}
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"rule":  rule,
		"items": items,
	})
}

func (h *CertificationHandler) fetchItem(ctx context.Context, id string) (domain.CertificationAbilityItem, error) {
	var item domain.CertificationAbilityItem
	err := h.DB.QueryRow(ctx, `
		SELECT id, rule_id, name, sort_order FROM certification_ability_items WHERE id = $1
	`, id).Scan(&item.ID, &item.RuleID, &item.Name, &item.SortOrder)
	return item, err
}

func (h *CertificationHandler) fetchPoint(ctx context.Context, id string) (domain.CertificationAbilityPoint, error) {
	var point domain.CertificationAbilityPoint
	err := h.DB.QueryRow(ctx, `
		SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight
		FROM certification_ability_points WHERE id = $1
	`, id).Scan(&point.ID, &point.ItemID, &point.AbilityPointID, &point.MappingType, &point.CustomLevelMapping, &point.RequiredLevel, &point.Weight)
	return point, err
}
