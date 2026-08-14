-- 联盟字典补齐回滚：仅移除本迁移补入且非运营方租户的种子项（保留运营方与用户自行配置的字典项）。
-- 注意：迁移 108 的种子项无来源标记，无法精确区分；此处保守处理——仅删除
-- 企业租户（tenants 中 platform 非学校）下未被业务引用的重复种子项不现实，
-- 因此仅删除 code 与种子完全一致且该租户字典量恰为 40（全量种子）的行，近似回滚。
-- 伤害面：108 与 151 的种子码集合完全相同（各 40 条），本回滚无法区分 151 补入的行与
-- 108 种子行，删除范围比 up 实际改动宽（存量租户的 108 种子也会被删）；
-- 恢复路径：回滚后如需恢复，重新执行 151 up（幂等补齐）即可。
DELETE FROM alliance_dictionaries d
WHERE d.dict_type || '|' || d.code IN (
    SELECT dd.dict_type || '|' || dd.code
    FROM (VALUES
        ('cooperation_type', '人才培养'),
        ('cooperation_type', '实习实训'),
        ('cooperation_type', '技术研发'),
        ('cooperation_type', '课程共建'),
        ('cooperation_type', '师资培训'),
        ('cooperation_type', '就业合作'),
        ('cooperation_rating', 'strategic'),
        ('cooperation_rating', 'deep'),
        ('cooperation_rating', 'general'),
        ('enterprise_status', 'negotiating'),
        ('enterprise_status', 'active'),
        ('enterprise_status', 'paused'),
        ('enterprise_status', 'terminated'),
        ('achievement_type', 'job'),
        ('achievement_type', 'scene'),
        ('achievement_type', 'course'),
        ('achievement_type', 'custom'),
        ('agreement_type', '战略合作协议'),
        ('agreement_type', '产学研合作协议'),
        ('agreement_type', '实习实训协议'),
        ('agreement_type', '人才培养协议'),
        ('agreement_type', '就业合作协议'),
        ('agreement_type', '课程共建协议'),
        ('agreement_type', '技术服务协议'),
        ('agreement_status', 'draft'),
        ('agreement_status', 'active'),
        ('agreement_status', 'expired'),
        ('agreement_status', 'renewed'),
        ('agreement_status', 'terminated'),
        ('expert_rating', 'gold'),
        ('expert_rating', 'silver'),
        ('expert_rating', 'copper'),
        ('project_type', '人才培养项目'),
        ('project_type', '技术研发项目'),
        ('project_type', '基地建设项目'),
        ('project_type', '技能竞赛项目'),
        ('project_type', '创新创业项目'),
        ('project_type', '师资培训项目'),
        ('project_type', '课程开发项目'),
        ('project_type', '专业共建项目')
    ) AS dd(dict_type, code)
)
AND d.tenant_id <> '00000000-0000-0000-0000-000000000001'
AND (SELECT COUNT(*) FROM alliance_dictionaries d2 WHERE d2.tenant_id = d.tenant_id) = 40;
