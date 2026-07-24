-- 068_backfill_resource_data: 从已有系统数据填充资源共享平台表

-- 从 task_resources 迁移到 resource_library
INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, thumbnail, file_size, uploaded_by, created_at, updated_at)
SELECT
    tr.id,
    COALESCE(s.tenant_id, first_tenant.id),
    tr.name,
    CASE tr.type
        WHEN 'document' THEN 'document'::resource_type
        WHEN 'spreadsheet' THEN 'spreadsheet'::resource_type
        WHEN 'image' THEN 'image'::resource_type
        WHEN 'link' THEN 'link'::resource_type
        WHEN 'audio' THEN 'audio'::resource_type
        WHEN 'video' THEN 'video'::resource_type
        WHEN 'archive' THEN 'archive'::resource_type
        WHEN 'software' THEN 'software'::resource_type
        ELSE 'other'::resource_type
    END,
    tr.url,
    tr.description,
    tr.thumbnail,
    NULLIF(regexp_replace(COALESCE(tr.size, ''), '[^0-9.]', '', 'g'), '')::bigint,
    tr.uploaded_by,
    COALESCE(tr.uploaded_at, NOW()),
    NOW()
FROM task_resources tr
LEFT JOIN task_resource_bindings trb ON trb.resource_id = tr.id
LEFT JOIN scenario_tasks st ON st.id = trb.task_id
LEFT JOIN scenarios s ON s.id = st.scenario_id
CROSS JOIN (SELECT id FROM tenants ORDER BY created_at LIMIT 1) first_tenant
WHERE tr.id NOT IN (SELECT id FROM resource_library)
ON CONFLICT (id) DO NOTHING;

-- 从 questions 迁移到 on_site_question_library（仅迁入短答案/论述等适合现场问答的题型）
INSERT INTO on_site_question_library (id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, created_at, updated_at)
SELECT
    q.id,
    COALESCE(q.tenant_id, first_tenant.id),
    q.content,
    q.answer,
    CASE q.type
        WHEN 'short_answer' THEN 'short_answer'
        WHEN 'essay' THEN 'essay'
        ELSE 'short_answer'
    END,
    q.score::float8,
    q.difficulty,
    q.knowledge_point_ids,
    '{}'::text[],
    q.created_at,
    NOW()
FROM questions q
CROSS JOIN (SELECT id FROM tenants ORDER BY created_at LIMIT 1) first_tenant
WHERE q.id NOT IN (SELECT id FROM on_site_question_library)
ON CONFLICT (id) DO NOTHING;
