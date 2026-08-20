-- 159_temp_exam_published: 统一临时考试状态为 published（文档 8.12）
-- 背景：任务侧 createTempExam 历史上建 draft 临时卷，课程侧 CreateTempExam 建 published，
-- 学生作答任务/节点测评需走 GET /evaluation/exams/{id} 读题；学生读非 published 资源
-- 加固为 404 后，draft 临时卷必须先统一为 published，否则学生作答链路断裂。

UPDATE exams SET status = 'published', updated_at = NOW()
WHERE is_temp = TRUE AND status = 'draft';
