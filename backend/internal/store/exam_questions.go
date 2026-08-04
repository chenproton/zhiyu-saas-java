package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// SyncExamQuestions 同步考试题目并重算总分（场景任务/课程节点共用）。
// 以当前 questionIDs 为准：移除已不选用的旧题，更新/插入当前题目；
// questionScores 非空时以其中单个题目分值覆盖题库原分（可为 nil）。
func SyncExamQuestions(ctx context.Context, q Queryer, tenantID, examID string, questionIDs []string, questionScores map[string]float64) error {
	if _, err := q.Exec(ctx, `
		DELETE FROM exam_questions WHERE exam_id = $1 AND NOT (question_id = ANY($2))
	`, examID, questionIDs); err != nil {
		return fmt.Errorf("prune exam questions: %w", err)
	}

	rows, err := q.Query(ctx, `
		SELECT id, type, content, options, answer, analysis, score
		FROM questions
		WHERE id = ANY($1) AND tenant_id = $2
		ORDER BY array_position($1, id)
	`, questionIDs, tenantID)
	if err != nil {
		return fmt.Errorf("fetch questions: %w", err)
	}
	defer rows.Close()

	type question struct {
		id       string
		qType    string
		content  string
		options  []byte
		answer   []byte
		analysis *string
		score    float64
	}
	var questions []question
	for rows.Next() {
		var qq question
		var optionsStr, answerStr *string
		if err := rows.Scan(&qq.id, &qq.qType, &qq.content, &optionsStr, &answerStr, &qq.analysis, &qq.score); err != nil {
			return err
		}
		if optionsStr != nil {
			qq.options = []byte(*optionsStr)
		} else {
			qq.options = []byte("[]")
		}
		if answerStr != nil {
			qq.answer = []byte(*answerStr)
		} else {
			qq.answer = []byte("[]")
		}
		questions = append(questions, qq)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i, qq := range questions {
		score := qq.score
		if s, ok := questionScores[qq.id]; ok && s > 0 {
			score = s
		}
		var existingID string
		_ = q.QueryRow(ctx, `SELECT id FROM exam_questions WHERE exam_id = $1 AND question_id = $2`, examID, qq.id).Scan(&existingID)
		if existingID != "" {
			if _, err := q.Exec(ctx, `
				UPDATE exam_questions SET type = $1, content = $2, options = $3, answer = $4, analysis = $5, score = $6, sort_order = $7
				WHERE id = $8
			`, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, score, i+1, existingID); err != nil {
				return fmt.Errorf("update exam question %s: %w", qq.id, err)
			}
		} else {
			if _, err := q.Exec(ctx, `
				INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, uuid.NewString(), tenantID, examID, qq.id, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, score, i+1); err != nil {
				return fmt.Errorf("insert exam question %s: %w", qq.id, err)
			}
		}
	}

	if _, err := q.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID); err != nil {
		return fmt.Errorf("recalc exam total: %w", err)
	}
	return nil
}
