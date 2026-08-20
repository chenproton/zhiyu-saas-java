-- 回滚：合作类型/协议类型/项目类型 编码由英文改回中文
UPDATE alliance_dictionaries d
JOIN (VALUES
    ROW('cooperation_type', 'talent_training', '人才培养'),
    ROW('cooperation_type', 'internship', '实习实训'),
    ROW('cooperation_type', 'tech_rd', '技术研发'),
    ROW('cooperation_type', 'course_co_build', '课程共建'),
    ROW('cooperation_type', 'teacher_training', '师资培训'),
    ROW('cooperation_type', 'employment', '就业合作'),
    ROW('agreement_type', 'strategic', '战略合作协议'),
    ROW('agreement_type', 'industry_academia_research', '产学研合作协议'),
    ROW('agreement_type', 'internship', '实习实训协议'),
    ROW('agreement_type', 'talent_training', '人才培养协议'),
    ROW('agreement_type', 'employment', '就业合作协议'),
    ROW('agreement_type', 'course_co_build', '课程共建协议'),
    ROW('agreement_type', 'technical_service', '技术服务协议'),
    ROW('project_type', 'talent_training', '人才培养项目'),
    ROW('project_type', 'tech_rd', '技术研发项目'),
    ROW('project_type', 'base_construction', '基地建设项目'),
    ROW('project_type', 'skill_competition', '技能竞赛项目'),
    ROW('project_type', 'innovation_startup', '创新创业项目'),
    ROW('project_type', 'teacher_training', '师资培训项目'),
    ROW('project_type', 'course_development', '课程开发项目'),
    ROW('project_type', 'major_co_build', '专业共建项目')
) AS m(dict_type, new_code, old_code)
  ON d.dict_type = m.dict_type AND d.code = m.new_code
LEFT JOIN alliance_dictionaries d2
  ON d2.tenant_id = d.tenant_id AND d2.dict_type = d.dict_type AND d2.code = m.old_code
SET d.code = m.old_code
WHERE d2.id IS NULL;
