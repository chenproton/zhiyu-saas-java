<!--
  待复刻 Tab 占位（教师/学校管理员的角色专属 Tab）。
  说明：本文件承担「布局专项阶段 2 学生核心 Tab」范围之外的教师/管理员专属内容占位，
  保证 ?tab= 路由与左侧 Tab 列表与 React 完全对齐、可访问不报错；
  对应 React 组件（teacher-courses-tab / teacher-portraits-tab / school-admin-*-tab）
  由教师·管理员视图专项复刻后替换此占位。
-->
<template>
  <div class="placeholder-tab">
    <el-empty :description="`「${title}」正在复刻中`">
      <p class="placeholder-hint">
        该 Tab 属于{{ roleName }}专属视图，内容将在教师·管理员视图专项中按 React 对位实现。
      </p>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; roleName: string }>();
</script>

<style scoped>
.placeholder-tab {
  padding: 32px 0;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
}
.placeholder-hint {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
</style>
