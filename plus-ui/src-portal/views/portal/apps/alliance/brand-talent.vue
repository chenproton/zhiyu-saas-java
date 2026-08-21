<template>
  <div class="talent-page">
    <el-tabs v-model="activeTab" class="talent-tabs">
      <el-tab-pane label="人才画像排名" name="ranking">
        <div class="ranking-head">
          <div>
            <h1 class="page-title">人才画像排名</h1>
            <p class="page-desc">基于岗位能力认证结果的学生综合排名</p>
          </div>
          <div class="ranking-actions">
            <el-input v-model="searchInput" placeholder="搜索学生姓名或学号..." clearable class="ranking-search" @keyup.enter="applySearch" />
            <el-button size="small" @click="applySearch">搜索</el-button>
            <el-button size="small" @click="openConfig">专业排名启用管理</el-button>
          </div>
        </div>

        <div v-loading="rankingLoading" class="ranking-body">
          <el-empty v-if="!rankingLoading && enabledGroups.length === 0" description="暂无启用展示的专业" :image-size="80" />
          <template v-else>
            <el-tabs v-if="currentMajor" v-model="activeMajor" class="major-tabs">
              <el-tab-pane v-for="g in enabledGroups" :key="g.majorId" :name="g.majorId" :label="g.majorName || '未分配专业'" />
            </el-tabs>
            <p v-if="currentMajor" class="ranking-range">
              展示范围：前 {{ currentMajor.rankLimit }} 名 · 当前显示 {{ rankedStudents.length }} 人
            </p>
            <div v-if="currentMajor" class="table-card">
              <el-table :data="rankedStudents" style="width: 100%" row-key="studentId" @sort-change="onSortChange">
                <el-table-column label="排名" width="80" align="center">
                  <template #default="{ row }">
                    <span class="rank-medal" :class="rankClass(row.rank)">{{ row.rank }}</span>
                  </template>
                </el-table-column>
                <el-table-column type="expand" width="40">
                  <template #default="{ row }">
                    <div class="position-detail">
                      <p v-if="(row.positions || []).length === 0" class="position-detail__empty">
                        暂无岗位评估明细，展开排名指标为空的学生无评估记录
                      </p>
                      <template v-else>
                        <p class="position-detail__hint">该学生 {{ (row.positions || []).length }} 个岗位的评估明细（排名指标为各岗位平均）</p>
                        <el-table :data="row.positions" size="small" style="width: 100%">
                          <el-table-column label="岗位名称" min-width="160">
                            <template #default="{ row: p }">{{ p.positionName || '-' }}</template>
                          </el-table-column>
                          <el-table-column label="岗位能力达成率" width="140">
                            <template #default="{ row: p }">{{ fmtValue(p.achievementRate, '%') }}</template>
                          </el-table-column>
                          <el-table-column label="岗位胜任度" width="120">
                            <template #default="{ row: p }">{{ fmtValue(p.positionCompetency, '%') }}</template>
                          </el-table-column>
                          <el-table-column label="岗位胜任度（新）" width="150">
                            <template #default="{ row: p }">{{ fmtValue(p.positionCompetencyV2, '%') }}</template>
                          </el-table-column>
                          <el-table-column label="能力认证得分" width="130">
                            <template #default="{ row: p }">{{ fmtValue(p.abilityCognitionScore) }}</template>
                          </el-table-column>
                          <el-table-column label="能力点达成" width="120">
                            <template #default="{ row: p }">{{ p.achievedAbilityPoints }}/{{ p.totalAbilityPoints }}</template>
                          </el-table-column>
                          <el-table-column label="评级" width="100">
                            <template #default="{ row: p }">{{ p.grade || '-' }}</template>
                          </el-table-column>
                          <el-table-column label="评估时间" width="130">
                            <template #default="{ row: p }">{{ formatDate(p.evaluatedAt) }}</template>
                          </el-table-column>
                        </el-table>
                      </template>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="姓名" min-width="120">
                  <template #default="{ row }">{{ row.name }}</template>
                </el-table-column>
                <el-table-column label="学号" min-width="130">
                  <template #default="{ row }">{{ row.studentNo }}</template>
                </el-table-column>
                <el-table-column label="专业" min-width="120">
                  <template #default="{ row }">{{ row.majorName }}</template>
                </el-table-column>
                <el-table-column label="班级" min-width="120">
                  <template #default="{ row }">{{ row.className }}</template>
                </el-table-column>
                <el-table-column label="院系" min-width="140">
                  <template #default="{ row }">{{ row.departmentName }}</template>
                </el-table-column>
                <el-table-column label="岗位能力达成率" prop="avgAchievementRate" width="140" sortable="custom">
                  <template #default="{ row }">{{ fmtValue(row.avgAchievementRate, '%') }}</template>
                </el-table-column>
                <el-table-column label="岗位胜任度" prop="avgPositionCompetency" width="120" sortable="custom">
                  <template #default="{ row }">{{ fmtValue(row.avgPositionCompetency, '%') }}</template>
                </el-table-column>
                <el-table-column label="岗位胜任度（新）" prop="avgPositionCompetencyV2" width="150" sortable="custom">
                  <template #default="{ row }">{{ fmtValue(row.avgPositionCompetencyV2, '%') }}</template>
                </el-table-column>
                <el-table-column label="能力认证得分" prop="avgAbilityCognitionScore" width="130" sortable="custom">
                  <template #default="{ row }">{{ fmtValue(row.avgAbilityCognitionScore) }}</template>
                </el-table-column>
                <el-table-column label="评估岗位数" prop="positionCount" width="110" sortable="custom">
                  <template #default="{ row }">{{ row.positionCount || '-' }}</template>
                </el-table-column>
                <template #empty>
                  <el-empty description="暂无学生数据" :image-size="60" />
                </template>
              </el-table>
            </div>
          </template>
        </div>

        <!-- 专业排名启用管理 -->
        <el-dialog v-model="configOpen" title="专业排名启用管理" width="560px">
          <div v-loading="configLoading" class="config-list">
            <el-empty v-if="!configLoading && configMajors.length === 0" description="暂无专业数据" :image-size="60" />
            <div v-for="major in configMajors" :key="major.id" class="config-row">
              <p class="config-row__name">{{ major.name }}</p>
              <div class="config-row__right">
                <el-input-number
                  :model-value="configOf(major.id).rankLimit"
                  :min="1"
                  :max="100"
                  size="small"
                  :disabled="!configOf(major.id).enabled"
                  @update:model-value="(v: number | undefined) => setRankLimit(major.id, v)"
                />
                <span class="config-row__hint">前 N 名</span>
                <el-switch :model-value="configOf(major.id).enabled" @change="(v: boolean | string | number) => setEnabled(major.id, Boolean(v))" />
              </div>
            </div>
          </div>
          <template #footer>
            <el-button @click="configOpen = false">取消</el-button>
            <el-button type="primary" :loading="configSaving" @click="saveConfigs">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane label="就业案例" name="cases">
        <div class="page-head">
          <div>
            <h1 class="page-title">人才品牌管理</h1>
            <p class="page-desc">管理学生能力画像排名与典型就业案例</p>
          </div>
          <div class="head-actions">
            <BatchImport brand-type="talent" entity-label="就业案例" @success="loadCases" />
            <el-button type="primary" size="small" @click="openCreate">
              <el-icon class="mr-4"><Plus /></el-icon>
              新建就业案例
            </el-button>
          </div>
        </div>

        <div class="toolbar">
          <el-input v-model="caseSearch" placeholder="搜索品牌名称..." clearable class="toolbar__search" @input="onCaseSearch" @clear="onCaseSearch" />
        </div>

        <div class="table-card">
          <el-table v-loading="casesLoading" :data="cases" style="width: 100%">
            <el-table-column label="名称" min-width="200">
              <template #default="{ row }">
                <span class="cell-strong">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="前台展示" width="120" align="center">
              <template #default="{ row }">
                <el-switch :model-value="row.isPublic" @change="(v: boolean | string | number) => toggleField(row, 'isPublic', Boolean(v))" />
              </template>
            </el-table-column>
            <el-table-column label="推荐" width="100" align="center">
              <template #default="{ row }">
                <el-switch :model-value="row.isFeatured" @change="(v: boolean | string | number) => toggleField(row, 'isFeatured', Boolean(v))" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
                <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无人才品牌数据" :image-size="60" />
            </template>
          </el-table>
        </div>

        <div class="pager">
          <span class="pager__total">共 {{ caseTotal }} 条记录</span>
          <el-pagination
            v-model:current-page="casePage"
            :page-size="pageSize"
            :total="caseTotal"
            layout="prev, pager, next"
            @current-change="loadCases"
          />
        </div>

        <el-dialog v-model="dialogOpen" :title="caseForm.id ? '编辑就业案例' : '新建就业案例'" width="520px">
          <el-form :model="caseForm" label-width="90px">
            <el-form-item label="案例名称" required>
              <el-input v-model="caseForm.name" placeholder="案例名称" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="caseForm.description" type="textarea" :rows="4" />
            </el-form-item>
            <el-form-item label="封面图">
              <ImageUpload v-model="caseForm.coverImage" />
            </el-form-item>
            <el-form-item label="关联学生">
              <el-input v-model="caseForm.studentId" placeholder="学生 ID（可选）" />
            </el-form-item>
            <el-form-item label="关联专业">
              <el-input v-model="caseForm.majorId" placeholder="专业 ID（可选）" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="dialogOpen = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type {
  AllianceBrand,
  BrandMajorRankConfig,
  MajorOption,
  TalentRankMajorGroup,
  TalentRankStudent,
} from './shared';
import BatchImport from './components/BatchImport.vue';
import ImageUpload from './components/ImageUpload.vue';

