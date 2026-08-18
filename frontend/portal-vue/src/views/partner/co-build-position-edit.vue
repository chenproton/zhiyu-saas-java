<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ isNew ? '新建共建岗位' : '编辑共建岗位' }}</div>
            <div class="card-sub">保存后状态回写为草稿，发布由学校端进行（含学校授权资源）。</div>
          </div>
          <div class="header-actions">
            <el-tag v-if="position" :type="statusTagType(meta.status)">{{ contentStatusLabel(meta.status) }}</el-tag>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" :disabled="!detailsLoaded" @click="onSave">
              {{ saving ? '保存中...' : '保存' }}
            </el-button>
            <el-button type="success" :loading="saving" :disabled="!detailsLoaded" @click="onFinish">
              {{ saving ? '保存中...' : '完成配置' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" v-loading="loading">
        <!-- 步骤 1：基本信息（含工作职责 / 任职要求 / 发展路径 / 相关证书） -->
        <el-tab-pane label="基本信息" name="basic">
          <div class="basic-layout">
            <div class="basic-main">
              <el-form :model="form" label-width="90px" class="basic-form">
                <el-form-item label="名称" required>
                  <el-input v-model="form.name" placeholder="例如：Java 后端开发工程师" />
                </el-form-item>
                <el-form-item label="简称">
                  <el-input v-model="form.shortName" placeholder="例如：Java开发" />
                </el-form-item>
                <el-form-item label="岗位类型">
                  <el-select v-model="form.positionType" style="width: 200px">
                    <el-option label="企业岗位" value="enterprise" />
                    <el-option label="教学岗位" value="teaching" />
                  </el-select>
                </el-form-item>
                <el-form-item label="薪资范围">
                  <div class="salary-row">
                    <el-input-number v-model="form.salaryMin" :min="0" :controls="false" placeholder="最低" />
                    <span class="sep">-</span>
                    <el-input-number v-model="form.salaryMax" :min="0" :controls="false" placeholder="最高" />
                    <span class="sep">元/月</span>
                  </div>
                </el-form-item>
                <el-form-item label="岗位简介">
                  <el-input v-model="form.description" type="textarea" :rows="4" placeholder="描述该岗位的主要工作内容和特点..." />
                </el-form-item>
              </el-form>

              <!-- 工作职责 -->
              <div class="block-card">
                <div class="block-title">工作职责</div>
                <div class="block-body">
                  <div v-for="(r, i) in responsibilities" :key="r.id" class="row-item">
                    <span class="row-index">{{ i + 1 }}</span>
                    <el-input v-model="r.name" placeholder="输入职责名称..." @keydown.enter.prevent="addResponsibility" />
                    <el-button link type="danger" @click="removeResponsibility(r.id)">删除</el-button>
                  </div>
                  <el-button class="add-btn" link type="primary" @click="addResponsibility">+ 添加工作职责</el-button>
                </div>
              </div>

              <!-- 任职要求 -->
              <div class="block-card">
                <div class="block-title">任职要求</div>
                <div class="block-body">
                  <div v-for="(req, i) in requirements" :key="`req-${i}`" class="row-item">
                    <span class="row-index">{{ i + 1 }}</span>
                    <el-input v-model="requirements[i]" placeholder="输入任职要求..." @keydown.enter.prevent="addRequirement" />
                    <el-button link type="danger" @click="removeRequirement(i)">删除</el-button>
                  </div>
                  <el-button class="add-btn" link type="primary" @click="addRequirement">+ 添加任职要求</el-button>
                </div>
              </div>

              <!-- 发展路径 -->
              <div class="block-card">
                <div class="block-title">发展路径</div>
                <div class="block-body">
                  <el-input v-model="form.careerPath" type="textarea" :rows="4" placeholder="请描述该岗位的职业发展路径，如横向发展和纵向晋升方向..." />
                </div>
              </div>

              <!-- 相关证书（仅展示 / 移除，无 partner 证书库端点） -->
              <div class="block-card">
                <div class="block-title">相关证书</div>
                <div class="block-body">
                  <el-empty v-if="certificates.length === 0" description="暂无相关证书" :image-size="64" />
                  <div v-else class="cert-grid">
                    <div v-for="c in certificates" :key="c.id" class="cert-item">
                      <div class="cert-head">
                        <span class="cert-name">{{ c.name }}</span>
                        <el-button link type="danger" size="small" @click="removeCert(c.id)">移除</el-button>
                      </div>
                      <a v-if="c.url" class="cert-url" :href="c.url" target="_blank" rel="noopener noreferrer">{{ c.url }}</a>
                      <div v-if="c.description" class="cert-desc">{{ c.description }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="side-card">
              <div class="side-block">
                <div class="side-label">岗位封面</div>
                <div class="cover-uploader">
                  <div v-if="form.coverImage" class="cover-preview">
                    <img :src="form.coverImage" alt="岗位封面" />
                    <el-button size="small" type="danger" :loading="coverUploading" @click="form.coverImage = ''">移除</el-button>
                  </div>
                  <div v-else class="cover-placeholder" @click="triggerFile">
                    {{ coverUploading ? '上传中...' : '点击上传封面' }}
                  </div>
                  <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFileChange" />
                </div>
              </div>

              <div class="side-block">
                <div class="side-label">当前状态</div>
                <div class="side-value"><el-tag :type="statusTagType(meta.status)" size="small">{{ contentStatusLabel(meta.status) }}</el-tag></div>
              </div>

              <div class="side-block">
                <div class="side-label">合作学校</div>
                <div class="side-value">{{ meta.schoolName || '-' }}</div>
              </div>

              <div class="side-block">
                <div class="side-label">创建人</div>
                <div class="side-value">{{ meta.createdByName || '当前用户' }}</div>
              </div>

              <div class="side-block">
                <div class="side-label">共建人</div>
                <div class="collab-picker">
                  <div class="collab-tags">
                    <el-tag v-for="id in collaborators" :key="id" closable @close="toggleCollaborator(id)" size="small">
                      {{ coBuilderName(id) }}
                    </el-tag>
                    <span v-if="collaborators.length === 0" class="side-value dim">点击选择共建人</span>
                  </div>
                  <el-button size="small" @click="openCollabDialog">选择</el-button>
                </div>
              </div>

              <div class="side-block">
                <div class="side-label">当前版本号</div>
                <div class="side-value">{{ form.version }}</div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 步骤 2：能力建模（职责 → 能力绑定） -->
        <el-tab-pane label="能力建模" name="ability">
          <div class="ability-layout">
            <div class="ability-sidebar">
              <div class="ability-sidebar-head">
                <span class="side-label">工作职责</span>
                <span class="side-sub">{{ responsibilities.length }} 项职责，{{ bindings.length }} 个能力点</span>
                <el-button size="small" type="primary" @click="openBatchRespDialog">添加</el-button>
              </div>
              <div class="ability-sidebar-list">
                <el-empty v-if="responsibilities.length === 0" description="暂无工作职责" :image-size="48" />
                <div
                  v-for="r in responsibilities"
                  :key="r.id"
                  class="resp-item"
                  :class="{ active: r.id === selectedRespId }"
                  @click="selectedRespId = r.id"
                >
                  <span class="resp-dot" :style="{ background: respColor(r.id) }"></span>
                  <span class="resp-name">{{ r.name || '未命名职责' }}</span>
                  <span class="resp-count">{{ bindingCount(r.id) }}</span>
                  <el-button link type="danger" size="small" @click.stop="removeResponsibility(r.id)">删除</el-button>
                </div>
              </div>
            </div>

            <div class="ability-content">
              <div class="ability-content-head">
                <span class="side-label">能力点列表</span>
                <span class="side-sub">共 {{ selectedRespBindings.length }} 个能力点</span>
                <div class="flex-1"></div>
                <el-button size="small" @click="openAbilityPool">从能力点库添加</el-button>
                <el-button size="small" type="primary" @click="openCreateAbility">新建能力点</el-button>
              </div>

              <el-empty
                v-if="responsibilities.length === 0"
                description="暂无工作职责和能力点，请先在左侧添加工作职责"
                :image-size="80"
              />
              <el-empty
                v-else-if="selectedRespBindings.length === 0"
                description="暂无能力点，点击上方按钮添加"
                :image-size="80"
              />
              <div v-else class="binding-grid">
                <div v-for="b in selectedRespBindings" :key="b.id" class="binding-card">
                  <div class="binding-head">
                    <span class="binding-name">{{ b.name }}</span>
                    <el-button link type="danger" size="small" @click="removeBinding(b.id)">移除</el-button>
                  </div>
                  <div class="binding-level">
                    <span class="binding-label">掌握程度</span>
                    <el-radio-group v-model="b.level" size="small">
                      <el-radio-button v-for="lv in COMPETENCY_LEVELS" :key="lv.value" :value="lv.value">
                        {{ lv.label }}
                      </el-radio-button>
                    </el-radio-group>
                  </div>
                  <el-input
                    v-model="b.rubricDescription"
                    type="textarea"
                    :rows="2"
                    placeholder="胜任标准描述..."
                    class="binding-rubric"
                  />
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 步骤 3：能力模型汇总 -->
        <el-tab-pane label="能力模型汇总" name="competency">
          <div class="summary-stats">
            <div class="stat-card">
              <div class="stat-label">工作职责</div>
              <div class="stat-value">{{ responsibilities.length }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">能力点</div>
              <div class="stat-value">{{ bindings.length }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">能力域</div>
              <div class="stat-value">{{ domainCount }}</div>
            </div>
          </div>

          <el-empty v-if="bindings.length === 0" description="暂无能力点数据，请返回步骤二进行拆解" :image-size="80" />
          <el-table v-else :data="domainGroupedRows" border class="summary-table">
            <el-table-column label="所属能力领域" width="150">
              <template #default="{ row, $index }">
                <el-tag v-if="row.isFirst" type="info" effect="plain" size="small">{{ row.domainLabel }}</el-tag>
                <span v-else></span>
                <span v-if="row.isFirst === undefined && $index === 0"></span>
              </template>
            </el-table-column>
            <el-table-column label="能力点名称" min-width="150">
              <template #default="{ row }">{{ row.name }}</template>
            </el-table-column>
            <el-table-column label="能力属性" width="140">
              <template #default="{ row }">{{ (row.attributes || []).join('、') || '-' }}</template>
            </el-table-column>
            <el-table-column label="能力领域" width="180">
              <template #default="{ row }">
                <el-select v-model="row.domain" placeholder="选择领域" clearable size="small" style="width: 100%">
                  <el-option v-for="d in ABILITY_DOMAINS" :key="d.value" :label="d.value" :value="d.value">
                    <span>{{ d.value }}（{{ d.hint }}）</span>
                  </el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="掌握程度" width="120">
              <template #default="{ row }">
                <el-select v-model="row.level" size="small" style="width: 100%">
                  <el-option v-for="lv in COMPETENCY_LEVELS" :key="lv.value" :label="lv.label" :value="lv.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="胜任标准描述" min-width="200">
              <template #default="{ row }">
                <el-input v-model="row.rubricDescription" placeholder="请输入胜任标准描述..." size="small" />
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 批量添加工作职责弹窗 -->
    <el-dialog v-model="batchRespDialog" title="添加工作职责" width="480px">
      <div class="batch-resp-list">
        <div v-for="(name, i) in newRespNames" :key="i" class="row-item">
          <el-input v-model="newRespNames[i]" placeholder="工作职责 {{ i + 1 }}" @keydown.enter.prevent="addRespRow" />
          <el-button link type="danger" :disabled="newRespNames.length === 1" @click="removeRespRow(i)">删除</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchRespDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!newRespNames.some((n) => n.trim())" @click="confirmAddResponsibilities">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 能力点库弹窗（学校能力只读） -->
    <el-dialog v-model="abilityPoolDialog" title="从能力点库添加" width="760px" top="6vh">
      <div class="pool-filters">
        <el-input v-model="abilityPoolSearch" placeholder="输入名称搜索能力点..." clearable style="width: 260px" />
        <div class="pool-attrs">
          <el-check-tag
            v-for="attr in ABILITY_ATTRIBUTES"
            :key="attr"
            :checked="abilityPoolFilterAttr === attr"
            @change="abilityPoolFilterAttr = abilityPoolFilterAttr === attr ? null : attr"
          >
            {{ attr }}
          </el-check-tag>
        </div>
      </div>
      <el-empty v-if="filteredPoolAbilities.length === 0" description="暂无匹配的能力点" :image-size="72" />
      <el-table v-else :data="filteredPoolAbilities" height="420" border>
        <el-table-column label="能力点名称" min-width="160">
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="能力点编码" width="120">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column label="能力属性" min-width="160">
          <template #default="{ row }">
            <el-tag v-for="attr in row.attributes" :key="attr" size="small" effect="plain" class="attr-tag">{{ attr }}</el-tag>
            <span v-if="(row.attributes || []).length === 0">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="isPoolAbilityAdded(row.id)" type="success" size="small" effect="plain">已添加</el-tag>
            <el-button v-else size="small" type="primary" @click="addFromPool(row)">添加</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button type="primary" @click="abilityPoolDialog = false">完成</el-button>
      </template>
    </el-dialog>

    <!-- 新建能力点弹窗 -->
    <el-dialog v-model="createAbilityDialog" title="新建能力点" width="480px">
      <template v-if="duplicateAbility">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>
            公共能力点库中已存在「{{ duplicateAbility }}」，建议直接从库中引用，无需重复创建。
          </template>
        </el-alert>
      </template>
      <template v-else>
        <el-form label-width="90px">
          <el-form-item label="能力点名称" required>
            <el-input v-model="newAbilityName" placeholder="例如：微服务架构设计" />
          </el-form-item>
          <el-form-item label="能力属性">
            <div class="pool-attrs">
              <el-check-tag
                v-for="attr in ABILITY_ATTRIBUTES"
                :key="attr"
                :checked="newAbilityAttributes.includes(attr)"
                @change="toggleNewAbilityAttr(attr)"
              >
                {{ attr }}
              </el-check-tag>
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <template v-if="duplicateAbility">
          <el-button @click="cancelDuplicate">取消</el-button>
          <el-button type="primary" @click="addExistingFromPool">从库中引用</el-button>
          <el-button @click="duplicateAbility = null">仍要新建</el-button>
        </template>
        <template v-else>
          <el-button @click="createAbilityDialog = false">取消</el-button>
          <el-button type="primary" :disabled="!newAbilityName.trim() || !selectedRespId" @click="createCustomAbility">
            创建并关联
          </el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 共建人选择弹窗 -->
    <el-dialog v-model="collabDialog" title="选择共建人" width="480px">
      <div class="collab-dialog-desc">可从合作学校的教师与企业专家中选择，共同维护该岗位。</div>
      <el-input v-model="collabSearch" placeholder="搜索姓名..." clearable style="margin-bottom: 12px" />
      <div class="collab-dialog-list">
        <div v-if="!coBuilders.length" class="dim">暂无符合条件的共建人</div>
        <template v-else>
          <template v-for="group in collabGroups" :key="group.key">
            <div v-if="group.items.length" class="collab-group">
              <div class="collab-group-title">{{ group.title }}</div>
              <div v-for="o in group.items" :key="o.id" class="collab-option" @click="toggleCollaborator(o.id)">
                <el-checkbox :model-value="collaborators.includes(o.id)" @click.stop />
                <span>{{ o.name }}</span>
                <span v-if="o.enterpriseName" class="dim">{{ o.enterpriseName }}</span>
              </div>
            </div>
          </template>
        </template>
      </div>
      <template #footer>
        <el-button type="primary" @click="collabDialog = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerRequest, authedFetch } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { partnerCobuildPositionApi } from '@/api/partner';
import type { CoBuildPosition } from '@/types/partner';
import type {
  PositionResponsibility,
  PositionCertificate,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain
} from '@/types/job';
import { contentStatusLabel } from '@/types/content-status';

// ===== 本地数据模型（对齐 React job-source 编辑态视图） =====
type CompetencyLevel = 'understand' | 'comprehend' | 'master' | 'proficient' | 'expert';

interface LocalResp {
  id: string;
  name: string;
  description: string;
}

interface LocalCert {
  id: string;
  libraryId?: string;
  name: string;
  url?: string;
  description?: string;
  image?: string;
}

interface LocalBinding {
  id: string;
  responsibilityId: string;
  source: 'public' | 'custom';
  publicAbilityId?: string;
  abilityPointId?: string;
  name: string;
  level: CompetencyLevel;
  rubricDescription: string;
  description?: string;
  attributes?: string[];
  domain?: string;
}

interface LocalDomain {
  id: string;
  name: string;
  description?: string;
  bindingIds: string[];
}

interface CoBuildUserOption {
  id: string;
  name: string;
  group: 'teacher' | 'expert';
  title?: string;
  expertId?: string;
  enterpriseName?: string;
}

// ===== 常量（对齐 React） =====
const COMPETENCY_LEVELS: { value: CompetencyLevel; label: string; description: string }[] = [
  { value: 'understand', label: '了解', description: '了解基本概念，能在指导下完成简单任务' },
  { value: 'comprehend', label: '理解', description: '理解原理和方法，能独立完成基本任务' },
  { value: 'master', label: '掌握', description: '能独立完成常规任务，处理一般问题' },
  { value: 'proficient', label: '熟练', description: '能处理复杂任务，指导他人，优化流程' },
  { value: 'expert', label: '精通', description: '行业专家水平，能创新和引领发展方向' }
];

const ABILITY_ATTRIBUTES = ['知识', '素养', '技能'];

const ABILITY_DOMAINS: { value: string; hint: string }[] = [
  { value: '岗位与行业认知', hint: '如行业常识、岗位职责、发展趋势类能力点' },
  { value: '专业知识', hint: '如专业理论、概念、原理、标准、规范、法规等知识类能力点' },
  { value: '专业技能', hint: '如实操、工具使用、业务处理、专项操作类能力点' },
  { value: '通用能力', hint: '如沟通、协作、思维、学习、执行、管理等通用综合能力点' },
  { value: '职业素养/价值观', hint: '价值观、责任心、敬业度、职业操守等素养类能力点' }
];

// ===== 以下端点 Vue api/partner.ts 尚未收录，按 React /partner/co-build/* 路径直连（禁止改 api/*.ts） =====
function saveFull(id: string, req: Record<string, unknown>) {
  return partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}/save-full`, {
    method: 'POST',
    body: JSON.stringify(req)
  });
}
function listResponsibilities(id: string) {
  return partnerRequest<ListResponse<PositionResponsibility>>(`/partner/co-build/positions/${id}/responsibilities`);
}
function listCertificates(id: string) {
  return partnerRequest<ListResponse<PositionCertificate>>(`/partner/co-build/positions/${id}/certificates`);
}
function listAbilityBindings(id: string) {
  return partnerRequest<ListResponse<PositionAbilityBinding>>(`/partner/co-build/positions/${id}/ability-bindings`);
}
function listAbilityDomains(id: string) {
  return partnerRequest<ListResponse<AbilityDomain>>(`/partner/co-build/positions/${id}/ability-domains`);
}
function schoolAbilities(tenantId: string) {
  return partnerRequest<ListResponse<AbilityPoint>>(`/partner/co-build/schools/${tenantId}/abilities`);
}
function schoolCoBuilders(tenantId: string) {
  return partnerRequest<ListResponse<CoBuildUserOption>>(`/partner/co-build/schools/${tenantId}/co-builders`);
}
async function uploadCover(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await authedFetch('/files/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';
const hasSaved = ref(false);

const loading = ref(false);
const detailsLoading = ref(false);
const detailsLoaded = ref(false);
const saving = ref(false);
const coverUploading = ref(false);
const activeTab = ref('basic');
const fileInput = ref<HTMLInputElement | null>(null);

const position = ref<CoBuildPosition | null>(null);

const form = reactive({
  name: '',
  shortName: '',
  positionType: 'enterprise' as CoBuildPosition['positionType'],
  salaryMin: undefined as number | undefined,
  salaryMax: undefined as number | undefined,
  description: '',
  careerPath: '',
  version: '1.0',
  coverImage: ''
});

const meta = reactive({
  schoolTenantId: '',
  schoolName: '',
  status: 'draft',
  createdByName: ''
});

const collaborators = ref<string[]>([]);
const requirements = ref<string[]>(['']);
const responsibilities = ref<LocalResp[]>([]);
const certificates = ref<LocalCert[]>([]);
const bindings = ref<LocalBinding[]>([]);
const abilityDomains = ref<LocalDomain[]>([]);
const abilities = ref<AbilityPoint[]>([]);
const coBuilders = ref<CoBuildUserOption[]>([]);

// 能力建模选中职责
const selectedRespId = ref<string | null>(null);

// 批量添加职责弹窗
const batchRespDialog = ref(false);
const newRespNames = ref<string[]>(['']);

// 能力点库弹窗
const abilityPoolDialog = ref(false);
const abilityPoolSearch = ref('');
const abilityPoolFilterAttr = ref<string | null>(null);

// 新建能力点弹窗
const createAbilityDialog = ref(false);
const newAbilityName = ref('');
const newAbilityAttributes = ref<string[]>([]);
const duplicateAbility = ref<string | null>(null);

// 共建人弹窗
const collabDialog = ref(false);
const collabSearch = ref('');

function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published' || s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'info';
}

function respColor(respId: string): string {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#fb923c', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < respId.length; i++) {
    hash = respId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function bindingCount(respId: string): number {
  return bindings.value.filter((b) => b.responsibilityId === respId).length;
}

const selectedRespBindings = computed(() => bindings.value.filter((b) => b.responsibilityId === selectedRespId.value));

const filteredPoolAbilities = computed(() => {
  const q = abilityPoolSearch.value.trim().toLowerCase();
  return abilities.value.filter((a) => {
    if (q && !a.name.toLowerCase().includes(q)) return false;
    if (abilityPoolFilterAttr.value && !(a.attributes || []).includes(abilityPoolFilterAttr.value)) return false;
    return true;
  });
});

const domainCount = computed(() => {
  const set = new Set(bindings.value.map((b) => b.domain).filter(Boolean) as string[]);
  return set.size + (bindings.value.some((b) => !b.domain) ? 1 : 0);
});

// 步骤 3 按能力域分组的行（用于合并单元格展示）
interface SummaryRow {
  key: string;
  domainLabel: string;
  isFirst: boolean;
  domain: string;
  name: string;
  attributes: string[];
  level: CompetencyLevel;
  rubricDescription: string;
}
const domainGroupedRows = computed<SummaryRow[]>(() => {
  const rows: SummaryRow[] = [];
  const groups = new Map<string, LocalBinding[]>();
  for (const b of bindings.value) {
    const key = b.domain || '未分类';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  for (const [key, group] of groups) {
    group.forEach((b, idx) => {
      rows.push({
        key: `${key}-${b.id}`,
        domainLabel: key,
        isFirst: idx === 0,
        domain: b.domain || '',
        name: b.name,
        attributes: b.attributes || [],
        level: b.level,
        rubricDescription: b.rubricDescription
      });
    });
  }
  return rows;
});

const collabGroups = computed(() => {
  const q = collabSearch.value.trim().toLowerCase();
  const filtered = q ? coBuilders.value.filter((o) => o.name.toLowerCase().includes(q)) : coBuilders.value;
  return [
    { key: 'teacher', title: '学校教师', items: filtered.filter((o) => o.group === 'teacher') },
    { key: 'expert', title: '企业专家', items: filtered.filter((o) => o.group === 'expert') }
  ];
});

function coBuilderName(id: string): string {
  return coBuilders.value.find((u) => u.id === id)?.name || id;
}

async function loadAll() {
  loading.value = true;
  try {
    const pos = await partnerCobuildPositionApi.get(id);
    position.value = pos;
    form.name = pos.name || '';
    form.shortName = pos.shortName || '';
    form.positionType = pos.positionType || 'enterprise';
    form.salaryMin = pos.salaryMin;
    form.salaryMax = pos.salaryMax;
    form.description = pos.description || '';
    form.careerPath = pos.careerPath || '';
    form.version = pos.version || '1.0';
    form.coverImage = pos.coverImage || '';
    meta.schoolTenantId = pos.schoolTenantId || '';
    meta.schoolName = pos.schoolName || '';
    meta.status = pos.status || 'draft';
    meta.createdByName = pos.createdByName || '';
    collaborators.value = (pos.collaborators || []).filter((c) => c !== pos.createdBy);
    requirements.value = pos.requirements || [];
    await loadDetails();
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadDetails() {
  detailsLoading.value = true;
  try {
    const [respRes, certRes, bindingRes, domainRes] = await Promise.all([
      listResponsibilities(id),
      listCertificates(id),
      listAbilityBindings(id),
      listAbilityDomains(id)
    ]);

    if (meta.schoolTenantId) {
      const [abilityRes, coBuilderRes] = await Promise.all([
        schoolAbilities(meta.schoolTenantId),
        schoolCoBuilders(meta.schoolTenantId)
      ]);
      abilities.value = abilityRes.items || [];
      coBuilders.value = coBuilderRes.items || [];
    }

    // 转换到本地编辑态视图（对齐 React job-converters）
    const abilityMap = new Map((abilities.value || []).map((a) => [a.id, a]));
    responsibilities.value = (respRes.items || []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? ''
    }));
    certificates.value = (certRes.items || []).map((c) => ({
      id: c.id,
      libraryId: c.certificateLibraryId,
      name: c.name,
      url: c.url ?? '',
      description: c.description ?? '',
      image: c.imageUrl ?? ''
    }));
    bindings.value = (bindingRes.items || []).map((b) => {
      const local: LocalBinding = {
        id: b.id,
        responsibilityId: b.responsibilityId,
        source: b.source as 'public' | 'custom',
        publicAbilityId: b.source === 'public' ? b.abilityPointId : undefined,
        abilityPointId: b.abilityPointId,
        name: b.abilityName || '',
        level: (b.requiredLevel as CompetencyLevel) || 'understand',
        rubricDescription: b.rubricDescription ?? '',
        description: b.rubricDescription ?? '',
        attributes: b.attributes || [],
        domain: b.domain ?? ''
      };
      const ability = abilityMap.get(b.abilityPointId);
      if (ability) {
        if (!local.name) local.name = ability.name;
        if (!local.description) local.description = ability.description ?? '';
      }
      return local;
    });
    abilityDomains.value = (domainRes.items || []).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description ?? '',
      bindingIds: d.bindingIds || []
    }));

    // 空默认值：刷新后不覆盖已保存数据（对齐 React）
    if (responsibilities.value.length === 0) {
      responsibilities.value = [{ id: `resp-${Date.now()}`, name: '', description: '' }];
    }
    if (requirements.value.length === 0) {
      requirements.value = [''];
    }
    if (responsibilities.value.length > 0) {
      selectedRespId.value = responsibilities.value[0].id;
    }
    detailsLoaded.value = true;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载详情失败');
  } finally {
    detailsLoading.value = false;
  }
}

// ===== 工作职责 =====
function addResponsibility() {
  responsibilities.value.push({ id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', description: '' });
}
function removeResponsibility(respId: string) {
  responsibilities.value = responsibilities.value.filter((r) => r.id !== respId);
  bindings.value = bindings.value.filter((b) => b.responsibilityId !== respId);
  if (selectedRespId.value === respId) {
    selectedRespId.value = responsibilities.value.length > 0 ? responsibilities.value[0].id : null;
  }
}

// ===== 任职要求 =====
function addRequirement() {
  requirements.value.push('');
}
function removeRequirement(index: number) {
  requirements.value.splice(index, 1);
}

// ===== 证书（仅展示 / 移除） =====
function removeCert(id: string) {
  certificates.value = certificates.value.filter((c) => c.id !== id);
}

// ===== 能力绑定 =====
function removeBinding(id: string) {
  bindings.value = bindings.value.filter((b) => b.id !== id);
}
function isPoolAbilityAdded(abilityId: string): boolean {
  return bindings.value.some(
    (b) => b.responsibilityId === selectedRespId.value && b.publicAbilityId === abilityId
  );
}
function openAbilityPool() {
  if (!selectedRespId.value) {
    ElMessage.warning('请先选择一项工作职责');
    return;
  }
  abilityPoolSearch.value = '';
  abilityPoolFilterAttr.value = null;
  abilityPoolDialog.value = true;
}
function addFromPool(ability: AbilityPoint) {
  if (!selectedRespId.value) return;
  const exists = bindings.value.some(
    (b) => b.responsibilityId === selectedRespId.value && b.publicAbilityId === ability.id
  );
  if (exists) {
    ElMessage.warning('该能力点已添加到当前职责');
    return;
  }
  bindings.value.push({
    id: `bind-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    responsibilityId: selectedRespId.value,
    source: 'public',
    publicAbilityId: ability.id,
    name: ability.name,
    level: 'understand',
    rubricDescription: '',
    description: ability.description ?? ''
  });
}
function openCreateAbility() {
  if (!selectedRespId.value) {
    ElMessage.warning('请先选择一项工作职责');
    return;
  }
  newAbilityName.value = '';
  newAbilityAttributes.value = [];
  duplicateAbility.value = null;
  createAbilityDialog.value = true;
}
function toggleNewAbilityAttr(attr: string) {
  newAbilityAttributes.value = newAbilityAttributes.value.includes(attr)
    ? newAbilityAttributes.value.filter((a) => a !== attr)
    : [...newAbilityAttributes.value, attr];
}
function createCustomAbility() {
  if (!selectedRespId.value || !newAbilityName.value.trim()) return;
  const trimmed = newAbilityName.value.trim();
  const existing = abilities.value.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    duplicateAbility.value = existing.name;
    return;
  }
  const existsInBindings = bindings.value.some(
    (b) => b.responsibilityId === selectedRespId.value && b.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existsInBindings) {
    ElMessage.warning('当前职责已存在同名能力点');
    return;
  }
  bindings.value.push({
    id: `bind-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    responsibilityId: selectedRespId.value,
    source: 'custom',
    name: trimmed,
    level: 'understand',
    rubricDescription: '',
    description: '',
    attributes: [...newAbilityAttributes.value],
    domain: undefined
  });
  newAbilityName.value = '';
  newAbilityAttributes.value = [];
  createAbilityDialog.value = false;
}
function addExistingFromPool() {
  if (!duplicateAbility.value || !selectedRespId.value) return;
  const existing = abilities.value.find((a) => a.name.toLowerCase() === duplicateAbility.value!.toLowerCase());
  if (existing) {
    addFromPool(existing);
    duplicateAbility.value = null;
    createAbilityDialog.value = false;
  }
}
function cancelDuplicate() {
  duplicateAbility.value = null;
  newAbilityName.value = '';
}

// ===== 批量添加职责 =====
function openBatchRespDialog() {
  newRespNames.value = [''];
  batchRespDialog.value = true;
}
function addRespRow() {
  newRespNames.value.push('');
}
function removeRespRow(index: number) {
  newRespNames.value = newRespNames.value.filter((_, i) => i !== index);
}
function confirmAddResponsibilities() {
  const names = newRespNames.value.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return;
  const now = Date.now();
  const newResps: LocalResp[] = names.map((name) => ({
    id: `resp-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: ''
  }));
  responsibilities.value = [...responsibilities.value, ...newResps];
  selectedRespId.value = newResps[newResps.length - 1].id;
  batchRespDialog.value = false;
  newRespNames.value = [''];
  ElMessage.success(`已添加 ${newResps.length} 条工作职责`);
}

