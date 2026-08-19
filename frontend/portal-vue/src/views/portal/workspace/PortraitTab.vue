<!--
  学生画像 Tab：内嵌 public/student_portrait.html（与 React 完全同源的静态画像页）。
  对齐 React frontend/edu/app/portal/workspace/_components/portrait-tab.tsx
  （带 userId 时透传 ?userId=，高度 calc(100vh - 200px)）。
-->
<template>
  <div class="portrait-tab">
    <iframe :src="src" class="portrait-frame" title="学生画像" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ userId?: string }>();

const src = computed(() =>
  props.userId
    ? `/student_portrait.html?userId=${encodeURIComponent(props.userId)}`
    : '/student_portrait.html'
);
</script>

<style scoped>
.portrait-tab {
  width: 100%;
  height: calc(100vh - 200px);
}
.portrait-frame {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 6px;
}
</style>
