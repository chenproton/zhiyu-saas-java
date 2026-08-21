package org.dromara.zhiyu.core.mybatis;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * PostgreSQL jsonb 数组列（tenants.secondary_colleges 等）↔ {@link List}&lt;Object&gt; 类型处理器。
 *
 * <p>读：经 JDBC getString 取 jsonb 原文后按数组解析；写：序列化为 JSON 文本，
 * 调用方需在 SQL 中用 {@code CAST(#{...} AS JSON)} 显式转换。</p>
 *
 * @author zhiyu
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.OTHER)
public class JsonArrayTypeHandler extends BaseTypeHandler<List<Object>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> LIST_REF = new TypeReference<>() {
    };

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<Object> parameter, JdbcType jdbcType)
        throws SQLException {
        try {
            ps.setString(i, MAPPER.writeValueAsString(parameter));
        } catch (Exception e) {
            throw new SQLException("jsonb 序列化失败", e);
        }
    }

    @Override
    public List<Object> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }

    @Override
    public List<Object> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }

    @Override
    public List<Object> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private List<Object> parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            List<Object> v = MAPPER.readValue(json, LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception ignored) {
            return null;
        }
    }
}
