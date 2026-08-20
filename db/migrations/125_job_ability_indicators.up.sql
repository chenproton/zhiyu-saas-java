-- 岗位能力结果落库：能力认知得分（0-100）与岗位胜任度（%，可超 100）
ALTER TABLE job_ability_results
    ADD COLUMN ability_cognition_score DECIMAL(5,2),
    ADD COLUMN position_competency DECIMAL(6,2);
