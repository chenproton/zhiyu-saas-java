<template>
  <div class="mine">
    <div class="mine-header">
      <div class="mine-header-inner">
        <router-link to="/portal/alliance/employment" class="mine-back">
          <el-icon><ArrowLeft /></el-icon>返回人才与岗位供需服务大厅
        </router-link>
        <div class="mine-title-row">
          <div class="mine-icon"><el-icon :size="26"><Briefcase /></el-icon></div>
          <div>
            <h1 class="mine-title">我的投递</h1>
            <p class="mine-subtitle">查看你已投递的岗位与求职信</p>
          </div>
        </div>
      </div>
    </div>

    <main class="mine-main">
      <div v-if="loading" class="mine-loading"><el-skeleton :rows="6" animated /></div>
      <div v-else-if="error" class="mine-empty">
        <el-empty :description="error" />
        <div class="retry-wrap"><el-button type="primary" @click="load">重试</el-button></div>
      </div>
      <div v-else-if="items.length === 0" class="mine-empty">
        <el-icon :size="40"><Briefcase /></el-icon>
        <p>暂无投递记录</p>
      </div>
      <div v-else class="mine-card">
        <el-table :data="items" style="width: 100%">
          <el-table-column label="岗位" min-width="160">
            <template #default="{ row }">{{ row.jobTitle || '-' }}</template>
          </el-table-column>
          <el-table-column label="企业" min-width="140">
            <template #default="{ row }">{{ row.enterpriseName || '-' }}</template>
          </el-table-column>
          <el-table-column label="项目" min-width="140">
            <template #default="{ row }">{{ row.projectName || '-' }}</template>
          </el-table-column>
          <el-table-column label="投递时间" min-width="150">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default><el-tag type="success" effect="plain">已投递</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="170" align="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="selected = row"><el-icon><Document /></el-icon>求职信</el-button>
              <el-button link size="small" @click="$router.push(`/portal/alliance/employment/job/${row.jobId}`)"><el-icon><Link /></el-icon>查看岗位</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <footer class="mine-footer">知与 SaaS · 产教融合联盟</footer>

    <el-dialog v-model="dialogOpen" title="我的求职信" width="560px">
      <p class="dlg-subtitle">{{ selected?.jobTitle || '-' }}{{ selected?.enterpriseName ? ` · ${selected.enterpriseName}` : '' }}</p>
      <div class="dlg-letter">
        <p v-if="selected?.coverLetter" class="dlg-letter-text">{{ selected.coverLetter }}</p>
        <p v-else class="dlg-letter-empty">未填写求职信</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowLeft, Briefcase, Document, Link } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, type EmploymentApplication } from './shared';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<EmploymentApplication[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const selected = ref<EmploymentApplication | null>(null);
const dialogOpen = ref(false);

watch(selected, (v) => {
  dialogOpen.value = !!v;
});
watch(dialogOpen, (v) => {
  if (!v) selected.value = null;
});

async function load() {
  if (!tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const res = await portalRequest<{ items: EmploymentApplication[] }>(
      '/alliance/public/employment-applications/mine',
    );
    items.value = res.items ?? [];
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.mine { min-height: 100vh; display: flex; flex-direction: column; background: #f5f8ff; }
.mine-header { position: relative; overflow: hidden; background: linear-gradient(135deg, #409eff, #2f7fd6, #1f66b3); }
.mine-header-inner { position: relative; max-width: 1400px; margin: 0 auto; padding: 24px; }
.mine-back { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.8); text-decoration: none; font-size: 14px; margin-bottom: 16px; transition: color 0.2s; }
.mine-back:hover { color: #fff; }
.mine-title-row { display: flex; align-items: center; gap: 16px; }
.mine-icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.mine-title { font-size: 24px; font-weight: 700; color: #fff; }
.mine-subtitle { font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px; }
.mine-main { max-width: 1400px; margin: 0 auto; padding: 24px; width: 100%; flex: 1; }
.mine-loading { background: #fff; border-radius: 16px; padding: 24px; }
.mine-empty { text-align: center; padding: 80px 0; color: #94a3b8; background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.mine-empty p { font-size: 15px; font-weight: 500; color: #475569; margin-top: 12px; }
.retry-wrap { margin-top: 12px; }
.mine-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow: hidden; }
.mine-footer { margin-top: auto; text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; border-top: 1px solid #eef2f7; }
.dlg-subtitle { font-size: 14px; color: #64748b; margin-bottom: 16px; }
.dlg-letter { border-radius: 12px; background: #f8fafc; padding: 16px; max-height: 50vh; overflow-y: auto; }
.dlg-letter-text { font-size: 14px; color: #334155; line-height: 1.8; white-space: pre-wrap; }
.dlg-letter-empty { font-size: 14px; color: #94a3b8; }
</style>
