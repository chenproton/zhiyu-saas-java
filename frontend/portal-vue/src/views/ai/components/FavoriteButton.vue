<template>
  <el-button
    text
    size="small"
    :class="['fav-btn', { active: isFavorite }]"
    :disabled="toggling"
    :title="isFavorite ? '取消收藏' : '收藏'"
    @click.stop.prevent="toggle"
  >
    <el-icon v-if="!isFavorite"><Star /></el-icon>
    <el-icon v-else><StarFilled /></el-icon>
    <span v-if="count !== null">{{ count }}</span>
  </el-button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Star, StarFilled } from '@element-plus/icons-vue';
import { aiCenterFavoriteApi } from '@/api/ai';

const props = defineProps<{
  targetType: 'ai_kb' | 'ai_agent';
  targetId: string;
}>();

const isFavorite = ref(false);
const count = ref<number | null>(null);
const toggling = ref(false);

async function loadStatus() {
  try {
    const res = await aiCenterFavoriteApi.status(props.targetType, props.targetId);
    isFavorite.value = res.isFavorite;
    count.value = res.favoriteCount;
  } catch {
    /* 收藏态查询失败不打扰用户，按钮按未收藏渲染 */
  }
}

async function toggle() {
  if (toggling.value) return;
  toggling.value = true;
  try {
    const res = await aiCenterFavoriteApi.toggle(props.targetType, props.targetId);
    isFavorite.value = res.isFavorite;
    count.value = res.favoriteCount;
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    toggling.value = false;
  }
}

onMounted(loadStatus);
</script>

<style scoped>
.fav-btn {
  color: #909399;
}
.fav-btn.active {
  color: #f56c6c;
}
</style>
