package org.dromara.zhiyu.domain.library;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 资源-标签绑定关系（resource_tag_relations 表，多态引用）。
 *
 * <p>该表仅有 created_at（无 updated_at），故不继承 BaseZhiyuEntity；
 * 本实体主要承载自定义 SQL 结果映射（业务读写均走 Mapper 自定义 SQL）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_tag_relations")
public class LibraryResourceTagRelation {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 标签 ID */
    private String tagId;

    /** 资源类型（knowledge_point/resource_library/ability_point/certificate_library/random_draw_question） */
    private String resourceType;

    /** 资源 ID */
    private String resourceId;
}
