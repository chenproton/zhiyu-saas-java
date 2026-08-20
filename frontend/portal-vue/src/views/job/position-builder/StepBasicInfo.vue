<template>
  <!-- 步骤一：岗位基础信息（逐项对齐 React components/job/position-builder/step-basic-info.tsx） -->
  <div class="step-basic">
    <!-- 基本信息 -->
    <el-card shadow="never" class="block-card">
      <template #header><span class="card-title">基本信息</span></template>

      <div class="grid-2">
        <div class="field">
          <div class="field-label">
            <span>岗位名称</span>
          </div>
          <el-input
            :model-value="position.name"
            placeholder="例如：Java 后端开发工程师"
            @update:model-value="(v: string) => emit('update', { name: v })"
          />
        </div>

        <div class="field">
          <div class="field-label">
            <span>岗位简称</span>
          </div>
          <el-input
            :model-value="position.shortName"
            placeholder="例如：Java开发"
            @update:model-value="(v: string) => emit('update', { shortName: v })"
          />
        </div>
      </div>

      <div class="grid-2">
        <template v-if="showIndustryMajor">
          <div class="field">
            <div class="field-label"><span>面向行业</span></div>
            <el-select
              :model-value="position.industry || ''"
              filterable
              clearable
              :placeholder="optionsLoading ? '加载中...' : '选择行业'"
              style="width: 100%"
              @update:model-value="(v: string) => emit('update', { industry: v || '' })"
            >
              <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
            </el-select>
          </div>
          <div class="field">
            <div class="field-label"><span>适用专业</span></div>
            <el-select
              :model-value="position.majors"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              :placeholder="optionsLoading ? '加载中...' : '选择专业'"
              style="width: 100%"
              @update:model-value="(v: string[]) => emit('update', { majors: v })"
            >
              <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
            </el-select>
          </div>
        </template>
        <div v-if="!hidePositionType" class="field">
          <div class="field-label"><span>岗位类型</span></div>
          <el-select
            :model-value="position.positionType"
            :disabled="lockedPositionType"
            style="width: 100%"
            @update:model-value="(v: PositionType) => emit('update', { positionType: v })"
          >
            <el-option label="企业岗位" value="enterprise" />
            <el-option label="教学岗位" value="teaching" />
          </el-select>
          <p v-if="lockedPositionType" class="field-hint">
            独立岗位固定为企业岗位，仅在本模块展示，不进入职业岗位库
          </p>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <span>薪资范围（元/月）</span>
        </div>
        <div class="salary-row">
          <el-input
            :model-value="String(position.salaryRange[0] ?? 0)"
            type="number"
            placeholder="最低"
            class="salary-input"
            @update:model-value="(v: string) => emit('update', { salaryRange: [Number(v) || 0, position.salaryRange[1]] })"
          >
            <template #suffix>¥</template>
          </el-input>
          <span class="sep">-</span>
          <el-input
            :model-value="String(position.salaryRange[1] ?? 0)"
            type="number"
            placeholder="最高"
            class="salary-input"
            @update:model-value="(v: string) => emit('update', { salaryRange: [position.salaryRange[0], Number(v) || 0] })"
          >
            <template #suffix>¥</template>
          </el-input>
        </div>
      </div>

      <div class="field">
        <div class="field-label">
          <span>岗位背景介绍</span>
        </div>
        <el-input
          :model-value="position.description"
          type="textarea"
          :rows="4"
          placeholder="描述该岗位的主要工作内容和特点..."
          @update:model-value="(v: string) => emit('update', { description: v })"
        />
      </div>
    </el-card>

    <el-alert v-if="aiNotice" type="warning" :closable="false" show-icon class="ai-notice">
      {{ aiNotice }}
    </el-alert>

    <!-- 工作职责 -->
    <el-card shadow="never" class="block-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">工作职责</span>
        </div>
      </template>
      <div class="row-list">
        <div v-for="(item, index) in position.responsibilities" :key="item.id" class="row-item">
          <el-tag class="row-index" type="info" effect="plain">{{ index + 1 }}</el-tag>
          <el-input
            :model-value="item.name"
            type="textarea"
            :rows="1"
            :autosize="{ minRows: 1, maxRows: 4 }"
            :data-focus-id="item.id"
            @update:model-value="(v: string) => updateResponsibility(index, v)"
            @keydown.enter.exact="onEnterAdd($event as KeyboardEvent, 'resp')"
          />
          <el-button text class="row-del" @click="removeResponsibility(index)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <el-button class="add-row" @click="addResponsibility()">
          <el-icon><Plus /></el-icon>
          添加工作职责
        </el-button>
      </div>
    </el-card>

    <!-- 任职要求 -->
    <el-card shadow="never" class="block-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">任职要求</span>
        </div>
      </template>
      <div class="row-list">
        <div v-for="(item, index) in position.requirements" :key="reqIds[index] ?? `req-fallback-${index}`" class="row-item">
          <el-tag class="row-index" type="info" effect="plain">{{ index + 1 }}</el-tag>
          <el-input
            :model-value="item"
            type="textarea"
            :rows="1"
            :autosize="{ minRows: 1, maxRows: 4 }"
            :data-focus-id="reqIds[index] ?? `req-fallback-${index}`"
            @update:model-value="(v: string) => updateRequirement(index, v)"
            @keydown.enter.exact="onEnterAdd($event as KeyboardEvent, 'req')"
          />
          <el-button text class="row-del" @click="removeRequirement(index)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <el-button class="add-row" @click="addRequirement()">
          <el-icon><Plus /></el-icon>
          添加任职要求
        </el-button>
      </div>
    </el-card>

    <!-- 发展路径 -->
    <el-card shadow="never" class="block-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">发展路径</span>
        </div>
      </template>
      <el-input
        :model-value="position.careerPath"
        type="textarea"
        :rows="6"
        placeholder="请描述该岗位的职业发展路径，如横向发展和纵向晋升方向..."
        @update:model-value="(v: string) => emit('update', { careerPath: v })"
      />
    </el-card>

    <!-- 相关证书 -->
    <el-card shadow="never" class="block-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">相关证书</span>
          <span class="section-ai">
            <template v-if="certificateLibraryEnabled">
              <el-button size="small" @click="openCertDialog">从证书库选择</el-button>
              <el-button size="small" @click="newCertDialog = true">
                <el-icon><Plus /></el-icon>
                新增证书
              </el-button>
            </template>
          </span>
        </div>
      </template>
      <el-empty v-if="position.certificates.length === 0" description="暂无相关证书" :image-size="72" />
      <div v-else class="cert-grid">
        <div v-for="cert in position.certificates" :key="cert.id" class="cert-card">
          <el-button circle size="small" class="cert-remove" @click="removeCertificate(cert.id)">
            <el-icon><Close /></el-icon>
          </el-button>
          <div class="cert-cover">
            <img v-if="isValidImageUrl(cert.image)" :src="cert.image" :alt="cert.name" />
            <el-icon v-else :size="36" class="cert-cover-icon"><Medal /></el-icon>
          </div>
          <div class="cert-body">
            <div class="cert-line">
              <span class="cert-key">证书名称：</span>
              <span class="cert-name">{{ cert.name }}</span>
            </div>
            <div v-if="cert.url" class="cert-line">
              <span class="cert-key">相关网站：</span>
              <a :href="cert.url" target="_blank" rel="noopener noreferrer" class="cert-url">{{ cert.url }}</a>
            </div>
            <div v-if="cert.description" class="cert-line">
              <span class="cert-key">证书介绍：</span>
              <span class="cert-desc">{{ cert.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 从证书库选择 -->
    <el-dialog v-model="certDialog" title="从证书库选择证书" width="920px" top="6vh">
      <p class="dialog-desc">选择与该岗位相关的职业资格证书</p>
      <el-input v-model="certSearchQuery" placeholder="搜索证书名称或描述..." clearable :prefix-icon="Search" />
      <div class="cert-pool">
        <el-empty v-if="filteredCertificates.length === 0" description="未找到匹配证书" :image-size="72" />
        <div v-else class="cert-grid">
          <div
            v-for="cert in filteredCertificates"
            :key="cert.id"
            class="cert-card selectable"
            :class="{ selected: selectedCertIds.includes(cert.id) }"
            @click="toggleCertificate(cert.id)"
          >
            <el-checkbox
              class="cert-check"
              :model-value="selectedCertIds.includes(cert.id)"
              @click.stop
              @change="() => toggleCertificate(cert.id)"
            />
            <div class="cert-cover">
              <img v-if="isValidImageUrl(cert.image)" :src="cert.image" :alt="cert.name" />
              <el-icon v-else :size="36" class="cert-cover-icon"><Medal /></el-icon>
            </div>
            <div class="cert-body">
              <div class="cert-line">
                <span class="cert-key">证书名称：</span>
                <span class="cert-name">{{ cert.name }}</span>
              </div>
              <div v-if="cert.url" class="cert-line">
                <span class="cert-key">相关网站：</span>
                <a :href="cert.url" target="_blank" rel="noopener noreferrer" class="cert-url" @click.stop>
                  {{ cert.url }}
                </a>
              </div>
              <div v-if="cert.description" class="cert-line">
                <span class="cert-key">证书介绍：</span>
                <span class="cert-desc">{{ cert.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="certDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCertificates">确认选择</el-button>
      </template>
    </el-dialog>

    <!-- 新增证书 -->
    <el-dialog v-model="newCertDialog" title="新增证书" width="520px" @close="resetNewCert">
      <p class="dialog-desc">添加一个新的职业资格证书</p>
      <el-form label-position="top">
        <el-form-item label="证书名称">
          <el-input v-model="newCert.name" placeholder="例如：AWS 云从业者认证" />
        </el-form-item>
        <el-form-item label="相关网址">
          <el-input v-model="newCert.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="证书介绍">
          <el-input v-model="newCert.description" type="textarea" :rows="3" placeholder="简要描述该证书..." />
        </el-form-item>
        <el-form-item label="证书图片">
          <div class="cert-upload" @click="pickCertImage">
            <img v-if="newCert.image" :src="newCert.image" alt="证书预览" class="cert-upload-img" />
            <template v-else>
              <el-icon :size="22"><Picture /></el-icon>
              <span class="cert-upload-tip">点击上传证书图片</span>
            </template>
          </div>
          <input ref="certFileInput" type="file" accept="image/*" style="display: none" @change="onCertImageChange" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newCertDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!newCert.name || certSubmitting" :loading="certSubmitting" @click="addNewCertificate">
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { Close, Medal, Picture, Plus, Search } from '@element-plus/icons-vue';
import { certificateLibraryApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { fileApi } from '@/api/import-export';
import type { PositionType } from '@/types/job';
import { localId, type LocalPosition } from './types';

interface PoolCertificate {
  id: string;
  name: string;
  url: string;
  description: string;
  image?: string;
}

const props = withDefaults(
  defineProps<{
    position: LocalPosition;
    showIndustryMajor?: boolean;
    certificateLibraryEnabled?: boolean;
    lockedPositionType?: boolean;
    hidePositionType?: boolean;
  }>(),
  {
    showIndustryMajor: true,
    certificateLibraryEnabled: true,
    lockedPositionType: false,
    hidePositionType: false
  }
);

const emit = defineEmits<{ (e: 'update', data: Partial<LocalPosition>): void }>();

const industries = ref<{ id: string; name: string }[]>([]);
const majors = ref<{ id: string; name: string }[]>([]);
const optionsLoading = ref(false);
const aiNotice = ref<string | null>(null);
const certificateLibrary = ref<PoolCertificate[]>([]);

// ===== 行业/专业字典 =====
async function loadOptions() {
  if (!props.showIndustryMajor) return;
  optionsLoading.value = true;
  try {
    const [indRes, majorRes] = await Promise.all([
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 })
    ]);
    industries.value = (indRes.items || []).filter((i) => i.enabled).map((i) => ({ id: i.id, name: i.name }));
    majors.value = (majorRes.items || []).filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name }));
  } catch {
    industries.value = [];
    majors.value = [];
  } finally {
    optionsLoading.value = false;
  }
}

