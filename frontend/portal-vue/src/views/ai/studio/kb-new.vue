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
          <h1 class="title">新建知识库</h1>
        </div>
      </div>
    </div>

    <div class="content">
      <el-card shadow="never" class="form-card">
        <template #header>
          <div class="card-head">
            <div class="card-title">基本信息</div>
            <div class="card-desc">创建后为私有，保存后进入管理页上传文档、邀请协作者，再提交审核发布到广场</div>
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item label="封面">
            <div class="cover-row">
              <el-button size="small" :loading="coverUploading" @click="pickCover">上传封面</el-button>
              <span v-if="cover" class="cover-preview" :style="{ backgroundImage: `url('${cover}')` }" />
              <el-button v-if="cover" size="small" text type="danger" @click="cover = ''">移除</el-button>
              <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="onCoverPick" />
            </div>
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="name" maxlength="200" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="description" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="标签">
            <el-input v-model="tags" placeholder="多个标签用逗号分隔" />
          </el-form-item>
          <el-form-item>
            <ClassifySelects :value="classify" with-kb-type @update:value="onClassify" />
          </el-form-item>
          <div class="form-actions">
            <el-button type="primary" :loading="saving" @click="create">创建知识库</el-button>
          </div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { aiCenterKbApi } from '@/api/ai';
import type { AIKBType } from '@/types/ai';
import { fileApi } from '../ai-api';
import ClassifySelects from '../components/ClassifySelects.vue';
import type { ClassifyValue } from '../components/ClassifySelects.vue';

const router = useRouter();
const name = ref('');
const description = ref('');
const tags = ref('');
const cover = ref('');
const coverUploading = ref(false);
const coverInput = ref<HTMLInputElement | null>(null);
const classify = ref<ClassifyValue>({ majorId: '', departmentId: '', kbType: '' });
const saving = ref(false);

function onClassify(v: ClassifyValue) {
  classify.value = v;
}

function pickCover() {
  coverInput.value?.click();
}
async function onCoverPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 5MB');
    return;
  }
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件');
    return;
  }
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    cover.value = res.url;
  } catch (err) {
    ElMessage.error((err as Error).message || '上传失败');
  } finally {
    coverUploading.value = false;
  }
}

async function create() {
  if (!name.value.trim()) {
    ElMessage.warning('请填写名称');
    return;
  }
  saving.value = true;
  try {
    const kb = await aiCenterKbApi.create({
      name: name.value.trim(),
      description: description.value.trim(),
      tags: tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      coverImage: cover.value || undefined,
      majorId: classify.value.majorId || undefined,
      departmentId: classify.value.departmentId || undefined,
      kbType: (classify.value.kbType || undefined) as AIKBType | undefined
    });
    ElMessage.success('创建成功，继续上传文档吧');
    router.replace(`/portal/apps/ai/studio/kb/${kb.id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败');
    saving.value = false;
  }
}
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
}
.content {
  max-width: 1024px;
  margin: 0 auto;
  padding: 24px 16px;
}
.form-card :deep(.el-card__header) {
  padding: 16px 20px 12px;
  border-bottom: 1px dashed #e7e5e4;
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
.cover-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cover-preview {
  width: 80px;
  height: 50px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  border: 1px solid #e4e7ed;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
