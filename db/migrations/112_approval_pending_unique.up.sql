-- 不可逆：删除 approval_records 中待审批状态重复行（保留最早一条），被删重复记录不可恢复。
-- 清理同一目标重复的 pending 审批记录（每组保留最早一条）
-- MySQL 版：PG 多表 DELETE ... USING 改 JOIN 删除；行比较 (a.created_at, a.id) > (b.created_at, b.id)
-- 展开为 OR 形式；部分唯一索引（仅 pending 唯一）用生成列哨兵实现（非 pending 时为 NULL，MySQL 唯一索引允许多 NULL）。
DELETE a FROM approval_records a
JOIN approval_records b
  ON a.target_type = b.target_type
 AND a.target_id = b.target_id
 AND a.status = 'pending' AND b.status = 'pending'
 AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

ALTER TABLE approval_records
    ADD COLUMN pending_uniq CHAR(1)
        GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN '1' ELSE NULL END) VIRTUAL;

CREATE UNIQUE INDEX uq_approval_records_target_pending
    ON approval_records (target_type, target_id, pending_uniq);
