-- 优化 Portal 工作台高频查询
CREATE INDEX IF NOT EXISTS idx_lbr_course_student ON lesson_behavior_records(course_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_scene_eval_task_evaluator_created ON scene_evaluation_results(task_id, evaluatee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_results_usage_user ON exam_results(exam_usage_id, user_id);
CREATE INDEX IF NOT EXISTS idx_exam_usages_status_start ON exam_usages(status, start_time);
