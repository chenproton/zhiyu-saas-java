-- 080_unify_resources_to_library down: 恢复绑定表外键到原表

-- 移除指向 resource_library 的外键
ALTER TABLE course_resource_bindings
    DROP CONSTRAINT IF EXISTS course_resource_bindings_resource_id_fkey;

ALTER TABLE node_resource_bindings
    DROP CONSTRAINT IF EXISTS node_resource_bindings_resource_id_fkey;

-- task_resource_bindings 恢复指向 task_resources
ALTER TABLE task_resource_bindings
    DROP CONSTRAINT IF EXISTS task_resource_bindings_resource_id_fkey;

ALTER TABLE task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_resource_id_fkey
    FOREIGN KEY (resource_id) REFERENCES task_resources(id) ON DELETE CASCADE;
