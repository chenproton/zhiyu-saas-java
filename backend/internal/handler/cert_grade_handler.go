package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type CertGradeHandler struct {
	Service *service.EvaluationService
}

type CompItemDTO struct {
	Name    string `json:"name"`
	Target  int    `json:"target"`
	Current int    `json:"current"`
	Desc    string `json:"desc"`
}

type CompGroupDTO struct {
	Duty  string        `json:"duty"`
	Items []CompItemDTO `json:"items"`
}

type LeaderboardEntryDTO struct {
	ID              string  `json:"id"`
	StudentName     string  `json:"studentName"`
	ClassName       string  `json:"className"`
	Major           string  `json:"major"`
	AchievementRate float64 `json:"achievementRate"`
	Grade           string  `json:"grade"`
}

type GradeDataDTO struct {
	TotalPoints int                   `json:"totalPoints"`
	AvgRate     float64               `json:"avgRate"`
	LastUpdated string                `json:"lastUpdated"`
	CompData    []CompGroupDTO        `json:"compData"`
	Leaderboard []LeaderboardEntryDTO `json:"leaderboard"`
}

func (h *CertGradeHandler) ListGrades(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	positionID := chi.URLParam(r, "id")
	if positionID == "" {
		respondError(w, http.StatusBadRequest, "缺少岗位ID")
		return
	}

	positionTenantID, err := h.Service.PositionTenantID(r.Context(), positionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}

	grades, allComps, allLB, err := h.Service.ListCertGrades(r.Context(), positionID)
	if err != nil {
		respondServerError(w, r, err, "查询grade data失败")
		return
	}

	if len(grades) == 0 {
		respondJSON(w, http.StatusOK, map[string]interface{}{"grades": map[string]GradeDataDTO{}})
		return
	}

	lastUpdatedMap := make(map[string]string)
	for _, g := range grades {
		if g.LastUpdated != nil && len(*g.LastUpdated) >= 10 {
			lastUpdatedMap[g.ID] = (*g.LastUpdated)[:10]
		}
	}

	result := make(map[string]GradeDataDTO)
	for _, g := range grades {
		gradeKey := itoa(g.GradeYear)
		dto := GradeDataDTO{
			TotalPoints: g.TotalAbilityPoints,
			LastUpdated: lastUpdatedMap[g.ID],
		}
		if g.AvgAchievementRate != nil {
			dto.AvgRate = *g.AvgAchievementRate
		}

		dutyMap := make(map[string][]CompItemDTO)
		dutyOrder := []string{}
		for _, c := range allComps {
			if c.GradeDataID != g.ID {
				continue
			}
			if _, ok := dutyMap[c.DutyName]; !ok {
				dutyOrder = append(dutyOrder, c.DutyName)
			}
			dutyMap[c.DutyName] = append(dutyMap[c.DutyName], CompItemDTO{
				Name: c.ItemName, Target: c.TargetLevel, Current: c.CurrentLevel, Desc: c.Description,
			})
		}
		for _, duty := range dutyOrder {
			dto.CompData = append(dto.CompData, CompGroupDTO{Duty: duty, Items: dutyMap[duty]})
		}

		for _, l := range allLB {
			if l.GradeDataID != g.ID {
				continue
			}
			dto.Leaderboard = append(dto.Leaderboard, LeaderboardEntryDTO{
				ID: l.UserID, StudentName: l.StudentName, ClassName: l.ClassName,
				Major: l.MajorName, AchievementRate: l.AchievementRate, Grade: l.GradeLabel,
			})
		}

		result[gradeKey] = dto
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"grades": result})
}
