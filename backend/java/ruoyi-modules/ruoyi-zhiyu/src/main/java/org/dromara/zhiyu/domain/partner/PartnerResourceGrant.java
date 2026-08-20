package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.util.List;

/**
 * 资源授权（alliance_resource_grants 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_resource_grants")
public class PartnerResourceGrant extends BaseZhiyuEntity {

    /** 学校租户 ID */
    private String tenantId;

    /** 企业主体 ID */
    private String enterpriseId;

    /** 资源类型（position/scene） */
    private String resourceType;

    /** 资源 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> resourceIds;

    /** 创建人 ID */
    private String createdBy;
}
