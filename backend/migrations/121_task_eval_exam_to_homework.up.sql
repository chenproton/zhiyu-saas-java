-- 将历史错误写入的 method_key='exam' 归并为 'homework'
-- 由于 (task_id, method_key) 有唯一约束，若目标 homework 行已存在则保留 homework 行并删除 exam 行

DO $$
DECLARE
  conflict_task_ids UUID[];
BEGIN
  -- 1) 无冲突的直接重命名
  UPDATE task_evaluation_methods
  SET method_key = 'homework'
  WHERE method_key = 'exam'
    AND NOT EXISTS (
      SELECT 1
      FROM task_evaluation_methods t2
      WHERE t2.task_id = task_evaluation_methods.task_id
        AND t2.method_key = 'homework'
    );

  -- 2) 记录同时存在 exam 和 homework 的冲突任务（理论上不会，但防御性处理）
  SELECT ARRAY(
    SELECT DISTINCT task_id
    FROM task_evaluation_methods
    WHERE method_key IN ('exam', 'homework')
    GROUP BY task_id
    HAVING COUNT(DISTINCT method_key) > 1
  ) INTO conflict_task_ids;

  IF array_length(conflict_task_ids, 1) > 0 THEN
    RAISE NOTICE '以下任务同时存在 exam 和 homework 测评方式，需要人工合并: %', conflict_task_ids;
  END IF;
END $$;
