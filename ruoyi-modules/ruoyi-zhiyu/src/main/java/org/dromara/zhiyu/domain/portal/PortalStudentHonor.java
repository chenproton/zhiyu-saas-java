package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 学生荣誉（student_honors 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("student_honors")
public class PortalStudentHonor extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 学生用户 ID */
    private String userId;

    /** 荣誉名称 */
    private String name;

    /** 颁发方 */
    private String issuer;

    /** 荣誉日期 */
    private String honorDate;

    /** 附件文件名 */
    private String fileName;

    /** 附件文件 URL */
    private String fileUrl;
}