// ===== 证书库 =====
const certDialog = ref(false);
const newCertDialog = ref(false);
const certSearchQuery = ref('');
const selectedCertIds = ref<string[]>([]);
const certSubmitting = ref(false);
const certFileInput = ref<HTMLInputElement | null>(null);
const newCert = reactive({ name: '', url: '', description: '', image: '' });
let certImageFile: File | null = null;

async function loadCertificateLibrary() {
  if (!props.certificateLibraryEnabled) return;
  try {
    const res = await certificateLibraryApi.list({ limit: 1000 });
    certificateLibrary.value = (res.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url ?? '',
      description: item.description ?? '',
      image: item.imageUrl ?? ''
    }));
  } catch {
    certificateLibrary.value = [];
  }
}

function isValidImageUrl(url?: string): boolean {
  return !!url && !url.startsWith('blob:');
}

// 同步已选证书状态，防止异步加载/重新进入编辑页后选择框与保存数据不一致
watch(
  () => props.position.certificates,
  (list) => {
    selectedCertIds.value = (list || []).map((c) => c.libraryId || c.id);
  },
  { immediate: true, deep: true }
);

function openCertDialog() {
  selectedCertIds.value = (props.position.certificates || []).map((c) => c.libraryId || c.id);
  certSearchQuery.value = '';
  certDialog.value = true;
}

