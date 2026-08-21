package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 登录日志（login_logs 表，仅 created_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("login_logs")
public class SystemLoginLog {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 用户 ID */
    private String userId;

    /** 用户名 */
    private String userName;

    /** IP */
    private String ip;

    /** 位置 */
    private String location;

    /** 设备 */
    private String device;

    /** 状态 */
    private String status;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
