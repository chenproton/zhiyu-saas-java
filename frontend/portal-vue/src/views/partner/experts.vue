<template>
  <!-- 成员角色：我的专家档案（只能查看/编辑本人） -->
  <div v-if="isAdmin === false" class="list-page">
    <div class="page-header">
      <h2 class="page-title">我的专家档案</h2>
      <p class="page-sub">维护你的专家档案，档案将共享给引入本企业的合作学校（学校端只读）。</p>
    </div>

    <div v-loading="memberLoading" class="member-layout">
      <div class="member-main">
        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">基础信息</span></template>
          <el-form label-width="100px">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="姓名" required>
                  <el-input v-model="member.name" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="性别">
                  <el-select v-model="member.gender" style="width: 100%">
                    <el-option label="男" value="male" />
                    <el-option label="女" value="female" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="年龄">
                  <el-input-number v-model="member.age" :min="0" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="所在城市">
                  <el-input v-model="member.city" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="职称/职位">
                  <el-input v-model="member.title" placeholder="如：高级工程师" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="任职岗位">
                  <el-input v-model="member.position" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="从业年限">
                  <el-input-number v-model="member.experienceYears" :min="0" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="教育背景">
                  <el-input v-model="member.education" placeholder="如：XX大学 硕士" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="行业方向">
              <el-input v-model="member.industry" placeholder="如：智能制造" />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">专家形象</span></template>
          <el-row :gutter="24">
            <el-col :span="12">
              <div class="upload-label">专家头像</div>
              <SingleImg v-model="member.avatarUrl" />
            </el-col>
            <el-col :span="12">
              <div class="upload-label">专家主页封面</div>
              <SingleImg v-model="member.coverImage" wide />
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">擅长领域</span></template>
          <div class="specialty-list">
            <el-tag v-for="s in member.specialties" :key="s" closable type="info" effect="plain" @close="removeSpecialty(s)">{{ s }}</el-tag>
            <el-empty v-if="member.specialties.length === 0" description="暂无擅长领域" :image-size="60" />
          </div>
          <div class="specialty-input-row">
            <el-input v-model="specialtyInput" placeholder="输入擅长领域后回车添加" @keyup.enter.prevent="addSpecialty" />
            <el-button @click="addSpecialty">添加</el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">专家简介</span></template>
          <el-input v-model="member.introduction" type="textarea" :rows="4" />
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">从业经历</span></template>
          <el-input v-model="member.workExperience" type="textarea" :rows="4" />
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">资质荣誉（佐证材料）</span></template>
          <MultiImg v-model="member.attachments" />
        </el-card>
      </div>

      <div class="member-side">
        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">设置</span></template>
          <el-form label-width="80px">
            <el-form-item label="状态">
              <el-select v-model="member.status" style="width: 200px">
                <el-option label="启用" value="active" />
                <el-option label="禁用" value="inactive" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>
        <el-card shadow="never" class="section-card">
          <template #header><span class="section-title">保存</span></template>
          <el-button type="primary" style="width: 100%" :loading="memberSaving" @click="saveMember">{{ memberSaving ? '保存中...' : '保存档案' }}</el-button>
        </el-card>
      </div>
    </div>
  </div>

  <!-- 管理员角色：专家资源列表 -->
  <div v-else class="list-page">
    <div class="page-header">
      <div class="header-main">
        <div>
          <h2 class="page-title">专家资源</h2>
          <p class="page-sub">维护企业专家档案，档案将共享给引入本企业的合作学校（学校端只读）。</p>
        </div>
        <el-button type="primary" @click="router.push('/partner/experts/new')">新建专家</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-input v-model="search" placeholder="搜索姓名、头衔或行业..." clearable style="max-width: 300px; margin-bottom: 12px" />
      <el-table v-loading="loading" :data="filteredExperts" stripe>
        <el-table-column label="姓名" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/partner/experts/${row.id}`)">{{ row.name }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="头衔" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column label="职位" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.position || '-' }}</template>
        </el-table-column>
        <el-table-column label="行业" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.industry || '-' }}</template>
        </el-table-column>
        <el-table-column label="所在城市" width="110">
          <template #default="{ row }">{{ row.city || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="expertStatusTagType(row.status)">{{ expertStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="router.push(`/partner/experts/${row.id}`)">查看</el-button>
            <el-button size="small" link type="primary" @click="router.push(`/partner/experts/${row.id}/edit`)">编辑</el-button>
            <el-button size="small" link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredExperts.length === 0" description="暂无专家。" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerExpertApi } from '@/api/partner';
import { fileApi } from '@/api/import-export';
import type { PartnerExpert } from '@/types/partner';

interface ExpertRow extends PartnerExpert {
  status: string;
  isPublic: boolean;
}

interface MeResponse {
  user?: { roleCodes?: string[] };
  roles?: { code?: string }[];
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

const EXPERT_STATUS_LABELS: Record<string, string> = { active: '正常', inactive: '已停用' };

const router = useRouter();
const isAdmin = ref<boolean | null>(null);

// 管理员列表状态
const experts = ref<ExpertRow[]>([]);
const search = ref('');
const loading = ref(false);

// 成员档案状态
const memberLoading = ref(false);
const memberSaving = ref(false);
const specialtyInput = ref('');
const member = reactive<ExpertFormState>({
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
  isPublic: false
});

const filteredExperts = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return experts.value;
  return experts.value.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q) ||
      (e.industry || '').toLowerCase().includes(q)
  );
});

function expertStatusLabel(s: string) { return EXPERT_STATUS_LABELS[s] || s; }
function expertStatusTagType(s: string): 'success' | 'info' {
  return s === 'inactive' ? 'info' : 'success';
}

async function resolveRole() {
  try {
    const me = await partnerRequest<MeResponse>('/auth/partner/me');
    const codes = me.user?.roleCodes;
    const activeRoleCode = codes && codes.length > 0 ? codes[0] : me.roles?.[0]?.code;
    isAdmin.value = activeRoleCode === 'enterprise_admin';
  } catch {
    isAdmin.value = false;
  }
}

// ---- 管理员列表 ----
async function loadExperts() {
  loading.value = true;
  try {
    const res = await partnerExpertApi.list({ limit: 200 });
    experts.value = (res.items || []) as ExpertRow[];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function confirmDelete(row: ExpertRow) {
  try {
    await ElMessageBox.confirm(`确定要删除专家「${row.name}」吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await partnerExpertApi.delete(row.id);
    ElMessage.success('已删除');
    loadExperts();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

