<!--
  landing 系列公开页无壳布局（仅顶部全局导航栏，无左侧域导航）

  对齐 React：landing 系列页面为「独立无壳布局（仅 TopNav）」
  （见 docs/spec/05-prototype-interaction.md §2.1 / vue-business-portal.md §11.7）。

  - 顶部全局导航栏复用 `PortalHeader.vue`（与 PortalLayout 管理壳一致，登录态显示 3 项导航 + 用户区，
    未登录显示品牌 + 登录入口）；
  - 不套 `portal-main` 的 padding，保持各 landing 页自有的全宽 hero / 内容设计；
  - 无左侧域导航（landing 为前台公开页，对齐 /portal/alliance/landing 形态）。
-->
<template>
  <div class="landing-layout">
    <PortalHeader />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import PortalHeader from './PortalHeader.vue';
</script>

<style scoped>
.landing-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
</style>
