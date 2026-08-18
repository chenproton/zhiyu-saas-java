<template>
  <div class="teacher-section">
    <div class="teacher-section__head">
      <div>
        <h2 class="section-title">{{ mode === 'school' ? '校本师资管理' : '企业专家师资管理' }}</h2>
        <p class="section-desc">
          {{
            mode === 'school'
              ? '从系统教师库关联教师，可补充师资展示资料（资料不足时编辑补充）'
              : '从企业专家库关联专家（只读展示，不可编辑专家信息）'
          }}
        </p>
      </div>
      <el-button type="primary" size="small" @click="openPicker">
        <el-icon class="mr-4"><User /></el-icon>
        {{ mode === 'school' ? '关联校本教师' : '关联企业专家' }}
      </el-button>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="items" style="width: 100%">
        <el-table-column label="姓名" min-width="140">
          <template #default="{ row }">
            <span class="cell-strong">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="120" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic" @change="(v: boolean | string | number) => toggle(row, 'isPublic', Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="推荐" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.isFeatured" @change="(v: boolean | string | number) => toggle(row, 'isFeatured', Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="140">
          <template #default="{ row }">
            <span class="cell-muted">
              {{ mode === 'school' ? `关联教师：${row.name}` : `关联专家：${row.name}` }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button v-if="mode === 'school'" link type="primary" size="small" @click="openProfileEdit(row)">
              编辑资料
            </el-button>
            <el-button link type="danger" size="small" @click="askRemove(row)">解除关联</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂未关联师资，点击右上角按钮关联" :image-size="60" />
        </template>
      </el-table>
    </div>

    <!-- 关联师资选择弹窗 -->
    <el-dialog v-model="pickerOpen" :title="mode === 'school' ? '关联校本教师' : '关联企业专家'" width="520px">
      <p class="dialog-tip">选择后关联到师资品牌（只读展示）</p>
      <el-input v-model="search" :placeholder="mode === 'school' ? '搜索教师姓名或工号...' : '搜索专家姓名或机构...'" clearable class="mb-12" />
      <div v-loading="optionsLoading" class="picker-list">
        <div v-if="referable.length === 0" class="picker-empty">没有可选人员</div>
        <div
          v-for="o in referable"
          :key="o.id"
          class="picker-item"
          :class="{ 'picker-item--active': isSelected(o.id) }"
          @click="toggleSelect(o)"
        >
          <div class="picker-item__main">
            <p class="picker-item__name">{{ o.name }}</p>
            <p class="picker-item__sub">{{ [o.title, o.department, o.position].filter(Boolean).join(' · ') || '-' }}</p>
          </div>
          <span class="picker-item__check" :class="{ 'picker-item__check--on': isSelected(o.id) }" />
        </div>
      </div>
      <template #footer>
        <el-button @click="pickerOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="selected.length === 0" @click="confirm">
          确认关联 ({{ selected.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 校本师资展示资料补充 -->
    <el-dialog v-if="mode === 'school'" v-model="profileOpen" title="编辑师资资料" width="640px">
      <p class="dialog-tip">补充教师展示资料（职称/专长/简介等），前台师资品牌与详情页展示</p>
      <div v-loading="profileLoading">
        <el-form v-if="profileForm" :model="profileForm" label-width="90px">
          <el-form-item label="姓名" required>
            <el-input v-model="profileForm.name" />
          </el-form-item>
          <el-form-item label="职称">
            <el-input v-model="profileForm.title" />
          </el-form-item>
          <el-form-item label="职位">
            <el-input v-model="profileForm.position" />
          </el-form-item>
          <el-form-item label="归属机构">
            <el-input v-model="profileForm.organization" />
          </el-form-item>
          <el-form-item label="行业">
            <el-input v-model="profileForm.industry" />
          </el-form-item>
          <el-form-item label="从业年限">
            <el-input v-model.number="profileForm.experienceYears" type="number" />
          </el-form-item>
          <el-form-item label="学历">
            <el-input v-model="profileForm.education" />
          </el-form-item>
          <el-form-item label="头像">
            <ImageUpload v-model="profileForm.avatarUrl" />
          </el-form-item>
          <el-form-item label="个人简介">
            <el-input v-model="profileForm.introduction" type="textarea" :rows="4" />
          </el-form-item>
        </el-form>
        <p v-else class="picker-empty">加载失败</p>
      </div>
      <template #footer>
        <el-button @click="profileOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveProfile">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { User } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { AllianceBrand } from '../shared';
import ImageUpload from './ImageUpload.vue';

const props = defineProps<{
  mode: 'school' | 'expert';
  items: AllianceBrand[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const brandType = 'teacher';
const auth = useAuthStore();
const tenantId = () => (auth.user?.tenantId as string) || '';

interface TeacherOption {
  id: string;
  name: string;
  title?: string;
  department?: string;
  position?: string;
  organization?: string;
}

const pickerOpen = ref(false);
const search = ref('');
const selected = ref<TeacherOption[]>([]);
const submitting = ref(false);
const options = ref<TeacherOption[]>([]);
const optionsLoading = ref(false);

const existingIds = computed(() => {
  const ids = new Set<string>();
  for (const b of props.items) {
    if (b.teacherId) ids.add(b.teacherId);
    if (b.expertId) ids.add(b.expertId);
  }
  return ids;
});

const referable = computed(() => {
  const list = options.value.filter((o) => !existingIds.value.has(o.id));
  const kw = search.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter(
    (o) =>
      o.name.toLowerCase().includes(kw) ||
      (o.title || '').toLowerCase().includes(kw) ||
      (o.department || '').toLowerCase().includes(kw) ||
      (o.position || '').toLowerCase().includes(kw),
  );
});

function isSelected(id: string) {
  return selected.value.some((x) => x.id === id);
}

function toggleSelect(o: TeacherOption) {
  selected.value = isSelected(o.id)
    ? selected.value.filter((x) => x.id !== o.id)
    : [...selected.value, o];
}

async function openPicker() {
  pickerOpen.value = true;
  search.value = '';
  selected.value = [];
  optionsLoading.value = true;
  try {
    if (props.mode === 'school') {
      const res = await portalRequest<{ items: TeacherOption[] }>('/users?role=teacher&limit=200');
      options.value = res.items || [];
    } else {
      const res = await portalRequest<{ items: any[] }>('/alliance/experts?limit=200');
      options.value = (res.items || []).map((e) => ({
        id: e.id,
        name: e.name,
        title: e.title || e.position,
        position: e.organization,
      }));
    }
  } catch {
    options.value = [];
  } finally {
    optionsLoading.value = false;
  }
}

async function confirm() {
  if (selected.value.length === 0) return;
  submitting.value = true;
  try {
    const linkField = props.mode === 'school' ? 'teacherId' : 'expertId';
    for (const o of selected.value) {
      const payload: any = { brandType, name: o.name, isPublic: false };
      payload[linkField] = o.id;
      await allianceBrandApi.create(payload);
    }
    ElMessage.success(`已关联 ${selected.value.length} 人`);
    pickerOpen.value = false;
    emit('saved');
  } catch (e) {
    ElMessage.error((e as Error).message || '关联失败');
  } finally {
    submitting.value = false;
  }
}

async function toggle(item: AllianceBrand, field: 'isPublic' | 'isFeatured', value: boolean) {
  try {
    await allianceBrandApi.update(item.id, { [field]: value } as any);
    ElMessage.success('已更新');
    emit('saved');
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  }
}

async function remove(item: AllianceBrand) {
  try {
    const expertId = (item.data as any)?.teacherExpertId;
    if (expertId) {
      try {
        await portalRequest(`/alliance/experts/${expertId}`, { method: 'DELETE' });
      } catch (e) {
        ElMessage.error((e as Error).message || '解除关联失败');
        return;
      }
    }
    await allianceBrandApi.delete(item.id);
    ElMessage.success('已解除关联');
    emit('saved');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function askRemove(item: AllianceBrand) {
  const extra = item.teacherId ? '（校本师资的展示资料档案将一并删除）' : '';
  try {
    await ElMessageBox.confirm(`确定要解除「${item.name}」的师资品牌关联吗？${extra}`, '确认解除关联', {
      confirmButtonText: '解除关联',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await remove(item);
}

// ── 校本师资展示资料补充 ─────────────────────
const profileOpen = ref(false);
const profileLoading = ref(false);
const profileTarget = ref<AllianceBrand | null>(null);
const profileForm = ref<Record<string, any> | null>(null);

function emptyProfile() {
  return {
    name: '',
    title: '',
    position: '',
    organization: '',
    industry: '',
    experienceYears: undefined,
    education: '',
    introduction: '',
    avatarUrl: '',
  };
}

async function openProfileEdit(brand: AllianceBrand) {
  profileTarget.value = brand;
  profileForm.value = null;
  profileOpen.value = true;
  profileLoading.value = true;
  try {
    const expertId = (brand.data as any)?.teacherExpertId;
    if (expertId) {
      const expert = await portalRequest<any>(`/alliance/experts/${expertId}`).catch(() => null);
      if (expert) {
        profileForm.value = {
          name: expert.name || '',
          title: expert.title || '',
          position: expert.position || '',
          organization: expert.organization || '',
          industry: expert.industry || '',
          experienceYears: expert.experienceYears,
          education: expert.education || '',
          introduction: expert.introduction || '',
          avatarUrl: expert.avatarUrl || '',
        };
        return;
      }
    }
    const teacherId = brand.teacherId;
    const teacher = teacherId
      ? await portalRequest<any>(`/users/${teacherId}`).catch(() => null)
      : null;
    profileForm.value = {
      ...emptyProfile(),
      name: brand.name || teacher?.name || '',
      avatarUrl: teacher?.avatarUrl || '',
    };
  } catch {
    profileForm.value = emptyProfile();
  } finally {
    profileLoading.value = false;
  }
}

async function saveProfile() {
  if (!profileTarget.value || !profileForm.value) return;
  if (!profileForm.value.name?.trim()) {
    ElMessage.warning('姓名不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload: any = {
      ...profileForm.value,
      userId: profileTarget.value.teacherId,
    };
    const existingId = (profileTarget.value.data as any)?.teacherExpertId;
    if (existingId) {
      await portalRequest(`/alliance/experts/${existingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      ElMessage.success('师资资料已更新');
    } else {
      const expert = await portalRequest<any>('/alliance/experts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      try {
        await allianceBrandApi.update(profileTarget.value.id, {
          data: { ...(profileTarget.value.data || {}), teacherExpertId: expert.id },
        } as any);
      } catch (err) {
        await portalRequest(`/alliance/experts/${expert.id}`, { method: 'DELETE' }).catch(() => null);
        throw err;
      }
      ElMessage.success('师资资料已创建');
    }
    profileOpen.value = false;
    profileForm.value = null;
    emit('saved');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.teacher-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.section-title {
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.section-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.mr-4 {
  margin-right: 4px;
}
.mb-12 {
  margin-bottom: 12px;
}
.table-card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.cell-strong {
  font-weight: 500;
}
.cell-muted {
  color: #94a3b8;
  font-size: 12px;
}
.dialog-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #64748b;
}
.picker-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.picker-empty {
  padding: 32px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
}
.picker-item--active {
  border-color: #409eff;
  background: #f5f9ff;
}
.picker-item__name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
}
.picker-item__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
.picker-item__check {
  width: 16px;
  height: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  flex-shrink: 0;
}
.picker-item__check--on {
  border-color: #409eff;
  background: #409eff;
}
</style>