const filteredCertificates = computed(() => {
  const q = certSearchQuery.value.trim().toLowerCase();
  if (!q) return certificateLibrary.value;
  return certificateLibrary.value.filter(
    (c) => c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
  );
});

function toggleCertificate(certId: string) {
  selectedCertIds.value = selectedCertIds.value.includes(certId)
    ? selectedCertIds.value.filter((id) => id !== certId)
    : [...selectedCertIds.value, certId];
}

function confirmCertificates() {
  const existingCerts = props.position.certificates || [];
  const existingLibraryIds = new Set(existingCerts.map((c) => c.libraryId || c.id));
  // 保留仍被勾选的已关联证书
  const keptCerts = existingCerts.filter((c) => selectedCertIds.value.includes(c.libraryId || c.id));
  // 追加新勾选的证书库条目
  for (const libItem of certificateLibrary.value) {
    if (selectedCertIds.value.includes(libItem.id) && !existingLibraryIds.has(libItem.id)) {
      keptCerts.push({
        id: localId('cert-ref'),
        libraryId: libItem.id,
        name: libItem.name,
        url: libItem.url,
        description: libItem.description,
        image: libItem.image
      });
    }
  }
  emit('update', { certificates: keptCerts });
  certDialog.value = false;
}

function pickCertImage() {
  certFileInput.value?.click();
}

