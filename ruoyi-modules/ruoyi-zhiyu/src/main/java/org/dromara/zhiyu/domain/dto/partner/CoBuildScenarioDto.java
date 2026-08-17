package org.dromara.zhiyu.domain.dto.partner;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.domain.scene.SceneScenario;

import java.util.List;

/**
 * 企业共建场景列表/详情响应（对齐 Go PartnerCoBuildScenario = Scenario + schoolName）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CoBuildScenarioDto extends SceneScenario {

    /** 所属学校名称（JOIN tenants） */
    private String schoolName;

    /** 行业名称数组（与 industryIds 按序对齐） */
    private List<String> industryNames;

    /** 专业名称数组（与 professionIds 按序对齐） */
    private List<String> professionNames;
}
