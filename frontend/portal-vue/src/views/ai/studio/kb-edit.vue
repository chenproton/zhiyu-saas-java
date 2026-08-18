<template>
  <div class="editor-page">
    <div class="top-bar">
      <div class="top-inner">
        <router-link class="back-link" to="/portal/apps/ai/landing">
          <el-icon><ArrowLeft /></el-icon>返回工坊
        </router-link>
        <span class="divider" />
        <div class="title-wrap">
          <span class="title-avatar">📚</span>
          <h1 class="title">{{ kb?.name }}</h1>
          <AiStatusBadge v-if="kb" :status="kb.status" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="page-loading">加载中...</div>
    <div v-else-if="!kb" class="page-loading">加载失败</div>
    <div v-else class="content">
      <div v-if="kb.status === 'rejected' && kb.reviewComment" class="banner banner-danger">驳回原因：{{ kb.reviewComment }}</div>
      <div v-if="!canEdit" class="banner banner-gray">当前为只读权限，仅可查看</div>

      <!-- 基本信息 + 协作者（可折叠） -->
      <el-collapse v-model="infoOpen" class="info-collapse">
        <el-collapse-item name="info">
          <template #title>
            <div class="collapse-title">
              基本信息与协作者
              <span class="collapse-sub">名称、描述与分类决定大厅展示与筛选；协作者可共同维护文档</span>
            </div>
          </template>
          <div class="info-grid">
            <div class="info-left">
              <el-form label-position="top">
                <el-form-item label="名称">
                  <el-input v-model="name" :disabled="!canEdit" maxlength="200" />
                </el-form-item>
                <el-form-item label="描述">
                  <el-input v-model="description" type="textarea" :rows="3" :disabled="!canEdit" />
                </el-form-item>
                <el-form-item label="标签">
                  <el-input v-model="tags" placeholder="多个标签用逗号分隔" :disabled="!canEdit" />
                </el-form-item>
                <el-form-item>
                  <div :class="{ disabled: !canEdit }">
                    <ClassifySelects :value="classify" with-kb-type @update:value="onClassify" />
                  </div>
                </el-form-item>
                <div v-if="canEdit" class="form-actions">
                  <el-button type="primary" :loading="saving" @click="save">保存</el-button>
                </div>
              </el-form>
            </div>
            <div class="info-right">
              <div class="collab-head">
                协作者
                <span class="collab-count">{{ collaborators.length }} 人</span>
              </div>
              <div v-if="isOwner" class="collab-add">
                <el-input v-model="newUserId" placeholder="输入同租户用户的 ID" />
                <div class="collab-add-row">
                  <el-select v-model="newRole" style="flex: 1">
                    <el-option label="编辑者" value="editor" />
                    <el-option label="查看者" value="viewer" />
                  </el-select>
                  <el-button size="small" :loading="collabActing" @click="addCollaborator">添加</el-button>
                </div>
              </div>
              <div class="collab-list">
                <div v-if="collabLoading" class="collab-loading">加载中...</div>
                <p v-else-if="!collaborators.length" class="collab-empty">暂无协作者</p>
                <div v-for="c in collaborators" :key="c.id" class="collab-item">
                  <span class="collab-avatar">{{ (c.userName || '?').slice(0, 1) }}</span>
                  <div class="collab-info">
                    <p class="collab-name">{{ c.userName || c.userId }}</p>
                    <p class="collab-role">{{ c.role === 'editor' ? '编辑者' : '查看者' }}</p>
                  </div>
                  <el-button v-if="isOwner" text size="small" type="danger" :disabled="collabActing" @click="removeCollabTarget = c">移除</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <!-- 文档管理 -->
      <el-card shadow="never" class="doc-card">
        <template #header>
          <div class="card-head">
            <div class="card-title">文档管理</div>
            <div class="card-desc">支持 PDF / DOCX / TXT / MD，单个文件不超过 10MB，解析后即可被检索提问</div>
          </div>
        </template>
        <div class="doc-toolbar">
          <p class="doc-hint">支持 PDF / DOCX / TXT / MD，单个文件不超过 10MB</p>
          <el-button v-if="canEdit" size="small" :loading="uploading" @click="pickFile">
            {{ uploading ? '上传中...' : '上传文档' }}
          </el-button>
          <input ref="fileInput" type="file" accept=".pdf,.docx,.txt,.md" style="display: none" @change="onPickFile" />
        </div>
        <div class="doc-list">
          <div v-if="docsLoading" class="doc-loading">加载中...</div>
          <p v-else-if="!docs.length" class="doc-empty">暂无文档</p>
          <div v-for="doc in docs" :key="doc.id" class="doc-item">
            <div class="doc-icon"><el-icon><Document /></el-icon></div>
            <div class="doc-info">
              <p class="doc-name">{{ doc.name }}</p>
              <div class="doc-meta">
                <span>{{ formatSize(doc.fileSize) }}</span>
                <span v-if="doc.status === 'parsing'" class="doc-parsing">解析中</span>
                <span v-else-if="doc.status === 'failed'" class="doc-failed">解析失败{{ doc.error ? `：${doc.error}` : '' }}</span>
                <span v-else class="doc-ready">就绪</span>
                <span v-if="doc.status === 'ready'">{{ doc.chunkCount }} 个分块</span>
                <span v-if="doc.uploaderName">上传人：{{ doc.uploaderName }}</span>
                <span>{{ formatDateTime(doc.createdAt) }}</span>
              </div>
            </div>
            <el-button v-if="canEdit" text size="small" type="danger" :disabled="acting" @click="deleteDocTarget = doc">删除</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 删除文档确认 -->
    <el-dialog v-model="deleteDocOpen" title="确认删除" width="440px">
      <p>删除后不可恢复，确定删除「{{ deleteDocTarget?.name }}」吗？</p>
      <template #footer>
        <el-button @click="deleteDocTarget = null">取消</el-button>
        <el-button type="danger" :loading="acting" @click="doDeleteDoc">删除</el-button>
      </template>
    </el-dialog>

    <!-- 移除协作者确认 -->
    <el-dialog v-model="removeCollabOpen" title="移除协作者" width="440px">
      <p>确定移除协作者「{{ removeCollabTarget?.userName || removeCollabTarget?.userId }}」吗？</p>
      <template #footer>
        <el-button @click="removeCollabTarget = null">取消</el-button>
        <el-button type="danger" :loading="collabActing" @click="doRemoveCollab">移除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Document } from '@element-plus/icons-vue';
