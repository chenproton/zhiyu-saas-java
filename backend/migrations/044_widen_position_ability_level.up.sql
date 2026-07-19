-- 放宽 position_ability_bindings.required_level，以容纳前端胜任力等级值
-- 如 understand(10)、comprehend(10)、proficient(10) 等
ALTER TABLE position_ability_bindings ALTER COLUMN required_level TYPE VARCHAR(32);
