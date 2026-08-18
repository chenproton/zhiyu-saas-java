<template>
  <div class="portal-layout">
    <header class="portal-header">
      <div class="brand" @click="$router.push('/portal')">知与 SaaS</div>
      <el-menu mode="horizontal" :default-active="activeTop" router class="nav-menu" :ellipsis="false">
        <el-menu-item index="/portal">首页</el-menu-item>
        <el-menu-item index="/portal/workspace">工作台</el-menu-item>
        <el-menu-item index="/portal/apps">应用中心</el-menu-item>
        <el-menu-item index="/portal/community">学习社区</el-menu-item>
        <el-menu-item index="/portal/favorites">我的收藏</el-menu-item>
      </el-menu>
      <div class="user-area">
        <span v-if="auth.user" class="user-name">{{ auth.user.name }}</span>
        <el-button size="small" @click="onLogout">退出</el-button>
      </div>
    </header>
    <main class="portal-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// 顶部主导航高亮：首页 / 工作台 / 应用中心（域名页回落到应用中心）
const activeTop = computed(() => {
  const p = route.path;
  if (p === '/portal' || p === '/') return '/portal';
  if (p.startsWith('/portal/workspace')) return '/portal/workspace';
  if (p.startsWith('/portal/apps')) return '/portal/apps';
  if (p.startsWith('/portal/community')) return '/portal/community';
  if (p.startsWith('/portal/favorites')) return '/portal/favorites';
  // 其它域名页（/job、/scene 等）高亮「应用中心」
  return '/portal/apps';
});

function onLogout() {
  auth.logout();
  router.replace('/login');
}
</script>

<style scoped>
.portal-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
.portal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.nav-menu {
  flex: 1;
  border-bottom: none;
}
.user-area {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.user-name {
  font-size: 13px;
  color: #606266;
}
.portal-main {
  flex: 1;
  padding: 16px;
}
</style>
