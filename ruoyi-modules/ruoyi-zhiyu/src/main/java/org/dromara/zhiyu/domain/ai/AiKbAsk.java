package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 知识库问答记录（ai_kb_asks 表，Go→Java 迁移；无 updated_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_kb_asks")
public class AiKbAsk {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 知识库 ID */
    private String kbId;

    /** 用户 ID */
    private String userId;

    /** 问题 */
    private String question;

    /** 回答 */
    private String answer;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
