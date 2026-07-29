package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
)

// CertificationModelHandler 岗位能力认定模型：关联链全链自动带出（只读），用户只配两级权重。
type CertificationModelHandler struct {
	DB *pgxpool.Pool
}

type certificationModelResponse struct {
	Rule       *domain.CertificationRule          `json:"rule"`
	PositionID string                             `json:"positionId"`
	Domains    []service.CertificationModelDomain `json:"domains"`
}

type certificationPointWeight struct {
	AbilityPointID string  `json:"abilityPointId"`
	Weight         float64 `json:"weight"`
}

type certificationTaskWeight struct {
	AbilityPointID string  `json:"abilityPointId"`
	TaskID         string  `json:"taskId"`
	Weight         float64 `json:"weight"`
}

type putCertificationWeightsRequest struct {
	PointWeights []certificationPointWeight `json:"pointWeights"`
	TaskWeights  []certificationTaskWeight  `json:"taskWeights"`
}

// GetModel GET /evaluation/certifications/positions/{positionId}/model
// 只读组装岗位能力认定模型：绑定链 + 任务关联链自动带出，权重缺省时给均分默认值。
func (h *CertificationModelHandler) GetModel(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	positionID := chi.URLParam(r, "positionId")

	rule, err := h.fetchPositionRule(r.Context(), positionID, tenantID)
	if err != nil {
		slog.Error("查询认证规则失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询认证规则失败")
		return
	}
	ruleID := ""
	if rule != nil {
		ruleID = rule.ID
	}

	domains, err := service.LoadCertificationModel(r.Context(), h.DB, tenantID, positionID, ruleID)
	if err != nil {
		slog.Error("组装岗位能力模型失败", "error", err)
		respondError(w, http.StatusInternalServerError, "组装岗位能力模型失败")
		return
	}

	respondJSON(w, http.StatusOK, certificationModelResponse{
		Rule:       rule,
		PositionID: positionID,
		Domains:    domains,
	})
}

// PutWeights PUT /evaluation/certifications/positions/{positionId}/weights
// 保存两级权重：无规则时自动创建草稿规则，事务内整删整插 certification_weights。
func (h *CertificationModelHandler) PutWeights(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	positionID := chi.URLParam(r, "positionId")

	var req putCertificationWeightsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	// 校验：pointWeights 非空时合计=100；每个能力点的 taskWeights 合计=100
	if len(req.PointWeights) > 0 {
		sum := 0.0
		for _, pw := range req.PointWeights {
			if pw.AbilityPointID == "" {
				respondError(w, http.StatusBadRequest, "缺少必填字段")
				return
			}
			sum += pw.Weight
		}
		if math.Abs(sum-100) > 0.01 {
			respondError(w, http.StatusBadRequest, "能力点权重之和必须等于 100")
			return
		}
	}
	taskSums := map[string]float64{}
	for _, tw := range req.TaskWeights {
		if tw.AbilityPointID == "" || tw.TaskID == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}
		taskSums[tw.AbilityPointID] += tw.Weight
	}
	for _, sum := range taskSums {
		if math.Abs(sum-100) > 0.01 {
			respondError(w, http.StatusBadRequest, "关联任务权重之和必须等于 100")
			return
		}
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "保存权重失败")
		return
	}
	defer tx.Rollback(r.Context())

	// 无规则时自动创建草稿规则（同一租户同一岗位只取一条）
	var ruleID string
	err = tx.QueryRow(r.Context(), `
		SELECT id FROM certification_rules
		WHERE tenant_id = $1 AND career_position_id = $2
		ORDER BY updated_at DESC LIMIT 1
	`, tenantID, positionID).Scan(&ruleID)
	if errors.Is(err, pgx.ErrNoRows) {
		ruleID = uuid.NewString()
		if _, err = tx.Exec(r.Context(), `
			INSERT INTO certification_rules (id, tenant_id, career_position_id, status, rule_source)
			VALUES ($1, $2, $3, 'draft', 'custom')
		`, ruleID, tenantID, positionID); err != nil {
			slog.Error("创建认证规则失败", "error", err)
			respondError(w, http.StatusInternalServerError, "保存权重失败")
			return
		}
	} else if err != nil {
		slog.Error("查询认证规则失败", "error", err)
		respondError(w, http.StatusInternalServerError, "保存权重失败")
		return
	}

	// 整删整插（表达式唯一索引下比 ON CONFLICT 更简单可靠）
	if _, err := tx.Exec(r.Context(), `
		DELETE FROM certification_weights WHERE rule_id = $1
	`, ruleID); err != nil {
		slog.Error("保存权重失败", "error", err)
		respondError(w, http.StatusInternalServerError, "保存权重失败")
		return
	}
	for _, pw := range req.PointWeights {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, NULL, $4, $5)
		`, uuid.NewString(), ruleID, pw.AbilityPointID, pw.Weight, tenantID); err != nil {
			slog.Error("保存权重失败", "error", err)
			respondError(w, http.StatusInternalServerError, "保存权重失败")
			return
		}
	}
	for _, tw := range req.TaskWeights {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.NewString(), ruleID, tw.AbilityPointID, tw.TaskID, tw.Weight, tenantID); err != nil {
			slog.Error("保存权重失败", "error", err)
			respondError(w, http.StatusInternalServerError, "保存权重失败")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		slog.Error("保存权重失败", "error", err)
		respondError(w, http.StatusInternalServerError, "保存权重失败")
		return
	}

	rule, err := h.fetchPositionRule(r.Context(), positionID, tenantID)
	if err != nil || rule == nil {
		slog.Error("查询认证规则失败", "error", err)
		respondError(w, http.StatusInternalServerError, "保存权重失败")
		return
	}
	respondJSON(w, http.StatusOK, rule)
}

// fetchPositionRule 取该岗位当前租户的认证规则（最新一条），无规则返回 nil。
func (h *CertificationModelHandler) fetchPositionRule(ctx context.Context, positionID, tenantID string) (*domain.CertificationRule, error) {
	var rule domain.CertificationRule
	err := h.DB.QueryRow(ctx, `
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
