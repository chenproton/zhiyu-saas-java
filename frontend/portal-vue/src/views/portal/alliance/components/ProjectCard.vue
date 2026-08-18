<template>
  <router-link :to="`/portal/alliance/projects/${project.id}`" class="acard">
    <div class="acard-cover">
      <img v-if="project.coverImage" :src="project.coverImage" :alt="project.name" class="cover-img" />
      <GradientPlaceholder v-else :seed="project.name" :label="project.name" class="cover-img" />
      <div class="cover-overlay" />
      <div class="cover-badge"><span class="badge">{{ phaseLabel }}</span></div>
    </div>
    <div class="acard-content">
      <h4 class="acard-title">{{ project.name }}</h4>
      <p class="acard-desc">{{ project.description || '暂无项目描述' }}</p>
      <div class="acard-foot">
        <div v-if="project.startDate" class="foot-date">
          <span>{{ project.startDate }}{{ project.endDate ? ` 至 ${project.endDate}` : '' }}</span>
        </div>
        <div class="progress-block">
          <div class="progress-line"><span>项目进度</span><span class="pv">{{ progress }}%</span></div>
          <el-progress :percentage="progress" :show-text="false" :stroke-width="6" />
        </div>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GradientPlaceholder from './GradientPlaceholder.vue';
import { allianceLabel, type AllianceProject } from '../shared';

const props = defineProps<{ project: AllianceProject }>();

const progress = computed(() => props.project.progress ?? 0);
const phaseLabel = computed(() => allianceLabel('projectPhase', props.project.phase));
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
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent, transparent); }
.cover-badge { position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; }
.badge { background: rgba(255,255,255,0.92); color: #1e293b; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.08); font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; }
.acard-content { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.acard-title { font-weight: 600; color: #0f172a; font-size: 14px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.acard:hover .acard-title { color: #409eff; }
.acard-desc { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 12px; min-height: 2.6em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.acard-foot { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
.foot-date { font-size: 12px; color: #64748b; }
.progress-block { display: flex; flex-direction: column; gap: 4px; }
.progress-line { display: flex; justify-content: space-between; font-size: 11px; color: #475569; }
.pv { font-weight: 500; }
</style>
