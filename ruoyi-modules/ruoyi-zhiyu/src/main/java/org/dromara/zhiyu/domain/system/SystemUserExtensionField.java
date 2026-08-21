package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 用户扩展字段（user_extension_fields 表，仅 created_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("user_extension_fields")
public class SystemUserExtensionField {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 字段键 */
    private String fieldKey;

    /** 字段名 */
    private String fieldName;

    /** 字段类型（text/number/date/select） */
    private String fieldType;

    /** 是否启用 */
    private Boolean isEnabled;

    /** 是否必填 */
    private Boolean isRequired;

    /** 适用角色码（text[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> applicableRoleCodes;

    /** 槽位号 */
    private Integer slotNumber;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
