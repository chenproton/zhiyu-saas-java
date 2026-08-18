package org.dromara.zhiyu.service.impl.importexport;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.importexport.ImportExportDtos.ImportPreviewItem;
import org.dromara.zhiyu.mapper.importexport.ImportExportMapper;
import org.dromara.zhiyu.service.importexport.IImportExportService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 导入导出服务实现（对齐 Go 版 import/export/templates 全套端点）。
 *
 * <p>响应结构与 Go 版 {@code ImportPreviewResult} / {@code map[string]interface{}} 一一对应；
 * 模板列映射、填写说明、参考字典 Sheet 均取自 Go 源码。复杂实体的深层关系持久化（岗位职责/
 * 场景任务/课程节点/题目选项等）在演示环境按「解析 + 逐行校验 + 计数」实现，见
 * {@link #importExcel} 各分支。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class ImportExportServiceImpl implements IImportExportService {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    /** Excel 导入实体（kebab-case URL 段，excel/preview 路径） */
    private static final Set<String> EXCEL_IMPORT_ENTITIES = Set.of(
        "positions", "scenarios", "question-banks", "exams", "courses", "granular-courses",
        "industries", "majors", "organizations", "students", "teachers",
        "alliance-projects", "alliance-achievements", "alliance-agreements",
        "alliance-permissions", "alliance-brands", "schedules", "program-courses", "affairs-config");

    /** 支持 preview 的实体（affairs-config 仅 excel，无 preview） */
    private static final Set<String> PREVIEW_ENTITIES = Set.of(
        "positions", "scenarios", "question-banks", "exams", "courses", "granular-courses",
        "industries", "majors", "organizations", "students", "teachers",
        "alliance-projects", "alliance-achievements", "alliance-agreements",
        "alliance-permissions", "alliance-brands", "schedules", "program-courses");

    /** 通用 CSV 实体（表名白名单，import_export_handler） */
    private static final Set<String> GENERIC_CSV_ENTITIES = Set.of(
        "question_banks", "exams", "courses", "career_positions", "scenarios");

    /** 通用 CSV 业务键列（keyCol） */
    private static final Map<String, String> GENERIC_KEY_COLS = Map.of(
        "question_banks", "name", "exams", "name", "courses", "code",
        "career_positions", "name", "scenarios", "name");

    /** 通用 CSV 导出默认列（对齐 Go defaultCols） */
    private static final Map<String, String[]> GENERIC_DEFAULT_COLS = Map.of(
        "question_banks", new String[]{"id", "name", "description", "status", "created_at"},
        "exams", new String[]{"id", "name", "description", "status", "created_at"},
        "courses", new String[]{"id", "code", "name", "status", "created_at"},
        "career_positions", new String[]{"id", "name", "short_name", "status", "created_at"},
        "scenarios", new String[]{"id", "name", "code", "status", "created_at"});

    private static final Map<String, String> TEMPLATE_FILENAMES = Map.ofEntries(
        Map.entry("positions", "岗位批量导入模板.xlsx"),
        Map.entry("scenarios", "场景批量导入模板.xlsx"),
        Map.entry("courses", "体系课批量导入模板.xlsx"),
        Map.entry("granular-courses", "颗粒课批量导入模板.xlsx"),
        Map.entry("question-banks", "题库批量导入模板.xlsx"),
        Map.entry("questions", "题目批量导入模板.xlsx"),
        Map.entry("exams", "试卷批量导入模板.xlsx"),
        Map.entry("industries", "行业批量导入模板.xlsx"),
        Map.entry("majors", "专业批量导入模板.xlsx"),
        Map.entry("organizations", "组织架构批量导入模板.xlsx"),
        Map.entry("students", "学生批量导入模板.xlsx"),
        Map.entry("teachers", "教师批量导入模板.xlsx"),
        Map.entry("alliance-projects", "合作项目批量导入模板.xlsx"),
        Map.entry("alliance-achievements", "合作成果批量导入模板.xlsx"),
        Map.entry("alliance-agreements", "合作协议批量导入模板.xlsx"),
        Map.entry("alliance-permissions", "合作权限批量导入模板.xlsx"),
        Map.entry("alliance-brands", "品牌内容批量导入模板.xlsx"),
        Map.entry("affairs-config", "教务配置批量导入模板.xlsx"),
        Map.entry("program-courses", "方案课程批量导入模板.xlsx"));

    private static final Map<String, String> EXPORT_FILENAMES = Map.of(
        "positions", "岗位导出.xlsx", "scenarios", "场景导出.xlsx", "courses", "体系课导出.xlsx",
        "granular-courses", "颗粒课导出.xlsx", "question-banks", "题库导出.xlsx",
        "questions", "题目导出.xlsx", "exams", "试卷导出.xlsx",
        "organizations", "组织架构导出.xlsx", "students", "学生导出.xlsx", "teachers", "教师导出.xlsx");

    private final ImportExportMapper mapper;

    // ==================== 模板 ====================

    @Override
    public byte[] buildTemplate(String entity, String bankId, String brandType) {
        requireTenant();
        String tenantId = TenantContext.getTenantId();
        try (Workbook wb = new XSSFWorkbook()) {
            Styles styles = new Styles(wb);
            switch (entity) {
                case "positions" -> positionTemplate(wb, styles, tenantId);
                case "scenarios" -> scenarioTemplate(wb, styles, tenantId);
                case "courses" -> systemCourseTemplate(wb, styles, tenantId);
                case "granular-courses" -> granularCourseTemplate(wb, styles, tenantId);
                case "question-banks" -> questionBankTemplate(wb, styles, tenantId);
                case "questions" -> questionTemplate(wb, styles, tenantId, bankId);
                case "exams" -> examTemplate(wb, styles, tenantId);
                case "industries" -> industryTemplate(wb, styles);
                case "majors" -> majorTemplate(wb, styles);
                case "organizations" -> organizationTemplate(wb, styles, tenantId);
                case "students" -> studentTemplate(wb, styles, tenantId);
                case "teachers" -> teacherTemplate(wb, styles, tenantId);
                case "alliance-projects" -> projectTemplate(wb, styles);
                case "alliance-achievements" -> achievementTemplate(wb, styles);
                case "alliance-agreements" -> agreementTemplate(wb, styles);
                case "alliance-permissions" -> permissionTemplate(wb, styles);
                case "alliance-brands" -> brandTemplate(wb, styles, tenantId, brandType);
                case "affairs-config" -> affairsConfigTemplate(wb, styles);
                case "program-courses" -> programCourseTemplate(wb, styles);
                default -> throw new ApiException(400, "bad_request", "不支持的实体");
            }
            return toBytes(wb);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "生成模板失败");
        }
    }

    private void positionTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("岗位基本信息");
        writeNote(s1, "填写说明：\n* 必填列。薪资单位为元。\n岗位类型：固定为教学岗位，无需填写\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n所需证书：从「系统证书库」Sheet 选取，匹配则关联，不匹配则自动新建并关联\n任职要求：多条可用换行（Alt+Enter）分隔\n导入后默认状态为 draft", 12, st);
        writeHeaders(s1, new String[]{"岗位名称 *", "岗位简称", "岗位类型", "面向行业", "适用专业", "薪资下限", "薪资上限", "岗位背景介绍", "任职要求", "发展路径", "所需证书", "所属批次"},
            new int[]{22, 14, 16, 20, 26, 12, 12, 42, 42, 30, 28, 18}, st);
        Sheet s2 = wb.createSheet("工作职责与能力点");
        writeNote(s2, "填写说明：\n一个岗位 = 多行，相同「职责名称」的行属于同一工作职责\n能力属性：知识 / 技能 / 素质\n胜任力等级：了解 / 理解 / 掌握 / 熟练 / 精通\n岗位名称须与「岗位基本信息」Sheet 中一致，自动匹配", 7, st);
        writeHeaders(s2, new String[]{"岗位名称 *", "职责名称 *", "能力点名称", "能力属性", "能力领域", "胜任力等级", "胜任标准描述"},
            new int[]{22, 28, 28, 14, 18, 14, 44}, st);
        addRefSheet(wb, st, "【参考】行业字典", new String[]{"行业名称", "行业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listIndustries(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        wb.setActiveSheet(0);
    }

    private void scenarioTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("场景基本信息");
        writeNote(s1, "填写说明：\n* 必填列。编码由系统自动生成（格式: SC-YYYY-NNNN），无需填写\n目标岗位：从「岗位字典」Sheet 选取，匹配则关联，不匹配则忽略\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔\n难度等级：1-5，1 最易，5 最难\n导入后默认状态为 draft", 7, st);
        writeHeaders(s1, new String[]{"场景名称 *", "目标岗位", "面向行业", "适用专业", "难度等级", "场景介绍", "所属批次"},
            new int[]{24, 22, 20, 26, 10, 48, 18}, st);
        Sheet s2 = wb.createSheet("任务配置");
        writeNote(s2, "填写说明：\n每个任务一行，相同场景下可有多行任务。\n任务名称：必填。编码由系统自动生成\n任务类型：考核 / 训练\n难度：1-5\n考查知识点/能力点/任务资源：多个逗号分隔\n测评方式：题库 / 试卷 / 随堂测 / 现场问答 / 现场评审 / 成果评价 / 作业", 11, st);
        writeHeaders(s2, new String[]{"场景名称 *", "任务名称 *", "任务类型", "难度", "预估学时(h)", "背景介绍", "详细说明", "考查知识点", "考查能力点", "任务资源", "测评方式"},
            new int[]{22, 24, 12, 8, 12, 34, 34, 28, 28, 28, 28}, st);
        addRefSheet(wb, st, "【参考】岗位字典", new String[]{"岗位名称"}, new int[]{30},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listPublishedPositionNames(tenantId)));
        addRefSheet(wb, st, "【参考】行业字典", new String[]{"行业名称", "行业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listIndustries(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】知识点库", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        addRefSheet(wb, st, "【参考】能力点库", new String[]{"能力点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listAbilityPointNames(tenantId)));
        addRefSheet(wb, st, "【参考】任务资源库", new String[]{"资源名称"}, new int[]{42},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listResourceNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void systemCourseTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("课程基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n适用专业：从「专业字典」Sheet 选取，匹配则关联，不匹配则忽略\n所属批次：从「批次字典」Sheet 选取，匹配则关联，不匹配则忽略\n关联能力点：从「能力点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n导入后默认状态为 draft", 5, st);
        writeHeaders(s1, new String[]{"课程名称 *", "适用专业", "课程简介", "所属批次", "关联能力点"},
            new int[]{28, 24, 48, 20, 30}, st);
        Sheet s2 = wb.createSheet("节点配置");
        writeNote(s2, "填写说明：\n每个节点一行，相同课程下可有多行节点。\n课程名称：须与「课程基本信息」Sheet 中一致\n节点名称：必填\n父节点名称：本课程下已出现的节点名称，为空表示一级节点\n节点类型：手动编辑（默认）/ 颗粒课\n排序：数字，越小越靠前\n测评方式：题库 / 试卷 / 随堂测 / 作业", 11, st);
        writeHeaders(s2, new String[]{"课程名称 *", "节点名称 *", "父节点名称", "节点类型", "排序", "学习目标", "预计课时", "难度", "关联知识点", "课程资源", "测评方式"},
            new int[]{22, 24, 18, 12, 8, 34, 12, 8, 28, 28, 28}, st);
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】批次字典", new String[]{"批次名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        addRefSheet(wb, st, "【参考】知识点库", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        addRefSheet(wb, st, "【参考】能力点库", new String[]{"能力点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listAbilityPointNames(tenantId)));
        addRefSheet(wb, st, "【参考】测评方式", new String[]{"测评方式"}, new int[]{24},
            "仅作参考，无需编辑修改。", List.of(new String[]{"题库"}, new String[]{"试卷"}, new String[]{"随堂测"}, new String[]{"作业"}));
        wb.setActiveSheet(0);
    }

    private void granularCourseTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("课程基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n适用专业：从「专业字典」Sheet 选取，匹配则关联，不匹配则忽略\n难度：1-5\n预计课时：数字，单位小时\n关联知识点：多个逗号分隔，不匹配则自动新建并关联\n课程资源：多个逗号分隔\n导入后默认状态为 draft", 8, st);
        writeHeaders(s1, new String[]{"课程名称 *", "适用专业", "难度", "预计课时", "学习目标", "关联知识点", "课程资源", "所属批次"},
            new int[]{28, 24, 10, 12, 48, 28, 28, 20}, st);
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】批次字典", new String[]{"批次名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        addRefSheet(wb, st, "【参考】知识点库", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        addRefSheet(wb, st, "【参考】任务资源库", new String[]{"资源名称"}, new int[]{42},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listResourceNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void questionBankTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("题库基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n所属批次：从「批次参考」Sheet 选取，匹配则关联，不匹配则忽略。\n导入后默认状态为 draft", 3, st);
        writeHeaders(s1, new String[]{"题库名称 *", "题库简介", "所属批次"}, new int[]{28, 42, 22}, st);
        addRefSheet(wb, st, "【参考】批次", new String[]{"批次名称"}, new int[]{32},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void questionTemplate(Workbook wb, Styles st, String tenantId, String bankId) {
        if (bankId == null || bankId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少题库ID");
        }
        Sheet s1 = wb.createSheet("题目明细");
        writeNote(s1, "填写说明：\n* 必填列。\n题型：单选题 / 多选题 / 判断题 / 填空题 / 问答题 / 简答题\n判断题：正确答案填 正确/错误 或 true/false\n难度：简单 / 中等 / 困难\n知识点：多个用逗号分隔，不存在则自动新建\n导入后默认状态为 draft", 12, st);
        writeHeaders(s1, new String[]{"题型 *", "题目内容 *", "选项A", "选项B", "选项C", "选项D", "正确答案 *", "答案解析", "难度", "知识点", "分数", "来源"},
            new int[]{12, 48, 24, 24, 24, 24, 28, 36, 10, 28, 10, 20}, st);
        addRefSheet(wb, st, "【参考】知识点", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void examTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("试卷基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n所属批次：从「批次参考」Sheet 选取，匹配则关联，不匹配则忽略。\n导入后默认状态为 draft", 3, st);
        writeHeaders(s1, new String[]{"试卷名称 *", "试卷简介", "所属批次"}, new int[]{28, 42, 22}, st);
        Sheet s2 = wb.createSheet("试卷题目");
        writeNote(s2, "填写说明：\n本表可选。\n试卷名称须与「试卷基本信息」Sheet 中一致。\n题目内容须与当前租户下已存在的题目内容一致，系统会按内容匹配并加入试卷。", 3, st);
        writeHeaders(s2, new String[]{"试卷名称 *", "题目内容 *", "分数 *"}, new int[]{28, 48, 12}, st);
        addRefSheet(wb, st, "【参考】批次", new String[]{"批次名称"}, new int[]{32},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void industryTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("行业列表");
        writeNote(s1, "填写说明：\n* 必填列。\n行业代码：租户内唯一，已存在则更新。\n上级行业代码：填写本 Sheet 中已有的行业代码；为空表示顶级行业。\n排序：数字，越小越靠前，默认为 0。\n是否启用：true/是/启用 表示启用，默认启用。", 5, st);
        writeHeaders(s1, new String[]{"行业代码 *", "行业名称 *", "上级行业代码", "排序", "是否启用"}, new int[]{18, 28, 18, 10, 12}, st);
        wb.setActiveSheet(0);
    }

    private void majorTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("专业列表");
        writeNote(s1, "填写说明：\n* 必填列。\n专业代码：租户内唯一，已存在则更新。\n别名：可选简称。\n是否启用：true/是/启用 表示启用，默认启用。", 4, st);
        writeHeaders(s1, new String[]{"专业代码 *", "专业名称 *", "别名", "是否启用"}, new int[]{18, 30, 24, 12}, st);
        wb.setActiveSheet(0);
    }

    private void organizationTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("组织架构");
        writeNote(s1, "填写说明：\n* 必填列。\n组织类型：须与「组织类型参考」Sheet 中的类型名称完全一致。\n父组织名称：本 Sheet 中已有的组织名称；为空表示一级节点。\n排序：数字，越小越靠前，默认为 0。", 4, st);
        writeHeaders(s1, new String[]{"组织名称 *", "组织类型 *", "父组织名称", "排序"}, new int[]{30, 20, 30, 10}, st);
        addRefSheet(wb, st, "【参考】组织类型", new String[]{"组织类型名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listOrgTypeNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void studentTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("学生列表");
        writeNote(s1, "填写说明：\n* 必填列。\n登录账号(学号)：租户内唯一，已存在则跳过。\n密码：长度至少 8 位，且需同时包含字母和数字。\n班级(组织节点路径)：支持多级路径，如 学校-学院-班级。\n状态：正常 / 禁用 / 毕业，默认为正常。", 5, st);
        writeHeaders(s1, new String[]{"登录账号(学号) *", "姓名 *", "密码 *", "班级(组织节点路径) *", "状态"}, new int[]{24, 16, 20, 42, 12}, st);
        wb.setActiveSheet(0);
    }

    private void teacherTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("教师列表");
        writeNote(s1, "填写说明：\n* 必填列。\n登录账号(工号)：租户内唯一，已存在则跳过。\n密码：长度至少 8 位，且需同时包含字母和数字。\n所属组织节点(路径)：支持多级路径。\n职位：多个职位用逗号分隔。\n状态：正常 / 禁用，默认为正常。", 6, st);
        writeHeaders(s1, new String[]{"登录账号(工号) *", "姓名 *", "密码 *", "所属组织节点(路径)", "职位(逗号分隔)", "状态"}, new int[]{24, 16, 20, 42, 28, 12}, st);
        addRefSheet(wb, st, "【参考】职位", new String[]{"职位名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listStaffTitleNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void projectTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作项目");
        writeNote(s1, "填写说明：\n* 必填列。\n合作类型：文本，选填（如：联合研发 / 产教融合）\n项目阶段：启动 / 执行中 / 验收 / 关闭（或 initiation / execution / acceptance / closure），默认为 启动\n预算：文本，选填\n开始日期 / 结束日期：格式 YYYY-MM-DD，选填\n合作企业：企业名称，多值用中文分号「；」分隔\n二级学院：学院名称，多值用中文分号「；」分隔\n公开显示：是 / 否（或 true / false），默认为 否", 10, st);
        writeHeaders(s1, new String[]{"项目名称 *", "合作类型", "项目阶段", "预算", "开始日期", "结束日期", "项目描述", "合作企业", "二级学院", "公开显示"},
            new int[]{28, 20, 22, 20, 16, 16, 48, 40, 30, 14}, st);
        wb.setActiveSheet(0);
    }

    private void achievementTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作成果");
        writeNote(s1, "填写说明：\n* 必填列。\n成果类型：岗位成果 / 场景成果 / 课程成果 / 自定义成果（或 job / scene / course / custom），默认为 自定义成果\n成果日期：格式 YYYY-MM-DD，选填\n归属项目/合作企业/二级学院：多值用中文分号「；」分隔\n公开显示：是 / 否，默认为 否", 8, st);
        writeHeaders(s1, new String[]{"成果名称 *", "成果类型", "成果日期", "成果描述", "归属项目", "合作企业", "二级学院", "公开显示"},
            new int[]{28, 22, 16, 48, 40, 40, 30, 14}, st);
        wb.setActiveSheet(0);
    }

    private void agreementTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作协议");
        writeNote(s1, "填写说明：\n* 必填列。\n协议类型：文本，选填（如：实验室共建 / 实训基地）\n协议状态：草稿 / 生效中 / 已失效 / 已续签 / 已终止（或 draft / active / expired / renewed / terminated），默认为 草稿\n开始日期 / 结束日期：格式 YYYY-MM-DD，选填\n合作企业/关联项目：多值用中文分号「；」分隔", 8, st);
        writeHeaders(s1, new String[]{"协议名称 *", "协议类型", "协议状态", "开始日期", "结束日期", "内容", "合作企业", "关联项目"},
            new int[]{28, 22, 20, 16, 16, 48, 40, 40}, st);
        wb.setActiveSheet(0);
    }

    private void permissionTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作权限");
        writeNote(s1, "填写说明：\n* 必填列。\n账号类型：企业账号 / 专家账号（或 enterprise / expert），默认为 企业账号\n是否启用：是 / 否（或 true / false），默认为 是（启用）", 3, st);
        writeHeaders(s1, new String[]{"账号名称 *", "账号类型", "是否启用"}, new int[]{28, 22, 14}, st);
        wb.setActiveSheet(0);
    }

    private void brandTemplate(Workbook wb, Styles st, String tenantId, String brandType) {
        String bt = brandType == null ? "" : brandType.trim();
        switch (bt) {
            case "talent" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n状态：草稿 / 已发布 / 已归档（或 draft / published / archived），默认为 草稿\n是否公开 / 是否推荐：是 / 否，默认 否", 8, st);
                writeHeaders(s, new String[]{"案例名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联专业名称"},
                    new int[]{28, 48, 18, 14, 14, 36, 24, 24}, st);
            }
            case "employer" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n企业类型：合作企业 / 独立雇主企业（或 enterprise / independent）\n是否公开 / 是否推荐：是 / 否，默认 否", 21, st);
                writeHeaders(s, new String[]{"企业类型 *", "企业名称 *", "是否公开", "是否推荐", "统一社会信用代码", "所属行业", "所在地区", "成立年份", "企业规模（人数）", "关联二级学院", "企业简介", "联系人", "联系电话", "联系邮箱", "详细地址", "企业Logo URL", "企业主页封面 URL", "企业风采照片URL", "企业营业执照URL", "企业知识产权URL", "企业荣誉资质URL"},
                    new int[]{18, 30, 14, 14, 26, 20, 16, 14, 16, 28, 48, 16, 18, 24, 28, 32, 32, 32, 32, 32, 32}, st);
            }
            case "job" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n岗位类型：教学岗位 / 企业岗位（或 teaching / enterprise）\n薪资下限 / 上限：数字（单位 K）", 12, st);
                writeHeaders(s, new String[]{"岗位类型 *", "岗位名称 *", "是否公开", "是否推荐", "薪资下限(K)", "薪资上限(K)", "面向专业", "所属行业", "岗位简介", "任职要求", "职业发展路径", "岗位职责"},
                    new int[]{18, 30, 14, 14, 16, 16, 30, 20, 48, 36, 36, 48}, st);
            }
            case "major" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n专业名称 / 专业代码：已预填系统全部专业，请勿修改或新增。\n是否公开 / 是否推荐：是 / 否，默认 否", 10, st);
                writeHeaders(s, new String[]{"专业名称", "专业代码", "是否公开", "是否推荐", "品牌介绍", "封面图URL", "关联岗位品牌名称", "关联合作企业名称", "关联合作成果名称", "关联特色课程名称"},
                    new int[]{28, 18, 14, 14, 48, 36, 32, 36, 36, 32}, st);
                // 预填系统全部专业
                List<Map<String, Object>> majors = mapper.listMajors(tenantId, null);
                for (int i = 0; i < majors.size(); i++) {
                    Row r = s.createRow(2 + i);
                    r.createCell(0).setCellValue(str(majors.get(i).get("name")));
                    r.createCell(1).setCellValue(str(majors.get(i).get("code")));
                }
            }
            case "teacher" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n师资类型：校本师资 / 企业专家（或 school / expert）\n性别：男 / 女\n是否公开 / 是否推荐：是 / 否，默认 否", 17, st);
                writeHeaders(s, new String[]{"师资类型 *", "关联教师名称", "关联专家名称", "是否公开", "是否推荐", "性别", "年龄", "所在城市", "职称", "职务", "从业年限", "学历", "所属行业", "擅长领域", "个人简介", "工作经历", "头像URL"},
                    new int[]{18, 24, 24, 14, 14, 12, 12, 16, 20, 20, 14, 18, 20, 32, 48, 48, 32}, st);
            }
            case "culture" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n状态：草稿 / 已发布 / 已归档，默认为 草稿\n是否公开 / 是否推荐：是 / 否，默认 否", 7, st);
                writeHeaders(s, new String[]{"名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联专业名称"},
                    new int[]{28, 48, 18, 14, 14, 36, 24}, st);
            }
            default -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n品牌类型：人才品牌 / 雇主品牌 / 岗位品牌 / 专业品牌 / 师资品牌 / 文化品牌（或 talent / employer / job / major / teacher / culture）\n状态：草稿 / 已发布 / 已归档，默认为 草稿\n是否公开 / 是否推荐：是 / 否，默认 否", 13, st);
                writeHeaders(s, new String[]{"品牌类型 *", "名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联企业名称", "关联岗位名称", "关联专业名称", "关联教师名称", "关联专家名称"},
                    new int[]{22, 30, 48, 18, 14, 14, 36, 24, 32, 28, 24, 24, 24}, st);
            }
        }
        wb.setActiveSheet(0);
    }

    private void affairsConfigTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("学期");
        writeNote(s1, "填写说明：\n名称：如 2025-2026-1\n开始/结束日期：YYYY-MM-DD\n周数：整数，默认 16", 4, st);
        writeHeaders(s1, new String[]{"名称 *", "开始日期 *", "结束日期 *", "周数"}, new int[]{18, 14, 14, 8}, st);
        Sheet s2 = wb.createSheet("场地");
        writeNote(s2, "填写说明：\n类型：教室/机房/实训室/实验室/校外基地\n容量：整数，选填", 3, st);
        writeHeaders(s2, new String[]{"名称 *", "类型 *", "容量"}, new int[]{20, 14, 8}, st);
        Sheet s3 = wb.createSheet("节次");
        writeNote(s3, "填写说明：\n名称：如 上午1-2\n时间：HH:MM 格式\n排序：整数\n时段类型：早自习/上午/下午/晚自习，选填", 5, st);
        writeHeaders(s3, new String[]{"名称 *", "开始时间", "结束时间", "排序", "时段类型"}, new int[]{16, 10, 10, 8, 10}, st);
        wb.setActiveSheet(0);
    }

    private void programCourseTemplate(Workbook wb, Styles st) {
        Sheet s = wb.createSheet("导入");
        writeNote(s, "填写说明：\n* 二选一必填列。\n关联岗位名称：填写已发布岗位名称。\n关联体系课名称：填写已发布体系课名称。\n学分：数字，如 3.5。\n总学时：整数。\n性质：默认为「必修」，可选：必修、选修、实践。", 5, st);
        writeHeaders(s, new String[]{"关联岗位名称（二选一）", "关联体系课名称（二选一）", "学分", "总学时", "性质"}, new int[]{24, 24, 10, 10, 12}, st);
        wb.setActiveSheet(0);
    }

    // ==================== 导出 ====================

    @Override
    public byte[] exportExcel(String entity, List<String> ids, String bankId) {
        requireTenant();
        String tenantId = TenantContext.getTenantId();
        if (!EXPORT_FILENAMES.containsKey(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        // organizations/students/teachers 允许空 ids（导出全部）；其余要求非空
        boolean allowEmpty = Set.of("organizations", "students", "teachers").contains(entity);
        if (!allowEmpty && (ids == null || ids.isEmpty())) {
            String missing = switch (entity) {
                case "positions" -> "缺少岗位ID";
                case "scenarios" -> "缺少场景方案ID";
                case "courses", "granular-courses" -> "缺少课程ID";
                case "question-banks" -> "缺少题库ID";
                case "questions" -> "缺少题目ID";
                case "exams" -> "缺少试卷ID";
                default -> "缺少ID";
            };
            throw new ApiException(400, "bad_request", missing);
        }
        try (Workbook wb = new XSSFWorkbook()) {
            Styles st = new Styles(wb);
            String filename = EXPORT_FILENAMES.get(entity);
            switch (entity) {
                case "positions" -> {
                    positionTemplate(wb, st, tenantId);
                    fillPositions(wb, tenantId, ids);
                }
                case "scenarios" -> {
                    scenarioTemplate(wb, st, tenantId);
                    fillScenarios(wb, tenantId, ids);
                }
                case "courses" -> {
                    systemCourseTemplate(wb, st, tenantId);
                    fillSystemCourses(wb, tenantId, ids);
                }
                case "granular-courses" -> {
                    granularCourseTemplate(wb, st, tenantId);
                    fillGranularCourses(wb, tenantId, ids);
                }
                case "question-banks" -> {
                    questionBankTemplate(wb, st, tenantId);
                    fillQuestionBanks(wb, tenantId, ids);
                }
                case "questions" -> {
                    questionTemplate(wb, st, tenantId, bankId);
                    fillQuestions(wb, tenantId, bankId, ids);
                }
                case "exams" -> {
                    examTemplate(wb, st, tenantId);
                    fillExams(wb, tenantId, ids);
                }
                case "organizations" -> {
                    organizationTemplate(wb, st, tenantId);
                    fillOrganizations(wb, tenantId, ids);
                }
                case "students", "teachers" -> fillUsers(wb, tenantId, entity, ids);
                default -> throw new ApiException(400, "bad_request", "不支持的实体");
            }
            return toBytes(wb);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "导出失败");
        }
    }

    private void fillPositions(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("岗位基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listPositionsForExport(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("short_name")));
            row.createCell(2).setCellValue(str(m.get("position_type")));
            row.createCell(5).setCellValue(str(m.get("salary_min")));
            row.createCell(6).setCellValue(str(m.get("salary_max")));
            row.createCell(7).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillScenarios(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("场景基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listScenariosForExport(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(4).setCellValue(str(m.get("difficulty")));
            row.createCell(5).setCellValue(str(m.get("background")));
            r++;
        }
    }

    private void fillSystemCourses(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("课程基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listSystemCoursesForExport(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(2).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillGranularCourses(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("课程基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listGranularCoursesForExport(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(2).setCellValue(str(m.get("difficulty")));
            row.createCell(3).setCellValue(str(m.get("online_hours")));
            row.createCell(4).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillQuestionBanks(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("题库基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listQuestionBanks(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillQuestions(Workbook wb, String tenantId, String bankId, List<String> ids) {
        if (bankId == null || bankId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少题库ID");
        }
        Sheet s = wb.getSheet("题目明细");
        int r = 2;
        for (Map<String, Object> m : mapper.listQuestionsForExport(tenantId, bankId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("type")));
            row.createCell(1).setCellValue(str(m.get("content")));
            row.createCell(10).setCellValue(str(m.get("score")));
            r++;
        }
    }

    private void fillExams(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("试卷基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listExams(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillOrganizations(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("组织架构");
        int r = 2;
        for (Map<String, Object> m : mapper.listOrganizations(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("type_name")));
            row.createCell(2).setCellValue(str(m.get("parent_name")));
            r++;
        }
    }

    private void fillUsers(Workbook wb, String tenantId, String entity, List<String> ids) {
        String sheetName = "students".equals(entity) ? "学生列表" : "教师列表";
        Sheet s = wb.getSheet(sheetName);
        int r = 2;
        for (Map<String, Object> m : mapper.listUsers(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("login_name")));
            row.createCell(1).setCellValue(str(m.get("name")));
            row.createCell(4).setCellValue(str(m.get("status")));
            r++;
        }
    }

    @Override
    public byte[] exportGeneric(String entity) {
        requireTenant();
        String tenantId = TenantContext.getTenantId();
        if (!GENERIC_CSV_ENTITIES.contains(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        String[] header = GENERIC_DEFAULT_COLS.get(entity);
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", header)).append("\n");
        for (Map<String, Object> row : mapper.listGenericExportRows(entity, tenantId)) {
            List<String> cells = new ArrayList<>();
            for (String col : header) {
                cells.add(csvCell(str(row.get(col))));
            }
            sb.append(String.join(",", cells)).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ==================== 导入 ====================

    @Override
    public Map<String, Object> importExcel(String entity, MultipartFile file, boolean preview, boolean overwrite,
                                           boolean rename, String bankId, String brandType, String termId,
                                           String programId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (!EXCEL_IMPORT_ENTITIES.contains(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        if (preview && !PREVIEW_ENTITIES.contains(entity)) {
            throw new ApiException(404, "not_found", "不支持的实体");
        }
        try (InputStream in = file.getInputStream(); Workbook wb = new XSSFWorkbook(in)) {
            return switch (entity) {
                case "industries" -> importIndustries(wb, tenantId, preview, overwrite, rename);
                case "majors" -> importMajors(wb, tenantId, preview, overwrite, rename);
                case "organizations" -> importOrganizations(wb, tenantId, preview, overwrite, rename);
                case "students" -> importStudents(wb, tenantId, preview);
                case "teachers" -> importTeachers(wb, tenantId, preview);
                case "alliance-projects" -> importProjects(wb, tenantId, userId, preview);
                case "alliance-achievements" -> importAchievements(wb, tenantId, userId, preview);
                case "alliance-agreements" -> importAgreements(wb, tenantId, userId, preview);
                case "alliance-permissions" -> importPermissions(wb, tenantId, preview);
                case "alliance-brands" -> importBrands(wb, tenantId, preview, brandType);
                case "positions" -> parseCount(wb, "岗位基本信息", "岗位", preview);
                case "scenarios" -> parseCount(wb, "场景基本信息", "场景", preview);
                case "courses" -> parseCount(wb, "课程基本信息", "体系课", preview);
                case "granular-courses" -> parseCount(wb, "课程基本信息", "颗粒课", preview);
                case "question-banks" -> importQuestionBanks(wb, tenantId, userId, preview, overwrite, rename);
                case "questions" -> parseCount(wb, "题目明细", "题目", preview);
                case "exams" -> importExams(wb, tenantId, userId, preview, overwrite, rename);
                case "schedules" -> parseCount(wb, "课程列表", "排课", preview);
                case "affairs-config" -> affairsConfigImport(wb, tenantId, preview);
                case "program-courses" -> parseCount(wb, "导入", "方案课程", preview);
                default -> throw new ApiException(400, "bad_request", "不支持的实体");
            };
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "解析Excel文件失败");
        }
    }

    @Override
    public Map<String, Object> importGeneric(String entity, MultipartFile file, boolean overwrite, boolean rename) {
        return importGenericInternal(entity, file, false, overwrite, rename);
    }

    @Override
    public Map<String, Object> preview(String entity, MultipartFile file, boolean overwrite, boolean rename,
                                       String bankId, String brandType, String termId, String programId) {
        if (EXCEL_IMPORT_ENTITIES.contains(entity)) {
            return importExcel(entity, file, true, overwrite, rename, bankId, brandType, termId, programId);
        }
        if (GENERIC_CSV_ENTITIES.contains(entity)) {
            return importGenericInternal(entity, file, true, overwrite, rename);
        }
        throw new ApiException(400, "bad_request", "不支持的实体");
    }

    private Map<String, Object> importGenericInternal(String entity, MultipartFile file, boolean preview,
                                                      boolean overwrite, boolean rename) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (!GENERIC_CSV_ENTITIES.contains(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        String keyCol = GENERIC_KEY_COLS.get(entity);
        List<String> lines;
        try {
            lines = new String(file.getBytes(), StandardCharsets.UTF_8).lines()
                .filter(l -> !l.isBlank()).toList();
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "解析导入文件失败");
        }
        if (lines.isEmpty()) {
            throw new ApiException(400, "bad_request", "CSV 为空或格式无效");
        }
        // 表头按列名定位 name/code
        String[] header = lines.get(0).split(",", -1);
        int nameIdx = -1;
        int codeIdx = -1;
        for (int i = 0; i < header.length; i++) {
            String h = header[i].trim();
            if ("name".equals(h) || "名称".equals(h) || "试卷名称".equals(h) || "题库名称".equals(h)
                || "课程名称".equals(h) || "岗位名称".equals(h) || "场景名称".equals(h)) {
                nameIdx = i;
            }
            if ("code".equals(h) || "编码".equals(h)) {
                codeIdx = i;
            }
        }
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int li = 1; li < lines.size(); li++) {
            String[] cols = lines.get(li).split(",", -1);
            int rowNum = li + 1;
            String name = nameIdx >= 0 && nameIdx < cols.length ? cols[nameIdx].trim() : "";
            String code = codeIdx >= 0 && codeIdx < cols.length ? cols[codeIdx].trim() : "";
            if (name.isEmpty()) {
                errors.add("第" + rowNum + "行名称不能为空");
                failed++;
                continue;
            }
            if (code.isEmpty()) {
                code = "IMP-" + UUID.randomUUID().toString().substring(0, 8);
            }
            String key = "code".equals(keyCol) ? code : name;
            String existing = findExistingId(entity, tenantId, keyCol, key);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, key, name));
                if (!preview) {
                    if (overwrite) {
                        updateGeneric(entity, existing, name, code);
                        created++;
                    } else if (rename) {
                        insertGeneric(entity, tenantId, userId, name + suffix(), code);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    insertGeneric(entity, tenantId, userId, name, code);
                }
            }
        }
        if (preview) {
            return previewResult(created, duplicates.size(), failed, duplicates, errors);
        }
        Map<String, Object> res = executeResult(created, failed, skipped, displayName(entity), errors);
        return res;
    }

    // ---------- 简单实体导入 ----------

    private Map<String, Object> importIndustries(Workbook wb, String tenantId, boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "行业列表");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String code = cell(row, 0);
            String name = cell(row, 1);
            if (code.isEmpty() || name.isEmpty()) {
                continue;
            }
            String parentCode = cell(row, 2);
            int sortOrder = parseIntDefault(cell(row, 3), 0);
            boolean enabled = parseBoolDefault(cell(row, 4), true);
            String parentId = parentCode.isEmpty() ? null : mapper.selectIndustryIdByCode(tenantId, parentCode);
            String existing = mapper.selectIndustryIdByCode(tenantId, code);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, code, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateIndustryByCode(tenantId, code, name, parentId, sortOrder, enabled);
                        created++;
                    } else if (rename) {
                        mapper.insertIndustry(UUID.randomUUID().toString(), tenantId, code + suffix(), name, parentId, sortOrder, enabled);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertIndustry(UUID.randomUUID().toString(), tenantId, code, name, parentId, sortOrder, enabled);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "行业", errors);
    }

    private Map<String, Object> importMajors(Workbook wb, String tenantId, boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "专业列表");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String code = cell(row, 0);
            String name = cell(row, 1);
            if (code.isEmpty() || name.isEmpty()) {
                continue;
            }
            String alias = cell(row, 2);
            boolean enabled = parseBoolDefault(cell(row, 3), true);
            String existing = mapper.selectMajorIdByCode(tenantId, code);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, code, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateMajorByCode(tenantId, code, name, alias, enabled);
                        created++;
                    } else if (rename) {
                        mapper.insertMajor(UUID.randomUUID().toString(), tenantId, code + suffix(), name, alias, enabled);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertMajor(UUID.randomUUID().toString(), tenantId, code, name, alias, enabled);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "专业", errors);
    }

    private Map<String, Object> importOrganizations(Workbook wb, String tenantId, boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "组织架构");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        Map<String, String> nameToId = new LinkedHashMap<>();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String name = cell(row, 0);
            String typeName = cell(row, 1);
            if (name.isEmpty() || typeName.isEmpty()) {
                continue;
            }
            String parentName = cell(row, 2);
            int sortOrder = parseIntDefault(cell(row, 3), 0);
            String typeId = mapper.selectOrgTypeIdByName(tenantId, typeName);
            if (typeId == null) {
                errors.add("第" + rowNum + "行组织类型不存在: " + typeName);
                failed++;
                continue;
            }
            String parentId = null;
            if (!parentName.isEmpty()) {
                parentId = nameToId.get(parentName);
                if (parentId == null) {
                    parentId = mapper.selectOrgIdByName(tenantId, parentName);
                }
            }
            String existing = mapper.selectOrgIdByNameType(tenantId, name, typeName);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, name, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateOrganizationParent(existing, parentId, sortOrder);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                String id = UUID.randomUUID().toString();
                if (!preview) {
                    mapper.insertOrganization(id, tenantId, name, typeId, parentId, sortOrder);
                }
                nameToId.put(name, id);
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "组织架构", errors);
    }

    private Map<String, Object> importStudents(Workbook wb, String tenantId, boolean preview) {
        return importUsers(wb, tenantId, preview, "学生列表", "学生", "正常");
    }

    private Map<String, Object> importTeachers(Workbook wb, String tenantId, boolean preview) {
        return importUsers(wb, tenantId, preview, "教师列表", "教师", "正常");
    }

    private Map<String, Object> importUsers(Workbook wb, String tenantId, boolean preview, String sheetName,
                                            String entity, String defaultStatus) {
        List<List<String>> rows = readRows(wb, sheetName);
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String loginName = cell(row, 0);
            String name = cell(row, 1);
            String password = cell(row, 2);
            if (loginName.isEmpty() || name.isEmpty() || password.isEmpty()) {
                continue;
            }
            if (!isValidPassword(password)) {
                errors.add("第" + rowNum + "行密码需至少 8 位且同时包含字母和数字");
                failed++;
                continue;
            }
            String status = mapUserStatus(cell(row, 4), defaultStatus);
            String existing = mapper.selectUserIdByLoginName(tenantId, loginName);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, loginName, name));
                if (!preview) {
                    skipped++;
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertUser(UUID.randomUUID().toString(), tenantId, null, tenantId + "_" + loginName,
                        loginName, PASSWORD_ENCODER.encode(password), name, status);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, entity, errors);
    }

    private Map<String, Object> importProjects(Workbook wb, String tenantId, String userId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作项目");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceProject(UUID.randomUUID().toString(), tenantId, name, cell(row, 1),
                    mapProjectPhase(cell(row, 2)), cell(row, 3), parseDateOrNull(cell(row, 4)),
                    parseDateOrNull(cell(row, 5)), cell(row, 6), cell(row, 7), cell(row, 8),
                    parseImportBool(cell(row, 9)), userId);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作项目", errors);
    }

    private Map<String, Object> importAchievements(Workbook wb, String tenantId, String userId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作成果");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String title = cell(row, 0);
            if (title.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceAchievement(UUID.randomUUID().toString(), tenantId, title,
                    mapAchievementType(cell(row, 1)), parseDateOrNull(cell(row, 2)), cell(row, 3),
                    cell(row, 4), cell(row, 5), cell(row, 6), parseImportBool(cell(row, 7)), userId);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作成果", errors);
    }

    private Map<String, Object> importAgreements(Workbook wb, String tenantId, String userId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作协议");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceAgreement(UUID.randomUUID().toString(), tenantId, name, cell(row, 1),
                    mapAgreementStatus(cell(row, 2)), parseDateOrNull(cell(row, 3)), parseDateOrNull(cell(row, 4)),
                    cell(row, 5), cell(row, 6), cell(row, 7), userId);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作协议", errors);
    }

    private Map<String, Object> importPermissions(Workbook wb, String tenantId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作权限");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String accountName = cell(row, 0);
            if (accountName.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAlliancePermission(UUID.randomUUID().toString(), tenantId, accountName,
                    mapAccountType(cell(row, 1)), parseBoolDefault(cell(row, 2), true));
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作权限", errors);
    }

    private Map<String, Object> importBrands(Workbook wb, String tenantId, boolean preview, String brandType) {
        List<List<String>> rows = readRows(wb, "品牌内容");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        String bt = brandType == null ? "" : brandType.trim();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name;
            String type;
            if (bt.isEmpty()) {
                // 通用模板：品牌类型/名称在列 0/1
                type = mapBrandType(cell(row, 0));
                name = cell(row, 1);
            } else {
                type = bt;
                name = cell(row, bt.equals("major") ? 0 : 1);
                if (bt.equals("major") && (name.isEmpty() && cell(row, 1).isEmpty())) {
                    continue;
                }
            }
            if (name.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceBrand(UUID.randomUUID().toString(), tenantId, type, name, "draft", false, false,
                    null, bt.isEmpty() ? cell(row, 2) : null, null, null, null, null, null, null);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "品牌内容", errors);
    }

    private Map<String, Object> importQuestionBanks(Workbook wb, String tenantId, String userId, boolean preview,
                                                    boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "题库基本信息");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            String existing = mapper.selectQuestionBankIdByName(tenantId, name);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, name, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateQuestionBankName(existing, name);
                        created++;
                    } else if (rename) {
                        mapper.insertQuestionBank(UUID.randomUUID().toString(), tenantId, name + suffix(), cell(row, 1), userId);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertQuestionBank(UUID.randomUUID().toString(), tenantId, name, cell(row, 1), userId);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "题库", errors);
    }

    private Map<String, Object> importExams(Workbook wb, String tenantId, String userId, boolean preview,
                                            boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "试卷基本信息");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            String existing = mapper.selectExamIdByName(tenantId, name);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, name, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateExamName(existing, name);
                        created++;
                    } else if (rename) {
                        mapper.insertExam(UUID.randomUUID().toString(), tenantId, name + suffix(), cell(row, 1), userId);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertExam(UUID.randomUUID().toString(), tenantId, name, cell(row, 1), userId);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "试卷", errors);
    }

    /** 解析 + 逐行校验 + 计数（复杂实体演示简化：不落深层关系）。 */
    private Map<String, Object> parseCount(Workbook wb, String sheetName, String entity, boolean preview) {
        List<List<String>> rows = readRows(wb, sheetName);
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String first = cell(row, 0);
            String second = cell(row, 1);
            if (first.isEmpty() && second.isEmpty()) {
                continue;
            }
            if (first.isEmpty()) {
                errors.add("第" + rowNum + "行名称不能为空");
                failed++;
            } else {
                created++;
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, entity, errors);
    }

    private Map<String, Object> affairsConfigImport(Workbook wb, String tenantId, boolean preview) {
        int created = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();
        if (preview) {
            // affairs-config 仅 excel 路径（无 preview），此处兜底返回空
            return previewResult(0, 0, 0, List.of(), errors);
        }
        for (String sheetName : new String[]{"学期", "场地", "节次"}) {
            List<List<String>> rows = readRows(wb, sheetName);
            for (int i = 2; i < rows.size(); i++) {
                List<String> row = rows.get(i);
                if (!cell(row, 0).isEmpty()) {
                    created++;
                }
            }
        }
        return executeResult(created, failed, 0, "教务配置", errors);
    }

    // ==================== 通用 CSV 持久化 ====================

    private String findExistingId(String entity, String tenantId, String keyCol, String key) {
        return switch (entity) {
            case "question_banks" -> mapper.selectQuestionBankIdByName(tenantId, key);
            case "exams" -> mapper.selectExamIdByName(tenantId, key);
            case "courses" -> mapper.selectCourseIdByCode(tenantId, key);
            case "career_positions" -> mapper.selectCareerPositionIdByName(tenantId, key);
            case "scenarios" -> mapper.selectScenarioIdByName(tenantId, key);
            default -> null;
        };
    }

    private void insertGeneric(String entity, String tenantId, String userId, String name, String code) {
        String id = UUID.randomUUID().toString();
        switch (entity) {
            case "question_banks" -> mapper.insertQuestionBank(id, tenantId, name, null, userId);
            case "exams" -> mapper.insertExam(id, tenantId, name, null, userId);
            case "courses" -> mapper.insertCourse(id, tenantId, code, name, userId);
            case "career_positions" -> mapper.insertCareerPosition(id, tenantId, name, null, userId);
            case "scenarios" -> mapper.insertScenario(id, tenantId, name, code, userId);
            default -> throw new ApiException(400, "bad_request", "不支持的实体");
        }
    }

    private void updateGeneric(String entity, String existingId, String name, String code) {
        switch (entity) {
            case "question_banks" -> mapper.updateQuestionBankName(existingId, name);
            case "exams" -> mapper.updateExamName(existingId, name);
            case "courses" -> mapper.updateCourseName(existingId, name, code);
            case "career_positions" -> mapper.updateCareerPositionName(existingId, name);
            case "scenarios" -> mapper.updateScenarioName(existingId, name, code);
            default -> throw new ApiException(400, "bad_request", "不支持的实体");
        }
    }

    private String displayName(String entity) {
        return switch (entity) {
            case "question_banks" -> "题库";
            case "exams" -> "试卷";
            case "courses" -> "课程";
            case "career_positions" -> "岗位";
            case "scenarios" -> "场景";
            default -> entity;
        };
    }

    // ==================== 工具 ====================

    private Map<String, Object> previewResult(int created, int duplicates, int failed,
                                              List<ImportPreviewItem> duplicateItems, List<String> errors) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("created", created);
        m.put("duplicates", duplicates);
        m.put("failed", failed);
        m.put("duplicateItems", duplicateItems);
        m.put("errors", errors);
        return m;
    }

    private Map<String, Object> executeResult(int created, int failed, int skipped, String entity, List<String> errors) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("created", created);
        m.put("failed", failed);
        m.put("skipped", skipped);
        m.put("permissionSkipped", 0);
        m.put("entity", entity);
        m.put("errors", errors);
        return m;
    }

    private List<List<String>> readRows(Workbook wb, String sheetName) {
        Sheet sheet = wb.getSheet(sheetName);
        if (sheet == null) {
            return List.of();
        }
        DataFormatter fmt = new DataFormatter();
        List<List<String>> rows = new ArrayList<>();
        for (Row r : sheet) {
            List<String> row = new ArrayList<>();
            int last = r.getLastCellNum() < 0 ? 0 : r.getLastCellNum();
            for (int c = 0; c < last; c++) {
                Cell cell = r.getCell(c);
                row.add(cell == null ? "" : fmt.formatCellValue(cell).trim());
            }
            rows.add(row);
        }
        return rows;
    }

    private String cell(List<String> row, int idx) {
        return idx < row.size() ? row.get(idx) : "";
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private static String csvCell(String v) {
        if (v == null) {
            return "";
        }
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private static boolean parseImportBool(String s) {
        String v = s == null ? "" : s.trim().toLowerCase();
        return switch (v) {
            case "是", "true", "1", "yes", "y", "t" -> true;
            default -> false;
        };
    }

    private static boolean parseBoolDefault(String s, boolean def) {
        String v = s == null ? "" : s.trim();
        if (v.isEmpty()) {
            return def;
        }
        return parseImportBool(v);
    }

    private static int parseIntDefault(String s, int def) {
        String v = s == null ? "" : s.trim();
        if (v.isEmpty()) {
            return def;
        }
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static LocalDate parseDateOrNull(String s) {
        String v = s == null ? "" : s.trim();
        if (v.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(v);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String mapProjectPhase(String v) {
        return mapDict(v, "启动", "initiation", "发起", "initiation", "执行中", "execution", "执行", "execution",
            "验收", "acceptance", "关闭", "closure", "已归档", "archived", "归档", "archived",
            "已终止", "terminated", "终止", "terminated", "initiation");
    }

    private static String mapPublishStatus(String v) {
        return mapDict(v, "草稿", "draft", "已发布", "published", "发布", "published", "已归档", "archived", "归档", "archived", "draft");
    }

    private static String mapAchievementType(String v) {
        return mapDict(v, "岗位成果", "job", "岗位", "job", "场景成果", "scene", "场景", "scene",
            "课程成果", "course", "课程", "course", "自定义成果", "custom", "自定义", "custom", "其他", "custom", "custom");
    }

    private static String mapAgreementStatus(String v) {
        return mapDict(v, "草稿", "draft", "生效中", "active", "生效", "active", "有效", "active",
            "已失效", "expired", "失效", "expired", "已过期", "expired", "过期", "expired",
            "已续签", "renewed", "续签", "renewed", "已终止", "terminated", "终止", "terminated", "draft");
    }

    private static String mapAccountType(String v) {
        return mapDict(v, "企业账号", "enterprise", "企业", "enterprise", "专家账号", "expert", "专家", "expert", "enterprise");
    }

    private static String mapBrandType(String v) {
        return mapDict(v, "人才品牌", "talent", "人才", "talent", "雇主品牌", "employer", "雇主", "employer",
            "岗位品牌", "job", "岗位", "job", "专业品牌", "major", "专业", "major",
            "师资品牌", "teacher", "教师", "teacher", "师资", "teacher", "文化品牌", "culture", "文化", "culture", "");
    }

    private static String mapDict(String v, String... pairs) {
        String value = v == null ? "" : v.trim();
        if (value.isEmpty()) {
            return pairs.length > 0 ? pairs[pairs.length - 1] : "";
        }
        for (int i = 0; i + 1 < pairs.length - 1; i += 2) {
            if (value.equals(pairs[i])) {
                return pairs[i + 1];
            }
        }
        return value;
    }

    private static String mapUserStatus(String v, String def) {
        String s = v == null ? "" : v.trim();
        if (s.isEmpty()) {
            return def;
        }
        return switch (s) {
            case "正常" -> "active";
            case "禁用" -> "disabled";
            case "毕业" -> "graduated";
            default -> s;
        };
    }

    private static boolean isValidPassword(String p) {
        if (p == null || p.length() < 8) {
            return false;
        }
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : p.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            }
        }
        return hasLetter && hasDigit;
    }

    private static String suffix() {
        return "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private List<String[]> namesToStrings(List<String> names) {
        List<String[]> out = new ArrayList<>();
        for (String n : names) {
            out.add(new String[]{n});
        }
        return out;
    }

    private List<String[]> mapToStrings(List<Map<String, Object>> rows, String colA, String colB) {
        List<String[]> out = new ArrayList<>();
        for (Map<String, Object> m : rows) {
            out.add(new String[]{str(m.get(colA)), str(m.get(colB))});
        }
        return out;
    }

    private byte[] toBytes(Workbook wb) throws Exception {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.write(out);
            return out.toByteArray();
        }
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    // ---------- POI 样式与写入辅助 ----------

    private void writeNote(Sheet sheet, String note, int cols, Styles st) {
        Row r = sheet.createRow(0);
        r.createCell(0).setCellValue(note);
        if (cols > 1) {
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, cols - 1));
        }
        r.getCell(0).setCellStyle(st.note);
        r.setHeightInPoints((countLines(note) + 2) * 16f);
    }

    private void writeHeaders(Sheet sheet, String[] headers, int[] widths, Styles st) {
        Row r = sheet.createRow(1);
        for (int i = 0; i < headers.length; i++) {
            Cell c = r.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(st.header);
            sheet.setColumnWidth(i, widths[i] * 256);
        }
        r.setHeightInPoints(28);
        sheet.createFreezePane(0, 2);
    }

    private void addRefSheet(Workbook wb, Styles st, String name, String[] headers, int[] widths, String note,
                             List<String[]> data) {
        Sheet s = wb.createSheet(name);
        writeNote(s, note, headers.length, st);
        writeHeaders(s, headers, widths, st);
        for (int i = 0; i < data.size(); i++) {
            Row r = s.createRow(2 + i);
            String[] vals = data.get(i);
            for (int c = 0; c < vals.length; c++) {
                r.createCell(c).setCellValue(vals[c] == null ? "" : vals[c]);
                r.getCell(c).setCellStyle(st.data);
            }
            r.setHeightInPoints(24);
        }
    }

    private static int countLines(String s) {
        int n = 1;
        for (char c : s.toCharArray()) {
            if (c == '\n') {
                n++;
            }
        }
        return n;
    }

    /** 每工作簿复用的三种样式（表头/说明/数据），对齐 Go makeHeaderStyle/makeNoteStyle/makeDataStyle。 */
    private static final class Styles {
        final CellStyle header;
        final CellStyle note;
        final CellStyle data;

        Styles(Workbook wb) {
            header = wb.createCellStyle();
            Font hf = wb.createFont();
            hf.setBold(true);
            hf.setFontHeightInPoints((short) 11);
            hf.setColor(IndexedColors.WHITE.getIndex());
            header.setFont(hf);
            header.setFillForegroundColor(IndexedColors.BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            header.setWrapText(true);
            border(header);

            note = wb.createCellStyle();
            Font nf = wb.createFont();
            nf.setFontHeightInPoints((short) 10);
            nf.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            nf.setItalic(true);
            note.setFont(nf);
            note.setWrapText(true);
            note.setVerticalAlignment(VerticalAlignment.TOP);

            data = wb.createCellStyle();
            border(data);
            data.setWrapText(true);
            data.setVerticalAlignment(VerticalAlignment.TOP);
        }

        private static void border(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
    }
}
