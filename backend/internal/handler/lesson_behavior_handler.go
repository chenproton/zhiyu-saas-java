package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type LessonBehaviorHandler struct {
	DB *pgxpool.Pool
}

type LessonBehaviorAggregate struct {
	SignIn             SignInSummary        `json:"signIn"`
	SignInDaily        []DailySignIn        `json:"signInDaily"`
	QuizResults        []QuizResult         `json:"quizResults"`
	RushAnswerRanking  []RushRank           `json:"rushAnswerRanking"`
	ClassInteraction   []InteractionItem    `json:"classInteraction"`
	AttendanceRateData []RateItem           `json:"attendanceRateData"`
	StudentDetails     []StudentBehaviorRow `json:"studentDetails"`
}

type SignInSummary struct {
	Total   int `json:"total"`
	Present int `json:"present"`
	Late    int `json:"late"`
	Absent  int `json:"absent"`
	Rate    int `json:"rate"`
}

type DailySignIn struct {
	Date    string `json:"date"`
	Present int    `json:"present"`
	Late    int    `json:"late"`
	Absent  int    `json:"absent"`
}

type QuizResult struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	AvgScore int    `json:"avgScore"`
	PassRate int    `json:"passRate"`
	Count    int    `json:"count"`
}

type RushRank struct {
	Rank         int    `json:"rank"`
	Name         string `json:"name"`
	CorrectCount int    `json:"correctCount"`
	AvgTime      string `json:"avgTime"`
	Badge        string `json:"badge"`
}

type InteractionItem struct {
	Name   string `json:"name"`
	Active int    `json:"active"`
	Total  int    `json:"total"`
}

type RateItem struct {
	Name string `json:"name"`
	Rate int    `json:"rate"`
}

type StudentBehaviorRow struct {
	Name        string `json:"name"`
	Attendance  int    `json:"attendance"`
	QuizAvg     int    `json:"quizAvg"`
	Interaction int    `json:"interaction"`
	Praise      int    `json:"praise"`
}

type CreateLessonBehaviorRequest struct {
	CourseID         string   `json:"courseId"`
	StudentUserID    string   `json:"studentUserId"`
	RecordDate       string   `json:"recordDate"`
	Attendance       string   `json:"attendance"`
	QuizScore        *float64 `json:"quizScore,omitempty"`
	InteractionCount int      `json:"interactionCount"`
	PraiseCount      int      `json:"praiseCount"`
	RushCorrectCount int      `json:"rushCorrectCount"`
	RushAvgTimeSec   *int     `json:"rushAvgTimeSec,omitempty"`
}

func (h *LessonBehaviorHandler) Aggregate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	courseID := r.URL.Query().Get("courseId")
	if courseID == "" {
		respondJSON(w, http.StatusOK, LessonBehaviorAggregate{
			SignIn: SignInSummary{},
		})
		return
	}

	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")

	records, err := h.listRecords(r.Context(), courseID, startDate, endDate)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "加载behavior records失败")
		return
	}

	respondJSON(w, http.StatusOK, h.buildAggregate(records))
}

func (h *LessonBehaviorHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateLessonBehaviorRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CourseID == "" || req.StudentUserID == "" {
		respondError(w, http.StatusBadRequest, "缺少课程ID或学生用户ID")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	record, err := h.upsert(r.Context(), req, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "保存behavior record失败")
		return
	}
	respondJSON(w, http.StatusCreated, record)
}

func (h *LessonBehaviorHandler) listRecords(ctx context.Context, courseID, startDate, endDate string) ([]domain.LessonBehaviorRecord, error) {
	args := []interface{}{courseID}
	query := `
		SELECT r.id, r.course_id, r.student_user_id, u.name, r.record_date, r.attendance,
			   r.quiz_score, r.interaction_count, r.praise_count, r.rush_correct_count, r.rush_avg_time_sec,
			   r.created_at, r.updated_at
		FROM lesson_behavior_records r
		JOIN users u ON u.id = r.student_user_id
		WHERE r.course_id = $1`

	if startDate != "" {
		args = append(args, startDate)
		query += " AND r.record_date >= $" + strconv.Itoa(len(args))
	}
	if endDate != "" {
		args = append(args, endDate)
		query += " AND r.record_date <= $" + strconv.Itoa(len(args))
	}
	query += " ORDER BY r.record_date DESC, r.created_at DESC"

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []domain.LessonBehaviorRecord
	for rows.Next() {
		var rec domain.LessonBehaviorRecord
		var studentName string
		var recordDate time.Time
		var quizScore *float64
		var rushTime *int
		if err := rows.Scan(&rec.ID, &rec.CourseID, &rec.StudentUserID, &studentName, &recordDate, &rec.Attendance,
			&quizScore, &rec.InteractionCount, &rec.PraiseCount, &rec.RushCorrectCount, &rushTime,
			&rec.CreatedAt, &rec.UpdatedAt); err != nil {
			return nil, err
		}
		rec.StudentName = studentName
		rec.RecordDate = recordDate.Format("2006-01-02")
		rec.QuizScore = quizScore
		rec.RushAvgTimeSec = rushTime
		records = append(records, rec)
	}
	return records, nil
}