function revokeCertImage() {
  if (newCert.image.startsWith('blob:')) URL.revokeObjectURL(newCert.image);
}

function onCertImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  revokeCertImage();
  certImageFile = file;
  newCert.image = URL.createObjectURL(file);
}

function resetNewCert() {
  revokeCertImage();
  newCert.name = '';
  newCert.url = '';
  newCert.description = '';
  newCert.image = '';
  certImageFile = null;
}

async function addNewCertificate() {
  if (!newCert.name) return;
  certSubmitting.value = true;
  try {
    let imageUrl: string | undefined = newCert.image.startsWith('blob:') ? undefined : newCert.image || undefined;
    if (certImageFile) {
      const uploadRes = await fileApi.upload(certImageFile);
      imageUrl = uploadRes.url;
    }
    const created = await certificateLibraryApi.create({
      name: newCert.name,
      url: newCert.url || undefined,
      description: newCert.description || undefined,
      imageUrl
    });
    const poolItem: PoolCertificate = {
      id: created.id,
      name: created.name,
      url: created.url ?? '',
      description: created.description ?? '',
      image: created.imageUrl ?? ''
    };
    certificateLibrary.value = [poolItem, ...certificateLibrary.value];
    emit('update', {
      certificates: [
        ...(props.position.certificates || []),
        {
          id: localId('cert-ref'),
          libraryId: created.id,
          name: created.name,
          url: created.url ?? '',
          description: created.description ?? '',
          image: created.imageUrl ?? ''
        }
      ]
    });
    resetNewCert();
    newCertDialog.value = false;
  } catch {
    aiNotice.value = '新增证书失败，请稍后重试';
  } finally {
    certSubmitting.value = false;
  }
}

