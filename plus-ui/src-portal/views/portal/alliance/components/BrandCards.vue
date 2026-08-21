<template>
  <!-- 人才品牌：横版旗舰卡 -->
  <router-link v-if="variant === 'talent'" :to="`/portal/alliance/brands/${brand.id}`" class="bcard talent">
    <div class="talent-cover">
      <img v-if="brand.coverImage" :src="brand.coverImage" :alt="brand.name" class="abs-img" />
      <GradientPlaceholder v-else :seed="brand.name" :label="brand.name" class="abs-img" />
      <div class="talent-overlay" />
    </div>
    <div class="talent-body">
      <h4 class="b-title">{{ brand.name }}</h4>
      <p class="b-desc">{{ brand.description || '暂无品牌描述' }}</p>
      <div class="b-tags">
        <span v-for="tag in tags.slice(0, 3)" :key="tag" class="b-tag-primary">{{ tag }}</span>
      </div>
    </div>
  </router-link>

  <!-- 雇主品牌：企业目录行 -->
  <router-link v-else-if="variant === 'employer'" :to="`/portal/alliance/brands/${brand.id}`" class="brow">
    <div class="brow-logo">
      <img v-if="emp.logoUrl" :src="emp.logoUrl" :alt="brand.name" />
      <GradientPlaceholder v-else :seed="brand.name" :label="brand.name" class="brow-logo-ph" />
    </div>
    <div class="brow-body">
      <div class="brow-title-row">
        <h4 class="brow-title">{{ brand.name }}</h4>
        <span v-if="empSubline" class="brow-subline">{{ empSubline }}</span>
      </div>
      <p class="brow-desc">{{ emp.description || '暂无企业简介' }}</p>
      <div v-if="tags.length" class="brow-tags">
        <span v-for="tag in tags.slice(0, 3)" :key="tag" class="b-tag-primary">{{ tag }}</span>
      </div>
    </div>
    <el-icon class="brow-arrow"><Right /></el-icon>
  </router-link>

  <!-- 岗位品牌：记录行 -->
  <router-link v-else-if="variant === 'job'" :to="`/portal/alliance/brands/${brand.id}`" class="brow">
    <div class="job-icon"><el-icon><Briefcase /></el-icon></div>
    <div class="brow-body">
      <h4 class="brow-title">{{ brand.positionName || brand.name }}</h4>
      <div class="job-meta">
        <span v-if="brand.industryName" class="job-industry">{{ brand.industryName }}</span>
        <span v-for="m in majors.slice(0, 3)" :key="m" class="job-major">{{ m }}</span>
        <span v-if="majors.length > 3" class="job-more">+{{ majors.length - 3 }}</span>
      </div>
    </div>
    <div v-if="salary" class="job-salary">
      <p class="job-salary-v">{{ salary }}</p>
      <p class="job-salary-l">薪资范围</p>
    </div>
    <el-icon class="brow-arrow"><Right /></el-icon>
  </router-link>

  <!-- 专业品牌：封面覆盖卡 -->
  <router-link v-else-if="variant === 'major'" :to="`/portal/alliance/brands/${brand.id}`" class="acard">
    <div class="acard-cover">
      <img v-if="brand.coverImage" :src="brand.coverImage" :alt="brand.name" class="cover-img" />
      <GradientPlaceholder v-else :seed="brand.name" :label="brand.name" class="cover-img" />
      <div class="major-overlay" />
      <div class="major-body">
        <h4 class="major-title">{{ brand.name }}</h4>
        <div v-if="tags.length" class="major-tags">
          <span v-for="tag in tags.slice(0, 2)" :key="tag" class="major-tag">{{ tag }}</span>
        </div>
      </div>
    </div>
    <div class="acard-content">
      <p class="acard-desc">{{ brand.description || '暂无品牌描述' }}</p>
    </div>
  </router-link>

  <!-- 师资品牌：紧凑卡片 -->
  <router-link v-else-if="variant === 'teacher'" :to="`/portal/alliance/brands/${brand.id}`" class="ecard">
    <div class="ecard-cover">
      <GradientPlaceholder :seed="brand.personIndustry || brand.name" class="cover-bg" />
      <div class="cover-overlay" />
      <div class="avatar">
        <img v-if="brand.personAvatar" :src="brand.personAvatar" :alt="teacherName" />
        <span v-else class="avatar-fb">{{ getInitials(teacherName) }}</span>
      </div>
    </div>
    <div class="ecard-body">
      <h4 class="name">{{ teacherName }}</h4>
      <p class="subtitle">{{ teacherSubtitle || '校本教师' }}</p>
      <div class="rows">
        <div v-if="brand.personOrganization" class="row"><span class="rl">单位</span><span class="rv">{{ brand.personOrganization }}</span></div>
        <div v-if="brand.personIndustry" class="row"><span class="rl">行业</span><span class="rv">{{ brand.personIndustry }}</span></div>
        <div v-if="brand.personExperienceYears != null" class="row"><span class="rl">经验</span><span class="rv">{{ brand.personExperienceYears }} 年</span></div>
      </div>
      <div v-if="personSpecialties.length" class="tags">
        <span v-for="tag in personSpecialties.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
      </div>
    </div>
  </router-link>

  <!-- 文化品牌：杂志卡 -->
  <router-link v-else-if="variant === 'culture'" :to="`/portal/alliance/brands/${brand.id}`" class="acard">
    <div class="acard-cover">
      <img v-if="brand.coverImage" :src="brand.coverImage" :alt="brand.name" class="cover-img" />
      <GradientPlaceholder v-else :seed="brand.name" :label="brand.name" class="cover-img" />
      <div class="culture-overlay" />
      <div class="cover-badge"><span class="badge">文化品牌</span></div>
    </div>
    <div class="acard-content">
      <h4 class="acard-title">{{ brand.name }}</h4>
      <p class="acard-desc">{{ brand.description || '暂无品牌描述' }}</p>
      <div class="culture-foot">
        <div v-if="tags.length" class="b-tags">
          <span v-for="tag in tags.slice(0, 2)" :key="tag" class="b-tag">{{ tag }}</span>
        </div>
      </div>
    </div>
  </router-link>

  <!-- 通用品牌卡 -->
  <router-link v-else :to="`/portal/alliance/brands/${brand.id}`" class="acard">
    <div class="acard-cover">
      <img v-if="brand.coverImage" :src="brand.coverImage" :alt="brand.name" class="cover-img" />
      <GradientPlaceholder v-else :seed="brand.name" :label="brand.name" class="cover-img" />
      <div class="cover-overlay" />
      <div class="cover-badge"><span class="badge">{{ typeLabel }}</span></div>
    </div>
    <div class="acard-content">
      <h4 class="acard-title">{{ brand.name }}</h4>
      <p class="acard-desc">{{ brand.description || '暂无品牌描述' }}</p>
      <div v-if="tags.length" class="b-tags">
        <span v-for="tag in tags.slice(0, 3)" :key="tag" class="b-tag">{{ tag }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Briefcase, Right } from '@element-plus/icons-vue';