func (h *LessonBehaviorHandler) upsert(ctx context.Context, req CreateLessonBehaviorRequest, tenantID string) (*domain.LessonBehaviorRecord, error) {
	recordDate := req.RecordDate
	if recordDate == "" {
		recordDate = time.Now().Format("2006-01-02")
	}

	var rec domain.LessonBehaviorRecord
	var recordDateOut time.Time
	err := h.DB.QueryRow(ctx, `
		INSERT INTO lesson_behavior_records
		(tenant_id, course_id, student_user_id, record_date, attendance, quiz_score, interaction_count, praise_count, rush_correct_count, rush_avg_time_sec)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (course_id, student_user_id, record_date)
		DO UPDATE SET attendance = EXCLUDED.attendance,
					  quiz_score = EXCLUDED.quiz_score,
					  interaction_count = EXCLUDED.interaction_count,
					  praise_count = EXCLUDED.praise_count,
					  rush_correct_count = EXCLUDED.rush_correct_count,
					  rush_avg_time_sec = EXCLUDED.rush_avg_time_sec,
					  updated_at = NOW()
		RETURNING id, course_id, student_user_id, record_date, attendance, quiz_score, interaction_count, praise_count, rush_correct_count, rush_avg_time_sec, created_at, updated_at
	`, tenantID, req.CourseID, req.StudentUserID, recordDate, req.Attendance, req.QuizScore, req.InteractionCount, req.PraiseCount, req.RushCorrectCount, req.RushAvgTimeSec).Scan(
		&rec.ID, &rec.CourseID, &rec.StudentUserID, &recordDateOut, &rec.Attendance,
		&rec.QuizScore, &rec.InteractionCount, &rec.PraiseCount, &rec.RushCorrectCount, &rec.RushAvgTimeSec,
		&rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		return nil, err
	}
	rec.RecordDate = recordDateOut.Format("2006-01-02")
	return &rec, nil
}

