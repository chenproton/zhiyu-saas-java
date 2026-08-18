package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * AI 用量记录（ai_usage_logs 表，Go→Java 迁移；无 updated_at 列，仅写入）。
 *
 * @author zhiyu
 */
@Data
@TableName("ai_usage_logs")
public class AiUsageLog {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 用户 ID（可空） */
    private String userId;

    /** 模型 */
    private String model;

    /** 提示词 token 数 */
    private Integer promptTokens;

    /** 补全 token 数 */
    private Integer completionTokens;

    /** 总 token 数 */
    private Integer totalTokens;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
