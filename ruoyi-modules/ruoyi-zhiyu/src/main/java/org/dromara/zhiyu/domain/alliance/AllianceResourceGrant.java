package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.util.List;

/**
 * 学校-企业资源授权（alliance_resource_grants 表；resource_ids 为 uuid[]）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_resource_grants")
public class AllianceResourceGrant extends BaseZhiyuEntity {

    private String tenantId;
    private String enterpriseId;
    private String resourceType;
    /** uuid[] 授权资源集合 */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> resourceIds;
    private String createdBy;
}
