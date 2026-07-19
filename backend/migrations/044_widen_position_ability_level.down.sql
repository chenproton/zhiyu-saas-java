-- 仅当现有数据最大长度不超过 8 时才可回滚
ALTER TABLE position_ability_bindings ALTER COLUMN required_level TYPE VARCHAR(8);
