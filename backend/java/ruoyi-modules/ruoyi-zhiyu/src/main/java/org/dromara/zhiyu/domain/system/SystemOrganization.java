package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 组织节点（organizations 表，Go→Java 迁移：PG uuid 主键）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("organizations")
public class SystemOrganization extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 组织名称 */
    private String name;

    /** 组织类型 ID */
    private String typeId;

    /** 父节点 ID */
    private String parentId;

    /** 排序 */
    private Integer sortOrder;

    /** 成员数 */
    private Integer memberCount;
}
