package org.dromara.zhiyu.domain.favorites;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.util.List;

/**
 * 题库（question_banks 表，收藏列表子集字段）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("question_banks")
public class FavQuestionBank extends BaseZhiyuEntity {

    /** 编码 */
    private String code;

    /** 名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 封面图 */
    private String coverImage;

    /** 状态 */
    private String status;

    /** 题目数 */
    private Integer questionCount;

    /** 创建人 ID */
    private String creatorId;

    /** 协作人 ID 数组 */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> collaboratorIds;

    /** 协作部门 ID 数组 */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> collaboratorDeptIds;

    /** 批次 ID */
    private String batchId;

    /** 版本 */
    private String version;

    /** 归属类型（mine/collaborate/public） */
    private String ownerType;

    /** 是否草稿池 */
    private Boolean isDraftPool;

    /** 租户 ID */
    private String tenantId;
}
