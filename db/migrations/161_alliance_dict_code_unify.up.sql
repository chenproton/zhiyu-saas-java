-- 联盟字典编码统一：迁移 151 曾以中文 code 为存量租户回插
-- cooperation_type/agreement_type/project_type 种子行，与 122 的英文编码策略冲突。
-- 本迁移统一口径（与 store/tenants.go allianceDictSeedSQL 新租户英文码对齐）：
--   1) 删除「同名存在英文码行」的中文码重复行（151 造成的双份）；
--   2) 其余中文码行按 122 映射改名为英文码（仅当同名英文码行不存在，保留租户自定义条目语义）。
-- 业务表（alliance_projects.type 等）存中文展示名，不受影响。
-- MySQL 版：PG 多表 DELETE ... USING 改 JOIN 删除；UPDATE...FROM(VALUES) 改 UPDATE JOIN (VALUES)。
DELETE d FROM alliance_dictionaries d
JOIN alliance_dictionaries e
  ON d.tenant_id = e.tenant_id
 AND d.dict_type = e.dict_type
 AND d.name = e.name
 AND d.code = d.name        -- 中文码行（code 与中文 name 相同）
 AND e.code <> e.name       -- 存在同名的英文码行
WHERE d.dict_type IN ('cooperation_type', 'agreement_type', 'project_type');

UPDATE alliance_dictionaries d
JOIN (VALUES
    -- 合作类型 cooperation_type
    ROW('cooperation_type', '人才培养', 'talent_training'),
    ROW('cooperation_type', '实习实训', 'internship'),
    ROW('cooperation_type', '技术研发', 'tech_rd'),
    ROW('cooperation_type', '课程共建', 'course_co_build'),
    ROW('cooperation_type', '师资培训', 'teacher_training'),
    ROW('cooperation_type', '就业合作', 'employment'),
    -- 协议类型 agreement_type
    ROW('agreement_type', '战略合作协议', 'strategic'),
    ROW('agreement_type', '产学研合作协议', 'industry_academia_research'),
    ROW('agreement_type', '实习实训协议', 'internship'),
    ROW('agreement_type', '人才培养协议', 'talent_training'),
    ROW('agreement_type', '就业合作协议', 'employment'),
    ROW('agreement_type', '课程共建协议', 'course_co_build'),
    ROW('agreement_type', '技术服务协议', 'technical_service'),
    -- 项目类型 project_type
    ROW('project_type', '人才培养项目', 'talent_training'),
    ROW('project_type', '技术研发项目', 'tech_rd'),
    ROW('project_type', '基地建设项目', 'base_construction'),
    ROW('project_type', '技能竞赛项目', 'skill_competition'),
    ROW('project_type', '创新创业项目', 'innovation_startup'),
    ROW('project_type', '师资培训项目', 'teacher_training'),
    ROW('project_type', '课程开发项目', 'course_development'),
    ROW('project_type', '专业共建项目', 'major_co_build')
) AS m(dict_type, old_code, new_code)
  ON d.dict_type = m.dict_type AND d.code = m.old_code
LEFT JOIN alliance_dictionaries d2
  ON d2.tenant_id = d.tenant_id AND d2.dict_type = d.dict_type
 AND d2.name = d.name AND d2.code = m.new_code
SET d.code = m.new_code
WHERE d2.id IS NULL;
