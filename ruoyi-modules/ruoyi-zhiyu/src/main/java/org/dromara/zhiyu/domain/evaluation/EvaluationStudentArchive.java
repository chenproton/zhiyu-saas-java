package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 学生能力档案（student_ability_archives 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("student_ability_archives")
public class EvaluationStudentArchive extends BaseZhiyuEntity {

    /** 学生用户 ID */
    private String userId;

    /** 材料类型 */
    private String materialType;

    /** 材料名称 */
    private String materialName;

    /** 颁发机构 */
    private String issuingOrg;

    /** 获得日期 */
    private LocalDate obtainDate;

    /** 等级 */
    private String level;

    /** 审核状态（pending 起） */
    private String auditStatus;

    /** 审核备注 */
    private String auditRemark;

    /** 折算学分 */
    private BigDecimal convertedCredit;

    /** 方向（positive/negative） */
    private String direction;

    /** 是否启用 */
    private Boolean isEnabled;

    /** 租户 ID */
    private String tenantId;
}
