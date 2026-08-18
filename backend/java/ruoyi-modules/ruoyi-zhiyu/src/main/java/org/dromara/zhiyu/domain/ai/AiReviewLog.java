package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 审核留痕（ai_review_logs 表，Go→Java 迁移；无 updated_at 列，仅写入）。
 *
 * @author zhiyu
 */
@Data
@TableName("ai_review_logs")
public class AiReviewLog {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 目标类型（kb/agent） */
    private String targetType;

    /** 目标 ID */
    private String targetId;

    /** 动作（submit/approve/reject/unpublish/takedown） */
    private String action;

    /** 操作人 ID */
    private String actorId;

    /** 备注 */
    private String comment;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
