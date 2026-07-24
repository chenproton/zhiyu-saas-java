package handler

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type LandingHandler struct {
	DB *pgxpool.Pool
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
	now := time.Now()

	query := `
		SELECT e.id, e.name, COALESCE(e.description, ''), e.duration,
			COALESCE((SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id), 0),
			eu.start_time, eu.end_time,
			COALESCE(org.name, ''),
			COALESCE(parent_org.name, '')
		FROM exams e
		JOIN exam_usages eu ON eu.exam_id = e.id
		LEFT JOIN LATERAL (
			SELECT o.id, o.name, o.parent_id
			FROM organizations o
			WHERE o.id = ANY(eu.target_ids)
			LIMIT 1
		) org ON TRUE
		LEFT JOIN organizations parent_org ON parent_org.id = org.parent_id
		WHERE e.status = 'published' AND e.is_temp = FALSE
		ORDER BY eu.start_time ASC NULLS LAST
		LIMIT 100`

	rows, err := h.DB.Query(r.Context(), query)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list landing exams")
		return
	}
	defer rows.Close()

	var items []LandingExamItem
	for rows.Next() {
		var item LandingExamItem
		var startTime, endTime interface{}
		var orgName, collegeName string

		if err := rows.Scan(
			&item.ID, &item.Name, &item.Description, &item.Duration,
			&item.QuestionCount,
			&startTime, &endTime,
			&orgName, &collegeName,
		); err != nil {
			continue
		}

		item.Type = "在线测评"
		item.College = collegeName
		if item.College == "" {
			item.College = orgName
		}
		item.Major = orgName

		item.TargetAudience = ""

		if t, ok := startTime.(time.Time); ok {
			item.Time = t.Format("2006-01-02 15:04")
		} else if t, ok := startTime.(interface{ Format(string) string }); ok {
			item.Time = t.Format("2006-01-02 15:04")
		}

		item.Status = computeExamStatus(startTime, endTime, now)

		items = append(items, item)
	}

	respondJSON(w, http.StatusOK, LandingExamListResponse{Items: items, Total: len(items)})
}

func computeExamStatus(start, end interface{}, now time.Time) string {
	var startTime, endTime time.Time

	if t, ok := start.(time.Time); ok {
		startTime = t
	}
	if t, ok := end.(time.Time); ok {
		endTime = t
	}

	if endTime.IsZero() {
		return "未开始"
	}
	if now.After(endTime) {
		return "已结束"
	}
	if !startTime.IsZero() && now.Before(startTime) {
		return "未开始"
	}
	return "进行中"
}

func joinStrings(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if p == "" { continue }
		if i > 0 { result += sep }
		result += p
	}
	return result
}
