<template>
  <div class="detail-page">
    <div v-if="loading" class="loading-wrap">
      <el-skeleton :rows="8" animated />
    </div>

    <el-empty v-else-if="!brand" description="品牌不存在">
      <el-button type="primary" @click="goBack">返回品牌列表</el-button>
    </el-empty>

    <template v-else>
      <div class="detail-head">
        <div>
          <h1 class="detail-title">{{ brand.name }}</h1>
          <p class="detail-sub">{{ brandTypeLabel(brand.brandType) }}</p>
        </div>
        <el-button size="small" @click="goBack">返回</el-button>
      </div>

      <!-- 雇主品牌详情 -->
      <el-tabs v-if="brand.brandType === 'employer'" v-model="employerTab">
        <el-tab-pane label="基本信息" name="info">
          <div class="card">
            <div class="card__head">
              <div class="card__head-left">
                <el-image v-if="enterprise.logoUrl" :src="enterprise.logoUrl" fit="cover" class="enterprise-logo" />
                <div>
                  <p class="enterprise-name">{{ enterprise.name || brand.name }}</p>
                  <p class="enterprise-sub">{{ [enterprise.industry, enterprise.region].filter(Boolean).join(' · ') || '-' }}</p>
                </div>
              </div>
              <div class="card__flags">
                <span>推荐：{{ brand.isFeatured ? '是' : '否' }}</span>
                <span>前台展示：{{ brand.isPublic ? '是' : '否' }}</span>
                <el-button v-if="!brand.enterpriseId" size="small" @click="openEditEnterprise">编辑资料</el-button>
              </div>
            </div>
            <div class="enterprise-body">
              <div class="enterprise-main">
                <div class="card-inner">
                  <h3 class="card-inner__title">企业简介</h3>
                  <p class="prose">{{ enterprise.description || '暂无企业简介' }}</p>
                  <div v-if="enterpriseRows.length" class="info-grid">
                    <div v-for="r in enterpriseRows" :key="r.label" class="info-grid__item">
                      <p class="info-grid__label">{{ r.label }}</p>
                      <p class="info-grid__value">{{ r.value }}</p>
                    </div>
                  </div>
                </div>
                <div v-if="brand.description" class="card-inner">
                  <h3 class="card-inner__title">品牌描述</h3>
                  <p class="prose">{{ brand.description }}</p>
                </div>
              </div>
              <div class="enterprise-side">
                <div class="card-inner">
                  <h3 class="card-inner__title">联系信息</h3>
                  <div class="contact-list">
                    <p v-if="enterprise.contactPerson"><span class="muted">联系人：</span>{{ enterprise.contactPerson }}</p>
                    <p v-if="enterprise.contactPhone"><span class="muted">联系电话：</span>{{ enterprise.contactPhone }}</p>
                    <p v-if="enterprise.contactEmail"><span class="muted">联系邮箱：</span>{{ enterprise.contactEmail }}</p>
                    <p v-if="enterprise.address"><span class="muted">详细地址：</span>{{ enterprise.address }}</p>
                    <p v-if="!enterprise.contactPerson && !enterprise.contactPhone && !enterprise.contactEmail && !enterprise.address" class="muted">
                      暂无联系信息
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div v-for="g in photoGroups" :key="g.label" class="card-inner">
              <h3 class="card-inner__title">{{ g.label }}</h3>
              <div class="photo-grid">
                <el-image v-for="(url, idx) in g.photos" :key="idx" :src="url" fit="cover" class="photo-grid__img" />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`关联岗位（${positions.length}）`" name="positions">
          <div class="card">
            <div class="card__toolbar">
              <el-button size="small" @click="openPositionPicker">引用岗位</el-button>
            </div>
            <el-table :data="positions" style="width: 100%">
              <el-table-column label="岗位名称" min-width="180">
                <template #default="{ row }">{{ row.name }}</template>
              </el-table-column>
              <el-table-column label="分类" width="120">
                <template #default="{ row }">{{ positionTypeLabel(row.positionType) }}</template>
              </el-table-column>
              <el-table-column label="薪资范围" width="120">
                <template #default="{ row }">{{ salaryText(row) }}</template>
              </el-table-column>
              <el-table-column label="面向专业" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">{{ (row.majorNames || []).join('、') || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="100" align="right">
                <template #default="{ row }">
                  <el-button link type="danger" size="small" :disabled="saving" @click="removePosition(row.id)">移除</el-button>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂未关联岗位" :image-size="60" />
              </template>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`已招聘学生（${hiredStudents.length}）`" name="students">
          <div class="card">
            <div class="card__toolbar">
              <el-button size="small" @click="openStudentPicker">关联学生</el-button>
            </div>
            <el-empty v-if="hiredStudents.length === 0" description="暂未关联学生" :image-size="60" />
            <div v-for="group in studentsByJob" :key="group[0]" class="student-group">
              <p class="student-group__job">{{ positionNameOf(group[0]) || '未分配岗位' }}</p>
              <div class="student-list">
                <div v-for="s in group[1]" :key="s.studentId" class="student-row">
                  <div class="student-row__main">
                    <p class="student-row__name">{{ s.name }}</p>
                    <p class="student-row__sub">{{ s.studentNo || '-' }}</p>
                  </div>
                  <el-button link type="danger" size="small" :disabled="saving" @click="removeStudent(s.studentId)">移除</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 专业品牌详情 -->
      <el-tabs v-else-if="brand.brandType === 'major'" v-model="majorTab">
        <el-tab-pane label="专业信息" name="info">
          <div class="card">
            <h3 class="card-inner__title">品牌展示信息</h3>
            <el-form label-width="90px">
              <el-form-item label="品牌名称">
                <el-input v-model="brand.name" />
              </el-form-item>
              <el-form-item label="封面图">
                <ImageUpload v-model="brand.coverImage" />
              </el-form-item>
              <el-form-item label="品牌介绍">
                <el-input v-model="brand.description" type="textarea" :rows="4" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="small" :loading="saving" @click="saveMajorDisplay">保存品牌信息</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
        <el-tab-pane :label="`专业就业方向（${majorData.employmentDirections.length}）`" name="directions">
          <RefSection kind="brands" title="关联岗位品牌作为专业就业方向" empty="暂未关联就业方向" :items="majorData.employmentDirections" placeholder="搜索岗位品牌..." picker-title="选择岗位品牌" @change="(v) => setMajorSection('employmentDirections', v)" />
        </el-tab-pane>
        <el-tab-pane :label="`专业合作企业（${majorData.cooperationEnterprises.length}）`" name="enterprises">
          <RefSection kind="enterprises" title="关联合作企业" empty="暂未关联合作企业" :items="majorData.cooperationEnterprises" placeholder="搜索企业名称..." picker-title="选择合作企业" @change="(v) => setMajorSection('cooperationEnterprises', v)" />
        </el-tab-pane>
        <el-tab-pane :label="`专业合作成果（${majorData.cooperationAchievements.length}）`" name="achievements">
          <RefSection kind="achievements" title="关联合作成果" empty="暂未关联合作成果" :items="majorData.cooperationAchievements" placeholder="搜索成果标题..." picker-title="选择合作成果" @change="(v) => setMajorSection('cooperationAchievements', v)" />
        </el-tab-pane>
        <el-tab-pane :label="`专业特色课程（${majorData.featuredCourses.length}）`" name="courses">
          <RefSection kind="courses" title="关联特色课程" empty="暂未关联特色课程" :items="majorData.featuredCourses" placeholder="搜索课程名称..." picker-title="选择特色课程" @change="(v) => setMajorSection('featuredCourses', v)" />
        </el-tab-pane>
      </el-tabs>

      <!-- 通用品牌详情 -->
      <div v-else class="generic-body">
        <div class="card">
          <h3 class="card-inner__title">品牌信息</h3>
          <div class="info-grid">
            <div class="info-grid__item">
              <p class="info-grid__label">品牌类型</p>
              <p class="info-grid__value">{{ brandTypeLabel(brand.brandType) }}</p>
            </div>
            <div class="info-grid__item">
              <p class="info-grid__label">推荐</p>
              <p class="info-grid__value">{{ brand.isFeatured ? '是' : '否' }}</p>
            </div>
            <div class="info-grid__item">
              <p class="info-grid__label">前台展示</p>
              <p class="info-grid__value">{{ brand.isPublic ? '是' : '否' }}</p>
            </div>
            <div class="info-grid__item">
              <p class="info-grid__label">排序</p>
              <p class="info-grid__value">{{ brand.sortOrder ?? 0 }}</p>
            </div>
          </div>
          <div v-if="relatedRefs.length" class="info-grid" style="margin-top: 16px">
            <div v-for="r in relatedRefs" :key="r.label" class="info-grid__item">
              <p class="info-grid__label">{{ r.label }}</p>
              <p class="info-grid__value">{{ r.value }}</p>
            </div>
          </div>
        </div>
        <div v-if="brand.description" class="card">
          <h3 class="card-inner__title">品牌描述</h3>
          <p class="prose">{{ brand.description }}</p>
        </div>
        <div v-if="hasData" class="card">
          <h3 class="card-inner__title">品牌数据</h3>
          <div class="info-grid">
            <div v-if="brand.brandType === 'teacher' && brand.data?.teacherExpertId" class="info-grid__item">
              <p class="info-grid__label">展示资料档案</p>
              <p class="info-grid__value">{{ brand.data.teacherExpertId }}</p>
            </div>
            <div v-if="brand.brandType === 'employer' && brand.data?.enterpriseInfo" class="info-grid__item">
              <p class="info-grid__label">独立企业资料</p>
              <p class="info-grid__value">已填写，可在编辑弹窗中维护</p>
            </div>
            <div v-if="(brand.brandType === 'job' || brand.brandType === 'major') && Array.isArray(brand.data?.positions)" class="info-grid__item">
              <p class="info-grid__label">岗位/关联数据</p>
              <p class="info-grid__value">{{ brand.data.positions.length }} 项</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 独立雇主企业编辑 -->
    <el-dialog v-model="editEnterpriseOpen" title="编辑独立雇主企业" width="640px">
      <el-form :model="editEnterpriseInfo" label-width="120px">
        <el-form-item label="企业名称" required>
          <el-input v-model="editEnterpriseInfo.name" />
        </el-form-item>
        <el-form-item label="统一社会信用代码">
          <el-input v-model="editEnterpriseInfo.unifiedSocialCreditCode" />
        </el-form-item>
        <el-form-item label="企业类型">
          <el-select v-model="editEnterpriseInfo.enterpriseType" style="width: 100%">
            <el-option label="合作企业" value="cooperation" />
            <el-option label="第三方雇主企业" value="third-party" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属行业">
          <el-input v-model="editEnterpriseInfo.industry" />
        </el-form-item>
        <el-form-item label="所在地区">
          <el-input v-model="editEnterpriseInfo.region" />
        </el-form-item>
        <el-form-item label="成立年份">
          <el-input v-model.number="editEnterpriseInfo.establishedYear" type="number" />
        </el-form-item>
        <el-form-item label="企业规模（人数）">
          <el-input v-model.number="editEnterpriseInfo.employeeCount" type="number" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="editEnterpriseInfo.contactPerson" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="editEnterpriseInfo.contactPhone" />
        </el-form-item>
        <el-form-item label="联系邮箱">
          <el-input v-model="editEnterpriseInfo.contactEmail" />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="editEnterpriseInfo.address" />
        </el-form-item>
        <el-form-item label="企业简介">
          <el-input v-model="editEnterpriseInfo.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editEnterpriseOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEnterprise">保存</el-button>
      </template>
    </el-dialog>

    <!-- 引用岗位 -->
    <el-dialog v-model="positionPickerOpen" title="引用职业岗位库" width="520px">
      <el-input v-model="positionSearch" placeholder="搜索岗位名称..." clearable class="mb-12" />
      <div v-loading="positionPickerLoading" class="picker-list">
        <div v-if="referablePositions.length === 0" class="picker-empty">没有可引用的岗位</div>
        <div
          v-for="p in referablePositions"
          :key="p.id"
          class="picker-item"
          :class="{ 'picker-item--active': isPositionSelected(p.id) }"
          @click="togglePosition(p)"
        >
          <div>
            <p class="picker-item__name">{{ p.name }}</p>
            <p class="picker-item__sub">{{ positionTypeLabel(p.positionType) }} · {{ salaryText(p) }}</p>
          </div>
          <span class="picker-item__check" :class="{ 'picker-item__check--on': isPositionSelected(p.id) }" />
        </div>
      </div>
      <template #footer>
        <el-button @click="positionPickerOpen = false">取消</el-button>
        <el-button type="primary" :disabled="selectedPositions.length === 0" @click="confirmPositions">
          确认关联 ({{ selectedPositions.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 关联学生 -->
    <el-dialog v-model="studentPickerOpen" title="关联学生" width="520px">
      <el-form-item label="雇佣岗位">
        <el-select v-model="studentJobId" placeholder="选择岗位..." style="width: 100%">
          <el-option v-for="p in positions" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
      </el-form-item>
      <el-input v-model="studentSearch" placeholder="搜索学生姓名或学号..." clearable class="mb-12" />
      <div v-loading="studentPickerLoading" class="picker-list">
        <div v-if="referableStudents.length === 0" class="picker-empty">没有可关联的学生</div>
        <div
          v-for="s in referableStudents"
          :key="s.id"
          class="picker-item"
          :class="{ 'picker-item--active': selectedStudents.has(s.id) }"
          @click="toggleStudent(s.id)"
        >
          <div>
            <p class="picker-item__name">{{ s.name }}</p>
            <p class="picker-item__sub">{{ s.studentNo || s.username || s.loginName || '' }}</p>
          </div>
          <span class="picker-item__check" :class="{ 'picker-item__check--on': selectedStudents.has(s.id) }" />
        </div>
      </div>
      <template #footer>
        <el-button @click="studentPickerOpen = false">取消</el-button>
        <el-button type="primary" :disabled="selectedStudents.size === 0 || !studentJobId" @click="confirmStudents">
          确认关联 ({{ selectedStudents.size }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  fetchAllPages,
  brandTypeLabel,
  positionTypeLabel,
  salaryText,
  employerEnterpriseOf,
  normalizeEnterpriseInfo,
  type AllianceBrand,
  type EmployerBrand,
  type EnterpriseInfo,
  type RefItem,
} from './shared';
import ImageUpload from './components/ImageUpload.vue';
import RefSection from './components/RefSection.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = () => (auth.user?.tenantId as string) || '';

const brand = ref<AllianceBrand | null>(null);
const loading = ref(true);
const saving = ref(false);

const employerTab = ref('info');
const majorTab = ref('info');

function goBack() {
  router.push('/portal/apps/alliance/brands');
}

async function load() {
  if (!id || !tenantId()) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    brand.value = (await allianceBrandApi.get(id)) as AllianceBrand;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
    brand.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ==================== 雇主品牌 ====================
const employerBrand = computed(() => brand.value as EmployerBrand | null);
const enterprise = computed(() => employerEnterpriseOf(employerBrand.value));
const positions = computed<any[]>(() => (brand.value?.data?.positions as any[]) ?? []);
const hiredStudents = computed<any[]>(() => (brand.value?.data?.hiredStudents as any[]) ?? []);

const isIndependent = computed(() => !!brand.value && !brand.value.enterpriseId);

const enterpriseRows = computed(() => {
  const e = enterprise.value;
  const info = normalizeEnterpriseInfo(brand.value?.data?.enterpriseInfo) as Record<string, any>;
  const rows: { label: string; value: string | number }[] = [
    { label: '企业名称', value: e.name ?? '' },
    ...(isIndependent.value ? [{ label: '企业类型', value: enterpriseTypeText(info.enterpriseType) }] : []),
    { label: '统一社会信用代码', value: e.creditCode ?? '' },
    { label: '所属行业', value: e.industry ?? '' },
    { label: '所在地区', value: e.region ?? '' },
    { label: '成立年份', value: e.establishedYear ?? '' },
    { label: '企业规模（人数）', value: e.employeeCount ?? '' },
    { label: '联系人', value: e.contactPerson ?? '' },
    { label: '联系电话', value: e.contactPhone ?? '' },
    { label: '联系邮箱', value: e.contactEmail ?? '' },
    { label: '企业地址', value: e.address ?? '' },
  ];
  return rows.filter((r) => r.value != null && r.value !== '' && r.value !== '-');
});

function enterpriseTypeText(v?: string): string {
  if (v === 'cooperation') return '合作企业';
  if (v === 'third-party' || v === 'platform') return '第三方雇主企业';
  return v || '-';
}

const photoGroups = computed(() => {
  const e = enterprise.value as Record<string, any>;
  return [
    { label: '营业执照', photos: (e.businessLicensePhotos ?? []) as string[] },
    { label: '知识产权', photos: (e.intellectualPropertyPhotos ?? []) as string[] },
    { label: '企业荣誉资质', photos: (e.qualificationPhotos ?? []) as string[] },
    { label: '企业展示封面', photos: (e.coverPhotos ?? []) as string[] },
  ].filter((g) => g.photos.length > 0);
});

const studentsByJob = computed<[string, any[]][]>(() => {
  const map = new Map<string, any[]>();
  for (const s of hiredStudents.value) {
    const key = s.jobId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()];
});

function positionNameOf(jobId: string) {
  return positions.value.find((p) => p.id === jobId)?.name;
}

async function saveData(nextPositions: any[], nextStudents: any[]) {
  if (!brand.value) return;
  saving.value = true;
  try {
    await allianceBrandApi.update(brand.value.id, {
      data: { ...(brand.value.data || {}), positions: nextPositions, hiredStudents: nextStudents },
    } as any);
    brand.value = {
      ...brand.value,
      data: { ...(brand.value.data || {}), positions: nextPositions, hiredStudents: nextStudents },
    };
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function removePosition(pid: string) {
  const nextPositions = positions.value.filter((p) => p.id !== pid);
  const nextStudents = hiredStudents.value.filter((s) => s.jobId !== pid);
  await saveData(nextPositions, nextStudents);
}

async function removeStudent(studentId: string) {
  await saveData(
    positions.value,
    hiredStudents.value.filter((s) => s.studentId !== studentId),
  );
}

// 独立雇主企业编辑
const editEnterpriseOpen = ref(false);
const editEnterpriseInfo = ref<EnterpriseInfo>({});

function openEditEnterprise() {
  editEnterpriseInfo.value = normalizeEnterpriseInfo(brand.value?.data?.enterpriseInfo);
  editEnterpriseOpen.value = true;
}

async function saveEnterprise() {
  if (!brand.value) return;
  if (!editEnterpriseInfo.value.name?.trim()) {
    ElMessage.warning('企业名称不能为空');
    return;
  }
  saving.value = true;
  try {
    await allianceBrandApi.update(brand.value.id, {
      name: editEnterpriseInfo.value.name,
      data: { ...(brand.value.data || {}), enterpriseInfo: editEnterpriseInfo.value },
    } as any);
    ElMessage.success('企业资料已更新');
    editEnterpriseOpen.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

// 引用岗位
const positionPickerOpen = ref(false);
const positionSearch = ref('');
const positionPickerLoading = ref(false);
const selectedPositions = ref<any[]>([]);
const positionOptions = ref<any[]>([]);

const referablePositions = computed(() => {
  const existing = new Set(positions.value.map((p) => p.id));
  const list = positionOptions.value.filter((p) => !existing.has(p.id));
  const kw = positionSearch.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((p) => p.name.toLowerCase().includes(kw));
});

function isPositionSelected(id: string) {
  return selectedPositions.value.some((x) => x.id === id);
}

function togglePosition(p: any) {
  selectedPositions.value = isPositionSelected(p.id)
    ? selectedPositions.value.filter((x) => x.id !== p.id)
    : [...selectedPositions.value, p];
}

async function openPositionPicker() {
  positionPickerOpen.value = true;
  positionSearch.value = '';
  selectedPositions.value = [];
  positionPickerLoading.value = true;
  try {
    positionOptions.value = await fetchAllPages<any>((page, pageSize) =>
      portalRequest<{ items: any[] }>(
        `/job/positions?positionType=teaching&limit=${pageSize}&offset=${page * pageSize}`,
      ),
    );
  } catch {
    positionOptions.value = [];
  } finally {
    positionPickerLoading.value = false;
  }
}

async function confirmPositions() {
  const snaps = selectedPositions.value.map((p) => ({
    id: p.id,
    name: p.name,
    positionType: p.positionType,
    salaryMin: p.salaryMin,
    salaryMax: p.salaryMax,
    majorNames: p.majorNames,
  }));
  const next = [
    ...positions.value,
    ...snaps.filter((s: any) => !positions.value.some((x) => x.id === s.id)),
  ];
  await saveData(next, hiredStudents.value);
  ElMessage.success(`已关联 ${snaps.length} 个岗位`);
  positionPickerOpen.value = false;
}

// 关联学生
const studentPickerOpen = ref(false);
const studentSearch = ref('');
const studentPickerLoading = ref(false);
const studentJobId = ref('');
const selectedStudents = ref<Set<string>>(new Set());
const studentOptions = ref<any[]>([]);

const referableStudents = computed(() => {
  const existing = new Set(hiredStudents.value.map((s) => s.studentId));
  const list = studentOptions.value.filter((s) => !existing.has(s.id));
  const kw = studentSearch.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(kw) ||
      (s.studentNo || s.username || s.loginName || '').toLowerCase().includes(kw),
  );
});

function toggleStudent(id: string) {
  const next = new Set(selectedStudents.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedStudents.value = next;
}

async function openStudentPicker() {
  studentPickerOpen.value = true;
  studentSearch.value = '';
  studentJobId.value = '';
  selectedStudents.value = new Set();
  studentPickerLoading.value = true;
  try {
    studentOptions.value = await fetchAllPages<any>((page, pageSize) =>
      portalRequest<{ items: any[] }>(
        `/users?role=student&limit=${pageSize}&offset=${page * pageSize}`,
      ),
    );
  } catch {
    studentOptions.value = [];
  } finally {
    studentPickerLoading.value = false;
  }
}

async function confirmStudents() {
  const job = positions.value.find((p) => p.id === studentJobId.value);
  const items = studentOptions.value
    .filter((s) => selectedStudents.value.has(s.id))
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      studentNo: s.studentNo || s.username || s.loginName || '',
      jobId: studentJobId.value,
      jobName: job?.name,
    }));
  if (items.length === 0) return;
  const next = [
    ...hiredStudents.value,
    ...items.filter((s: any) => !hiredStudents.value.some((x) => x.studentId === s.studentId)),
  ];
  await saveData(positions.value, next);
  ElMessage.success(`已关联 ${items.length} 名学生`);
  studentPickerOpen.value = false;
}

// ==================== 专业品牌 ====================
const majorData = computed(() => {
  const d = brand.value?.data ?? {};
  return {
    employmentDirections: (d.employmentDirections ?? []) as RefItem[],
    cooperationEnterprises: (d.cooperationEnterprises ?? []) as RefItem[],
    cooperationAchievements: (d.cooperationAchievements ?? []) as RefItem[],
    featuredCourses: (d.featuredCourses ?? []) as RefItem[],
  };
});

async function setMajorSection(key: 'employmentDirections' | 'cooperationEnterprises' | 'cooperationAchievements' | 'featuredCourses', items: RefItem[]) {
  if (!brand.value) return;
  saving.value = true;
  try {
    const next = { ...(brand.value.data || {}), [key]: items };
    await allianceBrandApi.update(brand.value.id, { data: next } as any);
    brand.value = { ...brand.value, data: next };
    ElMessage.success('已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function saveMajorDisplay() {
  if (!brand.value) return;
  saving.value = true;
  try {
    await allianceBrandApi.update(brand.value.id, {
      name: brand.value.name,
      coverImage: brand.value.coverImage,
      description: brand.value.description,
    } as any);
    ElMessage.success('已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

// ==================== 通用品牌 ====================
const relatedRefs = computed(() => {
  const b = brand.value;
  if (!b) return [];
  return [
    { label: '关联学生', value: b.studentId },
    { label: '关联企业', value: b.enterpriseId },
    { label: '关联岗位', value: b.positionId },
    { label: '关联专业', value: b.majorId },
    { label: '关联教师', value: b.teacherId },
    { label: '关联专家', value: b.expertId },
  ].filter((x) => x.value);
});

const hasData = computed(() => {
  const d = brand.value?.data;
  return d && JSON.stringify(d) !== '{}';
});
</script>

<style scoped>
.detail-page {
  min-height: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.loading-wrap {
  padding: 24px;
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.detail-title {
  font-size: 22px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.detail-sub {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  padding: 20px;
}
.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.card__head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card__flags {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}
.enterprise-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.enterprise-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}
.enterprise-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
.enterprise-body {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
.enterprise-main,
.enterprise-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-inner {
  border-top: 1px solid #f1f5f9;
  padding-top: 16px;
  margin-top: 16px;
}
.card-inner__title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 12px;
}
.prose {
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
  margin: 0;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.info-grid__item {
  min-width: 0;
}
.info-grid__label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #94a3b8;
}
.info-grid__value {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  word-break: break-all;
}
.contact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: #334155;
}
.muted {
  color: #94a3b8;
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.photo-grid__img {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.card__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.student-group {
  margin-bottom: 16px;
}
.student-group__job {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 8px;
}
.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.student-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 10px 14px;
}
.student-row__name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
}
.student-row__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
.generic-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #cbd5e1;
  flex-shrink: 0;
}
.picker-item__check--on {
  border-color: #409eff;
  background: #409eff;
}
.mb-12 {
  margin-bottom: 12px;
}
@media (max-width: 992px) {
  .enterprise-body {
    grid-template-columns: 1fr;
  }
  .info-grid,
  .photo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
