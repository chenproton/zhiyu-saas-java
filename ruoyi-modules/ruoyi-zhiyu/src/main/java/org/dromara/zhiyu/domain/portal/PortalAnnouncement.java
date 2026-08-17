package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 公告（announcements 表，仅 created_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("announcements")
public class PortalAnnouncement {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 标题 */
    private String title;

    /** 类型（如 通知） */
    private String type;

    /** 是否新公告 */
    private Boolean isNew;

    /** 租户 ID */
    private String tenantId;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
