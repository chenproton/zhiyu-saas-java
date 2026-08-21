package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.util.List;

/**
 * 评分模板（rubric_templates 表，Go→Java 迁移）。
 *
 * <p>data 为 jsonb 列，实体以 String 承载（Service 负责 Map 互转）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("rubric_templates")
public class SceneRubricTemplate extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 模板名称 */
    private String name;

    /** 模式（rubric/score_rule） */
    private String mode;

    /** 适用类型（JSON 数组列，原 PG varchar[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> types;

    /** 描述 */
    private String description;

    /** 模板数据（jsonb 原文，Service 负责 Map 互转） */
    private String data;

    /** 是否软删除 */
    private Boolean isDeleted;
}
