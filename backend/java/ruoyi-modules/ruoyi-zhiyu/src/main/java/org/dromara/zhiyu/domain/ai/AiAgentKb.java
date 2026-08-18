package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 智能体-知识库关联（ai_agent_kbs 表，Go→Java 迁移；无 updated_at 列）。
 *
 * @author zhiyu
 */
@Data
@TableName("ai_agent_kbs")
public class AiAgentKb {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 智能体 ID */
    private String agentId;

    /** 知识库 ID */
    private String kbId;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