const brandType = 'talent';

const auth = useAuthStore();
const router = useRouter();
const tenantId = () => (auth.user?.tenantId as string) || '';

const activeTab = ref('ranking');

// ==================== 人才画像排名 ====================
type SortKey =
  | 'avgAchievementRate'
  | 'avgPositionCompetency'
  | 'avgPositionCompetencyV2'
  | 'avgAbilityCognitionScore'
  | 'positionCount';

const searchInput = ref('');
const search = ref('');
const activeMajor = ref('');
const sortKey = ref<SortKey>('avgAchievementRate');
const sortDir = ref<'asc' | 'desc'>('desc');
const rankingLoading = ref(false);
const groups = ref<TalentRankMajorGroup[]>([]);

const enabledGroups = computed(() => groups.value.filter((g) => g.enabled));
const currentMajor = computed(
  () => enabledGroups.value.find((g) => g.majorId === activeMajor.value) ?? enabledGroups.value[0] ?? null,
);

const rankedStudents = computed<TalentRankStudent[]>(() => {
  if (!currentMajor.value) return [];
  const sorted = [...currentMajor.value.students].sort((a, b) => {
    const av = (a as any)[sortKey.value] ?? (sortKey.value === 'positionCount' ? 0 : -Infinity);
    const bv = (b as any)[sortKey.value] ?? (sortKey.value === 'positionCount' ? 0 : -Infinity);
    const diff = av - bv;
    return sortDir.value === 'desc'
      ? -diff || a.name.localeCompare(b.name)
      : diff || a.name.localeCompare(b.name);
  });
  return sorted.slice(0, currentMajor.value.rankLimit).map((s, idx) => ({ ...s, rank: idx + 1 }));
});

