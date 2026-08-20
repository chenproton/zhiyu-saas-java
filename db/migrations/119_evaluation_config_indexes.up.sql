-- 测评配置与考试场次查询索引：
-- exam_usages.target_ids 支撑 $x = ANY(target_ids) 反向查找（课程节点测评/任务临时场次）
-- task_eval_points/task_review_steps(config_id) 支撑任务测评配置页与认证模型 JOIN
CREATE INDEX idx_exam_usages_target_ids_gin ON exam_usages ((CAST(target_ids AS CHAR(64) ARRAY)));
CREATE INDEX idx_task_eval_points_config ON task_eval_points(config_id);
CREATE INDEX idx_task_review_steps_config ON task_review_steps(config_id);
