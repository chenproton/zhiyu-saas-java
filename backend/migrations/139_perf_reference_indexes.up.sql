-- 引用统计/零引用查询（CitationStats / ListUncited）按引用 ID 做相关子查询，
-- 各绑定表此前仅有关联主键侧索引，补反向引用索引消除全表扫描。
CREATE INDEX IF NOT EXISTS idx_position_ability_bindings_ability ON position_ability_bindings (ability_point_id);
CREATE INDEX IF NOT EXISTS idx_node_ability_point_bindings_ability ON node_ability_point_bindings (ability_point_id);
CREATE INDEX IF NOT EXISTS idx_task_ability_bindings_ability ON task_ability_bindings (ability_point_id);
CREATE INDEX IF NOT EXISTS idx_certification_ability_points_ability ON certification_ability_points (ability_point_id);
CREATE INDEX IF NOT EXISTS idx_nkpb_knowledge_point ON node_knowledge_point_bindings (knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_qbkp_knowledge_point ON question_bank_knowledge_points (knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_nrb_resource ON node_resource_bindings (resource_id);
CREATE INDEX IF NOT EXISTS idx_task_resource_bindings_resource ON task_resource_bindings (resource_id);