// ===== 共建人 =====
function openCollabDialog() {
  collabSearch.value = '';
  collabDialog.value = true;
}
function toggleCollaborator(userId: string) {
  if (collaborators.value.includes(userId)) {
    collaborators.value = collaborators.value.filter((v) => v !== userId);
  } else {
    collaborators.value = [...collaborators.value, userId];
  }
}

// ===== 封面上传 =====
function triggerFile() {
  fileInput.value?.click();
}
async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  coverUploading.value = true;
  try {
    form.coverImage = await uploadCover(file);
    ElMessage.success('封面上传成功');
  } catch (err) {
    ElMessage.error((err as Error).message || '封面上传失败');
  } finally {
    coverUploading.value = false;
    input.value = '';
  }
}

// ===== 保存（对齐 React save-full 请求形状） =====
function buildSavePayload(): Record<string, unknown> {
  return {
    batchId: position.value?.batchId || '',
    name: form.name.trim(),
    shortName: form.shortName.trim(),
    industry: position.value?.industryId || '',
    majors: position.value?.majorIds || [],
    positionType: form.positionType,
    salaryRange: [form.salaryMin ?? 0, form.salaryMax ?? 0],
    coverImage: form.coverImage || undefined,
    description: form.description.trim() || undefined,
    requirements: requirements.value,
    careerPath: form.careerPath.trim() || undefined,
    version: form.version,
    collaborators: collaborators.value,
    responsibilities: responsibilities.value.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description
    })),
    certificates: certificates.value.map((c) => ({
      id: c.id,
      name: c.name,
      url: c.url,
      description: c.description,
      image: c.image
    })),
    abilityBindings: bindings.value.map((b) => ({
      id: b.id,
      responsibilityId: b.responsibilityId,
      source: b.source,
      publicAbilityId: b.publicAbilityId,
      abilityPointId: b.abilityPointId,
      name: b.name,
      level: b.level,
      rubricDescription: b.rubricDescription,
      description: b.description,
      attributes: b.attributes,
      domain: b.domain
    })),
    abilityDomains: abilityDomains.value.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      bindingIds: d.bindingIds
    }))
  };
}