import { aiCenterKbApi } from '@/api/ai';
import type { AIKBType, AIKnowledgeBase } from '@/types/ai';
import { aiKbExt, formatDateTime, formatSize } from '../ai-api';
import type { AIKBCollaborator, AIKBDocument } from '../ai-api';
import AiStatusBadge from '../components/AiStatusBadge.vue';
import ClassifySelects from '../components/ClassifySelects.vue';
import type { ClassifyValue } from '../components/ClassifySelects.vue';

const ACCEPT = ['.pdf', '.docx', '.txt', '.md'];
const POLL_INTERVAL = 2500;

const route = useRoute();
const kbId = String(route.params.id);

const kb = ref<AIKnowledgeBase | null>(null);
const loading = ref(true);

const name = ref('');
const description = ref('');
const tags = ref('');
const classify = ref<ClassifyValue>({ majorId: '', departmentId: '', kbType: '' });
const saving = ref(false);
const infoOpen = ref<string[]>(['info']);

const docs = ref<AIKBDocument[]>([]);
const docsLoading = ref(true);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let pollTimer: ReturnType<typeof setTimeout> | null = null;

const collaborators = ref<AIKBCollaborator[]>([]);
const collabLoading = ref(true);
const newUserId = ref('');
const newRole = ref<'editor' | 'viewer'>('editor');
const collabActing = ref(false);
const removeCollabTarget = ref<AIKBCollaborator | null>(null);
const deleteDocTarget = ref<AIKBDocument | null>(null);
const acting = ref(false);

const deleteDocOpen = computed({ get: () => !!deleteDocTarget.value, set: (v) => { if (!v) deleteDocTarget.value = null; } });
const removeCollabOpen = computed({ get: () => !!removeCollabTarget.value, set: (v) => { if (!v) removeCollabTarget.value = null; } });

const myRole = computed(() => (kb.value as AIKnowledgeBase & { myRole?: string }).myRole ?? 'viewer');
const canEdit = computed(() => myRole.value === 'owner' || myRole.value === 'editor');
const isOwner = computed(() => myRole.value === 'owner');

async function loadKb() {
  try {
    const data = await aiCenterKbApi.get(kbId);
    kb.value = data;
    name.value = data.name;
    description.value = data.description;
    tags.value = (data.tags ?? []).join(', ');
    classify.value = {
      majorId: data.majorId ?? '',
      departmentId: data.departmentId ?? '',
      kbType: data.kbType ?? ''
    };
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function fetchDocs(silent = false): Promise<AIKBDocument[]> {
  try {
    const res = await aiKbExt.listDocuments(kbId);
    docs.value = res.items;
    return res.items;
  } catch (e) {
    if (!silent) ElMessage.error((e as Error).message || '加载失败');
    return [];
  } finally {
    docsLoading.value = false;
  }
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    const items = await fetchDocs(true);
    if (items.some((d) => d.status === 'parsing')) schedulePoll();
  }, POLL_INTERVAL);
}

async function refreshDocsAndPoll() {
  const items = await fetchDocs();
  if (items.some((d) => d.status === 'parsing')) schedulePoll();
}

async function loadCollaborators() {
  try {
    const res = await aiKbExt.listCollaborators(kbId);
    collaborators.value = res.items;
  } catch {
    /* 非 owner 无权限时静默降级为空列表 */
  } finally {
    collabLoading.value = false;
  }
}

function onClassify(v: ClassifyValue) {
  classify.value = v;
}

