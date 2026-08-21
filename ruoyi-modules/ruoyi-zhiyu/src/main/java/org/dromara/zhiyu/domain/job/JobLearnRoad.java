package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.util.List;

/**
 * 学习路径（learn_roads 表，Go→Java 迁移）。
 *
 * <p>steps 为 jsonb 数组列（步骤对象数组），实体保存原始 JSON 文本，
 * 由 Service 与 DTO 之间做 JSON 转换（与 Go JSONSlice 语义一致）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("learn_roads")
public class JobLearnRoad extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 路径名称 */
    private String name;

    /** 路径描述 */
    private String description;

    /** 关联岗位 ID 数组（uuid[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> positionIds;

    /** 步骤（jsonb，原始 JSON 文本） */
    private String steps;
}
