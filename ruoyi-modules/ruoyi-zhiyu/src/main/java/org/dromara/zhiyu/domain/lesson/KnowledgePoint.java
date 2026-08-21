package org.dromara.zhiyu.domain.lesson;

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
 * 知识点（knowledge_points 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("knowledge_points")
public class KnowledgePoint extends BaseZhiyuEntity {

    /** 知识点名称 */
    private String name;

    /** 知识点编码 */
    private String code;

    /** 描述 */
    private String description;

    /** 是否已关联 */
    private Boolean linked;

    /** 颗粒课 ID 数组 */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> granularLessonIds;

    /** 创建人 ID */
    private String creatorId;

    /** 来源类型 */
    private String sourceType;

    /** 来源 ID */
    private String sourceId;

    /** 分类 */
    private String category;

    /** 租户 ID */
    private String tenantId;
}
