package org.dromara.zhiyu.controller.importexport;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.service.importexport.IImportExportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 导入导出控制器（对齐 Go registerImportExportRoutes + affairs import 路由段，前端契约零改动）。
 *
 * <p>路径统一 {@code /api/v1} 前缀；导入返回裸 JSON 结果结构，导出/模板返回
 * {@code application/vnd.openxmlformats-officedocument.spreadsheetml.sheet} 附件（通用 CSV 导出返回
 * {@code text/csv}）。</p>
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1")
public class ImportExportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final IImportExportService importExportService;

    // ==================== 模板下载 ====================

    @GetMapping("/templates/{entity}")
    public ResponseEntity<byte[]> template(@PathVariable String entity,
                                           @RequestParam(value = "brandType", required = false) String brandType) {
        byte[] bytes = importExportService.buildTemplate(entity, null, brandType);
        return xlsx(bytes, templateFilename(entity));
    }

    @GetMapping("/templates/question-banks/{bankId}/questions")
    public ResponseEntity<byte[]> questionTemplate(@PathVariable String bankId) {
        byte[] bytes = importExportService.buildTemplate("questions", bankId, null);
        return xlsx(bytes, "题目批量导入模板.xlsx");
    }

    // ==================== 导入 ====================

    /** 通用 CSV 导入（POST /import/{entity}，entity ∈ 5 个基础实体表名） */
    @PostMapping("/import/{entity}")
    public Map<String, Object> importGeneric(@PathVariable String entity,
                                             @RequestParam("file") MultipartFile file,
                                             @RequestParam(value = "overwrite", required = false) Boolean overwrite,
                                             @RequestParam(value = "rename", required = false) Boolean rename) {
        return importExportService.importGeneric(entity, file, bool(overwrite), bool(rename));
    }

    /** 导入预览（Excel 实体走 Excel，其余走通用 CSV） */
    @PostMapping("/import/{entity}/preview")
    public Map<String, Object> preview(@PathVariable String entity,
                                       @RequestParam("file") MultipartFile file,
                                       @RequestParam(value = "overwrite", required = false) Boolean overwrite,
                                       @RequestParam(value = "rename", required = false) Boolean rename,
                                       @RequestParam(value = "brandType", required = false) String brandType,
                                       @RequestParam(value = "termId", required = false) String termId,
                                       @RequestParam(value = "programId", required = false) String programId) {
        return importExportService.preview(entity, file, bool(overwrite), bool(rename), null, brandType, termId,
            programId);
    }

    /** Excel 导入落库（POST /import/{entity}/excel） */
    @PostMapping("/import/{entity}/excel")
    public Map<String, Object> importExcel(@PathVariable String entity,
                                           @RequestParam("file") MultipartFile file,
                                           @RequestParam(value = "overwrite", required = false) Boolean overwrite,
                                           @RequestParam(value = "rename", required = false) Boolean rename,
                                           @RequestParam(value = "brandType", required = false) String brandType,
                                           @RequestParam(value = "termId", required = false) String termId,
                                           @RequestParam(value = "programId", required = false) String programId) {
        return importExportService.importExcel(entity, file, false, bool(overwrite), bool(rename), null, brandType,
            termId, programId);
    }

    @PostMapping("/import/question-banks/{bankId}/questions/excel")
    public Map<String, Object> importQuestions(@PathVariable String bankId,
                                               @RequestParam("file") MultipartFile file,
                                               @RequestParam(value = "overwrite", required = false) Boolean overwrite,
                                               @RequestParam(value = "rename", required = false) Boolean rename) {
        return importExportService.importExcel("questions", file, false, bool(overwrite), bool(rename), bankId, null,
            null, null);
    }

    @PostMapping("/import/question-banks/{bankId}/questions/preview")
    public Map<String, Object> importQuestionsPreview(@PathVariable String bankId,
                                                      @RequestParam("file") MultipartFile file,
                                                      @RequestParam(value = "overwrite", required = false) Boolean overwrite,
                                                      @RequestParam(value = "rename", required = false) Boolean rename) {
        return importExportService.importExcel("questions", file, true, bool(overwrite), bool(rename), bankId, null,
            null, null);
    }

    // ==================== 导出 ====================

    /** 通用 CSV 导出（GET /export/{entity}） */
    @GetMapping("/export/{entity}")
    public ResponseEntity<byte[]> exportGeneric(@PathVariable String entity) {
        byte[] bytes = importExportService.exportGeneric(entity);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(entity + "-export.csv", StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
            .body(bytes);
    }

    @PostMapping("/export/{entity}/excel")
    public ResponseEntity<byte[]> exportExcel(@PathVariable String entity,
                                              @RequestBody(required = false) Map<String, Object> body) {
        List<String> ids = extractIds(body);
        byte[] bytes = importExportService.exportExcel(entity, ids, null);
        return xlsx(bytes, exportFilename(entity));
    }

    @PostMapping("/export/question-banks/{bankId}/questions/excel")
    public ResponseEntity<byte[]> exportQuestions(@PathVariable String bankId,
                                                  @RequestBody(required = false) Map<String, Object> body) {
        List<String> ids = extractIds(body);
        byte[] bytes = importExportService.exportExcel("questions", ids, bankId);
        return xlsx(bytes, "题目导出.xlsx");
    }

    // ==================== 工具 ====================

    private ResponseEntity<byte[]> xlsx(byte[] bytes, String filename) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
            .contentType(XLSX)
            .body(bytes);
    }

    private String templateFilename(String entity) {
        return switch (entity) {
            case "positions" -> "岗位批量导入模板.xlsx";
            case "scenarios" -> "场景批量导入模板.xlsx";
            case "courses" -> "体系课批量导入模板.xlsx";
            case "granular-courses" -> "颗粒课批量导入模板.xlsx";
            case "question-banks" -> "题库批量导入模板.xlsx";
            case "exams" -> "试卷批量导入模板.xlsx";
            case "industries" -> "行业批量导入模板.xlsx";
            case "majors" -> "专业批量导入模板.xlsx";
            case "organizations" -> "组织架构批量导入模板.xlsx";
            case "students" -> "学生批量导入模板.xlsx";
            case "teachers" -> "教师批量导入模板.xlsx";
            case "alliance-projects" -> "合作项目批量导入模板.xlsx";
            case "alliance-achievements" -> "合作成果批量导入模板.xlsx";
            case "alliance-agreements" -> "合作协议批量导入模板.xlsx";
            case "alliance-permissions" -> "合作权限批量导入模板.xlsx";
            case "alliance-brands" -> "品牌内容批量导入模板.xlsx";
            case "affairs-config" -> "教务配置批量导入模板.xlsx";
            case "program-courses" -> "方案课程批量导入模板.xlsx";
            default -> "导入模板.xlsx";
        };
    }

    private String exportFilename(String entity) {
        return switch (entity) {
            case "positions" -> "岗位导出.xlsx";
            case "scenarios" -> "场景导出.xlsx";
            case "courses" -> "体系课导出.xlsx";
            case "granular-courses" -> "颗粒课导出.xlsx";
            case "question-banks" -> "题库导出.xlsx";
            case "exams" -> "试卷导出.xlsx";
            case "organizations" -> "组织架构导出.xlsx";
            case "students" -> "学生导出.xlsx";
            case "teachers" -> "教师导出.xlsx";
            default -> "导出.xlsx";
        };
    }

    private boolean bool(Boolean v) {
        return Boolean.TRUE.equals(v);
    }

    @SuppressWarnings("unchecked")
    private List<String> extractIds(Map<String, Object> body) {
        if (body == null || body.get("ids") == null) {
            return null;
        }
        Object ids = body.get("ids");
        if (ids instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return null;
    }
}