// ---- 成员档案 ----
function fillMember(expert: ExpertRow) {
  member.name = expert.name || '';
  member.gender = expert.gender || 'male';
  member.age = expert.age;
  member.city = expert.city || '';
  member.title = expert.title || '';
  member.position = expert.position || '';
  member.experienceYears = expert.experienceYears;
  member.education = expert.education || '';
  member.industry = expert.industry || '';
  member.specialties = expert.specialties || [];
  member.introduction = expert.introduction || '';
  member.workExperience = expert.workExperience || '';
  member.avatarUrl = expert.avatarUrl || '';
  member.coverImage = expert.coverImage || '';
  member.attachments = expert.attachments || [];
  member.status = expert.status || 'active';
  member.isPublic = expert.isPublic || false;
}

async function loadMember() {
  memberLoading.value = true;
  try {
    const expert = await partnerRequest<ExpertRow>('/partner/experts/me');
    fillMember(expert);
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    memberLoading.value = false;
  }
}

function addSpecialty() {
  const v = specialtyInput.value.trim();
  if (v && !member.specialties.includes(v)) member.specialties.push(v);
  specialtyInput.value = '';
}
function removeSpecialty(s: string) {
  member.specialties = member.specialties.filter((x) => x !== s);
}

async function saveMember() {
  if (!member.name.trim()) {
    ElMessage.warning('请填写姓名');
    return;
  }
  memberSaving.value = true;
  try {
    await partnerRequest<PartnerExpert>('/partner/experts/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: member.name.trim(),
        gender: member.gender,
        age: member.age,
        city: member.city,
        title: member.title,
        position: member.position,
        experienceYears: member.experienceYears,
        education: member.education,
        industry: member.industry,
        specialties: member.specialties,
        introduction: member.introduction,
        workExperience: member.workExperience,
        avatarUrl: member.avatarUrl,
        coverImage: member.coverImage,
        attachments: member.attachments,
        status: member.status,
        isPublic: member.isPublic
      })
    });
    ElMessage.success('档案已更新');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    memberSaving.value = false;
  }
}

// ---- 内联图片上传子组件（仅本页使用） ----
async function doUpload(f: File): Promise<string> {
  const res = await fileApi.upload(f);
  return res.url;
}

