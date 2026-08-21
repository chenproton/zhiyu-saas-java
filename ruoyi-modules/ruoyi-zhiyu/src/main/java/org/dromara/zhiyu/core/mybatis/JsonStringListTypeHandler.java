package org.dromara.zhiyu.core.mybatis;

import com.fasterxml.jackson.core.type.TypeReference;
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
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;

/**
 * MySQL JSON 数组列（原 PG jsonb，如 schedule_entries.periods）↔ {@link List}&lt;String&gt; 类型处理器。
 *
 * <p>JSON 列经 JDBC getString 返回 JSON 文本，本处理器按 Go 版
 * {@code JSONSliceToStrings} 语义解析：仅提取数组中的字符串元素、过滤其余类型与空串，
 * 避免脏数据导致整行读取失败（Go 版同样静默过滤）。</p>
 *
 * @author zhiyu
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.OTHER)
public class JsonStringListTypeHandler extends BaseTypeHandler<List<String>> {

    private static final TypeReference<List<Object>> LIST_REF = new TypeReference<>() {
    };

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
        throws SQLException {
        try {
            ps.setString(i, ZhiyuJsonUtils.MAPPER.writeValueAsString(parameter));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new SQLException("jsonb 序列化失败", e);
        }
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private List<String> parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            List<Object> raw = ZhiyuJsonUtils.MAPPER.readValue(json, LIST_REF);
            List<String> out = new ArrayList<>(raw.size());
            for (Object el : raw) {
                if (el instanceof String str && !str.isEmpty()) {
                    out.add(str);
                }
            }
            return out;
        } catch (Exception ignored) {
            return null;
        }
    }
}
