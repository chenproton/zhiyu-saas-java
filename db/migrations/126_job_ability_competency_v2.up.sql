-- 岗位能力结果新增指标：岗位胜任度（新）（%，等级距离法，无上限）
ALTER TABLE job_ability_results
    ADD COLUMN position_competency_v2 DECIMAL(6,2);