const SingleImg = defineComponent({
  name: 'SingleImg',
  props: { modelValue: { type: String, default: '' }, wide: { type: Boolean, default: false } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const uploading = ref(false);
    const onChange = async (f: File) => {
      uploading.value = true;
      try {
        emit('update:modelValue', await doUpload(f));
      } catch (e) {
        ElMessage.error((e as Error).message || '上传失败');
      } finally {
        uploading.value = false;
      }
    };
    return () => {
      const imgCls = props.wide ? 'cover-img cover-img-wide' : 'cover-img';
      const emptyCls = props.wide ? 'cover-empty cover-empty-wide' : 'cover-empty';
      return h('div', { class: 'cover-wrap' }, [
        props.modelValue
          ? h('div', { class: 'cover-preview' }, [
              h('img', { src: props.modelValue, class: imgCls }),
              h('div', { class: 'cover-actions' }, [
                h('label', { class: 'cover-upload-btn' }, [
                  uploading.value ? '上传中...' : '更换',
                  h('input', {
                    type: 'file',
                    accept: 'image/*',
                    style: { display: 'none' },
                    onChange: (ev: Event) => {
                      const input = ev.target as HTMLInputElement;
                      const f = input.files?.[0];
                      if (f) onChange(f);
                      input.value = '';
                    }
                  })
                ]),
                h('span', { class: 'cover-remove-btn', onClick: () => emit('update:modelValue', '') }, '移除')
              ])
            ])
          : h('div', { class: emptyCls }, uploading.value ? '上传中...' : '点击上传')
      ]);
    };
  }
});

const MultiImg = defineComponent({
  name: 'MultiImg',
  props: { modelValue: { type: Array as () => string[], required: true } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const uploading = ref(false);
    const onChange = async (f: File) => {
      uploading.value = true;
      try {
        const url = await doUpload(f);
        emit('update:modelValue', [...props.modelValue, url]);
      } catch (e) {
        ElMessage.error((e as Error).message || '上传失败');
      } finally {
        uploading.value = false;
      }
    };
    const remove = (i: number) => {
      emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i));
    };
    return () =>
      h('div', { class: 'multi-wrap' }, [
        ...props.modelValue.map((url, idx) =>
          h('div', { key: idx, class: 'multi-item' }, [
            h('img', { src: url, class: 'multi-img' }),
            h('span', { class: 'multi-remove', onClick: () => remove(idx) }, '×')
          ])
        ),
        h('label', { class: 'multi-add' }, [
          h('span', { class: 'multi-add-inner' }, uploading.value ? '上传中...' : '上传'),
          h('input', {
            type: 'file',
            accept: 'image/*',
            style: { display: 'none' },
            onChange: (ev: Event) => {
              const input = ev.target as HTMLInputElement;
              const f = input.files?.[0];
              if (f) onChange(f);
              input.value = '';
            }
          })
        ])
      ]);
  }
});

onMounted(async () => {
  await resolveRole();
  if (isAdmin.value === true) {
    loadExperts();
  } else if (isAdmin.value === false) {
    loadMember();
  }
});
</script>

<style scoped>
.list-page { padding: 16px; min-height: 100%; }
.page-header { margin-bottom: 16px; }
.header-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }

.member-layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
.member-main { display: flex; flex-direction: column; gap: 16px; }
.member-side { display: flex; flex-direction: column; gap: 16px; }
.section-card { border-radius: 10px; }
.section-title { font-size: 14px; font-weight: 600; }
.upload-label { font-size: 13px; color: #606266; margin-bottom: 8px; }
.specialty-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.specialty-input-row { display: flex; gap: 8px; margin-top: 12px; max-width: 480px; }

@media (max-width: 992px) {
  .member-layout { grid-template-columns: 1fr; }
}
</style>

<style>
.cover-wrap { width: 100%; }
.cover-preview { position: relative; }
.cover-img { width: 160px; height: 160px; border-radius: 8px; border: 1px solid #ebeef5; object-fit: cover; }
.cover-img-wide { width: 240px; height: 120px; }
.cover-actions { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.cover-upload-btn { display: inline-flex; align-items: center; justify-content: center; padding: 5px 12px; font-size: 12px; border: 1px solid #dcdfe6; border-radius: 4px; color: #606266; background: #fff; cursor: pointer; }
.cover-remove-btn { display: inline-flex; align-items: center; justify-content: center; padding: 5px 12px; font-size: 12px; border: 1px solid #dcdfe6; border-radius: 4px; color: #606266; background: #fff; cursor: pointer; }
.cover-empty { width: 160px; height: 100px; display: flex; align-items: center; justify-content: center; border: 1px dashed #dcdfe6; border-radius: 8px; color: #909399; font-size: 12px; cursor: pointer; }
.cover-empty-wide { width: 240px; height: 120px; }
.multi-wrap { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
.multi-item { position: relative; }
.multi-img { width: 96px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #ebeef5; }
.multi-remove { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: #f56c6c; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
.multi-add { width: 96px; height: 72px; border: 1px dashed #dcdfe6; border-radius: 8px; cursor: pointer; display: flex; }
.multi-add-inner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #909399; font-size: 12px; }
</style>
