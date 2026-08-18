-- 回滚：无法区分迁移前 enterprise 的学校自建岗位与迁移后新建的 enterprise 岗位，
-- 仅将 source_type=school 的 teaching 岗位回退为 enterprise（可接受近似还原）。
UPDATE career_positions SET position_type = 'enterprise', updated_at = NOW()
WHERE source_type = 'school' AND position_type = 'teaching';
