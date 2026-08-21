<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">导入导出</span>
        </div>
      </template>

      <el-form label-width="80px" style="max-width: 480px">
        <el-form-item label="资源类型">
          <el-select v-model="entity" style="width: 100%">
            <el-option v-for="e in ENTITIES" :key="e.key" :label="e.label" :value="e.key" />
          </el-select>
        </el-form-item>
      </el-form>

      <ImportExport :key="entity" :entity="entity" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ImportExport from '@/components/ImportExport.vue';

const ENTITIES = [
  { key: 'positions', label: '岗位' },
  { key: 'scenarios', label: '场景' },
  { key: 'courses', label: '课程' },
  { key: 'question-banks', label: '题库' },
  { key: 'questions', label: '题目' },
  { key: 'exams', label: '试卷' },
  { key: 'industries', label: '行业' },
  { key: 'majors', label: '专业' },
  { key: 'organizations', label: '组织' },
  { key: 'students', label: '学生' },
  { key: 'teachers', label: '教师' },
  { key: 'affairs-config', label: '教务配置（场地与节次）' },
  { key: 'alliance-projects', label: '合作项目' },
  { key: 'alliance-achievements', label: '合作成果' },
  { key: 'alliance-agreements', label: '合作协议' }
];

const entity = ref('positions');
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>
