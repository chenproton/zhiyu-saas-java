<template>
  <div class="edit-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ isCreate ? '新建专家' : '编辑专家' }}</div>
            <div class="card-sub">{{ isCreate ? '创建后自动生成企业服务台登录账号' : form.name || '专家信息' }}</div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/partner/experts')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="!loading && !loaded" description="专家不存在" />

      <template v-else>
        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">基础信息</span></template>
          <el-form :model="form" label-width="100px" class="expert-form">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="姓名" required>
                  <el-input v-model="form.name" placeholder="请输入姓名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="性别">
                  <el-select v-model="form.gender" style="width: 100%">
                    <el-option label="男" value="male" />
                    <el-option label="女" value="female" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="年龄">
                  <el-input-number v-model="form.age" :min="0" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="所在城市">
                  <el-input v-model="form.city" placeholder="请输入所在城市" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="职称/职位">
                  <el-input v-model="form.title" placeholder="如：高级工程师" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="任职岗位">
                  <el-input v-model="form.position" placeholder="请输入任职岗位" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="从业年限">
                  <el-input-number v-model="form.experienceYears" :min="0" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="教育背景">
                  <el-input v-model="form.education" placeholder="如：XX大学 硕士" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="行业方向">
              <el-input v-model="form.industry" placeholder="如：智能制造" />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">专家形象</span></template>
          <el-row :gutter="24">
            <el-col :span="12">
              <div class="upload-label">专家头像</div>
              <div class="cover-wrap">
                <div v-if="form.avatarUrl" class="cover-preview">
                  <el-image :src="form.avatarUrl" fit="cover" class="cover-img" />
                  <div class="cover-actions">
                    <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" :disabled="avatarUploading" @change="onAvatarChange">
                      <el-button size="small" :loading="avatarUploading">更换头像</el-button>
                    </el-upload>
                    <el-button size="small" :disabled="avatarUploading" @click="form.avatarUrl = ''">移除</el-button>
                  </div>
                </div>
                <el-upload v-else :auto-upload="false" :show-file-list="false" accept="image/*" :disabled="avatarUploading" @change="onAvatarChange">
                  <div class="cover-empty">
                    <span>{{ avatarUploading ? '上传中...' : '点击上传专家头像' }}</span>
                  </div>
                </el-upload>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="upload-label">专家主页封面</div>
              <div class="cover-wrap">
                <div v-if="form.coverImage" class="cover-preview">
                  <el-image :src="form.coverImage" fit="cover" class="cover-img cover-img-wide" />
                  <div class="cover-actions">
                    <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" :disabled="coverUploading" @change="onCoverChange">
                      <el-button size="small" :loading="coverUploading">更换封面</el-button>
                    </el-upload>
                    <el-button size="small" :disabled="coverUploading" @click="form.coverImage = ''">移除</el-button>
                  </div>
                </div>
                <el-upload v-else :auto-upload="false" :show-file-list="false" accept="image/*" :disabled="coverUploading" @change="onCoverChange">
                  <div class="cover-empty">
                    <span>{{ coverUploading ? '上传中...' : '点击上传主页封面' }}</span>
                  </div>
                </el-upload>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">擅长领域</span></template>
          <div class="specialty-list">
            <el-tag
              v-for="s in form.specialties"
              :key="s"
              closable
              type="info"
              effect="plain"
              @close="removeSpecialty(s)"
            >
              {{ s }}
            </el-tag>
            <el-empty v-if="form.specialties.length === 0" description="暂无擅长领域" :image-size="60" />
          </div>
          <div class="specialty-input-row">
            <el-input
              v-model="specialtyInput"
              placeholder="输入擅长领域后回车添加"
              @keyup.enter.prevent="addSpecialty"
            />
            <el-button @click="addSpecialty">添加</el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">专家简介</span></template>
          <el-input v-model="form.introduction" type="textarea" :rows="4" placeholder="请输入专家简介" />
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">从业经历</span></template>
          <el-input v-model="form.workExperience" type="textarea" :rows="4" placeholder="请输入从业经历" />
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">资质荣誉（佐证材料）</span></template>
          <div v-if="form.attachments.length" class="attachment-grid">
            <div v-for="(a, i) in form.attachments" :key="i" class="attachment-item">
              <img :src="a" :alt="`佐证材料 ${i + 1}`" class="attachment-img" />
              <el-button
                type="danger"
                size="small"
                circle
                class="attachment-remove"
                @click="removeAttachment(i)"
              >
                ×
              </el-button>
            </div>
          </div>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            multiple
            :disabled="attachmentsUploading"
            @change="onAttachmentChange"
          >
            <el-button :loading="attachmentsUploading">上传佐证材料</el-button>
          </el-upload>
          <div class="attachment-url-row">
            <el-input v-model="attachmentUrlInput" placeholder="上传附件或输入 URL" @keyup.enter.prevent="addAttachmentUrl" />
            <el-button @click="addAttachmentUrl">添加</el-button>
          </div>
        </el-card>

        <el-card v-if="!isCreate" shadow="never" class="section-card">
          <template #header><span class="section-title">设置</span></template>
          <el-form label-width="80px">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 200px">
                <el-option label="启用" value="active" />
                <el-option label="禁用" value="inactive" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-if="isCreate" shadow="never" class="section-card">
          <template #header><span class="section-title">专家登录账号</span></template>
          <div class="account-hint">
            创建专家将自动生成企业服务台登录账号，专家登录后可维护自己的档案并参与学校授权的共建资源
          </div>
          <el-form label-width="120px" class="account-form">
            <el-form-item label="用户名" required>
              <el-input v-model="username" placeholder="设置登录用户名（同一账号可加入多个企业）" autocomplete="off" />
            </el-form-item>
            <el-form-item label="初始密码" required>
              <el-input
                v-model="password"
                type="password"
                placeholder="至少 8 位，包含字母和数字"
                autocomplete="new-password"
                show-password
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-else shadow="never" class="section-card">
          <template #header><span class="section-title">重置登录密码</span></template>
          <el-form label-width="120px">
            <el-form-item label="新密码（选填）">
              <el-input
                v-model="newPassword"
                type="password"
                placeholder="至少 8 位，包含字母和数字"
                autocomplete="new-password"
                show-password
              />
            </el-form-item>
          </el-form>
        </el-card>

        <div class="form-actions">
          <el-button type="primary" :loading="saving" @click="handleSave">{{ isCreate ? '创建' : '保存' }}</el-button>
          <el-button @click="router.back()">取消</el-button>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerExpertApi } from '@/api/partner';
