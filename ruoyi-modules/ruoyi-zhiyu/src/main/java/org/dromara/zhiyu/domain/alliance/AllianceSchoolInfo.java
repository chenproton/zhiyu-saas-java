package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 联盟学校信息（alliance_school_info 表，Go→Java 迁移）。
 *
 * <p>scale_data / secondary_colleges 为 jsonb 对象列，本实体以 JSON 原文承载，
 * Service 层负责与 DTO 的 Map/List 互转。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_school_info")
public class AllianceSchoolInfo extends BaseZhiyuEntity {

    private String tenantId;
    private String name;
    private String shortName;
    private String schoolType;
    private String province;
    private String city;
    private String address;
    private String website;
    private String contactPhone;
    private String description;
    private String logoUrl;
    /** jsonb 对象（scale_data），JSON 原文 */
    private String scaleData;
    /** jsonb 对象数组（secondary_colleges），JSON 原文 */
    private String secondaryColleges;
}