function removeCertificate(certId: string) {
  const cert = props.position.certificates?.find((c) => c.id === certId);
  emit('update', { certificates: (props.position.certificates || []).filter((c) => c.id !== certId) });
  if (cert) {
    selectedCertIds.value = selectedCertIds.value.filter((id) => id !== (cert.libraryId || cert.id));
  }
}

// ===== 职责 / 任职要求（回车新增行并聚焦） =====
let pendingFocusId: string | null = null;

function genReqId(): string {
  return localId('req');
}
const reqIds = ref<string[]>(props.position.requirements.map(() => genReqId()));
// 外部整体替换（AI/父级重置）导致数量不一致时重建 id 表
watch(
  () => props.position.requirements.length,
  (len) => {
    if (reqIds.value.length !== len) {
      reqIds.value = Array.from({ length: len }, () => genReqId());
    }
  }
);

async function focusPending() {
  if (!pendingFocusId) return;
  const target = pendingFocusId;
  await nextTick();
  const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-focus-id="${target}"]`);
  if (el) {
    pendingFocusId = null;
    el.focus();
  }
}

/** 回车新增下一行：中文输入法确认键（composing）不触发，对齐 React isComposing 判断 */
function onEnterAdd(e: KeyboardEvent, kind: 'resp' | 'req') {
  if (e.isComposing) return;
  e.preventDefault();
  if (kind === 'resp') addResponsibility(true);
  else addRequirement(true);
}

function updateResponsibility(index: number, value: string) {
  const next = props.position.responsibilities.map((r, i) => (i === index ? { ...r, name: value } : r));
  emit('update', { responsibilities: next });
}

function addResponsibility(focusNew = false) {
  const newItem = { id: localId('resp'), name: '', description: '' };
  if (focusNew) pendingFocusId = newItem.id;
  emit('update', { responsibilities: [...props.position.responsibilities, newItem] });
  void focusPending();
}

function removeResponsibility(index: number) {
  emit('update', { responsibilities: props.position.responsibilities.filter((_, i) => i !== index) });
}

function updateRequirement(index: number, value: string) {
  emit('update', { requirements: props.position.requirements.map((r, i) => (i === index ? value : r)) });
}

function addRequirement(focusNew = false) {
  const newId = genReqId();
  reqIds.value = [...reqIds.value, newId];
  if (focusNew) pendingFocusId = newId;
  emit('update', { requirements: [...props.position.requirements, ''] });
  void focusPending();
}

function removeRequirement(index: number) {
  emit('update', { requirements: props.position.requirements.filter((_, i) => i !== index) });
  reqIds.value = reqIds.value.filter((_, i) => i !== index);
}

onMounted(() => {
  void loadOptions();
  void loadCertificateLibrary();
});
</script>

<style scoped>
.step-basic {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.block-card {
  border-radius: 10px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.section-ai {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  padding: 2px;
  border-radius: 6px;
}
.grid-2 .field {
  margin-bottom: 0;
}
.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.field-hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}
.salary-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.salary-input {
  width: 160px;
}
.sep {
  color: #909399;
}
.ai-notice {
  border-radius: 8px;
}
.row-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.row-index {
  width: 32px;
  flex-shrink: 0;
  text-align: center;
}
.row-del {
  flex-shrink: 0;
  color: #c0c4cc;
}
.row-del:hover {
  color: #f56c6c;
}
.add-row {
  border-style: dashed;
  width: 100%;
}
.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}
.cert-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.cert-card.selectable {
  cursor: pointer;
  border-width: 2px;
  transition: all 0.2s;
}
.cert-card.selectable:hover {
  border-color: #c0c4cc;
}
.cert-card.selected {
  border-color: #409eff;
}
.cert-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
}
.cert-check {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
}
.cert-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  overflow: hidden;
}
.cert-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cert-cover-icon {
  color: #c0c4cc;
}
.cert-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}
.cert-line {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}
.cert-key {
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
}
.cert-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}
.cert-url {
  font-size: 12px;
  color: #409eff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cert-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cert-pool {
  margin-top: 14px;
  max-height: 56vh;
  overflow: auto;
  padding-right: 4px;
}
.cert-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 96px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  color: #909399;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.cert-upload:hover {
  background: #f5f7fa;
}
.cert-upload-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cert-upload-tip {
  font-size: 12px;
}
.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
</style>
