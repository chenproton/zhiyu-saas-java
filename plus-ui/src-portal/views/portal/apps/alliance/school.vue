<template>
  <div class="school-page">
    <div v-if="loading" class="loading-wrap">
      <el-skeleton :rows="6" animated />
    </div>

    <template v-else>
      <div class="page-head">
        <div>
          <h1 class="page-title">学校信息管理</h1>
          <p class="page-desc">配置学校基本信息，与租户信息同步</p>
        </div>
        <el-button v-if="tenant" size="small" @click="openEdit">
          <el-icon class="mr-4"><Edit /></el-icon>
          编辑
        </el-button>
      </div>

      <el-alert v-if="error && !tenant" type="error" :title="error" show-icon class="error-alert">
        <template #default>
          <el-button size="small" @click="load">重试</el-button>
        </template>
      </el-alert>

      <div v-if="tenant" class="card">
        <div class="card__head">
          <el-image v-if="tenant.logoUrl && tenant.logoUrl !== '-'" :src="tenant.logoUrl" fit="cover" class="school-logo" />
          <div v-else class="school-logo school-logo--placeholder">
            <el-icon><OfficeBuilding /></el-icon>
          </div>
          <div>
            <h2 class="school-name">{{ tenant.enterpriseName }}</h2>
            <p class="school-sub">
              {{ tenant.educationLevel !== '-' ? tenant.educationLevel : '' }}
              {{ tenant.educationNature !== '-' ? `/ ${tenant.educationNature}` : '' }}
            </p>
          </div>
        </div>
        <div class="field-grid">
          <div class="field-item">
            <p class="field-label">联系人</p>
            <p class="field-value">{{ tenant.contact }} / {{ tenant.contactPhone !== '-' ? tenant.contactPhone : tenant.phone }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">学校简称</p>
            <p class="field-value">{{ tenant.shortName }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">办学层次</p>
            <p class="field-value">{{ tenant.educationLevel }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">省份/城市</p>
            <p class="field-value">{{ tenant.province }} {{ tenant.city }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">官网</p>
            <p class="field-value">{{ tenant.website }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">绑定域名</p>
            <p class="field-value">{{ tenant.domain }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">学校地址</p>
            <p class="field-value">{{ tenant.address }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">学校代码</p>
            <p class="field-value">{{ tenant.enterpriseCode }}</p>
          </div>
          <div class="field-item">
            <p class="field-label">创建时间</p>
            <p class="field-value">{{ tenant.createdAt }}</p>
          </div>
        </div>
        <div v-if="tenant.description && tenant.description !== '-'" class="school-desc">
          <p class="field-label">学校简介</p>
          <p class="field-value">{{ tenant.description }}</p>
        </div>
      </div>
    </template>

    <el-dialog v-model="editOpen" title="编辑学校信息" width="640px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="学校 Logo">
          <ImageUpload v-model="form.logoUrl" />
        </el-form-item>
        <el-form-item label="学校名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="学校代码">
          <el-input v-model="form.enterpriseCode" />
        </el-form-item>
        <el-form-item label="学校简称">
          <el-input v-model="form.shortName" />
        </el-form-item>
        <el-form-item label="办学层次">
          <el-select v-model="form.educationLevel" placeholder="请选择" style="width: 100%">
            <el-option label="普通本科院校" value="普通本科院校" />
            <el-option label="职业本科院校" value="职业本科院校" />
            <el-option label="高职院校" value="高职院校" />
            <el-option label="中等专业学校" value="中等专业学校" />
            <el-option label="职业高中" value="职业高中" />
            <el-option label="技工学校" value="技工学校" />
          </el-select>
        </el-form-item>
        <el-form-item label="办学性质">
          <el-select v-model="form.educationNature" placeholder="请选择" style="width: 100%">
            <el-option label="公办" value="公办" />
            <el-option label="民办" value="民办" />
          </el-select>
        </el-form-item>
        <el-form-item label="省份">
          <el-select v-model="form.province" placeholder="请选择省份" style="width: 100%" @change="onProvinceChange">
            <el-option v-for="p in PROVINCES" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="城市">
          <el-select v-model="form.city" :disabled="!form.province" :placeholder="form.province ? '请选择城市' : '请先选省份'" style="width: 100%">
            <el-option v-for="c in cities" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="学校简介">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contact" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.contactPhone" />
        </el-form-item>
        <el-form-item label="学校地址">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="官网">
          <el-input v-model="form.website" placeholder="https://www.example.edu.cn" />
        </el-form-item>
        <el-form-item label="绑定域名">
          <el-input v-model="form.domain" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, OfficeBuilding } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import ImageUpload from './components/ImageUpload.vue';

const auth = useAuthStore();
const tenantId = () => (auth.user?.tenantId as string) || '';

interface Tenant {
  id: string;
  code: string;
  enterpriseName: string;
  contact: string;
  phone: string;
  domain: string;
  address: string;
  enterpriseCode: string;
  description: string;
  shortName: string;
  province: string;
  city: string;
  website: string;
  contactPhone: string;
  educationLevel: string;
  educationNature: string;
  logoUrl: string;
  status: string;
  createdAt: string;
  secondaryColleges?: string[];
}

const CHINA_REGION: Record<string, string[]> = {
  北京: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区', '通州区', '大兴区'],
  上海: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '浦东新区', '闵行区'],
  天津: ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '滨海新区'],
  重庆: ['渝中区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '渝北区'],
  广东: ['广州', '深圳', '珠海', '东莞', '佛山', '中山', '惠州', '汕头'],
  浙江: ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '台州'],
  江苏: ['南京', '苏州', '无锡', '常州', '南通', '徐州', '扬州', '镇江'],
  山东: ['济南', '青岛', '烟台', '潍坊', '临沂', '淄博', '威海', '日照'],
  四川: ['成都', '绵阳', '德阳', '宜宾', '南充', '泸州', '乐山'],
  湖北: ['武汉', '宜昌', '襄阳', '荆州', '黄石', '十堰', '孝感'],
  湖南: ['长沙', '株洲', '湘潭', '衡阳', '岳阳', '常德', '郴州'],
  河南: ['郑州', '洛阳', '开封', '新乡', '南阳', '许昌', '周口'],
  河北: ['石家庄', '唐山', '保定', '邯郸', '廊坊', '沧州', '秦皇岛'],
  福建: ['福州', '厦门', '泉州', '漳州', '莆田', '龙岩', '三明'],
  安徽: ['合肥', '芜湖', '蚌埠', '马鞍山', '安庆', '滁州', '阜阳'],
  陕西: ['西安', '咸阳', '宝鸡', '汉中', '渭南', '延安', '榆林'],
  辽宁: ['沈阳', '大连', '鞍山', '抚顺', '本溪', '锦州', '营口'],
  江西: ['南昌', '九江', '赣州', '景德镇', '萍乡', '新余', '宜春'],
  云南: ['昆明', '曲靖', '玉溪', '大理', '丽江', '保山', '昭通'],
  贵州: ['贵阳', '遵义', '毕节', '六盘水', '安顺', '铜仁'],
  广西: ['南宁', '柳州', '桂林', '北海', '玉林', '梧州', '百色'],
  黑龙江: ['哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '鸡西'],
  吉林: ['长春', '吉林市', '四平', '通化', '延边', '白城'],
  山西: ['太原', '大同', '阳泉', '长治', '临汾', '运城', '晋城'],
  内蒙: ['呼和浩特', '包头', '鄂尔多斯', '赤峰', '通辽', '呼伦贝尔'],
  甘肃: ['兰州', '天水', '白银', '酒泉', '张掖', '武威'],
  新疆: ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '喀什', '伊犁'],
  海南: ['海口', '三亚', '儋州', '琼海', '文昌', '万宁'],
  宁夏: ['银川', '石嘴山', '吴忠', '固原', '中卫'],
  青海: ['西宁', '海东', '格尔木', '德令哈', '玉树'],
  西藏: ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲'],
};
const PROVINCES = Object.keys(CHINA_REGION);

const tenant = ref<Tenant | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const editOpen = ref(false);
const submitting = ref(false);
const form = ref<Record<string, string>>({});

const cities = computed(() => (form.value.province ? CHINA_REGION[form.value.province] || [] : []));

function mapBackendTenant(t: any): Tenant {
  return {
    id: t.id,
    code: t.code,
    enterpriseName: t.name,
    contact: t.contact || '-',
    phone: t.phone || '-',
    domain: t.domain || '-',
    address: t.address || '-',
    enterpriseCode: t.enterpriseCode || '-',
    description: t.description || '-',
    shortName: t.shortName || '-',
    province: t.province || '-',
    city: t.city || '-',
    website: t.website || '-',
    contactPhone: t.contactPhone || '-',
    educationLevel: t.educationLevel || '-',
    educationNature: t.educationNature || '-',
    logoUrl: t.logoUrl || '-',
    status: t.status,
    createdAt: t.createdAt,
    secondaryColleges: t.secondaryColleges || [],
  };
}

function loadTenantToForm(t: Tenant) {
  form.value = {
    name: t.enterpriseName,
    shortName: t.shortName === '-' ? '' : t.shortName,
    province: PROVINCES.includes(t.province) ? t.province : '',
    city: t.city !== '-' && t.city && CHINA_REGION[t.province]?.includes(t.city) ? t.city : '',
    contact: t.contact === '-' ? '' : t.contact,
    phone: t.phone === '-' ? '' : t.phone,
    contactPhone: t.contactPhone === '-' ? '' : t.contactPhone,
    domain: t.domain === '-' ? '' : t.domain,
    address: t.address === '-' ? '' : t.address,
    website: t.website === '-' ? '' : t.website,
    enterpriseCode: t.enterpriseCode === '-' ? '' : t.enterpriseCode,
    description: t.description === '-' ? '' : t.description,
    educationLevel: t.educationLevel === '-' ? '' : t.educationLevel,
    educationNature: t.educationNature === '-' ? '' : t.educationNature,
    logoUrl: t.logoUrl === '-' ? '' : t.logoUrl,
    secondaryColleges: (t.secondaryColleges || []).join(','),
  };
}

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  error.value = null;
  try {
    const res = await portalRequest<any>(`/tenants/${tenantId()}`);
    const t = mapBackendTenant(res);
    tenant.value = t;
    loadTenantToForm(t);
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function onProvinceChange() {
  form.value.city = '';
}

function openEdit() {
  if (tenant.value) {
    loadTenantToForm(tenant.value);
    editOpen.value = true;
  }
}

async function save() {
  if (!form.value.name || !tenant.value) {
    error.value = '请填写学校名称';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const website = form.value.website
      ? form.value.website.startsWith('http')
        ? form.value.website
        : 'https://' + form.value.website
      : null;
    const secondaryColleges = (form.value.secondaryColleges || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await portalRequest(`/tenants/${tenant.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: form.value.name,
        logoUrl: form.value.logoUrl || null,
        contact: form.value.contact || null,
        phone: form.value.phone || form.value.contactPhone || null,
        domain: form.value.domain || null,
        address: form.value.address || null,
        enterpriseCode: form.value.enterpriseCode || null,
        description: form.value.description || null,
        shortName: form.value.shortName || null,
        province: form.value.province || null,
        city: form.value.city || null,
        website,
        contactPhone: form.value.contactPhone || form.value.phone || null,
        educationLevel: form.value.educationLevel || null,
        educationNature: form.value.educationNature || null,
        secondaryColleges,
      }),
    });
    ElMessage.success('已保存');
    editOpen.value = false;
    await load();
  } catch (e) {
    error.value = (e as Error).message || '保存失败';
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.school-page {
  min-height: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.loading-wrap {
  padding: 24px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.page-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.mr-4 {
  margin-right: 4px;
}
.error-alert {
  margin-bottom: 16px;
}
.card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid #f1f5f9;
}
.school-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.school-logo--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #409eff;
}
.school-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}
.school-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  padding: 20px;
}
.field-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #94a3b8;
}
.field-value {
  margin: 0;
  font-size: 14px;
  color: #0f172a;
  word-break: break-all;
}
.school-desc {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
}
.school-desc .field-value {
  margin-top: 8px;
  line-height: 1.7;
  color: #334155;
}
@media (max-width: 992px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
