package handler

import (
	"net/http"
	"time"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type LandingHandler struct {
	Service *service.PositionService
}

type LandingExamItem struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Status         string `json:"status"`
	Type           string `json:"type"`
	Time           string `json:"time"`
	Duration       int    `json:"duration"`
	QuestionCount  int    `json:"questionCount"`
	Description    string `json:"description"`
	College        string `json:"college"`
	Major          string `json:"major"`
	TargetAudience string `json:"targetAudience"`
}

type LandingExamListResponse struct {
	Items []LandingExamItem `json:"items"`
	Total int               `json:"total"`
}

func (h *LandingHandler) ListExams(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	now := time.Now()
	exams, err := h.Service.ListLandingExams(r.Context(), effectiveTenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询落地考试失败")
		return
	}

	items := make([]LandingExamItem, 0, len(exams))
	for _, e := range exams {
		item := LandingExamItem{
			ID: e.ID, Name: e.Name, Description: e.Description, Duration: e.Duration,
			QuestionCount: e.QuestionCount, Type: "在线测评",
			College: e.CollegeName, Major: e.OrgName, TargetAudience: "",
		}
		if item.College == "" {
			item.College = e.OrgName
		}
		if e.StartTime != nil {
			item.Time = e.StartTime.Format("2006-01-02 15:04")
		}
		item.Status = computeExamStatus(e.StartTime, e.EndTime, now)
		items = append(items, item)
	}
	respondJSON(w, http.StatusOK, LandingExamListResponse{Items: items, Total: len(items)})
}

func computeExamStatus(start, end interface{}, now time.Time) string {
	var startTime, endTime *time.Time
	if t, ok := start.(*time.Time); ok {
		startTime = t
	}
	if t, ok := end.(*time.Time); ok {
		endTime = t
	}
	if startTime == nil || startTime.IsZero() {
		return "进行中"
	}
	if now.Before(*startTime) {
		return "未开始"
	}
	if endTime != nil && !endTime.IsZero() && now.After(*endTime) {
		return "已结束"
	}
	return "进行中"
}

func joinStrings(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}
