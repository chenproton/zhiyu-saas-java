package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ai.AiKbAsk;
import org.dromara.zhiyu.domain.ai.AiKbCollaborator;
import org.dromara.zhiyu.domain.ai.AiKbDocument;
import org.dromara.zhiyu.domain.ai.AiKnowledgeBase;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ChatStreamRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.CollaboratorRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.KbInput;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * 知识库控制器（对齐 Go ai_center_handler.go 知识库/文档/协作者/问答）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai/kb")
public class AiKbController {

    private final IAiCenterService aiCenterService;

    @GetMapping
    public ListResponse<AiKnowledgeBase> list(@RequestParam(value = "scope", required = false) String scope,
                                              @RequestParam(value = "q", required = false) String q,
                                              @RequestParam(value = "page", required = false) Long page,
                                              @RequestParam(value = "pageSize", required = false) Long pageSize) {
        return aiCenterService.listKbs(scope, q, page == null ? 1 : page, pageSize == null ? 20 : pageSize);
    }

    @PostMapping
    public AiKnowledgeBase create(@RequestBody KbInput in) {
        return aiCenterService.createKb(in);
    }

    @GetMapping("/{id}")
    public AiKnowledgeBase get(@PathVariable String id) {
        return aiCenterService.getKb(id);
    }

    @PutMapping("/{id}")
    public Map<String, String> update(@PathVariable String id, @RequestBody KbInput in) {
        return aiCenterService.updateKb(id, in);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return aiCenterService.deleteKb(id);
    }

    @PostMapping("/{id}/submit")
    public Map<String, String> submit(@PathVariable String id) {
        return aiCenterService.submitKb(id);
    }

    @PostMapping("/{id}/unpublish")
    public Map<String, String> unpublish(@PathVariable String id) {
        return aiCenterService.unpublishKb(id);
    }

    // ---------- 文档 ----------

    @GetMapping("/{id}/documents")
    public Map<String, Object> documents(@PathVariable String id) {
        return Map.of("items", aiCenterService.listDocuments(id));
    }

    @GetMapping("/{id}/documents/{docId}")
    public AiKbDocument getDocument(@PathVariable String id, @PathVariable String docId) {
        return aiCenterService.getDocument(id, docId);
    }

    @PostMapping("/{id}/documents")
    public AiKbDocument uploadDocument(@PathVariable String id, @RequestParam("file") MultipartFile file) {
        return aiCenterService.uploadDocument(id, file);
    }

    @DeleteMapping("/{id}/documents/{docId}")
    public Map<String, String> deleteDocument(@PathVariable String id, @PathVariable String docId) {
        return aiCenterService.deleteDocument(id, docId);
    }

    // ---------- 协作者 ----------

    @GetMapping("/{id}/collaborators")
    public Map<String, Object> collaborators(@PathVariable String id) {
        return Map.of("items", aiCenterService.listCollaborators(id));
    }

    @PostMapping("/{id}/collaborators")
    public Map<String, String> addCollaborator(@PathVariable String id, @RequestBody CollaboratorRequest req) {
        return aiCenterService.addCollaborator(id, req.getUserId(), req.getRole());
    }

    @PutMapping("/{id}/collaborators/{userId}")
    public Map<String, String> updateCollaborator(@PathVariable String id, @PathVariable String userId,
                                                  @RequestBody CollaboratorRequest req) {
        return aiCenterService.addCollaborator(id, userId, req.getRole());
    }

    @DeleteMapping("/{id}/collaborators/{userId}")
    public Map<String, String> removeCollaborator(@PathVariable String id, @PathVariable String userId) {
        return aiCenterService.removeCollaborator(id, userId);
    }

    // ---------- 问答 ----------

    @GetMapping("/{id}/asks")
    public Map<String, Object> asks(@PathVariable String id) {
        List<AiKbAsk> items = aiCenterService.listMyKbAsks(id);
        return Map.of("items", items);
    }

    @PostMapping("/{id}/ask")
    public SseEmitter ask(@PathVariable String id, @RequestBody ChatStreamRequest req) {
        String message = AiWeb.message(req.getMessage());
        return AiWeb.chat(aiCenterService.kbAsk(id, message));
    }
}
