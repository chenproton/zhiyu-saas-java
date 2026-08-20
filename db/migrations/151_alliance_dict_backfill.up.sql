-- 联盟字典补齐：迁移 108 仅覆盖当时存在的租户，此后新建的租户（含企业租户）
-- 未获得联盟字典种子数据，导致字典管理页为空但业务页面仍走前端硬编码。
-- 本迁移为所有现存租户补齐种子数据（已存在(code 冲突)则跳过），
-- 与 store/tenants.go allianceDictSeedSQL（新建租户回填）保持一致。
INSERT IGNORE INTO alliance_dictionaries (id, tenant_id, dict_type, code, name, sort_order, created_at)
SELECT (UUID()), t.id, d.dict_type, d.code, d.name, d.sort_order, NOW()
FROM (VALUES
ROW('cooperation_type', '人才培养', '人才培养', 1),
ROW('cooperation_type', '实习实训', '实习实训', 2),
ROW('cooperation_type', '技术研发', '技术研发', 3),
ROW('cooperation_type', '课程共建', '课程共建', 4),
ROW('cooperation_type', '师资培训', '师资培训', 5),
ROW('cooperation_type', '就业合作', '就业合作', 6),
ROW('cooperation_rating', 'strategic', '战略合作', 1),
ROW('cooperation_rating', 'deep', '深度合作', 2),
ROW('cooperation_rating', 'general', '一般合作', 3),
ROW('enterprise_status', 'negotiating', '洽谈中', 1),
ROW('enterprise_status', 'active', '合作中', 2),
ROW('enterprise_status', 'paused', '已暂停', 3),
ROW('enterprise_status', 'terminated', '已终止', 4),
ROW('achievement_type', 'job', '岗位成果', 1),
ROW('achievement_type', 'scene', '场景成果', 2),
ROW('achievement_type', 'course', '课程成果', 3),
ROW('achievement_type', 'custom', '自定义成果', 4),
ROW('agreement_type', '战略合作协议', '战略合作协议', 1),
ROW('agreement_type', '产学研合作协议', '产学研合作协议', 2),
ROW('agreement_type', '实习实训协议', '实习实训协议', 3),
ROW('agreement_type', '人才培养协议', '人才培养协议', 4),
ROW('agreement_type', '就业合作协议', '就业合作协议', 5),
ROW('agreement_type', '课程共建协议', '课程共建协议', 6),
ROW('agreement_type', '技术服务协议', '技术服务协议', 7),
ROW('agreement_status', 'draft', '草稿', 1),
ROW('agreement_status', 'active', '生效中', 2),
ROW('agreement_status', 'expired', '已失效', 3),
ROW('agreement_status', 'renewed', '已续签', 4),
ROW('agreement_status', 'terminated', '已终止', 5),
ROW('expert_rating', 'gold', '金牌专家', 1),
ROW('expert_rating', 'silver', '银牌专家', 2),
ROW('expert_rating', 'copper', '铜牌专家', 3),
ROW('project_type', '人才培养项目', '人才培养项目', 1),
ROW('project_type', '技术研发项目', '技术研发项目', 2),
ROW('project_type', '基地建设项目', '基地建设项目', 3),
ROW('project_type', '技能竞赛项目', '技能竞赛项目', 4),
ROW('project_type', '创新创业项目', '创新创业项目', 5),
ROW('project_type', '师资培训项目', '师资培训项目', 6),
ROW('project_type', '课程开发项目', '课程开发项目', 7),
ROW('project_type', '专业共建项目', '专业共建项目', 8)
) AS d(dict_type, code, name, sort_order)
CROSS JOIN (
    -- 运营方租户固定 ID + 所有现存租户（含企业租户）
    SELECT '00000000-0000-0000-0000-000000000001' AS id
    UNION
    SELECT id FROM tenants
) t

