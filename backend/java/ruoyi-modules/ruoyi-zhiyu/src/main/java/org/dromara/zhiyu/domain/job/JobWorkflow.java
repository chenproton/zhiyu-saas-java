package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 审批流程（workflows 表，Go→Java 迁移）。
 *
 * <p>表仅有 created_at（无 updated_at），故不继承 {@code BaseZhiyuEntity}，
 * 自建 id 主键。steps/majorIds 为 jsonb 列（steps 原始 JSON 文本，
 * majorIds 字符串数组经 JSON 解析）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("workflows")
public class JobWorkflow {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 流程名称 */
    private String name;

    /** 场景标识 */
    private String scene;

    /** 流程描述 */
    private String description;

    /** 审批步骤（jsonb，原始 JSON 文本） */
    private String steps;

    /** 适用专业 ID（jsonb 字符串数组，原始 JSON 文本） */
    private String majorIds;

    /** 使用次数 */
    private Integer usageCount;

    /** 状态（active/inactive） */
    private String status;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
