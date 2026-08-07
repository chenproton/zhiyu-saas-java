-- 联盟字典种子数据（code=英文存储值, name=中文显示名）
-- 插入运营方租户（固定 ID，seed 程序随后创建该租户行）与所有现存租户；
-- 若运营方租户行尚未创建（migration 先于 seed 执行），其字典行会先落库，
-- 租户创建时无需回填即可直接使用。已存在(code 冲突)则跳过。
INSERT INTO alliance_dictionaries (id, tenant_id, dict_type, code, name, sort_order, created_at)
SELECT gen_random_uuid(), t.id, d.dict_type, d.code, d.name, d.sort_order, NOW()
FROM (VALUES
    ('cooperation_type', '人才培养', '人才培养', 1),
    ('cooperation_type', '实习实训', '实习实训', 2),
    ('cooperation_type', '技术研发', '技术研发', 3),
    ('cooperation_type', '课程共建', '课程共建', 4),
    ('cooperation_type', '师资培训', '师资培训', 5),
    ('cooperation_type', '就业合作', '就业合作', 6),
    ('cooperation_rating', 'strategic', '战略合作', 1),
    ('cooperation_rating', 'deep', '深度合作', 2),
    ('cooperation_rating', 'general', '一般合作', 3),
    ('enterprise_status', 'negotiating', '洽谈中', 1),
    ('enterprise_status', 'active', '合作中', 2),
    ('enterprise_status', 'paused', '已暂停', 3),
    ('enterprise_status', 'terminated', '已终止', 4),
    ('achievement_type', 'job', '岗位成果', 1),
    ('achievement_type', 'scene', '场景成果', 2),
    ('achievement_type', 'course', '课程成果', 3),
    ('achievement_type', 'custom', '自定义成果', 4),
    ('agreement_type', '战略合作协议', '战略合作协议', 1),
    ('agreement_type', '产学研合作协议', '产学研合作协议', 2),
    ('agreement_type', '实习实训协议', '实习实训协议', 3),
    ('agreement_type', '人才培养协议', '人才培养协议', 4),
    ('agreement_type', '就业合作协议', '就业合作协议', 5),
    ('agreement_type', '课程共建协议', '课程共建协议', 6),
    ('agreement_type', '技术服务协议', '技术服务协议', 7),
    ('agreement_status', 'draft', '草稿', 1),
    ('agreement_status', 'active', '生效中', 2),
    ('agreement_status', 'expired', '已失效', 3),
    ('agreement_status', 'renewed', '已续签', 4),
    ('agreement_status', 'terminated', '已终止', 5),
    ('expert_rating', 'gold', '金牌专家', 1),
    ('expert_rating', 'silver', '银牌专家', 2),
    ('expert_rating', 'copper', '铜牌专家', 3),
    ('project_type', '人才培养项目', '人才培养项目', 1),
    ('project_type', '技术研发项目', '技术研发项目', 2),
    ('project_type', '基地建设项目', '基地建设项目', 3),
    ('project_type', '技能竞赛项目', '技能竞赛项目', 4),
    ('project_type', '创新创业项目', '创新创业项目', 5),
    ('project_type', '师资培训项目', '师资培训项目', 6),
    ('project_type', '课程开发项目', '课程开发项目', 7),
    ('project_type', '专业共建项目', '专业共建项目', 8)
) AS d(dict_type, code, name, sort_order)
CROSS JOIN (
    -- 运营方租户固定 ID（seed 程序随后创建租户行）+ 所有现存租户
    SELECT '00000000-0000-0000-0000-000000000001'::uuid AS id
    UNION
    SELECT id FROM tenants
) t
ON CONFLICT (tenant_id, dict_type, code) DO NOTHING;