async function save() {
  if (!name.value.trim()) {
    ElMessage.warning('请填写名称');
    return;
  }
  saving.value = true;
  try {
    await aiCenterKbApi.update(kbId, {
      name: name.value.trim(),
      description: description.value.trim(),
      tags: tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      majorId: classify.value.majorId || undefined,
      departmentId: classify.value.departmentId || undefined,
      kbType: (classify.value.kbType || undefined) as AIKBType | undefined
    });
    ElMessage.success('保存成功');
    loadKb();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function pickFile() {
  fileInput.value?.click();
}
async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ACCEPT.includes(ext)) {
    ElMessage.warning('仅支持 PDF / DOCX / TXT / MD 文件');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('单个文件不超过 10MB');
    return;
  }
  uploading.value = true;
  try {
    await aiKbExt.uploadDocument(kbId, file);
    ElMessage.success('上传成功，正在解析');
    refreshDocsAndPoll();
    loadKb();
  } catch (err) {
    ElMessage.error((err as Error).message || '上传失败');
  } finally {
    uploading.value = false;
  }
}

async function doDeleteDoc() {
  if (!deleteDocTarget.value || acting.value) return;
  acting.value = true;
  try {
    await aiKbExt.removeDocument(kbId, deleteDocTarget.value.id);
    ElMessage.success('已删除');
    deleteDocTarget.value = null;
    refreshDocsAndPoll();
    loadKb();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}

async function addCollaborator() {
  if (!newUserId.value.trim()) {
    ElMessage.warning('请填写用户 ID');
    return;
  }
  collabActing.value = true;
  try {
    await aiKbExt.addCollaborator(kbId, newUserId.value.trim(), newRole.value);
    ElMessage.success('操作成功');
    newUserId.value = '';
    newRole.value = 'editor';
    loadCollaborators();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    collabActing.value = false;
  }
}

async function doRemoveCollab() {
  if (!removeCollabTarget.value || collabActing.value) return;
  collabActing.value = true;
  try {
    await aiKbExt.removeCollaborator(kbId, removeCollabTarget.value.userId);
    ElMessage.success('已移除');
    removeCollabTarget.value = null;
    loadCollaborators();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    collabActing.value = false;
  }
}

onMounted(() => {
  loadKb();
  refreshDocsAndPoll();
  loadCollaborators();
});

onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
});
</script>

<style scoped>
.editor-page {
  min-height: calc(100vh - 3.5rem);
  background: #f5f7fa;
}
.top-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid #e7e5e4;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
}
.top-inner {
  max-width: 1024px;
  margin: 0 auto;
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #909399;
  text-decoration: none;
  flex-shrink: 0;
}
.back-link:hover {
  color: var(--el-color-primary);
}
.divider {
  width: 1px;
  height: 20px;
  background: #e4e7ed;
  flex-shrink: 0;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.title-avatar {
  font-size: 20px;
}
.title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-loading {
  text-align: center;
  color: #909399;
  padding: 80px 0;
}
.content {
  max-width: 1024px;
  margin: 0 auto;
  padding: 24px 16px;
}
.banner {
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  margin-bottom: 16px;
}
.banner-danger {
  border: 1px solid #fde2e2;
  background: #fef0f0;
  color: #f56c6c;
}
.banner-gray {
  border: 1px solid #e4e7ed;
  background: #f5f7fa;
  color: #909399;
}
.info-collapse {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-bottom: 20px;
}
.info-collapse :deep(.el-collapse-item__header) {
  padding: 16px 20px;
  border-bottom: 1px dashed #e7e5e4;
  height: auto;
  line-height: normal;
}
.info-collapse :deep(.el-collapse-item__content) {
  padding: 0;
}
.collapse-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
}
.collapse-sub {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.info-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  padding: 20px;
}
.info-right {
  border-left: 1px dashed #e7e5e4;
  padding-left: 24px;
}
.collab-head {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}
.collab-count {
  font-size: 12px;
  color: #909399;
  font-weight: 400;
  margin-left: 8px;
}
.collab-add {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.collab-add-row {
  display: flex;
  gap: 8px;
}
.collab-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.collab-loading,
.collab-empty {
  text-align: center;
  color: #909399;
  font-size: 12px;
  padding: 24px 0;
}
.collab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 8px 12px;
}
.collab-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.collab-info {
  flex: 1;
  min-width: 0;
}
.collab-name {
  font-size: 14px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collab-role {
  font-size: 11px;
  color: #909399;
  margin: 0;
}
.disabled {
  pointer-events: none;
  opacity: 0.6;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
}
.doc-card {
  border-radius: 16px;
}
.doc-card :deep(.el-card__header) {
  padding: 16px 20px 12px;
  border-bottom: 1px dashed #e7e5e4;
}
.doc-card :deep(.el-card__body) {
  padding: 0;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.card-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.doc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px dashed #e7e5e4;
}
.doc-hint {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
.doc-list {
  min-height: 120px;
}
.doc-loading,
.doc-empty {
  text-align: center;
  color: #909399;
  font-size: 14px;
  padding: 40px 0;
}
.doc-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
}
.doc-item:last-child {
  border-bottom: none;
}
.doc-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.doc-info {
  flex: 1;
  min-width: 0;
}
.doc-name {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.doc-parsing {
  color: #e6a23c;
}
.doc-failed {
  color: #f56c6c;
}
.doc-ready {
  color: #67c23a;
}
</style>
