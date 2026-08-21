package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 专业（majors 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("majors")
public class SystemMajor extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 编码 */
    private String code;

    /** 名称 */
    private String name;

    /** 别名 */
    private String alias;

    /** 是否启用 */
    private Boolean enabled;
}
