-- 联盟字典：合作类型/协议类型/项目类型 编码由中文改为英文，与其他字典（评级/状态/成果类型）保持一致
-- 说明：业务表（alliance_projects.type、alliance_agreements.type、alliance_enterprises.cooperation_types）
-- 仍存储中文文本，本次仅调整 alliance_dictionaries 的 code 列。
UPDATE alliance_dictionaries d
SET code = m.new_code
FROM (VALUES
    -- 合作类型 cooperation_type
    ('cooperation_type', '人才培养', 'talent_training'),
    ('cooperation_type', '实习实训', 'internship'),
    ('cooperation_type', '技术研发', 'tech_rd'),
    ('cooperation_type', '课程共建', 'course_co_build'),
    ('cooperation_type', '师资培训', 'teacher_training'),
    ('cooperation_type', '就业合作', 'employment'),
    -- 协议类型 agreement_type
    ('agreement_type', '战略合作协议', 'strategic'),
    ('agreement_type', '产学研合作协议', 'industry_academia_research'),
    ('agreement_type', '实习实训协议', 'internship'),
    ('agreement_type', '人才培养协议', 'talent_training'),
    ('agreement_type', '就业合作协议', 'employment'),
    ('agreement_type', '课程共建协议', 'course_co_build'),
    ('agreement_type', '技术服务协议', 'technical_service'),
    -- 项目类型 project_type
    ('project_type', '人才培养项目', 'talent_training'),
    ('project_type', '技术研发项目', 'tech_rd'),
    ('project_type', '基地建设项目', 'base_construction'),
    ('project_type', '技能竞赛项目', 'skill_competition'),
    ('project_type', '创新创业项目', 'innovation_startup'),
    ('project_type', '师资培训项目', 'teacher_training'),
    ('project_type', '课程开发项目', 'course_development'),
    ('project_type', '专业共建项目', 'major_co_build')
) AS m(dict_type, old_code, new_code)
WHERE d.dict_type = m.dict_type AND d.code = m.old_code
  AND NOT EXISTS (
      SELECT 1 FROM alliance_dictionaries d2
      WHERE d2.tenant_id = d.tenant_id AND d2.dict_type = d.dict_type AND d2.code = m.new_code
  );
