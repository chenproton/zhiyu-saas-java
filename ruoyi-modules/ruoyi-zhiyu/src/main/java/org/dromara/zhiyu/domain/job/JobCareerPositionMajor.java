package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 岗位-专业绑定（career_position_majors 表，Go→Java 迁移）。
 *
 * <p>表仅有 created_at（无 updated_at），故不继承 {@code BaseZhiyuEntity}，
 * 自建 id 主键（ASSIGN_UUID 等价 PG gen_random_uuid 语义）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("career_position_majors")
public class JobCareerPositionMajor {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 岗位 ID */
    private String careerPositionId;

    /** 专业 ID */
    private String majorId;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