async function onSave(): Promise<boolean> {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return false;
  }
  if (!detailsLoaded.value) {
    ElMessage.warning('详情加载中，请稍候');
    return false;
  }
  saving.value = true;
  try {
    const res = await saveFull(id, buildSavePayload());
    hasSaved.value = true;
    if (res.status && res.status !== meta.status) {
      meta.status = res.status;
    }
    ElMessage.success('已保存');
    return true;
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
    return false;
  } finally {
    saving.value = false;
  }
}

async function onFinish() {
  const ok = await onSave();
  if (ok) {
    router.push('/partner/co-build/positions');
  }
}

async function onBack() {
  if (isNew && !hasSaved.value) {
    try {
      await partnerCobuildPositionApi.delete(id);
    } catch {
      // 忽略删除未保存草稿的失败
    }
  }
  router.push('/partner/co-build/positions');
}

onMounted(loadAll);
</script>

<style scoped>
.edit-page {
  padding: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.basic-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.basic-main {
  flex: 1;
  min-width: 0;
}
.basic-form {
  max-width: 640px;
}
.side-card {
  width: 320px;
  border-left: 1px solid #ebeef5;
  padding-left: 24px;
  flex-shrink: 0;
}
.side-block {
  margin-bottom: 20px;
}
.side-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.side-value {
  font-weight: 500;
  color: #303133;
}
.side-value.dim,
.dim {
  color: #909399;
  font-size: 13px;
}
.cover-uploader {
  width: 100%;
}
.cover-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cover-preview img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}
.cover-placeholder {
  height: 120px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  cursor: pointer;
}
.cover-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}
.salary-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sep {
  color: #909399;
}
.block-card {
  margin-top: 20px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  max-width: 640px;
}
.block-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
.block-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.add-btn {
  align-self: flex-start;
  border: none;
}
.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.cert-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}
.cert-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cert-name {
  font-weight: 600;
  color: #303133;
}
.cert-url {
  display: block;
  font-size: 12px;
  color: #409eff;
  margin-top: 6px;
  word-break: break-all;
}
.cert-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.collab-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.collab-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.ability-layout {
  display: flex;
  gap: 16px;
  height: 560px;
}
.ability-sidebar {
  width: 300px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}
