package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 联盟字典项（alliance_dictionaries 表；无 updated_at 列，不继承基类）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_dictionaries")
public class AllianceDictionary implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;
    private String tenantId;
    private String dictType;
    private String code;
    private String name;
    private Integer sortOrder;
    private OffsetDateTime createdAt;
}
