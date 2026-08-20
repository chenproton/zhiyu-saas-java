SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('node_homework_submissions');
CALL drop_all_fks('node_homeworks');DROP INDEX idx_node_hw_sub_student ON node_homework_submissions;
DROP INDEX idx_node_hw_sub_homework ON node_homework_submissions;
DROP INDEX idx_node_hw_sub_node ON node_homework_submissions;
DROP INDEX idx_node_hw_sub_tenant ON node_homework_submissions;
DROP TABLE IF EXISTS node_homework_submissions;

ALTER TABLE node_homeworks
    DROP COLUMN creator_id,
    DROP COLUMN status,
    DROP COLUMN created_at,
    DROP COLUMN updated_at;

SET FOREIGN_KEY_CHECKS = 1;