.ability-sidebar-head {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  gap: 8px;
}
.side-sub {
  font-size: 11px;
  color: #c0c4cc;
  flex: 1;
}
.ability-sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.resp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
.resp-item:hover {
  background: #f5f7fa;
}
.resp-item.active {
  background: #fff;
  box-shadow: 0 0 0 1px #dcdfe6;
}
.resp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.resp-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}
.resp-count {
  font-size: 11px;
  color: #909399;
  background: #f0f2f5;
  border-radius: 10px;
  padding: 1px 8px;
}
.ability-content {
  flex: 1;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ability-content-head {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  gap: 12px;
}
.flex-1 {
  flex: 1;
}
.binding-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  align-content: start;
}
.binding-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
}
.binding-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.binding-name {
  font-weight: 600;
  color: #303133;
}
.binding-level {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.binding-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.binding-rubric {
  font-size: 12px;
}
.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
  max-width: 640px;
}
.stat-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  text-align: center;
  padding: 16px;
}
.stat-label {
  font-size: 12px;
  color: #909399;
}
.stat-value {
  font-size: 26px;
  font-weight: 600;
  color: #303133;
  margin-top: 4px;
}
.summary-table {
  margin-top: 8px;
}
.pool-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.pool-attrs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.attr-tag {
  margin-right: 4px;
}
.batch-resp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.collab-dialog-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}
.collab-dialog-list {
  max-height: 360px;
  overflow-y: auto;
}
.collab-group {
  margin-bottom: 12px;
}
.collab-group-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.collab-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.collab-option:hover {
  background: #f5f7fa;
}
</style>
