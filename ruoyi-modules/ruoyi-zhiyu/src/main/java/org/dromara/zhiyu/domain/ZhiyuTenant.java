package org.dromara.zhiyu.domain;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.util.List;
import java.util.Map;

/**
 * 租户实体（tenants 表，Go→Java 迁移：PG uuid 主键）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("tenants")
public class ZhiyuTenant extends BaseZhiyuEntity {

    /** 租户名称 */
    private String name;

    /** 租户编码 */
    private String code;

    /** 租户类型（school/enterprise） */
    private String type;

    /** Logo 地址 */
    private String logoUrl;

    /** 域名 */
    private String domain;

    /** 企业编码 */
    private String enterpriseCode;

    /** 联系人 */
    private String contact;

    /** 电话 */
    private String phone;

    /** 地址 */
    private String address;

    /** 描述 */
    private String description;

    /** 状态（active/停用） */
    private String status;

    /** 简称 */
    private String shortName;

    /** 学校类型 */
    private String schoolType;

    /** 省份 */
    private String province;

    /** 城市 */
    private String city;

    /** 官网 */
    private String website;

    /** 联系电话 */
    private String contactPhone;

    /** 规模数据（jsonb） */
    @TableField(typeHandler = JsonMapTypeHandler.class)
    private Map<String, Object> scaleData;

    /** 二级学院（jsonb 数组） */
    @TableField(typeHandler = JsonArrayTypeHandler.class)
    private List<Object> secondaryColleges;

    /** 办学层次 */
    private String educationLevel;

    /** 办学性质 */
    private String educationNature;

    /** 管理员用户 ID 数组（uuid[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> adminIds;

    /** 有效期起（YYYY-MM-DD，空为不限） */
    private String validFrom;

    /** 有效期止（YYYY-MM-DD，空为不限） */
    private String validUntil;
}
