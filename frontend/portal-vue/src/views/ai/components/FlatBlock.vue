<template>
  <div class="flat-block">
    <div class="flat-head">
      <div class="flat-head-left">
        <div class="flat-icon">{{ icon }}</div>
        <div>
          <h3 class="flat-title">
            {{ title }}
            <span v-if="count != null" class="flat-count">({{ count }})</span>
          </h3>
          <p class="flat-desc">{{ desc }}</p>
        </div>
      </div>
      <a v-if="moreHref" class="flat-more" @click.prevent="goMore">{{ moreLabel }} <span>→</span></a>
    </div>
    <div class="flat-body">
      <div v-if="hasItems" class="flat-grid">
        <slot />
      </div>
      <div v-else class="flat-empty">
        <p>{{ emptyLabel }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
  title: string;
  desc: string;
  icon: string;
  count?: number;
  moreHref?: string;
  moreLabel?: string;
  emptyLabel: string;
  hasItems: boolean;
}>();

const router = useRouter();
function goMore() {
  if (props.moreHref) router.push(props.moreHref);
}
</script>

<style scoped>
.flat-block {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.flat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}
.flat-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.flat-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.flat-count {
  color: #64748b;
  font-size: 13px;
  font-weight: 400;
}
.flat-desc {
  color: #94a3b8;
  font-size: 12px;
  margin: 2px 0 0;
}
.flat-more {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
  flex-shrink: 0;
  cursor: pointer;
}
.flat-more:hover {
  text-decoration: underline;
}
.flat-body {
  padding: 20px;
}
.flat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}
.flat-empty {
  border: 1px dashed #e4e7ed;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
}
.flat-empty p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}
</style>
