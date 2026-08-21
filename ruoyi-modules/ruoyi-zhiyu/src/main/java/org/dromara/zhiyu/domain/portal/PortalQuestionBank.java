package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 题库（question_banks 表，资源增长趋势统计用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("question_banks")
public class PortalQuestionBank extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 名称 */
    private String name;
}