func (h *LessonBehaviorHandler) buildAggregate(records []domain.LessonBehaviorRecord) LessonBehaviorAggregate {
	agg := LessonBehaviorAggregate{
		SignIn: SignInSummary{},
	}
	if len(records) == 0 {
		return agg
	}

	dailyMap := make(map[string]*DailySignIn)
	studentMap := make(map[string]*studentAcc)
	rateMap := make(map[string]*rateAcc)
	var totalQuizScore float64
	var quizCount int
	var quizPassed int
	var totalInteractions, totalPraise, totalRush int

	for _, rec := range records {
		switch rec.Attendance {
		case "present":
			agg.SignIn.Present++
		case "late":
			agg.SignIn.Late++
		case "absent":
			agg.SignIn.Absent++
		}
		agg.SignIn.Total++

		dateLabel := formatMD(rec.RecordDate)
		ds := dailyMap[dateLabel]
		if ds == nil {
			ds = &DailySignIn{Date: dateLabel}
			dailyMap[dateLabel] = ds
		}
		switch rec.Attendance {
		case "present":
			ds.Present++
		case "late":
			ds.Late++
		case "absent":
			ds.Absent++
		}

		if rec.QuizScore != nil {
			totalQuizScore += *rec.QuizScore
			quizCount++
			if *rec.QuizScore >= 60 {
				quizPassed++
			}
		}

		totalInteractions += rec.InteractionCount
		totalPraise += rec.PraiseCount
		totalRush += rec.RushCorrectCount

		acc := studentMap[rec.StudentUserID]
		if acc == nil {
			acc = &studentAcc{studentUserID: rec.StudentUserID}
			studentMap[rec.StudentUserID] = acc
		}
		acc.name = rec.StudentName
		acc.records++
		if rec.Attendance == "present" {
			acc.present++
		}
		if rec.QuizScore != nil {
			acc.quizSum += *rec.QuizScore
			acc.quizCount++
		}
		acc.interaction += rec.InteractionCount
		acc.praise += rec.PraiseCount
		acc.rushCorrect += rec.RushCorrectCount
		acc.rushTimeSum += intPtr(rec.RushAvgTimeSec)
		acc.rushTimeCount += countIntPtr(rec.RushAvgTimeSec)

		rt := rateMap[dateLabel]
		if rt == nil {
			rt = &rateAcc{name: dateLabel}
			rateMap[dateLabel] = rt
		}
		rt.total++
		if rec.Attendance == "present" {
			rt.present++
		}
	}

	if agg.SignIn.Total > 0 {
		agg.SignIn.Rate = int(float64(agg.SignIn.Present) / float64(agg.SignIn.Total) * 100)
	}

	for _, ds := range dailyMap {
		agg.SignInDaily = append(agg.SignInDaily, *ds)
	}

	if quizCount > 0 {
		passRate := 0
		if quizCount > 0 {
			passRate = int(float64(quizPassed) / float64(quizCount) * 100)
		}
		agg.QuizResults = append(agg.QuizResults, QuizResult{
			ID:       "overall",
			Name:     "随堂测验",
			AvgScore: int(totalQuizScore / float64(quizCount)),
			PassRate: passRate,
			Count:    quizCount,
		})
	}

	rushList := make([]*studentAcc, 0, len(studentMap))
	for _, acc := range studentMap {
		rushList = append(rushList, acc)
	}
	orderStudentsByRush(rushList)
	for i, acc := range rushList {
		badge := ""
		switch i {
		case 0:
			badge = "抢答王"
		case 1:
			badge = "达人"
		case 2:
			badge = "积极"
		}
		avgTime := "-"
		if acc.rushTimeCount > 0 {
			avgTime = strconv.Itoa(acc.rushTimeSum/acc.rushTimeCount) + "s"
		}
		agg.RushAnswerRanking = append(agg.RushAnswerRanking, RushRank{
			Rank:         i + 1,
			Name:         acc.name,
			CorrectCount: acc.rushCorrect,
			AvgTime:      avgTime,
			Badge:        badge,
		})
	}

	agg.ClassInteraction = []InteractionItem{
		{Name: "课堂互动", Active: totalInteractions, Total: totalInteractions},
		{Name: "抢答", Active: totalRush, Total: totalRush},
		{Name: "表扬", Active: totalPraise, Total: totalPraise},
	}

	for _, rt := range rateMap {
		item := RateItem{Name: rt.name}
		if rt.total > 0 {
			item.Rate = int(float64(rt.present) / float64(rt.total) * 100)
		}
		agg.AttendanceRateData = append(agg.AttendanceRateData, item)
	}

	for _, acc := range studentMap {
		attendance := 0
		if acc.records > 0 {
			attendance = int(float64(acc.present) / float64(acc.records) * 100)
		}
		quizAvg := 0
		if acc.quizCount > 0 {
			quizAvg = int(acc.quizSum / float64(acc.quizCount))
		}
		agg.StudentDetails = append(agg.StudentDetails, StudentBehaviorRow{
			Name:        acc.name,
			Attendance:  attendance,
			QuizAvg:     quizAvg,
			Interaction: acc.interaction,
			Praise:      acc.praise,
		})
	}

	return agg
}

type studentAcc struct {
	studentUserID string
	name          string
	records       int
	present       int
	quizSum       float64
	quizCount     int
	interaction   int
	praise        int
	rushCorrect   int
	rushTimeSum   int
	rushTimeCount int
}

type rateAcc struct {
	name    string
	total   int
	present int
}

func orderStudentsByRush(list []*studentAcc) {
	for i := 0; i < len(list); i++ {
		for j := i + 1; j < len(list); j++ {
			if list[j].rushCorrect > list[i].rushCorrect {
				list[i], list[j] = list[j], list[i]
			}
		}
	}
}

func formatMD(date string) string {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return date
	}
	return t.Format("01-02")
}

func intPtr(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}

func countIntPtr(v *int) int {
	if v == nil {
		return 0
	}
	return 1
}
