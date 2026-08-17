package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiKbCollaborator;

/**
 * 知识库协作者 Mapper（ai_kb_collaborators 表）。
 *
 * @author zhiyu
 */
public interface AiKbCollaboratorMapper extends BaseMapperPlus<AiKbCollaborator, AiKbCollaborator> {

    /** 添加协作者（重复则更新角色，对齐 Go ON CONFLICT upsert 语义） */
    @Insert("INSERT INTO ai_kb_collaborators (tenant_id, kb_id, user_id, role)"
        + " VALUES (#{tenantId}, #{kbId}, #{userId}, #{role})"
        + " ON CONFLICT (kb_id, user_id) DO UPDATE SET role = EXCLUDED.role")
    int upsert(@Param("tenantId") String tenantId, @Param("kbId") String kbId,
               @Param("userId") String userId, @Param("role") String role);
}
