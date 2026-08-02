CREATE UNIQUE INDEX uq_approval_records_target_pending
    ON approval_records (target_type, target_id)
    WHERE status = 'pending';
