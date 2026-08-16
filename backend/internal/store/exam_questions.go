package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// SyncExamQuestions 同步考试题目并重算总分（场景任务/课程节点共用）。
// 以当前 questionIDs 为准：移除已不选用的旧题，更新/插入当前题目；
// questionScores 非空时以其中单个题目分值覆盖题库原分（可为 nil）。
// 返回 changed 表示题目集合（题目/内容/分值/排序）实际发生变化，供调用方决定是否
// bump 临时考试版本并重写快照（文档 5.1 末条 temp exam 兜底）。
func SyncExamQuestions(ctx context.Context, q Queryer, tenantID, examID string, questionIDs []string, questionScores map[string]float64) (bool, error) {
	before, err := examQuestionsChecksum(ctx, q, tenantID, examID)
	if err != nil {
		return false, err
	}
	if _, err := q.Exec(ctx, `
		DELETE FROM exam_questions WHERE exam_id = $1 AND tenant_id = $2 AND NOT (question_id = ANY($3))
	`, examID, tenantID, questionIDs); err != nil {
		return false, fmt.Errorf("prune exam questions: %w", err)
	}

	rows, err := q.Query(ctx, `
		SELECT id, type, content, options, answer, analysis, score
		FROM questions
		WHERE id = ANY($1) AND tenant_id = $2
		ORDER BY array_position($1, id)
	`, questionIDs, tenantID)
	if err != nil {
		return false, fmt.Errorf("fetch questions: %w", err)
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
			return false, err
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
		return false, err
	}

	for i, qq := range questions {
		score := qq.score
		if s, ok := questionScores[qq.id]; ok && s > 0 {
			score = s
		}
		// ON CONFLICT 单语句完成插入/更新，消除每题 2 次往返的 N+1
		if _, err := q.Exec(ctx, `
			INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (exam_id, question_id) DO UPDATE SET
				type = EXCLUDED.type, content = EXCLUDED.content, options = EXCLUDED.options,
				answer = EXCLUDED.answer, analysis = EXCLUDED.analysis, score = EXCLUDED.score,
				sort_order = EXCLUDED.sort_order
		`, uuid.NewString(), tenantID, examID, qq.id, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, score, i+1); err != nil {
			return false, fmt.Errorf("upsert exam question %s: %w", qq.id, err)
		}
	}

	if _, err := q.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1 AND tenant_id = $2), 0), updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2
	`, examID, tenantID); err != nil {
		return false, fmt.Errorf("recalc exam total: %w", err)
	}
	after, err := examQuestionsChecksum(ctx, q, tenantID, examID)
	if err != nil {
		return false, err
	}
	return before != after, nil
}

// examQuestionsChecksum 考试题目集合摘要：题目 id/类型/内容/选项/答案/解析/分值按排序聚合取 md5，
// 供 SyncExamQuestions 比对同步前后是否实际变化（ON CONFLICT 盲目重写不产生假变更）。
func examQuestionsChecksum(ctx context.Context, q Queryer, tenantID, examID string) (string, error) {
	var sum string
	err := q.QueryRow(ctx, `
		SELECT COALESCE(md5(string_agg(
			concat_ws('|', question_id::text, type, md5(content), md5(COALESCE(options::text, '')),
				md5(answer), md5(COALESCE(analysis, '')), score::text),
			',' ORDER BY sort_order, id
		)), '')
		FROM exam_questions WHERE exam_id = $1 AND tenant_id = $2
	`, examID, tenantID).Scan(&sum)
	return sum, err
}
