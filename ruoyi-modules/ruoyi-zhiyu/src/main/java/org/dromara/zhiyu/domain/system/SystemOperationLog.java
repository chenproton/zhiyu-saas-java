package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 操作日志（operation_logs 表，仅 created_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("operation_logs")
public class SystemOperationLog {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 用户 ID */
    private String userId;

    /** 用户名 */
    private String userName;

    /** 模块 */
    private String module;

    /** 动作 */
    private String action;

    /** 目标类型 */
    private String targetType;

    /** 目标 ID */
    private String targetId;

    /** 详情 */
    private String detail;

    /** IP */
    private String ip;

    /** 状态 */
    private String status;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
