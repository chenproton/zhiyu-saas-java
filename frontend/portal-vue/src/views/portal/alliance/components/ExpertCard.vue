<template>
  <div class="expert-wrap" :class="{ 'not-public': expert.isPublic === false }" :title="expert.isPublic === false ? '该专家未开启前台展示，暂无详情页' : undefined">
    <router-link v-if="expert.isPublic !== false" :to="`/portal/alliance/experts/${expert.id}`" class="ecard">
      <div class="ecard-cover">
        <GradientPlaceholder :seed="expert.industry" class="cover-bg" />
        <div class="cover-overlay" />
        <div class="avatar">
          <img v-if="expert.avatarUrl" :src="expert.avatarUrl" :alt="expert.name" />
          <span v-else class="avatar-fb">{{ getInitials(expert.name) }}</span>
        </div>
      </div>
      <div class="ecard-body">
        <h4 class="name">{{ expert.name }}</h4>
        <p class="subtitle">{{ subtitle }}</p>
        <div class="rows">
          <div class="row"><span class="rl">企业</span><span class="rv">{{ expert.organization || expert.enterpriseName || '—' }}</span></div>
          <div class="row"><span class="rl">行业</span><span class="rv">{{ expert.industry || '—' }}</span></div>
          <div class="row"><span class="rl">经验</span><span class="rv">{{ expert.experienceYears ? `${expert.experienceYears} 年` : '—' }}</span></div>
        </div>
        <div v-if="specialties.length" class="tags">
          <span v-for="tag in specialties.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </router-link>
    <div v-else class="ecard">
      <div class="ecard-cover">
        <GradientPlaceholder :seed="expert.industry" class="cover-bg" />
        <div class="cover-overlay" />
        <div class="avatar">
          <img v-if="expert.avatarUrl" :src="expert.avatarUrl" :alt="expert.name" />
          <span v-else class="avatar-fb">{{ getInitials(expert.name) }}</span>
        </div>
      </div>
      <div class="ecard-body">
        <h4 class="name">{{ expert.name }}</h4>
        <p class="subtitle">{{ subtitle }}</p>
        <div class="rows">
          <div class="row"><span class="rl">企业</span><span class="rv">{{ expert.organization || expert.enterpriseName || '—' }}</span></div>
          <div class="row"><span class="rl">行业</span><span class="rv">{{ expert.industry || '—' }}</span></div>
          <div class="row"><span class="rl">经验</span><span class="rv">{{ expert.experienceYears ? `${expert.experienceYears} 年` : '—' }}</span></div>
        </div>
        <div v-if="specialties.length" class="tags">
          <span v-for="tag in specialties.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>
    <span v-if="expert.isPublic === false" class="np-badge">未公开</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GradientPlaceholder from './GradientPlaceholder.vue';
import { getInitials, type AllianceExpert } from '../shared';

const props = defineProps<{ expert: AllianceExpert }>();

const subtitle = computed(() =>
  [props.expert.title, props.expert.position].filter(Boolean).join(' · ') || '企业专家',
);
const specialties = computed(() => props.expert.specialties ?? []);
</script>

<style scoped>
.expert-wrap { position: relative; height: 100%; }
.expert-wrap.not-public { opacity: 0.8; }
.ecard {
  display: flex; flex-direction: column; background: #fff; border: 1px solid #e7e5e4;
  border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; text-decoration: none; color: inherit; height: 100%; text-align: center;
}
a.ecard:hover { transform: translateY(-8px); box-shadow: 0 20px 48px rgba(0,0,0,0.1); border-color: rgba(64,158,255,0.3); }
.ecard-cover { position: relative; height: 64px; }
.cover-bg { position: absolute; inset: 0; }
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.5), transparent); }
.avatar { position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%); width: 56px; height: 56px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-fb { font-weight: 600; font-size: 16px; color: #1e293b; }
.ecard-body { padding: 36px 14px 16px; flex: 1; display: flex; flex-direction: column; text-align: left; }
.name { font-weight: 600; color: #0f172a; text-align: center; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.subtitle { font-size: 12px; color: #64748b; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.rows { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #475569; }
.row { display: flex; justify-content: space-between; gap: 8px; min-width: 0; }
.rl { color: #94a3b8; flex-shrink: 0; }
.rv { text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tags { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.tag { font-size: 10px; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #334155; font-weight: 500; }
.np-badge { position: absolute; top: 8px; right: 8px; z-index: 10; background: rgba(15,23,42,0.6); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 9999px; }
</style>