import GradientPlaceholder from './GradientPlaceholder.vue';
import {
  allianceLabel,
  brandTags,
  employerBrandOf,
  formatSalaryRange,
  getInitials,
  type AlliancePublicBrand,
} from '../shared';

const props = defineProps<{ brand: AlliancePublicBrand; variant: string }>();

const tags = computed(() => brandTags(props.brand));
const emp = computed(() => employerBrandOf(props.brand));
const empSubline = computed(() =>
  [emp.value.industry, emp.value.region].filter(Boolean).join(' · '),
);
const majors = computed(() => props.brand.majorNames ?? []);
const salary = computed(() => formatSalaryRange(props.brand));
const typeLabel = computed(() => allianceLabel('brandType', props.brand.brandType));
const teacherName = computed(() => props.brand.personName || props.brand.name);
const teacherSubtitle = computed(() =>
  [props.brand.personTitle, props.brand.personPosition].filter(Boolean).join(' · '),
);
const personSpecialties = computed(() =>
  Array.isArray(props.brand.personSpecialties) ? props.brand.personSpecialties : [],
);
</script>

<style scoped>
/* 通用卡片 */
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
.cover-badge { position: absolute; top: 12px; left: 12px; }
.badge { background: rgba(255,255,255,0.92); color: #1e293b; border: none; box-shadow: 0 1px 2px rgba(0,0,0,0.08); font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; }
.acard-content { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.acard-title { font-weight: 600; color: #0f172a; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.acard:hover .acard-title { color: #409eff; }
.acard-desc { font-size: 14px; color: #475569; line-height: 1.6; min-height: 2.6em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.b-tags { margin-top: auto; display: flex; flex-wrap: wrap; gap: 4px; }
.b-tag { font-size: 10px; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #334155; font-weight: 500; }
.b-tag-primary { font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: rgba(64,158,255,0.05); color: #409eff; border: 1px solid rgba(64,158,255,0.1); font-weight: 500; }
.b-title { font-weight: 600; color: #0f172a; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.b-desc { font-size: 14px; color: #475569; line-height: 1.6; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* 人才品牌 */
.talent { display: flex; flex-direction: column; background: #fff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; text-decoration: none; color: inherit; height: 100%; }
.talent:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.08); border-color: rgba(64,158,255,0.3); }
.talent-cover { position: relative; aspect-ratio: 16 / 9; overflow: hidden; flex-shrink: 0; }
.abs-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.talent:hover .abs-img { transform: scale(1.05); }
.talent-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.4), transparent, transparent); }
.talent-body { padding: 20px; flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.talent:hover .b-title { color: #409eff; }

/* 行卡（雇主/岗位） */
.brow { display: flex; align-items: center; gap: 16px; padding: 16px 20px; transition: background-color 0.2s; text-decoration: none; color: inherit; }
.brow:hover { background: rgba(64,158,255,0.03); }
.brow-logo { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; flex-shrink: 0; border: 1px solid #f1f5f9; background: #f8fafc; position: relative; }
.brow-logo img { width: 100%; height: 100%; object-fit: cover; }
.brow-logo-ph { position: absolute; inset: 0; }
.brow-body { flex: 1; min-width: 0; }
.brow-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.brow-title { font-weight: 600; font-size: 14px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.brow:hover .brow-title { color: #409eff; }
.brow-subline { font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: #f1f5f9; color: #64748b; font-weight: 500; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.brow-desc { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.brow-tags { display: flex; align-items: center; gap: 4px; margin-top: 6px; min-width: 0; }
.brow-arrow { color: #cbd5e1; transition: color 0.2s, transform 0.2s; flex-shrink: 0; }
.brow:hover .brow-arrow { color: #409eff; transform: translate(2px, -2px); }
.job-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(64,158,255,0.1), rgba(64,158,255,0.05)); display: flex; align-items: center; justify-content: center; color: #409eff; flex-shrink: 0; transition: background 0.2s; }
.brow:hover .job-icon { background: linear-gradient(135deg, rgba(64,158,255,0.15), rgba(64,158,255,0.1)); }
.job-meta { display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap; min-width: 0; }
.job-industry { font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; font-weight: 500; white-space: nowrap; }
.job-major { font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: #f1f5f9; color: #475569; font-weight: 500; white-space: nowrap; }
.job-more { font-size: 10px; color: #94a3b8; white-space: nowrap; }
.job-salary { flex-shrink: 0; text-align: right; }
.job-salary-v { font-size: 16px; font-weight: 700; color: #409eff; line-height: 1.2; }
.job-salary-l { font-size: 10px; color: #94a3b8; margin-top: 2px; }

/* 专业品牌 */
.major-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.3), transparent); }
.major-body { position: absolute; bottom: 0; left: 0; right: 0; padding: 16px; }
.major-title { font-weight: 600; color: #fff; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.major-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.major-tag { font-size: 10px; padding: 2px 8px; border-radius: 9999px; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.25); font-weight: 500; }

/* 师资品牌（复用专家卡样式） */
.ecard {
  display: flex; flex-direction: column; background: #fff; border: 1px solid #e7e5e4;
  border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; text-decoration: none; color: inherit; height: 100%; text-align: center;
}
.ecard:hover { transform: translateY(-8px); box-shadow: 0 20px 48px rgba(0,0,0,0.1); border-color: rgba(64,158,255,0.3); }
.ecard-cover { position: relative; height: 64px; }
.cover-bg { position: absolute; inset: 0; }
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.5), transparent); }
.avatar { position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%); width: 56px; height: 56px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-fb { font-weight: 600; font-size: 16px; color: #1e293b; }
.ecard-body { padding: 36px 14px 16px; flex: 1; display: flex; flex-direction: column; text-align: left; }
.name { font-weight: 600; color: #0f172a; text-align: center; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.ecard:hover .name { color: #409eff; }
.subtitle { font-size: 12px; color: #64748b; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.rows { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #475569; }
.row { display: flex; justify-content: space-between; gap: 8px; min-width: 0; }
.rl { color: #94a3b8; flex-shrink: 0; }
.rv { text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tags { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.tag { font-size: 10px; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #334155; font-weight: 500; }

/* 文化品牌 */
.culture-overlay { position: absolute; inset: 0; background: linear-gradient(to top right, rgba(15,23,42,0.4), transparent, transparent); }
.culture-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 12px; margin-top: 12px; border-top: 1px solid #f1f5f9; }
</style>
