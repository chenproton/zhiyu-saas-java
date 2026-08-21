package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 任务测评方式（task_evaluation_methods 表，Go→Java 迁移）。
 *
 * <p>evalSubjects/resourceConfig 为 jsonb 列，实体以 String 承载（Service 负责互转）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("task_evaluation_methods")
public class SceneEvalMethod extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 任务 ID */
    private String taskId;

    /** 方法 key（paper/question_bank/quiz/manual 等） */
    private String methodKey;

    /** 权重（0-100） */
    private java.math.BigDecimal weight;

    /** 评价对象（individual/group） */
    private String evalObject;

    /** 计分类型 */
    private String scoreType;

    /** 评价主体（jsonb 原文） */
    private String evalSubjects;

    /** 引用评分模板 ID（恒为 NULL，评价标准为纯复制语义） */
    private String rubricTemplateId;

    /** 标准名称 */
    private String standardName;

    /** 标准模式（rubric/score_rule） */
    private String standardMode;

    /** 资源配置（jsonb 原文，含 examId/usageId 等） */
    private String resourceConfig;

    /** 乐观锁版本号（整数，与资源版本字符串不同义） */
    private Integer version;

    /** 是否启用 */
    private Boolean isEnabled;
}
