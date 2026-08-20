-- 联盟字典补齐回滚：仅移除本迁移补入且非运营方租户的种子项（保留运营方与用户自行配置的字典项）。
-- 注意：迁移 108 的种子项无来源标记，无法精确区分；此处保守处理——仅删除
-- 企业租户（tenants 中 platform 非学校）下未被业务引用的重复种子项不现实，
-- 因此仅删除 code 与种子完全一致且该租户字典量恰为 40（全量种子）的行，近似回滚。
-- 伤害面：108 与 151 的种子码集合完全相同（各 40 条），本回滚无法区分 151 补入的行与
-- 108 种子行，删除范围比 up 实际改动宽（存量租户的 108 种子也会被删）；
-- 恢复路径：回滚后如需恢复，重新执行 151 up（幂等补齐）即可。
DELETE d FROM alliance_dictionaries d
JOIN (SELECT tenant_id FROM alliance_dictionaries GROUP BY tenant_id HAVING COUNT(*) = 40) ft
  ON ft.tenant_id = d.tenant_id
WHERE CONCAT(d.dict_type, '|', d.code) IN (
    SELECT CONCAT(dd.dict_type, '|', dd.code)
    FROM (VALUES
ROW('cooperation_type', '人才培养'),
ROW('cooperation_type', '实习实训'),
ROW('cooperation_type', '技术研发'),
ROW('cooperation_type', '课程共建'),
ROW('cooperation_type', '师资培训'),
ROW('cooperation_type', '就业合作'),
ROW('cooperation_rating', 'strategic'),
ROW('cooperation_rating', 'deep'),
ROW('cooperation_rating', 'general'),
ROW('enterprise_status', 'negotiating'),
ROW('enterprise_status', 'active'),
ROW('enterprise_status', 'paused'),
ROW('enterprise_status', 'terminated'),
ROW('achievement_type', 'job'),
ROW('achievement_type', 'scene'),
ROW('achievement_type', 'course'),
ROW('achievement_type', 'custom'),
ROW('agreement_type', '战略合作协议'),
ROW('agreement_type', '产学研合作协议'),
ROW('agreement_type', '实习实训协议'),
ROW('agreement_type', '人才培养协议'),
ROW('agreement_type', '就业合作协议'),
ROW('agreement_type', '课程共建协议'),
ROW('agreement_type', '技术服务协议'),
ROW('agreement_status', 'draft'),
ROW('agreement_status', 'active'),
ROW('agreement_status', 'expired'),
ROW('agreement_status', 'renewed'),
ROW('agreement_status', 'terminated'),
ROW('expert_rating', 'gold'),
ROW('expert_rating', 'silver'),
ROW('expert_rating', 'copper'),
ROW('project_type', '人才培养项目'),
ROW('project_type', '技术研发项目'),
ROW('project_type', '基地建设项目'),
ROW('project_type', '技能竞赛项目'),
ROW('project_type', '创新创业项目'),
ROW('project_type', '师资培训项目'),
ROW('project_type', '课程开发项目'),
ROW('project_type', '专业共建项目')
    ) AS dd(dict_type, code)
)
  AND d.tenant_id <> '00000000-0000-0000-0000-000000000001';
