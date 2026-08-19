package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalTerm;

import java.time.LocalDate;

/**
 * 学期 Mapper（terms 表）。
 *
 * @author zhiyu
 */
public interface PortalTermMapper extends BaseMapperPlus<PortalTerm, PortalTerm> {

    /** 清空当前学期标记（置新当前学期前）。 */
    @Update("UPDATE terms SET is_current = false WHERE tenant_id = #{tenantId}")
    int clearCurrent(@Param("tenantId") String tenantId);

    /** 清空当前学期标记（排除自身，更新场景）。 */
    @Update("UPDATE terms SET is_current = false WHERE tenant_id = #{tenantId} AND id <> #{id}")
    int clearCurrentExcept(@Param("tenantId") String tenantId, @Param("id") String id);

    /** 学期查重（对齐 Go store/imports.go ImportTerm）。 */
    @Select("SELECT id FROM terms WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String selectIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 学期导入插入（对齐 Go store/imports.go ImportTerm）。 */
    @Insert("INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{name}, #{startDate}, #{endDate}, #{weeks})")
    int insertTerm(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                   @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate,
                   @Param("weeks") Integer weeks);
}
