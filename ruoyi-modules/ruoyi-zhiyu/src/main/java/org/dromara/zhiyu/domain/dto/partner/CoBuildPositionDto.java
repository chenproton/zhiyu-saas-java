package org.dromara.zhiyu.domain.dto.partner;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.domain.job.JobCareerPosition;

import java.util.List;

/**
 * 企业共建岗位列表/详情响应（对齐 Go PartnerCoBuildPosition = CareerPosition + schoolName）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CoBuildPositionDto extends JobCareerPosition {

    /** 所属学校名称（JOIN tenants） */
    private String schoolName;

    /** 专业 ID 数组（career_position_majors，组装结果） */
    private List<String> majorIds;

    /** 专业名称数组（JOIN majors，与 majorIds 按序对齐） */
    private List<String> majorNames;
}
