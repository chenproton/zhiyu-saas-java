-- 092 down: 删除教务管理服务平台全部表（按外键依赖逆序）
DROP TABLE IF EXISTS schedule_entries;
DROP TABLE IF EXISTS period_slots;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS teaching_plan_entries;
DROP TABLE IF EXISTS teaching_plans;
DROP TABLE IF EXISTS training_program_courses;
DROP TABLE IF EXISTS training_programs;
DROP TABLE IF EXISTS terms;
