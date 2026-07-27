package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CertGradeHandler struct {
	DB *pgxpool.Pool
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
	TotalPoints int                  `json:"totalPoints"`
	AvgRate     float64              `json:"avgRate"`
	LastUpdated string               `json:"lastUpdated"`
	CompData    []CompGroupDTO       `json:"compData"`
	Leaderboard []LeaderboardEntryDTO `json:"leaderboard"`
}

func (h *CertGradeHandler) ListGrades(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	positionID := chi.URLParam(r, "id")
	if positionID == "" {
		respondError(w, http.StatusBadRequest, "missing position id")
		return
	}

	var positionTenantID string
	if err := h.DB.QueryRow(r.Context(), `SELECT tenant_id FROM career_positions WHERE id = $1`, positionID).Scan(&positionTenantID); err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}

	gradeRows, err := h.DB.Query(r.Context(), `
		SELECT id, position_id, grade_year, total_ability_points, avg_achievement_rate, last_updated
		FROM certification_grade_data
		WHERE position_id = $1
		ORDER BY grade_year DESC
	`, positionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to query grade data")
		return
	}
	defer gradeRows.Close()

	type gradeRow struct {
		ID                 string
		PositionID         string
		GradeYear          int
		TotalAbilityPoints int
		AvgAchievementRate *float64
		LastUpdated        string
	}
	var grades []gradeRow
	var gradeIDs []string
	for gradeRows.Next() {
		var g gradeRow
		var lu interface{}
		if err := gradeRows.Scan(&g.ID, &g.PositionID, &g.GradeYear, &g.TotalAbilityPoints, &g.AvgAchievementRate, &lu); err != nil {
			continue
		}
		if t, ok := lu.(interface{ Format(string) string }); ok {
			g.LastUpdated = t.Format("2006-01-02")
		}
		grades = append(grades, g)
		gradeIDs = append(gradeIDs, g.ID)
	}

	if len(grades) == 0 {
		respondJSON(w, http.StatusOK, map[string]interface{}{"grades": map[string]GradeDataDTO{}})
		return
	}

	type compRow struct {
		GradeDataID  string
		DutyName     string
		ItemName     string
		TargetLevel  int
		CurrentLevel int
		Description  string
		SortOrder    int
	}

	var allComps []compRow
	if len(gradeIDs) > 0 {
		compRows, err := h.DB.Query(r.Context(), `
			SELECT grade_data_id, duty_name, item_name, target_level, current_level,
				COALESCE(description, ''), sort_order
			FROM certification_competency_requirements
			WHERE grade_data_id = ANY($1)
			ORDER BY grade_data_id, sort_order
		`, gradeIDs)
		if err == nil {
			defer compRows.Close()
			for compRows.Next() {
				var c compRow
				if err := compRows.Scan(&c.GradeDataID, &c.DutyName, &c.ItemName, &c.TargetLevel, &c.CurrentLevel, &c.Description, &c.SortOrder); err == nil {
					allComps = append(allComps, c)
				}
			}
		}
	}

	type lbRow struct {
		GradeDataID     string
		StudentName     string
		ClassName       string
		MajorName       string
		AchievementRate float64
		GradeLabel      string
		SortOrder       int
		UserID          string
	}

	var allLB []lbRow
	if len(gradeIDs) > 0 {
		lbRows, err := h.DB.Query(r.Context(), `
			SELECT cgl.grade_data_id, cgl.student_name, COALESCE(cgl.class_name, ''), COALESCE(m.name, '') AS major_name,
				COALESCE(cgl.achievement_rate, 0), COALESCE(cgl.grade_label, ''), cgl.sort_order, cgl.user_id
			FROM certification_grade_leaderboard cgl
			LEFT JOIN majors m ON m.id = cgl.major_id
			WHERE cgl.grade_data_id = ANY($1)
			ORDER BY cgl.grade_data_id, cgl.sort_order
		`, gradeIDs)
		if err == nil {
			defer lbRows.Close()
			for lbRows.Next() {
				var l lbRow
				if err := lbRows.Scan(&l.GradeDataID, &l.StudentName, &l.ClassName, &l.MajorName, &l.AchievementRate, &l.GradeLabel, &l.SortOrder, &l.UserID); err == nil {
					allLB = append(allLB, l)
				}
			}
		}
	}

	result := make(map[string]GradeDataDTO)
	for _, g := range grades {
		gradeKey := itoa(g.GradeYear)
		dto := GradeDataDTO{
			TotalPoints: g.TotalAbilityPoints,
			LastUpdated: g.LastUpdated,
		}
		if g.AvgAchievementRate != nil {
			dto.AvgRate = *g.AvgAchievementRate
		}

		dutyMap := make(map[string][]CompItemDTO)
		dutyOrder := []string{}
		for _, c := range allComps {
			if c.GradeDataID != g.ID { continue }
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
			if l.GradeDataID != g.ID { continue }
			dto.Leaderboard = append(dto.Leaderboard, LeaderboardEntryDTO{
				ID: l.UserID, StudentName: l.StudentName, ClassName: l.ClassName,
				Major: l.MajorName, AchievementRate: l.AchievementRate, Grade: l.GradeLabel,
			})
		}

		result[gradeKey] = dto
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"grades": result})
}
