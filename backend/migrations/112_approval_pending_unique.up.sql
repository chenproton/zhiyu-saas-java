-- 清理同一目标重复的 pending 审批记录（每组保留最早一条）
DELETE FROM approval_records a
USING approval_records b
WHERE a.target_type = b.target_type
  AND a.target_id = b.target_id
  AND a.status = 'pending' AND b.status = 'pending'
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX uq_approval_records_target_pending
    ON approval_records (target_type, target_id)
    WHERE status = 'pending';
