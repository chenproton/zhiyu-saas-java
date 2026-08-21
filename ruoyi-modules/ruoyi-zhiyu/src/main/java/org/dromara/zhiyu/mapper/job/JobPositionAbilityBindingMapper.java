package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.domain.job.JobPositionAbilityBinding;

/**
 * 岗位-能力绑定 Mapper（position_ability_bindings 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface JobPositionAbilityBindingMapper extends BaseMapperPlus<JobPositionAbilityBinding, JobPositionAbilityBinding> {

    /**
     * 按 ID 查询绑定（LEFT JOIN ability_points 带出能力点名称）。
     */
    @Select("""
        SELECT b.id, b.tenant_id, b.career_position_id, b.responsibility_id, b.ability_point_id,
            ap.name AS ability_name, b.source, b.domain, b.required_level,
            b.rubric_description, b.attributes, b.weight
        FROM position_ability_bindings b
        LEFT JOIN ability_points ap ON ap.id = b.ability_point_id
        WHERE b.id = #{id}
        """)
    JobPositionAbilityBinding selectBindingById(@Param("id") String id);

    /**
     * 按唯一键查询绑定（冲突命中时回读实际行 id，避免把未入库的新 uuid 写入映射，对齐 Go RETURNING id）。
     */
    @Select("""
        SELECT b.id, b.tenant_id, b.career_position_id, b.responsibility_id, b.ability_point_id,
            ap.name AS ability_name, b.source, b.domain, b.required_level,
            b.rubric_description, b.attributes, b.weight
        FROM position_ability_bindings b
        LEFT JOIN ability_points ap ON ap.id = b.ability_point_id
        WHERE b.career_position_id = #{careerPositionId} AND b.responsibility_id = #{responsibilityId}
            AND b.ability_point_id = #{abilityPointId}
        """)
    JobPositionAbilityBinding selectBindingByUnique(@Param("careerPositionId") String careerPositionId,
                                                    @Param("responsibilityId") String responsibilityId,
                                                    @Param("abilityPointId") String abilityPointId);

    /**
     * 写入绑定（id 由调用方预置；唯一键冲突时更新领域/等级/量规/属性/权重，对齐 Go ON CONFLICT DO UPDATE）。
     */
    @Insert("""
        INSERT INTO position_ability_bindings (
            id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
            domain, required_level, rubric_description,
            attributes, weight
        ) VALUES (
            #{id}, #{tenantId}, #{careerPositionId}, #{responsibilityId}, #{abilityPointId}, #{source},
            #{domain}, #{requiredLevel}, #{rubricDescription},
            #{attributes, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},
            #{weight}
        )
        ON DUPLICATE KEY UPDATE
            domain = VALUES(domain),
            required_level = VALUES(required_level),
            rubric_description = VALUES(rubric_description),
            attributes = VALUES(attributes),
            weight = VALUES(weight)
        """)
    int upsertBinding(JobPositionAbilityBinding binding);
}