import { fileApi } from '@/api/import-export';
import type { PartnerExpert } from '@/types/partner';

interface ExpertDetail extends PartnerExpert {
  status: string;
  isPublic: boolean;
}

interface ExpertFormState {
  name: string;
  gender: string;
  age?: number;
  city: string;
  title: string;
  position: string;
  experienceYears?: number;
  education: string;
  industry: string;
  specialties: string[];
  introduction: string;
  workExperience: string;
  avatarUrl: string;
  coverImage: string;
  attachments: string[];
  status: string;
  isPublic: boolean;
}

// GET /auth/partner/me：角色编码用于「写操作仅 enterprise_admin」判定
interface PartnerMeResponse {
  user?: { roleCodes?: string[] };
  roles?: { code?: string }[];
}

// POST /partner/experts：档案 + 自动生成的登录账号（返回初始密码，仅创建时下发）
interface ExpertCreateResponse {
  expert?: PartnerExpert;
  username?: string;
  initialPassword?: string;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
// 新建模式：/partner/experts/new/edit（复用 :id/edit 路由，对齐 React /partner/experts/new）
const isCreate = id === 'new';

const loading = ref(false);
const loaded = ref(false);
const saving = ref(false);
const newPassword = ref('');
const username = ref('');
const password = ref('');
const specialtyInput = ref('');
const attachmentUrlInput = ref('');
const avatarUploading = ref(false);
const coverUploading = ref(false);
const attachmentsUploading = ref(false);

const form = reactive<ExpertFormState>({
  name: '',
  gender: 'male',
  age: undefined,
  city: '',
  title: '',
  position: '',
  experienceYears: undefined,
  education: '',
  industry: '',
  specialties: [],
  introduction: '',
  workExperience: '',
  avatarUrl: '',
  coverImage: '',
  attachments: [],
  status: 'active',
  // 新建默认对外展示（对齐 React new 页 isPublic: true），编辑时由详情回填
  isPublic: isCreate
});

function fillForm(expert: ExpertDetail) {
  form.name = expert.name || '';
  form.gender = expert.gender || 'male';
  form.age = expert.age;
  form.city = expert.city || '';
  form.title = expert.title || '';
  form.position = expert.position || '';
  form.experienceYears = expert.experienceYears;
  form.education = expert.education || '';
  form.industry = expert.industry || '';
  form.specialties = expert.specialties || [];
  form.introduction = expert.introduction || '';
  form.workExperience = expert.workExperience || '';
  form.avatarUrl = expert.avatarUrl || '';
  form.coverImage = expert.coverImage || '';
  form.attachments = expert.attachments || [];
  form.status = expert.status || 'active';
  form.isPublic = expert.isPublic || false;
}

// 写操作仅 enterprise_admin（对齐 React usePartnerAuth().isAdmin：优先 user.roleCodes[0]，回退 roles[0].code）
async function checkAdmin(): Promise<boolean> {
  try {
    const me = await partnerRequest<PartnerMeResponse>('/auth/partner/me');
    const activeRoleCode = me.user?.roleCodes?.[0] ?? me.roles?.[0]?.code;
    return activeRoleCode === 'enterprise_admin';
  } catch {
    return false;
  }
}

async function loadExpert() {
  try {
    const expert = (await partnerExpertApi.get(id)) as ExpertDetail;
    fillForm(expert);
    loaded.value = true;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  }
}

function addSpecialty() {
  const v = specialtyInput.value.trim();
  if (v && !form.specialties.includes(v)) form.specialties.push(v);
  specialtyInput.value = '';
}
function removeSpecialty(s: string) {
  form.specialties = form.specialties.filter((x) => x !== s);
}
function removeAttachment(i: number) {
  form.attachments.splice(i, 1);
}
function addAttachmentUrl() {
  const u = attachmentUrlInput.value.trim();
  if (u) form.attachments.push(u);
  attachmentUrlInput.value = '';
}

async function onAvatarChange(uploadFile: UploadFile) {
  const f = uploadFile.raw;
  if (!f) return;
  avatarUploading.value = true;
  try {
    const res = await fileApi.upload(f);
    form.avatarUrl = res.url;
    ElMessage.success('头像上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  } finally {
    avatarUploading.value = false;
  }
}

async function onCoverChange(uploadFile: UploadFile) {
  const f = uploadFile.raw;
  if (!f) return;
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(f);
    form.coverImage = res.url;
    ElMessage.success('封面上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  } finally {
    coverUploading.value = false;
  }
}

async function onAttachmentChange(uploadFile: UploadFile) {
  const f = uploadFile.raw;
  if (!f) return;
  attachmentsUploading.value = true;
  try {
    const res = await fileApi.upload(f);
    form.attachments.push(res.url);
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  } finally {
    attachmentsUploading.value = false;
  }
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写姓名');
    return;
  }
  if (isCreate && (!username.value || !password.value)) {
    ElMessage.warning('请填写专家登录用户名和密码');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      age: form.age,
      city: form.city,
      title: form.title,
      position: form.position,
      experienceYears: form.experienceYears,
      education: form.education,
      industry: form.industry,
      specialties: form.specialties,
      introduction: form.introduction,
      workExperience: form.workExperience,
      avatarUrl: form.avatarUrl,
      coverImage: form.coverImage,
      attachments: form.attachments,
      status: form.status,
      isPublic: form.isPublic
    };
    if (isCreate) {
      // 新建：档案 + 登录账号一并提交，成功后把初始密码提示转交专家本人
      const data = await partnerRequest<ExpertCreateResponse>('/partner/experts', {
        method: 'POST',
        body: JSON.stringify({ ...payload, username: username.value, password: password.value })
      });
      ElMessage.success(
        `专家已创建 — 用户名：${data.username || username.value} ｜ 初始密码：${data.initialPassword || password.value}，请转交专家本人`
      );
      router.push('/partner/experts');
      return;
    }
    await partnerRequest<PartnerExpert>(`/partner/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, password: newPassword.value || undefined })
    });
    ElMessage.success('专家已更新');
    router.push(`/partner/experts/${id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  if (!(await checkAdmin())) {
    ElMessage.warning('仅企业管理员可维护专家档案');
    // 保持 loading：跳转生效前不渲染表单/空态，避免闪现「专家不存在」
    router.replace(isCreate ? '/partner/experts' : `/partner/experts/${id}`);
    return;
  }
  if (isCreate) {
    loaded.value = true;
    loading.value = false;
    return;
  }
  await loadExpert();
  loading.value = false;
});
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.section-card { margin-top: 16px; }
.section-title { font-size: 14px; font-weight: 600; }
.expert-form { max-width: 860px; }
.account-form { max-width: 520px; }
.account-hint { font-size: 12px; color: #909399; line-height: 1.6; margin-bottom: 12px; }
.upload-label { font-size: 13px; color: #606266; margin-bottom: 8px; }
.cover-wrap { width: 100%; }
.cover-preview { position: relative; }
.cover-img { width: 160px; height: 160px; border-radius: 8px; border: 1px solid #ebeef5; }
.cover-img-wide { width: 240px; height: 120px; }
.cover-actions { display: flex; gap: 8px; margin-top: 8px; }
.cover-empty {
  width: 160px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
}
.specialty-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.specialty-input-row { display: flex; gap: 8px; margin-top: 12px; max-width: 480px; }
.attachment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 12px;
}
.attachment-item { position: relative; }
.attachment-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
.attachment-remove { position: absolute; top: 4px; right: 4px; }
.attachment-url-row { display: flex; gap: 8px; margin-top: 12px; max-width: 480px; }
.form-actions { margin-top: 20px; display: flex; gap: 8px; }
@media (max-width: 768px) {
  .attachment-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
