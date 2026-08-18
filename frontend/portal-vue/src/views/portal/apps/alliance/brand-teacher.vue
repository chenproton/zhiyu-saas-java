<template>
  <div class="teacher-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">师资品牌管理</h1>
        <p class="page-desc">校本师资关联系统教师并补充展示资料，企业专家关联专家库</p>
      </div>
      <BatchImport brand-type="teacher" entity-label="师资品牌" @success="load" />
    </div>

    <el-tabs v-model="activeTab" class="teacher-tabs">
      <el-tab-pane :label="`校本师资（${schoolBrands.length}）`" name="school">
        <TeacherBrandSection mode="school" :items="schoolBrands" :loading="loading" @saved="load" />
      </el-tab-pane>
      <el-tab-pane :label="`企业专家师资（${expertBrands.length}）`" name="expert">
        <TeacherBrandSection mode="expert" :items="expertBrands" :loading="loading" @saved="load" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { allianceBrandApi } from '@/api/alliance';
import { useAuthStore } from '@/stores/auth';
import type { AllianceBrand } from './shared';
import BatchImport from './components/BatchImport.vue';
import TeacherBrandSection from './components/TeacherBrandSection.vue';

const brandType = 'teacher';

const auth = useAuthStore();
const tenantId = () => (auth.user?.tenantId as string) || '';

const brands = ref<AllianceBrand[]>([]);
const loading = ref(false);
const activeTab = ref('school');

const schoolBrands = computed(() => brands.value.filter((b) => b.teacherId));
const expertBrands = computed(() => brands.value.filter((b) => b.expertId));

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  try {
    const data = await allianceBrandApi.list({ brandType, limit: 200 });
    brands.value = (data.items || []) as AllianceBrand[];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.teacher-page {
  min-height: 100%;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
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
.teacher-tabs {
  width: 100%;
}
</style>
