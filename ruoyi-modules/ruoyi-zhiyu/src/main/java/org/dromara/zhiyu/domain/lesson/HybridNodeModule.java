package org.dromara.zhiyu.domain.lesson;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 混合课程节点模块（hybrid_node_modules 表，无 created_at/updated_at 列，故不继承基类）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("hybrid_node_modules")
public class HybridNodeModule {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 节点 ID */
    private String nodeId;

    /** 模块键 */
    private String moduleKey;

    /** 模式（online/offline） */
    private String mode;

    /** 模块数据（jsonb 列，存 JSON 文本） */
    private String data;

    /** 租户 ID */
    private String tenantId;
}
