package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiAgentKb;

import java.util.List;

/**
 * 智能体-知识库关联 Mapper（ai_agent_kbs 表）。
 *
 * @author zhiyu
 */
public interface AiAgentKbMapper extends BaseMapperPlus<AiAgentKb, AiAgentKb> {

    /** 取智能体关联的知识库 ID 列表（按创建时间升序） */
    @Select("SELECT kb_id FROM ai_agent_kbs WHERE tenant_id = #{tenantId} AND agent_id = #{agentId} ORDER BY created_at ASC")
    List<String> selectKbIds(@Param("tenantId") String tenantId, @Param("agentId") String agentId);
}
