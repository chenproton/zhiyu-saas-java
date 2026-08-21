package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationStudentArchive;

import java.time.LocalDate;

/**
 * 学生能力档案 Mapper（student_ability_archives 表）。
 *
 * @author zhiyu
 */
public interface EvaluationArchiveMapper extends BaseMapperPlus<EvaluationStudentArchive, EvaluationStudentArchive> {

    @Insert("INSERT INTO student_ability_archives (id, tenant_id, user_id, material_type, material_name,"
        + " issuing_org, obtain_date, audit_status, converted_credit, direction, is_enabled)"
        + " VALUES (#{id}, #{tenantId}, #{userId}, #{materialType}, #{materialName}, #{issuingOrg}, #{obtainDate},"
        + " 'pending', 0, #{direction}, true)")
    int insertArchive(@Param("id") String id, @Param("tenantId") String tenantId, @Param("userId") String userId,
                      @Param("materialType") String materialType, @Param("materialName") String materialName,
                      @Param("issuingOrg") String issuingOrg, @Param("obtainDate") LocalDate obtainDate,
                      @Param("direction") String direction);
}
