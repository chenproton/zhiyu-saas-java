package handler

import (
	"math"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// CertificationModelHandler 岗位能力认定模型：关联链全链自动带出（只读），用户只配两级权重。
type CertificationModelHandler struct {
	Service *service.EvaluationService
}

type certificationModelResponse struct {
	Rule       *domain.CertificationRule         `json:"rule"`
	PositionID string                            `json:"positionId"`
	Domains    []domain.CertificationModelDomain `json:"domains"`
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

func (h *CertificationModelHandler) GetModel(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	positionID := chi.URLParam(r, "positionId")

	rule, err := h.Service.FindPositionRule(r.Context(), positionID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询认证规则失败")
		return
	}
	ruleID := ""
	if rule != nil {
		ruleID = rule.ID
	}

	domains, err := h.Service.LoadCertificationModel(r.Context(), tenantID, positionID, ruleID)
	if err != nil {
		respondServerError(w, r, err, "组装岗位能力模型失败")
		return
	}
	respondJSON(w, http.StatusOK, certificationModelResponse{
		Rule:       rule,
		PositionID: positionID,
		Domains:    domains,
	})
}

func (h *CertificationModelHandler) PutWeights(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	positionID := chi.URLParam(r, "positionId")

	positionTenantID, err := h.Service.PositionTenantID(r.Context(), positionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}

	var req putCertificationWeightsRequest
	if !decodeBody(w, r, &req) {
		return
	}
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

	pointWeights := make([]store.CertificationWeightItem, 0, len(req.PointWeights))
	for _, pw := range req.PointWeights {
		pointWeights = append(pointWeights, store.CertificationWeightItem{AbilityPointID: pw.AbilityPointID, Weight: pw.Weight})
	}
	taskWeights := make([]store.CertificationWeightItem, 0, len(req.TaskWeights))
	for _, tw := range req.TaskWeights {
		taskWeights = append(taskWeights, store.CertificationWeightItem{AbilityPointID: tw.AbilityPointID, TaskID: store.StrPtrIfNonEmpty(tw.TaskID), Weight: tw.Weight})
	}

	err = h.Service.PutCertificationWeights(r.Context(), tenantID, positionID, pointWeights, taskWeights)
	if err != nil {
		respondServerError(w, r, err, "保存权重失败")
		return
	}

	rule, err := h.Service.FindPositionRule(r.Context(), positionID, tenantID)
	if err != nil || rule == nil {
		respondServerError(w, r, err, "保存权重失败")
		return
	}
	respondJSON(w, http.StatusOK, rule)
}
