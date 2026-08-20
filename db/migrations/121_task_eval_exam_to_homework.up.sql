-- 将历史错误写入的 method_key='exam' 归并为 'homework'
-- 由于 (task_id, method_key) 有唯一约束，若目标 homework 行已存在则保留 homework 行并删除 exam 行

-- 1) 同时存在 exam 和 homework 的任务：保留 homework，删除 exam
DELETE tem FROM task_evaluation_methods tem
JOIN (SELECT task_id FROM task_evaluation_methods WHERE method_key = 'homework') h
  ON h.task_id = tem.task_id
WHERE tem.method_key = 'exam';

-- 2) 仅存在 exam 的任务：直接重命名为 homework
UPDATE task_evaluation_methods
SET method_key = 'homework'
WHERE method_key = 'exam';
