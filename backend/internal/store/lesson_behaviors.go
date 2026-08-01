package store

import (
	"context"
	"strconv"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// LessonBehaviorStore 课堂行为持久化。
type LessonBehaviorStore struct {
	q Queryer
}

// NewLessonBehaviorStore 创建课堂行为 store。
func NewLessonBehaviorStore(q Queryer) *LessonBehaviorStore {
	return &LessonBehaviorStore{q: q}
}

// ListRecords 查询行为记录（按课程+日期范围）。
func (s *LessonBehaviorStore) ListRecords(ctx context.Context, courseID, startDate, endDate string) ([]domain.LessonBehaviorRecord, error) {
	args := []any{courseID}
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

	rows, err := s.q.Query(ctx, query, args...)
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
	return records, rows.Err()
}

// Upsert 保存行为记录（幂等 upsert）。
func (s *LessonBehaviorStore) Upsert(ctx context.Context, tenantID string, p *LessonBehaviorUpsertParams) (*domain.LessonBehaviorRecord, error) {
	recordDate := p.RecordDate
	if recordDate == "" {
		recordDate = time.Now().Format("2006-01-02")
	}
	var rec domain.LessonBehaviorRecord
	var recordDateOut time.Time
	err := s.q.QueryRow(ctx, `
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
	`, tenantID, p.CourseID, p.StudentUserID, recordDate, p.Attendance, p.QuizScore, p.InteractionCount, p.PraiseCount, p.RushCorrectCount, p.RushAvgTimeSec).Scan(
		&rec.ID, &rec.CourseID, &rec.StudentUserID, &recordDateOut, &rec.Attendance,
		&rec.QuizScore, &rec.InteractionCount, &rec.PraiseCount, &rec.RushCorrectCount, &rec.RushAvgTimeSec,
		&rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		return nil, err
	}
	rec.RecordDate = recordDateOut.Format("2006-01-02")
	return &rec, nil
}

// LessonBehaviorUpsertParams 行为记录参数。
type LessonBehaviorUpsertParams struct {
	CourseID         string
	StudentUserID    string
	RecordDate       string
	Attendance       string
	QuizScore        *float64
	InteractionCount int
	PraiseCount      int
	RushCorrectCount int
	RushAvgTimeSec   *int
}
