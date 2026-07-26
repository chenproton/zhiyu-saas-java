-- 080_unify_resources_to_library: 将课程/任务/节点资源统一归集到 resource_library

-- 1. 补齐 resource_library 中尚未镜像的 node_resources 记录（按原 ID 保留）
INSERT INTO resource_library (
    id,
    tenant_id,
    name,
    resource_type,
    url,
    description,
    file_size,
    uploaded_by,
    created_at,
    updated_at
)
SELECT
    nr.id,
    nr.tenant_id,
    nr.name,
    CASE
        WHEN nr.type IN ('document', 'spreadsheet', 'image', 'link', 'audio', 'video', 'archive', 'venue', 'facility', 'software', 'other')
        THEN nr.type::resource_type
        ELSE 'other'::resource_type
    END,
    nr.url,
    NULL,
    nr.size::bigint,
    NULL,
    nr.created_at,
    NOW()
FROM node_resources nr
WHERE nr.id NOT IN (SELECT id FROM resource_library)
ON CONFLICT (id) DO NOTHING;

-- 2. 再次兜底：把 task_resources 中仍未镜像的记录写入 resource_library
INSERT INTO resource_library (
    id,
    tenant_id,
    name,
    resource_type,
    url,
    description,
    thumbnail,
    file_size,
    metadata,
    uploaded_by,
    created_at,
    updated_at
)
SELECT
    tr.id,
    tr.tenant_id,
    tr.name,
    CASE
        WHEN tr.type IN ('document', 'spreadsheet', 'image', 'link', 'audio', 'video', 'archive', 'venue', 'facility', 'software', 'other')
        THEN tr.type::resource_type
        ELSE 'other'::resource_type
    END,
    tr.url,
    tr.description,
    tr.thumbnail,
    NULLIF(regexp_replace(COALESCE(tr.size, ''), '[^0-9.]', '', 'g'), '')::bigint,
    COALESCE(jsonb_build_object(
        'knowledgePointIds', tr.knowledge_point_ids,
        'extraData', tr.extra_data
    ), '{}'::jsonb),
    tr.uploaded_by,
    COALESCE(tr.uploaded_at, NOW()),
    NOW()
FROM task_resources tr
WHERE tr.id NOT IN (SELECT id FROM resource_library)
ON CONFLICT (id) DO NOTHING;

-- 3. 调整 task_resource_bindings 外键指向 resource_library
ALTER TABLE task_resource_bindings
    DROP CONSTRAINT IF EXISTS task_resource_bindings_resource_id_fkey;

ALTER TABLE task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_resource_id_fkey
    FOREIGN KEY (resource_id) REFERENCES resource_library(id) ON DELETE CASCADE;

-- 4. 为 course_resource_bindings 添加外键指向 resource_library
ALTER TABLE course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_resource_id_fkey
    FOREIGN KEY (resource_id) REFERENCES resource_library(id) ON DELETE CASCADE;

-- 5. 为 node_resource_bindings 添加外键指向 resource_library
ALTER TABLE node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_resource_id_fkey
    FOREIGN KEY (resource_id) REFERENCES resource_library(id) ON DELETE CASCADE;
