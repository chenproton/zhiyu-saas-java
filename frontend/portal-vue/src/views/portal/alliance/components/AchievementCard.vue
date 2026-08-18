<template>
  <router-link :to="`/portal/alliance/achievements/${achievement.id}`" class="acard">
    <div class="acard-cover">
      <img v-if="achievement.coverImage" :src="achievement.coverImage" :alt="achievement.title" class="cover-img" />
      <GradientPlaceholder v-else :seed="achievement.title" :label="achievement.title" class="cover-img" />
      <div class="cover-overlay" />
      <div class="cover-badge"><span class="badge">{{ typeLabel }}</span></div>
    </div>
    <div class="acard-content">
      <h4 class="acard-title">{{ achievement.title }}</h4>
      <p class="acard-desc">{{ achievement.description || '暂无成果描述' }}</p>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GradientPlaceholder from './GradientPlaceholder.vue';
import { allianceLabel, type AllianceAchievement } from '../shared';

const props = defineProps<{ achievement: AllianceAchievement }>();
const typeLabel = computed(() => allianceLabel('achievementType', props.achievement.type));
</script>

<style scoped>
.acard {
  display: flex; flex-direction: column; background: #fff; border: 1px solid #e7e5e4;
  border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; text-decoration: none; color: inherit; height: 100%;
}
.acard:hover { transform: translateY(-8px); box-shadow: 0 20px 48px rgba(0,0,0,0.1); border-color: rgba(64,158,255,0.3); }
.acard-cover { position: relative; aspect-ratio: 16 / 10; overflow: hidden; }
.cover-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.acard:hover .cover-img { transform: scale(1.05); }
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top right, rgba(15,23,42,0.5), transparent, transparent); }
.cover-badge { position: absolute; top: 12px; left: 12px; }
.badge { background: rgba(255,255,255,0.92); color: #1e293b; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.08); font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; }
.acard-content { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.acard-title { font-weight: 600; color: #0f172a; font-size: 14px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.acard:hover .acard-title { color: #409eff; }
.acard-desc { font-size: 14px; color: #475569; line-height: 1.6; min-height: 2.6em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
