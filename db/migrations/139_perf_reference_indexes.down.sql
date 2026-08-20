SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('position_ability_bindings');CALL drop_all_fks('node_ability_point_bindings');CALL drop_all_fks('task_ability_bindings');CALL drop_all_fks('certification_ability_points');CALL drop_all_fks('node_knowledge_point_bindings');CALL drop_all_fks('question_bank_knowledge_points');CALL drop_all_fks('node_resource_bindings');CALL drop_all_fks('task_resource_bindings');DROP INDEX idx_position_ability_bindings_ability ON position_ability_bindings;
DROP INDEX idx_node_ability_point_bindings_ability ON node_ability_point_bindings;
DROP INDEX idx_task_ability_bindings_ability ON task_ability_bindings;
DROP INDEX idx_certification_ability_points_ability ON certification_ability_points;
DROP INDEX idx_nkpb_knowledge_point ON node_knowledge_point_bindings;
DROP INDEX idx_qbkp_knowledge_point ON question_bank_knowledge_points;
DROP INDEX idx_nrb_resource ON node_resource_bindings;
DROP INDEX idx_task_resource_bindings_resource ON task_resource_bindings;

SET FOREIGN_KEY_CHECKS = 1;