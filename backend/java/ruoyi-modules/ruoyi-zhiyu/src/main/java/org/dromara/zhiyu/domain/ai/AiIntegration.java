package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 第三方智能体/应用挂接（ai_integrations 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_integrations")
public class AiIntegration extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 类型（agent/app） */
    private String kind;

    /** 名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 链接 */
    private String url;

    /** 图标 */
    private String icon;

    /** 分类 */
    private String category;

    /** 排序 */
    private Integer sort;

    /** 状态（active/inactive） */
    private String status;

    /** 创建人 ID */
    private String createdBy;
}