function fmtValue(v?: number, unit?: string) {
  if (v === undefined || v === null) return '-';
  return `${v.toFixed(1)}${unit ?? ''}`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rankClass(rank: number) {
  return rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n';
}

function applySearch() {
  search.value = searchInput.value.trim();
  loadRanking();
}

async function loadRanking() {
  if (!tenantId()) return;
  rankingLoading.value = true;
  try {
    const qs = search.value ? `?search=${encodeURIComponent(search.value)}` : '';
    const data = await portalRequest<{ items: TalentRankMajorGroup[] }>(
      `/alliance/brands/talent-ranking${qs}`,
    );
    groups.value = data.items || [];
    if (!enabledGroups.value.some((g) => g.majorId === activeMajor.value)) {
      activeMajor.value = enabledGroups.value[0]?.majorId ?? '';
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    rankingLoading.value = false;
  }
}

function onSortChange(e: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!e.order) return;
  const keyMap: Record<string, SortKey> = {
    avgAchievementRate: 'avgAchievementRate',
    avgPositionCompetency: 'avgPositionCompetency',
    avgPositionCompetencyV2: 'avgPositionCompetencyV2',
    avgAbilityCognitionScore: 'avgAbilityCognitionScore',
    positionCount: 'positionCount',
  };
  const key = keyMap[e.prop];
  if (key) {
    sortKey.value = key;
    sortDir.value = e.order === 'descending' ? 'desc' : 'asc';
  }
}

// 排名启用配置
const configOpen = ref(false);
const configLoading = ref(false);
const configSaving = ref(false);
const configMajors = ref<MajorOption[]>([]);
const configs = ref<Record<string, BrandMajorRankConfig>>({});

function configOf(majorId: string): BrandMajorRankConfig {
  return configs.value[majorId] ?? { majorId, enabled: true, rankLimit: 10 };
}

function setRankLimit(majorId: string, v: number | undefined) {
  const cfg = configOf(majorId);
  configs.value = { ...configs.value, [majorId]: { ...cfg, rankLimit: v || 10 } };
}

function setEnabled(majorId: string, v: boolean) {
  const cfg = configOf(majorId);
  configs.value = { ...configs.value, [majorId]: { ...cfg, enabled: v } };
}

async function openConfig() {
  configOpen.value = true;
  configLoading.value = true;
  try {
    const [majorsRes, configRes] = await Promise.all([
      portalRequest<{ items: MajorOption[] }>('/majors?limit=200'),
      portalRequest<{ items: BrandMajorRankConfig[] }>('/alliance/brands/rank-configs'),
    ]);
    configMajors.value = majorsRes.items || [];
    const cfgMap: Record<string, BrandMajorRankConfig> = {};
    for (const c of configRes.items || []) cfgMap[c.majorId] = c;
    configs.value = cfgMap;
  } catch {
    configMajors.value = [];
    configs.value = {};
  } finally {
    configLoading.value = false;
  }
}

async function saveConfigs() {
  configSaving.value = true;
  try {
    await portalRequest('/alliance/brands/rank-configs', {
      method: 'PUT',
      body: JSON.stringify({ configs: Object.values(configs.value) }),
    });
    ElMessage.success('专业排名配置已保存');
    configOpen.value = false;
    await loadRanking();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    configSaving.value = false;
  }
}

// ==================== 就业案例 ====================
interface CaseForm {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  studentId: string;
  majorId: string;
}

const cases = ref<AllianceBrand[]>([]);
const caseTotal = ref(0);
const casesLoading = ref(false);
const casePage = ref(1);
const pageSize = 20;
const caseSearch = ref('');
const dialogOpen = ref(false);
const saving = ref(false);
const caseForm = ref<CaseForm>(emptyCaseForm());

function emptyCaseForm(): CaseForm {
  return { id: '', name: '', description: '', coverImage: '', studentId: '', majorId: '' };
}

async function loadCases() {
  if (!tenantId()) return;
  casesLoading.value = true;
  try {
    const data = await allianceBrandApi.list({
      brandType,
      page: casePage.value,
      limit: pageSize,
      search: caseSearch.value.trim() || undefined,
    });
    cases.value = (data.items || []) as AllianceBrand[];
    caseTotal.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    casesLoading.value = false;
  }
}

function onCaseSearch() {
  casePage.value = 1;
  loadCases();
}

async function toggleField(item: AllianceBrand, field: 'isPublic' | 'isFeatured', value: boolean) {
  try {
    await allianceBrandApi.update(item.id, { [field]: value } as any);
    ElMessage.success('已更新');
    await loadCases();
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  }
}

function viewDetail(item: AllianceBrand) {
  router.push(`/portal/apps/alliance/brands/${item.id}`);
}

function openCreate() {
  caseForm.value = emptyCaseForm();
  dialogOpen.value = true;
}

function openEdit(item: AllianceBrand) {
  caseForm.value = {
    id: item.id,
    name: item.name || '',
    description: item.description || '',
    coverImage: item.coverImage || '',
    studentId: item.studentId || '',
    majorId: item.majorId || '',
  };
  dialogOpen.value = true;
}

async function save() {
  if (!caseForm.value.name.trim()) {
    ElMessage.warning('案例名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload: any = {
      brandType,
      name: caseForm.value.name,
      description: caseForm.value.description,
      coverImage: caseForm.value.coverImage,
      studentId: caseForm.value.studentId || undefined,
      majorId: caseForm.value.majorId || undefined,
    };
    if (caseForm.value.id) {
      await allianceBrandApi.update(caseForm.value.id, payload);
    } else {
      await allianceBrandApi.create(payload);
    }
    ElMessage.success(caseForm.value.id ? '品牌已更新' : '品牌已创建');
    dialogOpen.value = false;
    await loadCases();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(item: AllianceBrand) {
  try {
    await ElMessageBox.confirm(`确定要删除品牌「${item.name}」吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await allianceBrandApi.delete(item.id);
    ElMessage.success('品牌已删除');
    await loadCases();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(() => {
  loadRanking();
  loadCases();
});
</script>

<style scoped>
.talent-page {
  min-height: 100%;
}
.talent-tabs {
  width: 100%;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.page-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.ranking-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.ranking-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ranking-search {
  width: 240px;
}
.ranking-body {
  min-height: 120px;
}
.ranking-range {
  margin: 0 0 12px;
  font-size: 12px;
  color: #94a3b8;
}
.major-tabs {
  margin-bottom: 4px;
}
.table-card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.rank-medal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}
.rank-1 {
  background: #fef3c7;
  color: #b45309;
}
.rank-2 {
  background: #e2e8f0;
  color: #475569;
}
.rank-3 {
  background: #ffedd5;
  color: #ea580c;
}
.rank-n {
  background: #f1f5f9;
  color: #64748b;
}
.position-detail {
  padding: 8px 16px;
}
.position-detail__hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #94a3b8;
}
.position-detail__empty {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}
.config-list {
  max-height: 55vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  padding: 10px 16px;
}
.config-row__name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.config-row__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.config-row__hint {
  font-size: 12px;
  color: #94a3b8;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mr-4 {
  margin-right: 4px;
}
.toolbar {
  margin-bottom: 16px;
}
.toolbar__search {
  max-width: 360px;
}
.cell-strong {
  font-weight: 500;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.pager__total {
  font-size: 13px;
  color: #64748b;
}
</style>
