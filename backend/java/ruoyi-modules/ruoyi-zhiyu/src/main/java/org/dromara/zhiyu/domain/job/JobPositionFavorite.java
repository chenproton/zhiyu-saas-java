package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 岗位收藏记录（position_favorites 表，Go→Java 迁移）。
 *
 * <p>表仅有 created_at（无 updated_at），故不继承 {@code BaseZhiyuEntity}，
 * 自建 id 主键。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("position_favorites")
public class JobPositionFavorite {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 用户 ID */
    private String userId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
