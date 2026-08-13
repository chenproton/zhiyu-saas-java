-- 回滚：临时考试恢复为 draft（镜像 159_temp_exam_published.up.sql）。
-- 注意：无法区分回填前即为 published 的临时卷，回滚会把全部临时卷置回 draft。

UPDATE exams SET status = 'draft', updated_at = NOW()
WHERE is_temp = TRUE AND status = 'published';
