<template>
  <div class="enterprise-page">
    <!-- 页头 -->
    <div class="page-header">
      <div>
        <h2 class="page-title">企业信息</h2>
        <p class="page-sub">维护企业主体信息，信息将共享给引入本企业的合作学校。</p>
      </div>
      <div class="header-actions">
        <div class="public-switch" :title="'开启后企业才会出现在各学校的产业联盟展示页；具体是否在某学校前台出现，由该校在引入时决定。'">
          <span class="switch-label">愿意对外展示</span>
          <el-switch v-model="item.enablePublic" @change="onTogglePublic" />
        </div>
        <el-button @click="previewOpen = true">预览展示页</el-button>
        <el-button type="primary" @click="openEdit">编辑</el-button>
      </div>
    </div>

    <!-- 资料待补全提示 -->
    <el-card v-if="missingFields.length > 0" shadow="never" class="missing-card">
      <div class="missing-title">资料待补全</div>
      <p class="missing-desc">以下资料尚未完善，将影响企业在产业联盟展示页的对外展示效果：</p>
      <ul class="missing-list">
        <li v-for="f in missingFields" :key="f">{{ f }}</li>
      </ul>
    </el-card>

    <!-- 只读视图 -->
    <div v-loading="loading" class="view-card">
      <div class="view-header">
        <div class="view-brand">
          <img v-if="item.logoUrl" :src="item.logoUrl" :alt="item.name" class="view-logo" />
          <div v-else class="view-logo view-logo-fallback">
            <el-icon :size="20"><OfficeBuilding /></el-icon>
          </div>
          <div>
            <h3 class="view-name">{{ item.name }}</h3>
            <p v-if="badge" class="view-badge">{{ badge }}</p>
          </div>
        </div>
      </div>

      <div class="view-body">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="联系人">{{ item.contactPerson || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ item.contactPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系邮箱">{{ item.contactEmail || '-' }}</el-descriptions-item>
          <el-descriptions-item label="统一社会信用代码">{{ item.unifiedSocialCreditCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="成立年份">{{ item.establishedYear ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="企业规模（人数）">{{ item.employeeCount != null ? `${item.employeeCount.toLocaleString()} 人` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="所在地区">{{ item.region || '-' }}</el-descriptions-item>
          <el-descriptions-item label="详细地址">{{ item.address || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="item.description" class="view-section">
          <div class="section-label">企业简介</div>
          <p class="pre-wrap">{{ item.description }}</p>
        </div>

        <div class="view-section">
          <div class="section-label">企业形象</div>
          <div v-if="coverPhotos.length > 0" class="photo-grid">
            <img v-for="(p, i) in coverPhotos" :key="i" :src="p" :alt="`企业形象 ${i + 1}`" class="photo-img" />
          </div>
          <p v-else class="muted">暂无形象图片</p>
        </div>

        <div class="view-section">
          <div class="section-label">企业证照</div>
          <div class="license-group">
            <div>
              <div class="license-label">企业营业执照</div>
              <div v-if="item.businessLicensePhotos.length > 0" class="photo-grid">
                <img v-for="(p, i) in item.businessLicensePhotos" :key="i" :src="p" :alt="`营业执照 ${i + 1}`" class="photo-img" />
              </div>
              <p v-else class="muted">暂无</p>
            </div>
            <div>
              <div class="license-label">企业知识产权</div>
              <div v-if="item.intellectualPropertyPhotos.length > 0" class="photo-grid">
                <img v-for="(p, i) in item.intellectualPropertyPhotos" :key="i" :src="p" :alt="`知识产权 ${i + 1}`" class="photo-img" />
              </div>
              <p v-else class="muted">暂无</p>
            </div>
            <div>
              <div class="license-label">企业荣誉资质</div>
              <div v-if="item.qualificationPhotos.length > 0" class="photo-grid">
                <img v-for="(p, i) in item.qualificationPhotos" :key="i" :src="p" :alt="`荣誉资质 ${i + 1}`" class="photo-img" />
              </div>
              <p v-else class="muted">暂无</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editOpen" title="编辑企业信息" width="760px" top="6vh">
      <p class="dialog-sub">修改企业主体信息，保存后共享给合作学校的产业联盟展示页</p>
      <el-form label-width="130px" class="edit-form">
        <div class="form-section-title">基础信息</div>
        <el-form-item label="企业名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="统一社会信用代码">
              <el-input v-model="form.unifiedSocialCreditCode" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属行业">
              <el-input v-model="form.industry" placeholder="如：信息技术" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="所在地区">
              <el-input v-model="form.region" placeholder="如：深圳" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成立年份">
              <el-input-number v-model="form.establishedYear" :min="1900" :max="2100" :controls="false" placeholder="如：2010" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="企业规模（人数）">
          <el-input-number v-model="form.employeeCount" :min="0" :controls="false" placeholder="如：500" style="width: 100%" />
        </el-form-item>
        <el-form-item label="企业简介">
          <el-input v-model="form.description" type="textarea" :rows="4" />
        </el-form-item>

        <div class="form-section-title">企业形象</div>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="企业 Logo">
              <div class="img-field">
                <div v-if="form.logoUrl" class="img-preview">
                  <img :src="form.logoUrl" class="img-preview-img" />
                  <div class="img-actions">
                    <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onLogoChange">
                      <el-button size="small">更换</el-button>
                    </el-upload>
                    <el-button size="small" @click="form.logoUrl = ''">移除</el-button>
                  </div>
                </div>
                <el-upload v-else :auto-upload="false" :show-file-list="false" accept="image/*" @change="onLogoChange">
                  <div class="img-empty">点击上传</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="企业主页封面">
              <div class="img-field">
                <div v-if="form.coverImage" class="img-preview">
                  <img :src="form.coverImage" class="img-preview-img" />
                  <div class="img-actions">
                    <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onCoverChange">
                      <el-button size="small">更换</el-button>
                    </el-upload>
                    <el-button size="small" @click="form.coverImage = ''">移除</el-button>
                  </div>
                </div>
                <el-upload v-else :auto-upload="false" :show-file-list="false" accept="image/*" @change="onCoverChange">
                  <div class="img-empty">点击上传</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="企业风采照片">
          <ImgListEditor :value="form.coverPhotos" @change="(v) => (form.coverPhotos = v)" />
        </el-form-item>

        <div class="form-section-title">企业证照</div>
        <el-form-item label="企业营业执照">
          <ImgListEditor :value="form.businessLicensePhotos" @change="(v) => (form.businessLicensePhotos = v)" />
        </el-form-item>
        <el-form-item label="企业知识产权">
          <ImgListEditor :value="form.intellectualPropertyPhotos" @change="(v) => (form.intellectualPropertyPhotos = v)" />
        </el-form-item>
        <el-form-item label="企业荣誉资质">
          <ImgListEditor :value="form.qualificationPhotos" @change="(v) => (form.qualificationPhotos = v)" />
        </el-form-item>

        <div class="form-section-title">联系信息</div>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactPerson" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系邮箱">
              <el-input v-model="form.contactEmail" type="email" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="详细地址">
              <el-input v-model="form.address" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewOpen" title="展示页预览" width="820px" top="6vh">
      <div class="preview-body">
        <div class="preview-brand">
          <img v-if="item.logoUrl" :src="item.logoUrl" :alt="item.name" class="preview-logo" />
          <div v-else class="preview-logo preview-logo-fallback">
            <el-icon :size="26"><OfficeBuilding /></el-icon>
          </div>
          <div>
            <h3 class="preview-name">{{ item.name }}</h3>
            <p v-if="badge" class="preview-badge">{{ badge }}</p>
          </div>
        </div>
        <p v-if="item.description" class="pre-wrap preview-desc">{{ item.description }}</p>
        <div v-if="coverPhotos.length > 0" class="preview-section">
          <div class="section-label">企业形象</div>
          <div class="photo-grid">
            <img v-for="(p, i) in coverPhotos" :key="i" :src="p" :alt="`企业形象 ${i + 1}`" class="photo-img" />
          </div>
        </div>
        <div class="preview-section">
          <div class="section-label">联系信息</div>
          <p class="preview-contact">
            <template v-if="item.contactPerson">联系人：{{ item.contactPerson }}　</template>
            <template v-if="item.contactPhone">电话：{{ item.contactPhone }}　</template>
            <template v-if="item.contactEmail">邮箱：{{ item.contactEmail }}</template>
          </p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { OfficeBuilding } from '@element-plus/icons-vue';
import { partnerEnterpriseApi } from '@/api/partner';
import { fileApi } from '@/api/import-export';
import type { PartnerEnterprise } from '@/types/partner';

interface FormState {
  name: string;
  unifiedSocialCreditCode: string;
  industry: string;
  region: string;
  description: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  logoUrl: string;
  coverImage: string;
  establishedYear?: number;
  employeeCount?: number;
  businessLicensePhotos: string[];
  intellectualPropertyPhotos: string[];
  qualificationPhotos: string[];
  coverPhotos: string[];
  enablePublic: boolean;
}

function toForm(e: PartnerEnterprise): FormState {
  return {
    name: e.name || '',
    unifiedSocialCreditCode: e.unifiedSocialCreditCode || '',
    industry: e.industry || '',
    region: e.region || '',
    description: e.description || '',
    contactPerson: e.contactPerson || '',
    contactPhone: e.contactPhone || '',
    contactEmail: e.contactEmail || '',
    address: e.address || '',
    logoUrl: e.logoUrl || '',
    coverImage: e.coverImage || '',
    establishedYear: e.establishedYear,
    employeeCount: e.employeeCount,
    businessLicensePhotos: e.businessLicensePhotos || [],
    intellectualPropertyPhotos: e.intellectualPropertyPhotos || [],
    qualificationPhotos: e.qualificationPhotos || [],
    coverPhotos: e.coverPhotos || [],
    enablePublic: e.enablePublic || false
  };
}

function getMissingFields(e: FormState): string[] {
  const missing: string[] = [];
  if (!e.logoUrl) missing.push('企业 Logo');
  if (!e.description) missing.push('企业简介');
  if (!e.contactPerson || !e.contactPhone) missing.push('联系人和联系电话');
  if (!e.coverImage) missing.push('企业主页封面');
  if (
    e.businessLicensePhotos.length === 0 &&
    e.intellectualPropertyPhotos.length === 0 &&
    e.qualificationPhotos.length === 0
  ) {
    missing.push('资质/证照图片');
  }
  return missing;
}

const loading = ref(true);
const saving = ref(false);
const editOpen = ref(false);
const previewOpen = ref(false);

const item = ref<FormState>({
  name: '',
  unifiedSocialCreditCode: '',
  industry: '',
  region: '',
  description: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  logoUrl: '',
  coverImage: '',
  establishedYear: undefined,
  employeeCount: undefined,
  businessLicensePhotos: [],
  intellectualPropertyPhotos: [],
  qualificationPhotos: [],
  coverPhotos: [],
  enablePublic: false
});

const form = reactive<FormState>({ ...item.value });

const missingFields = computed(() => getMissingFields(item.value));
const badge = computed(() => [item.value.industry, item.value.region].filter(Boolean).join(' · '));
const coverPhotos = computed(() =>
  item.value.coverImage ? [item.value.coverImage, ...item.value.coverPhotos] : item.value.coverPhotos
);

async function load() {
  loading.value = true;
  try {
    const e = await partnerEnterpriseApi.getProfile();
    Object.assign(item.value, toForm(e));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openEdit() {
  Object.assign(form, { ...item.value });
  editOpen.value = true;
}

async function onSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写企业名称');
    return;
  }
  saving.value = true;
  try {
    const payload: Partial<PartnerEnterprise> = {
      name: form.name.trim(),
      unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
      industry: form.industry.trim() || undefined,
      region: form.region.trim() || undefined,
      description: form.description.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      address: form.address.trim() || undefined,
      logoUrl: form.logoUrl || undefined,
      coverImage: form.coverImage || undefined,
      establishedYear: form.establishedYear,
      employeeCount: form.employeeCount,
      businessLicensePhotos: form.businessLicensePhotos,
      intellectualPropertyPhotos: form.intellectualPropertyPhotos,
      qualificationPhotos: form.qualificationPhotos,
      coverPhotos: form.coverPhotos
    };
    await partnerEnterpriseApi.updateProfile(payload);
    Object.assign(item.value, { ...form });
    editOpen.value = false;
    ElMessage.success('企业信息已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTogglePublic(v: boolean) {
  const prev = item.value.enablePublic;
  try {
    await partnerEnterpriseApi.updateProfile({ enablePublic: v });
    ElMessage.success(v ? '已开启对外展示' : '已关闭对外展示');
  } catch (e) {
    item.value.enablePublic = prev;
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function onSingleUpload(uploadFile: UploadFile, field: 'logoUrl' | 'coverImage') {
  const f = uploadFile.raw;
  if (!f) return;
  try {
    const res = await fileApi.upload(f);
    form[field] = res.url;
    ElMessage.success('上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  }
}

function onLogoChange(uploadFile: UploadFile) {
  onSingleUpload(uploadFile, 'logoUrl');
}
function onCoverChange(uploadFile: UploadFile) {
  onSingleUpload(uploadFile, 'coverImage');
}

async function onMultiUpload(uploadFile: UploadFile, field: keyof Pick<FormState, 'coverPhotos' | 'businessLicensePhotos' | 'intellectualPropertyPhotos' | 'qualificationPhotos'>) {
  const f = uploadFile.raw;
  if (!f) return;
  try {
    const res = await fileApi.upload(f);
    form[field].push(res.url);
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  }
}

// 多图编辑内联组件（本页内联，避免额外文件）
const ImgListEditor = defineComponent({
  name: 'ImgListEditor',
  props: { value: { type: Array as () => string[], required: true } },
  emits: ['change'],
  setup(props, { emit }) {
    const uploading = ref(false);
    const onUpload = async (uploadFile: UploadFile) => {
      const f = uploadFile.raw;
      if (!f) return;
      uploading.value = true;
      try {
        const res = await fileApi.upload(f);
        emit('change', [...props.value, res.url]);
      } catch (e) {
        ElMessage.error((e as Error).message || '上传失败');
      } finally {
        uploading.value = false;
      }
    };
    const remove = (i: number) => {
      emit('change', props.value.filter((_, idx) => idx !== i));
    };
    return () =>
      h('div', { class: 'img-list' }, [
        ...props.value.map((url, idx) =>
          h('div', { key: idx, class: 'img-list-item' }, [
            h('img', { src: url, class: 'img-list-img' }),
            h('span', { class: 'img-list-remove', onClick: () => remove(idx) }, '×')
          ])
        ),
        h(
          'div',
          { class: 'img-list-add', onClick: () => {} },
          [
            h(
              'label',
              { class: 'img-list-add-inner' },
              [
                uploading.value ? '上传中...' : '上传',
                h('input', {
                  type: 'file',
                  accept: 'image/*',
                  style: { display: 'none' },
                  onChange: (ev: Event) => {
                    const input = ev.target as HTMLInputElement;
                    const f = input.files?.[0];
                    if (f) onUpload({ raw: f } as UploadFile);
                    input.value = '';
                  }
                })
              ]
            )
          ]
        )
      ]);
  }
});

onMounted(load);
</script>

<style scoped>
.enterprise-page { padding: 16px; min-height: 100%; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.public-switch { display: flex; align-items: center; gap: 8px; margin-right: 4px; }
.switch-label { font-size: 13px; color: #909399; }

.missing-card { margin-bottom: 16px; border-color: #fde68a; background: rgba(254, 243, 199, 0.4); }
.missing-title { font-size: 14px; font-weight: 600; color: #303133; }
.missing-desc { font-size: 13px; color: #909399; margin: 6px 0; }
.missing-list { margin: 0; padding-left: 20px; font-size: 13px; color: #909399; }

.view-card { background: #fff; border: 1px solid #f0f2f5; border-radius: 10px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); }
.view-header { padding: 20px 24px 16px; border-bottom: 1px solid #f0f2f5; }
.view-brand { display: flex; align-items: center; gap: 12px; }
.view-logo { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 1px solid #f0f2f5; background: #fff; }
.view-logo-fallback { display: flex; align-items: center; justify-content: center; background: rgba(64, 158, 255, 0.1); color: #409eff; }
.view-name { font-size: 18px; font-weight: 600; margin: 0; }
.view-badge { font-size: 13px; color: #909399; margin: 4px 0 0; }
.view-body { padding: 20px 24px 24px; }
.view-section { margin-top: 20px; }
.section-label { font-size: 12px; color: #909399; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; margin: 0; font-size: 14px; }
.muted { font-size: 13px; color: #909399; margin: 0; }
.license-group { display: flex; flex-direction: column; gap: 16px; }
.license-label { font-size: 13px; color: #909399; margin-bottom: 8px; }

.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.photo-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; border: 1px solid #f0f2f5; }

.dialog-sub { color: #909399; font-size: 13px; margin: 0 0 12px; }
.edit-form { max-height: 60vh; overflow-y: auto; padding-right: 4px; }
.form-section-title { font-size: 12px; color: #909399; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0; font-weight: 600; }

.img-field { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.img-preview { display: flex; flex-direction: column; gap: 8px; }
.img-preview-img { width: 120px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #ebeef5; }
.img-actions { display: flex; gap: 8px; }
.img-empty { width: 120px; height: 90px; display: flex; align-items: center; justify-content: center; border: 1px dashed #dcdfe6; border-radius: 8px; color: #909399; font-size: 12px; cursor: pointer; }

.img-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
.img-list-item { position: relative; }
.img-list-img { width: 96px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #ebeef5; }
.img-list-remove { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: #f56c6c; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
.img-list-add { width: 96px; height: 72px; border: 1px dashed #dcdfe6; border-radius: 8px; cursor: pointer; }
.img-list-add-inner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #909399; font-size: 12px; cursor: pointer; }

.preview-body { max-height: 70vh; overflow-y: auto; }
.preview-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.preview-logo { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 1px solid #f0f2f5; }
.preview-logo-fallback { display: flex; align-items: center; justify-content: center; background: rgba(64, 158, 255, 0.1); color: #409eff; }
.preview-name { font-size: 20px; font-weight: 700; margin: 0; }
.preview-badge { font-size: 13px; color: #909399; margin: 4px 0 0; }
.preview-desc { margin-bottom: 16px; }
.preview-section { margin-top: 16px; }
.preview-contact { font-size: 14px; color: #606266; margin: 0; }
@media (max-width: 768px) {
  .photo-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
