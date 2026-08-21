package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.affairs.PeriodSlot;

import java.time.LocalTime;

/**
 * 节次 Mapper（period_slots 表）。
 *
 * @author zhiyu
 */
public interface PeriodSlotMapper extends BaseMapperPlus<PeriodSlot, PeriodSlot> {

    /** 节次查重（对齐 Go store/imports.go ImportPeriodSlot）。 */
    @Select("SELECT id FROM period_slots WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 节次导入插入（对齐 Go store/imports.go ImportPeriodSlot）。 */
    @Insert("INSERT INTO period_slots (id, tenant_id, name, slot_type, start_time, end_time, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{slotType}, #{startTime}, #{endTime}, #{sortOrder})")
    int insertPeriodSlot(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                         @Param("slotType") String slotType, @Param("startTime") LocalTime startTime,
                         @Param("endTime") LocalTime endTime, @Param("sortOrder") Integer sortOrder);
}
