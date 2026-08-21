<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">套餐情况查看</h1>
        <p class="page-desc">查看当前租户购买的套餐内容和功能模块</p>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 16px">
      <template #default>
        <el-button size="small" text type="primary" @click="loadPackage">重试</el-button>
      </template>
    </el-alert>

    <div v-loading="loading">
      <template v-if="!loading && subscription">
        <!-- 套餐基本信息 -->
        <el-card shadow="never" class="section-card">
          <div class="package-head">
            <div class="package-head-left">
              <div class="package-icon">📦</div>
              <div>
                <div class="package-name">{{ subscription.name }}</div>
                <div class="package-meta">
                  <span>有效期至 {{ subscription.validUntil || '未设置' }}</span>
                  <span class="meta-primary">已开通 {{ enabledCount }}/{{ packageModules.length }} 个平台</span>
                </div>
              </div>
            </div>
            <el-tag v-if="subscription.status === 'active'" type="success">已激活</el-tag>
            <el-tag v-else type="info">{{ subscription.status || '未知' }}</el-tag>
          </div>
        </el-card>

        <!-- 套餐功能模块（两级结构） -->
        <el-card shadow="never" class="section-card">
          <template #header>
            <div>
              <div class="card-title">套餐功能模块</div>
              <div class="card-subtitle">展开查看各平台包含的二级功能模块</div>
            </div>
          </template>

          <el-empty v-if="packageModules.length === 0" description="暂无模块配置" :image-size="80" />
          <div v-else class="module-list">
            <div
              v-for="m in packageModules"
              :key="m.name"
              class="module-item"
              :class="{ 'module-disabled': !m.enabled }"
            >
              <button type="button" class="module-head" @click="toggleModule(m.name)">
                <div class="module-head-left">
                  <span class="module-check" :class="m.enabled ? 'on' : 'off'">✓</span>
                  <span class="module-name">{{ m.name }}</span>
                  <el-tag v-if="!m.enabled" size="small" type="info">未开通</el-tag>
                </div>
                <div class="module-head-right">
                  <span class="module-count">
                    {{ m.subModules.filter((s) => s.enabled).length }}/{{ m.subModules.length }} 个功能
                  </span>
                  <span class="module-arrow">{{ expandedModules.includes(m.name) ? '▾' : '▸' }}</span>
                </div>
              </button>

              <div v-if="expandedModules.includes(m.name)" class="module-body">
                <div class="submodule-grid">
                  <div
                    v-for="s in m.subModules"
                    :key="s.name"
                    class="submodule-item"
                    :class="{ 'submodule-disabled': !s.enabled }"
                  >
                    <span class="module-check small" :class="s.enabled ? 'on' : 'off'">✓</span>
                    <span class="submodule-name">{{ s.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { portalRequest, buildQuery } from '@/api/http';

interface SubscriptionPackage {
  id: string;
  tenantId: string;
  name: string;
  validUntil?: string;
  modules: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface SubModule {
  name: string;
  enabled: boolean;
}

interface PackageModule {
  name: string;
  enabled: boolean;
  subModules: SubModule[];
}

// 平台一级模块 + 二级功能模块（对齐 React lib/navigation-config platformModuleDefs）
interface PlatformDef {
  key: string;
  label: string;
  subModules: string[];
}

const PLATFORM_DEFS: PlatformDef[] = [
  { key: 'system', label: '系统管理', subModules: ['租户信息管理', '系统资源管理', '组织用户管理', '日志管理'] },
  { key: 'career', label: '职业岗位学习平台', subModules: ['岗位中心', '批次与审批管理', '岗位展示配置'] },
  { key: 'scene', label: '实践场景学习平台', subModules: ['场景中心', '批次与审批管理'] },
  { key: 'course', label: '数字课程服务平台', subModules: ['在线课资源库', '混合课资源库', '批次与审批管理'] },
  { key: 'ability', label: '能力评价与测评资源管理平台', subModules: ['测评资源', '批次与审批管理', '结果与认证'] },
  { key: 'resource', label: '教学资源共享服务平台', subModules: ['公共资源库', '我的资源库', '标签管理'] },
  { key: 'affairs', label: '教务管理服务平台', subModules: ['教务管理', '教学管理', '审批管理'] },
  { key: 'alliance', label: '产教融合与就业服务平台', subModules: ['产教融合管理', '品牌运营管理', '就业服务管理'] },
  { key: 'opc', label: 'OPC专区', subModules: [] },
  { key: 'decision', label: '敏捷决策中心', subModules: [] },
  { key: 'research', label: '教科研服务中心', subModules: [] }
];

function buildPackageModules(modules: Record<string, unknown> | undefined): PackageModule[] {
  if (!modules || typeof modules !== 'object') return [];
  return PLATFORM_DEFS.filter((def) => Boolean(modules[def.key])).map((def) => {
    const enabled = Boolean(modules[def.key]);
    return {
      name: def.label,
      enabled,
      subModules: def.subModules.map((name) => ({ name, enabled }))
    };
  });
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const subscription = ref<SubscriptionPackage | null>(null);
const loading = ref(false);
const error = ref('');
const expandedModules = ref<string[]>([]);

const packageModules = computed<PackageModule[]>(() =>
  buildPackageModules(subscription.value?.modules as Record<string, unknown> | undefined)
);

const enabledCount = computed(() => packageModules.value.filter((m) => m.enabled).length);

function toggleModule(name: string) {
  const idx = expandedModules.value.indexOf(name);
  if (idx >= 0) expandedModules.value.splice(idx, 1);
  else expandedModules.value.push(name);
}

async function loadPackage() {
  if (!tenantId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await portalRequest<SubscriptionPackage>(
      `/subscriptions${buildQuery({ tenantId: tenantId.value })}`
    );
    subscription.value = res;
    const parsed = buildPackageModules(res.modules as Record<string, unknown> | undefined);
    if (parsed.length > 0) {
      expandedModules.value = [parsed[0].name];
    }
  } catch (e) {
    error.value = (e as Error).message || '加载套餐信息失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadPackage);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.page-desc { color: #909399; font-size: 13px; margin: 4px 0 0; }
.section-card { margin-bottom: 16px; }
.package-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.package-head-left { display: flex; align-items: center; gap: 12px; }
.package-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #ecf5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.package-name { font-size: 16px; font-weight: 600; }
.package-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #909399;
  font-size: 13px;
  margin-top: 4px;
}
.meta-primary { color: #409eff; }
.card-title { font-size: 15px; font-weight: 600; }
.card-subtitle { color: #909399; font-size: 12px; margin-top: 2px; }
.module-list { display: flex; flex-direction: column; gap: 8px; }
.module-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}
.module-disabled { opacity: 0.6; }
.module-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
  border: none;
  cursor: pointer;
  text-align: left;
}
.module-head-left { display: flex; align-items: center; gap: 10px; }
.module-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
}
.module-check.on { background: #409eff; }
.module-check.off { background: #c0c4cc; }
.module-check.small { width: 16px; height: 16px; font-size: 10px; flex-shrink: 0; }
.module-name { font-weight: 500; }
.module-head-right { display: flex; align-items: center; gap: 8px; }
.module-count { font-size: 12px; color: #909399; }
.module-arrow { color: #909399; }
.module-body {
  padding: 8px 16px 16px;
  background: #fafafa;
}
.submodule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.submodule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid #d9ecff;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
.submodule-disabled {
  border-color: #e4e7ed;
  background: #f5f7fa;
  opacity: 0.6;
}
.submodule-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
