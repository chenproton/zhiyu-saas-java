-- 岗位类型语义调整：/job/positions 岗位库仅管理教学岗位（teaching）
-- 学校自建岗位（source_type=school）历史数据均为 enterprise 类型，统一转为 teaching；
-- 企业端共建岗位（source_type=enterprise）保持 enterprise 不变（品牌模块企业岗位走岗位库新增接口，同样为 enterprise，不在 /job/positions 可见）。
UPDATE career_positions SET position_type = 'teaching', updated_at = NOW()
WHERE source_type = 'school' AND position_type = 'enterprise';
