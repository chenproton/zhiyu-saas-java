<template>
  <div class="photo-grid">
    <img v-for="(photo, idx) in photos" :key="idx" :src="photo" :alt="`${alt} 照片 ${idx + 1}`" class="photo-img" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ photos: string[]; alt: string }>();
</script>

<style scoped>
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.photo-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
@media (max-width: 640px) { .photo-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
