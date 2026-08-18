<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">
              {{ enterprise?.name || '企业详情' }}
              <el-tag v-if="enterprise" size="small" class="status-tag">{{ allianceLabel('enterpriseStatus', enterprise.status) }}</el-tag>
            </div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/portal/apps/alliance/enterprises')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="notFound" description="企业不存在或未引入" />

      <el-tabs v-else v-model="activeTab">
        <el-tab-pane label="基本信息" name="info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="企业类型">{{ allianceLabel('enterpriseType', enterprise?.enterpriseType) }}</el-descriptions-item>
            <el-descriptions-item label="所属行业">{{ enterprise?.industry || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所在地区">{{ enterprise?.region || '-' }}</el-descriptions-item>
            <el-descriptions-item label="统一社会信用代码">{{ enterprise?.unifiedSocialCreditCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="成立年份">{{ enterprise?.establishedYear || '-' }}</el-descriptions-item>
            <el-descriptions-item label="企业规模">{{ enterprise?.employeeCount ? `${enterprise.employeeCount}人` : '-' }}</el-descriptions-item>
            <el-descriptions-item label="合作评级">{{ allianceLabel('enterpriseRating', enterprise?.rating) }}</el-descriptions-item>
            <el-descriptions-item label="关联二级学院">{{ (enterprise?.secondaryColleges || []).join('、') || '-' }}</el-descriptions-item>
            <el-descriptions-item label="前台展示">{{ enterprise?.isPublic ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ enterprise?.contactPerson || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ enterprise?.contactPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ enterprise?.contactEmail || '-' }}</el-descriptions-item>
            <el-descriptions-item label="地址">{{ enterprise?.address || '-' }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="enterprise?.businessLicensePhotos?.length" class="photo-block">
            <div class="block-title">营业执照</div>
            <div class="photo-grid">
              <el-image v-for="(u, i) in enterprise.businessLicensePhotos" :key="i" :src="u" fit="cover" class="photo-item" />
            </div>
          </div>
          <div v-if="enterprise?.intellectualPropertyPhotos?.length" class="photo-block">
            <div class="block-title">企业知识产权</div>
            <div class="photo-grid">
              <el-image v-for="(u, i) in enterprise.intellectualPropertyPhotos" :key="i" :src="u" fit="cover" class="photo-item" />
            </div>
          </div>
          <div v-if="enterprise?.qualificationPhotos?.length" class="photo-block">
            <div class="block-title">企业荣誉资质</div>
            <div class="photo-grid">
              <el-image v-for="(u, i) in enterprise.qualificationPhotos" :key="i" :src="u" fit="cover" class="photo-item" />
            </div>
          </div>
          <div v-if="enterprise?.description" class="photo-block">
            <div class="block-title">企业简介</div>
            <p class="pre-wrap">{{ enterprise.description }}</p>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`合作协议（${agreements.length}）`" name="agreements">
          <div class="tab-toolbar">
            <el-button size="small" :disabled="availableForLink.length === 0" @click="openAgreementLink">关联已有协议</el-button>
            <el-button size="small" type="primary" @click="router.push(`/portal/apps/alliance/agreements/new?enterpriseId=${id}`)">新增协议</el-button>
          </div>
          <el-table :data="agreements" stripe>
            <el-table-column label="协议名称" min-width="200">
              <template #default="{ row }">
                {{ row.name }}<span v-if="!(row.enterpriseIds || []).includes(id)" class="via-project">（经项目关联）</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="120"><template #default="{ row }">{{ row.type || '-' }}</template></el-table-column>
            <el-table-column label="状态" width="100"><template #default="{ row }">{{ allianceLabel('agreementStatus', row.status) }}</template></el-table-column>
            <el-table-column label="起止日期" width="200"><template #default="{ row }">{{ row.startDate || '-' }} ~ {{ row.endDate || '-' }}</template></el-table-column>
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button v-if="(row.enterpriseIds || []).includes(id)" size="small" text type="danger" @click="unlinkAgreement(row.id)">取消关联</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="agreements.length === 0" description="暂无合作协议，可点击右上角关联或新增" />
        </el-tab-pane>

        <el-tab-pane :label="`合作项目（${projects.length}）`" name="projects">
          <div class="tab-toolbar">
            <el-button size="small" :disabled="allProjects.filter((p) => !(p.enterpriseIds || []).includes(id)).length === 0" @click="openProjectLink">关联已有项目</el-button>
            <el-button size="small" type="primary" @click="router.push(`/portal/apps/alliance/projects/new?enterpriseId=${id}`)">新增项目</el-button>
          </div>
          <el-table :data="projects" stripe>
            <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="阶段" width="120"><template #default="{ row }">{{ allianceLabel('projectPhase', row.phase) }}</template></el-table-column>
            <el-table-column label="开始日期" width="120"><template #default="{ row }">{{ row.startDate || '-' }}</template></el-table-column>
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button size="small" text type="danger" @click="unlinkProject(row.id)">取消关联</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="projects.length === 0" description="暂无合作项目" />
        </el-tab-pane>

        <el-tab-pane :label="`合作成果（${achievements.length}）`" name="achievements">
          <div class="tab-toolbar">
            <el-button size="small" :disabled="allAchievements.filter((a) => !(a.enterpriseIds || []).includes(id)).length === 0" @click="openAchievementLink">关联已有成果</el-button>
            <el-button size="small" type="primary" @click="router.push(`/portal/apps/alliance/achievements/new?enterpriseId=${id}`)">新增成果</el-button>
          </div>
          <el-table :data="achievements" stripe>
            <el-table-column label="成果名称" min-width="200">
              <template #default="{ row }">
                {{ row.title }}<span v-if="!(row.enterpriseIds || []).includes(id)" class="via-project">（经项目关联）</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="120"><template #default="{ row }">{{ allianceLabel('achievementType', row.type) }}</template></el-table-column>
            <el-table-column label="状态" width="100"><template #default="{ row }">{{ allianceLabel('achievementStatus', row.status) }}</template></el-table-column>
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button v-if="(row.enterpriseIds || []).includes(id)" size="small" text type="danger" @click="unlinkAchievement(row.id)">取消关联</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="achievements.length === 0" description="暂无合作成果" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 关联已有协议 -->
    <el-dialog v-model="agreementLinkDialog" title="关联已有协议" width="520px">
      <div class="link-select-list">
        <el-checkbox-group v-model="linkSelected">
          <el-checkbox v-for="a in availableForLink" :key="a.id" :value="a.id" class="link-select-item">
            <span class="link-name">{{ a.name }}</span>
            <span class="link-sub">{{ a.type || '未分类' }} · {{ allianceLabel('agreementStatus', a.status) }}</span>
          </el-checkbox>
        </el-checkbox-group>
        <el-empty v-if="availableForLink.length === 0" description="暂无可关联的协议" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="agreementLinkDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="linkSelected.length === 0" @click="saveAgreementLink">关联 ({{ linkSelected.length }})</el-button>
      </template>
    </el-dialog>

    <!-- 关联已有项目 -->
    <el-dialog v-model="projectLinkDialog" title="关联已有项目" width="520px">
      <div class="link-select-list">
        <el-checkbox-group v-model="projLinkSelected">
          <el-checkbox v-for="p in allProjects.filter((x) => !(x.enterpriseIds || []).includes(id))" :key="p.id" :value="p.id" class="link-select-item">
            <span class="link-name">{{ p.name }}</span>
            <span class="link-sub">{{ allianceLabel('projectPhase', p.phase) }}</span>
          </el-checkbox>
        </el-checkbox-group>
        <el-empty v-if="allProjects.filter((x) => !(x.enterpriseIds || []).includes(id)).length === 0" description="暂无可关联的项目" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="projectLinkDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="projLinkSelected.length === 0" @click="saveProjectLink">关联 ({{ projLinkSelected.length }})</el-button>
      </template>
    </el-dialog>

    <!-- 关联已有成果 -->
    <el-dialog v-model="achievementLinkDialog" title="关联已有成果" width="520px">
      <div class="link-select-list">
        <el-checkbox-group v-model="achLinkSelected">
          <el-checkbox v-for="a in allAchievements.filter((x) => !(x.enterpriseIds || []).includes(id))" :key="a.id" :value="a.id" class="link-select-item">
            <span class="link-name">{{ a.title }}</span>
            <span class="link-sub">{{ allianceLabel('achievementType', a.type) }} · {{ allianceLabel('achievementStatus', a.status) }}</span>
          </el-checkbox>
        </el-checkbox-group>
        <el-empty v-if="allAchievements.filter((x) => !(x.enterpriseIds || []).includes(id)).length === 0" description="暂无可关联的成果" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="achievementLinkDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="achLinkSelected.length === 0" @click="saveAchievementLink">关联 ({{ achLinkSelected.length }})</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { allianceLabel, fetchAllPages } from './alliance-admin';
import type {
  AllianceEnterprise,
  AllianceAgreement,
  AllianceProject,
  AllianceAchievement,
  ListResponse,
} from './alliance-admin';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const id = route.params.id as string;

const enterprise = ref<AllianceEnterprise | null>(null);
const loading = ref(true);
const notFound = ref(false);
const activeTab = ref((route.query.tab as string) || 'info');

const agreements = ref<AllianceAgreement[]>([]);
const projects = ref<AllianceProject[]>([]);
const achievements = ref<AllianceAchievement[]>([]);

const allAgreements = ref<AllianceAgreement[]>([]);
const allProjects = ref<AllianceProject[]>([]);
const allAchievements = ref<AllianceAchievement[]>([]);

const fullAgreements = ref(false);
const fullProjects = ref(false);
const fullAchievements = ref(false);

const agreementLinkDialog = ref(false);
const projectLinkDialog = ref(false);
const achievementLinkDialog = ref(false);
const linkSelected = ref<string[]>([]);
const projLinkSelected = ref<string[]>([]);
const achLinkSelected = ref<string[]>([]);
const saving = ref(false);

const availableForLink = computed(() =>
  allAgreements.value.filter((a) => !(a.enterpriseIds || []).includes(id)),
);

async function loadData() {
  if (!tenantId.value || !id) return;
  loading.value = true;
  notFound.value = false;
  fullAgreements.value = false;
  fullProjects.value = false;
  fullAchievements.value = false;
  try {
    const [ent, agr, proj, ach] = await Promise.all([
      portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
      portalRequest<ListResponse<AllianceAgreement>>('/alliance/agreements?limit=200'),
      portalRequest<ListResponse<AllianceProject>>('/alliance/projects?limit=200'),
      portalRequest<ListResponse<AllianceAchievement>>('/alliance/achievements?limit=200'),
    ]);
    enterprise.value = ent;
    allAgreements.value = agr.items || [];
    allProjects.value = proj.items || [];
    allAchievements.value = ach.items || [];

    const enterpriseProjects = (proj.items || []).filter((p) => (p.enterpriseIds || []).includes(id));
    const projectIds = enterpriseProjects.map((p) => p.id);
    projects.value = enterpriseProjects;
    agreements.value = (agr.items || []).filter(
      (a) => (a.enterpriseIds || []).includes(id) || (a.projectIds || []).some((pid) => projectIds.includes(pid)),
    );
    achievements.value = (ach.items || []).filter(
      (a) => (a.enterpriseIds || []).includes(id) || (a.projectIds || []).some((pid) => projectIds.includes(pid)),
    );
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
    if (!enterprise.value) notFound.value = true;
  }
}

async function ensureFullAgreements() {
  if (fullAgreements.value) return;
  try {
    allAgreements.value = await fetchAllPages<AllianceAgreement>((page, pageSize) =>
      portalRequest<ListResponse<AllianceAgreement>>(
        `/alliance/agreements${buildQuery({ limit: pageSize, offset: page * pageSize })}`,
      ),
    );
    fullAgreements.value = true;
  } catch {
    /* 补全失败保持已有数据 */
  }
}

async function ensureFullProjects() {
  if (fullProjects.value) return;
  try {
    allProjects.value = await fetchAllPages<AllianceProject>((page, pageSize) =>
      portalRequest<ListResponse<AllianceProject>>(
        `/alliance/projects${buildQuery({ limit: pageSize, offset: page * pageSize })}`,
      ),
    );
    fullProjects.value = true;
  } catch {
    /* 补全失败保持已有数据 */
  }
}

async function ensureFullAchievements() {
  if (fullAchievements.value) return;
  try {
    allAchievements.value = await fetchAllPages<AllianceAchievement>((page, pageSize) =>
      portalRequest<ListResponse<AllianceAchievement>>(
        `/alliance/achievements${buildQuery({ limit: pageSize, offset: page * pageSize })}`,
      ),
    );
    fullAchievements.value = true;
  } catch {
    /* 补全失败保持已有数据 */
  }
}

function openAgreementLink() {
  linkSelected.value = [];
  agreementLinkDialog.value = true;
  void ensureFullAgreements();
}
function openProjectLink() {
  projLinkSelected.value = [];
  projectLinkDialog.value = true;
  void ensureFullProjects();
}
function openAchievementLink() {
  achLinkSelected.value = [];
  achievementLinkDialog.value = true;
  void ensureFullAchievements();
}

async function saveAgreementLink() {
  saving.value = true;
  try {
    for (const aid of linkSelected.value) {
      const agreement = allAgreements.value.find((a) => a.id === aid);
      if (!agreement) continue;
      const ids = [...new Set([...(agreement.enterpriseIds || []), id])];
      await portalRequest(`/alliance/agreements/${aid}`, {
        method: 'PUT',
        body: JSON.stringify({ ...agreement, enterpriseIds: ids }),
      });
    }
    ElMessage.success(`已关联 ${linkSelected.value.length} 份协议`);
    agreementLinkDialog.value = false;
    linkSelected.value = [];
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '关联失败');
  } finally {
    saving.value = false;
  }
}

async function unlinkAgreement(aid: string) {
  const agreement = allAgreements.value.find((a) => a.id === aid);
  if (!agreement) return;
  try {
    await portalRequest(`/alliance/agreements/${aid}`, {
      method: 'PUT',
      body: JSON.stringify({ ...agreement, enterpriseIds: (agreement.enterpriseIds || []).filter((x) => x !== id) }),
    });
    ElMessage.success('已取消关联');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function saveProjectLink() {
  saving.value = true;
  try {
    for (const pid of projLinkSelected.value) {
      const project = allProjects.value.find((p) => p.id === pid);
      if (!project) continue;
      await portalRequest(`/alliance/projects/${pid}`, {
        method: 'PUT',
        body: JSON.stringify({ ...project, enterpriseIds: [...new Set([...(project.enterpriseIds || []), id])] }),
      });
    }
    ElMessage.success(`已关联 ${projLinkSelected.value.length} 个项目`);
    projectLinkDialog.value = false;
    projLinkSelected.value = [];
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '关联失败');
  } finally {
    saving.value = false;
  }
}

async function unlinkProject(pid: string) {
  const project = allProjects.value.find((p) => p.id === pid);
  if (!project) return;
  try {
    await portalRequest(`/alliance/projects/${pid}`, {
      method: 'PUT',
      body: JSON.stringify({ ...project, enterpriseIds: (project.enterpriseIds || []).filter((x) => x !== id) }),
    });
    ElMessage.success('已取消关联');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function saveAchievementLink() {
  saving.value = true;
  try {
    for (const achId of achLinkSelected.value) {
      const achievement = allAchievements.value.find((a) => a.id === achId);
      if (!achievement) continue;
      await portalRequest(`/alliance/achievements/${achId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...achievement, enterpriseIds: [...new Set([...(achievement.enterpriseIds || []), id])] }),
      });
    }
    ElMessage.success(`已关联 ${achLinkSelected.value.length} 项成果`);
    achievementLinkDialog.value = false;
    achLinkSelected.value = [];
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '关联失败');
  } finally {
    saving.value = false;
  }
}

async function unlinkAchievement(achId: string) {
  const achievement = allAchievements.value.find((a) => a.id === achId);
  if (!achievement) return;
  try {
    await portalRequest(`/alliance/achievements/${achId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...achievement, enterpriseIds: (achievement.enterpriseIds || []).filter((x) => x !== id) }),
    });
    ElMessage.success('已取消关联');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

onMounted(loadData);
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.header-left { min-width: 0; }
.card-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.status-tag { margin-left: 4px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.photo-block { margin-top: 16px; }
.block-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.photo-item { width: 96px; height: 64px; border-radius: 6px; border: 1px solid #e5e7eb; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; font-size: 13px; }
.tab-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
.via-project { margin-left: 6px; font-size: 12px; color: #909399; }
.link-select-list { max-height: 50vh; overflow-y: auto; }
.link-select-item { display: flex; align-items: center; width: 100%; padding: 6px 0; }
.link-name { font-size: 13px; font-weight: 500; }
.link-sub { font-size: 12px; color: #909399; margin-left: 8px; }
</style>
