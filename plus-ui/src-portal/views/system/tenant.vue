<template>
  <div class="list-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h1 class="page-title">租户信息管理</h1>
        <p class="page-desc">查看和编辑当前租户及学校信息</p>
      </div>
      <div class="header-actions">
        <el-button v-if="tenant" type="primary" @click="openEditDialog">编辑</el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 16px">
      <template #default>
        <el-button size="small" text type="primary" @click="fetchTenant">重试</el-button>
      </template>
    </el-alert>

    <template v-if="tenant">
      <!-- 租户基本信息 -->
      <el-card shadow="never" class="section-card">
        <div class="tenant-head">
          <div class="tenant-head-left">
            <div class="tenant-icon">🏫</div>
            <div>
              <div class="tenant-name">{{ tenant.enterpriseName }}</div>
              <div class="tenant-code">{{ tenant.code }}</div>
            </div>
          </div>
          <el-tag :type="tenant.status === 'active' ? 'success' : 'info'">
            {{ tenant.status === 'active' ? '启用' : '停用' }}
          </el-tag>
        </div>
        <div class="info-grid">
          <div v-for="f in infoFields" :key="f.label" class="info-item">
            <div class="info-label">{{ f.label }}</div>
            <div class="info-value">{{ f.value }}</div>
          </div>
        </div>
        <div v-if="tenant.description && tenant.description !== '-'" class="tenant-desc">
          <div class="info-label">学校简介</div>
          <div class="info-value">{{ tenant.description }}</div>
        </div>
      </el-card>

      <!-- 学校管理员 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div>
            <div class="card-title">学校管理员</div>
            <div class="card-subtitle">管理当前租户的学校管理员账号</div>
          </div>
        </template>

        <el-alert v-if="adminError" :title="adminError" type="error" :closable="false" show-icon style="margin-bottom: 12px" />

        <el-table v-loading="adminLoading" :data="admins" stripe :empty-text="adminLoading ? '加载中...' : '暂无学校管理员'">
          <el-table-column label="账号" min-width="140">
            <template #default="{ row }"><span class="cell-mono">{{ row.username }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="姓名" min-width="120" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                {{ row.status === 'active' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openAdminPassword(row)">修改密码</el-button>
              <el-button size="small" @click="openAdminEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="confirmAdminDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- 编辑租户信息 -->
    <el-dialog v-model="editDialog" title="编辑信息" width="640px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="租户标识">
              <el-input :model-value="tenant?.code || ''" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-input :model-value="tenant?.status === 'active' ? '启用' : '停用'" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">基础信息</el-divider>

        <el-form-item label="学校名称" required>
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="学校代码">
              <el-input v-model="formData.enterpriseCode" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学校简称">
              <el-input v-model="formData.shortName" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="办学层次">
              <el-select v-model="formData.educationLevel" clearable style="width: 100%" placeholder="请选择">
                <el-option v-for="lv in EDUCATION_LEVELS" :key="lv" :label="lv" :value="lv" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="办学性质">
              <el-select v-model="formData.educationNature" clearable style="width: 100%" placeholder="请选择">
                <el-option label="公办" value="公办" />
                <el-option label="民办" value="民办" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="省份">
              <el-select v-model="formData.province" clearable style="width: 100%" placeholder="请选择省份" @change="onProvinceChange">
                <el-option v-for="p in PROVINCES" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="城市">
              <el-select v-model="formData.city" clearable style="width: 100%" :placeholder="formData.province ? '请选择城市' : '请先选省份'" :disabled="!formData.province">
                <el-option v-for="c in cities" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="学校简介">
          <el-input v-model="formData.description" type="textarea" :rows="3" />
        </el-form-item>

        <el-divider content-position="left">联系信息</el-divider>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="formData.contact" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="formData.contactPhone" @input="onContactPhoneInput" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="学校地址">
          <el-input v-model="formData.address" />
        </el-form-item>

        <el-divider content-position="left">网络信息</el-divider>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="官网">
              <el-input v-model="formData.website" placeholder="https://www.example.edu.cn" @input="onWebsiteInput" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="绑定域名">
              <el-input v-model="formData.domain" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-alert v-if="dialogError" :title="dialogError" type="error" :closable="false" show-icon style="margin-bottom: 12px" />

      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUpdate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 管理员编辑 -->
    <el-dialog v-model="adminEditDialog" title="编辑管理员" width="440px">
      <el-form label-width="70px">
        <el-form-item label="账号" required>
          <el-input v-model="adminForm.username" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="adminForm.name" placeholder="姓名" />
        </el-form-item>
      </el-form>
      <el-alert v-if="adminError" :title="adminError" type="error" :closable="false" show-icon style="margin-bottom: 12px" />
      <template #footer>
        <el-button @click="adminEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="adminSubmitting" @click="submitAdminEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 管理员修改密码 -->
    <el-dialog v-model="adminPasswordDialog" :title="`修改密码：${passwordAdmin?.name || ''}`" width="440px">
      <el-form label-width="90px">
        <el-form-item label="新密码" required>
          <el-input v-model="newPassword" type="password" show-password placeholder="至少 8 位，包含字母和数字" />
        </el-form-item>
        <el-form-item label="确认新密码" required>
          <el-input v-model="confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <el-alert v-if="passwordError" :title="passwordError" type="error" :closable="false" show-icon style="margin-bottom: 12px" />
      <template #footer>
        <el-button @click="adminPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="passwordSubmitting" @click="submitAdminPassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { portalRequest } from '@/api/http';
import type { ListResponse } from '@/api/http';

// ===== 类型 =====
interface BackendTenant {
  id: string;
  name: string;
  code: string;
  domain?: string;
  enterpriseCode?: string;
  contact?: string;
  phone?: string;
  address?: string;
  description?: string;
  shortName?: string;
  schoolType?: string;
  province?: string;
  city?: string;
  website?: string;
  contactPhone?: string;
  educationLevel?: string;
  educationNature?: string;
  adminIds?: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

interface TenantInfo {
  id: string;
  code: string;
  enterpriseName: string;
  contact: string;
  phone: string;
  adminCount: number;
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
  status: 'active' | 'inactive';
  createdAt: string;
}

interface TenantAdmin {
  id: string;
  tenantId: string;
  username: string;
  loginName: string;
  name: string;
  status: string;
  newPassword?: string;
  createdAt: string;
  updatedAt: string;
}

const EDUCATION_LEVELS = ['普通本科院校', '职业本科院校', '高职院校', '中等专业学校', '职业高中', '技工学校'];

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
  西藏: ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲']
};
const PROVINCES = Object.keys(CHINA_REGION);

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

// ===== 租户信息 =====
const tenant = ref<TenantInfo | null>(null);
const loading = ref(false);
const error = ref('');

const editDialog = ref(false);
const dialogError = ref('');
const submitting = ref(false);
const formData = reactive<Record<string, string>>({});

function mapBackendTenant(t: BackendTenant): TenantInfo {
  return {
    id: t.id,
    code: t.code,
    enterpriseName: t.name,
    contact: t.contact || '-',
    phone: t.phone || '-',
    adminCount: (t.adminIds || []).length,
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
    status: t.status,
    createdAt: t.createdAt
  };
}

const infoFields = computed(() => {
  if (!tenant.value) return [];
  const t = tenant.value;
  const phoneText = t.contactPhone !== '-' ? t.contactPhone : t.phone;
  const provinceCity = t.province === '-' && t.city === '-' ? '-' : `${t.province} ${t.city}`;
  return [
    { label: '联系人', value: `${t.contact} / ${phoneText}` },
    { label: '学校简称', value: t.shortName },
    { label: '办学层次', value: t.educationLevel },
    { label: '省份/城市', value: provinceCity },
    { label: '官网', value: t.website },
    { label: '绑定域名', value: t.domain },
    { label: '学校地址', value: t.address },
    { label: '学校代码', value: t.enterpriseCode },
    { label: '创建时间', value: t.createdAt },
    { label: '管理员', value: `${t.adminCount}人` }
  ];
});

const cities = computed(() => (formData.province ? CHINA_REGION[formData.province] || [] : []));

function loadTenantToForm(ten: TenantInfo) {
  const knownProvince = PROVINCES.includes(ten.province);
  formData.name = ten.enterpriseName;
  formData.shortName = ten.shortName === '-' ? '' : ten.shortName;
  formData.province = knownProvince ? ten.province : '';
  formData.city = knownProvince && ten.city !== '-' && ten.city ? ten.city : '';
  formData.contact = ten.contact === '-' ? '' : ten.contact;
  formData.phone = ten.phone === '-' ? '' : ten.phone;
  formData.contactPhone = ten.contactPhone === '-' ? '' : ten.contactPhone;
  formData.domain = ten.domain === '-' ? '' : ten.domain;
  formData.address = ten.address === '-' ? '' : ten.address;
  formData.website = ten.website === '-' ? '' : ten.website;
  formData.enterpriseCode = ten.enterpriseCode === '-' ? '' : ten.enterpriseCode;
  formData.description = ten.description === '-' ? '' : ten.description;
  formData.educationLevel = ten.educationLevel === '-' ? '' : ten.educationLevel;
  formData.educationNature = ten.educationNature === '-' ? '' : ten.educationNature;
}

async function fetchTenant() {
  if (!tenantId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await portalRequest<BackendTenant>(`/tenants/${tenantId.value}`);
    const ten = mapBackendTenant(res);
    tenant.value = ten;
    loadTenantToForm(ten);
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function openEditDialog() {
  if (tenant.value) {
    loadTenantToForm(tenant.value);
    dialogError.value = '';
    editDialog.value = true;
  }
}

function onProvinceChange() {
  formData.city = '';
}

function onContactPhoneInput(v: string) {
  formData.phone = v;
  formData.contactPhone = v;
}

function onWebsiteInput(v: string) {
  formData.website = v ? (v.startsWith('http') ? v : 'https://' + v) : v;
}

async function handleUpdate() {
  if (!formData.name || !tenant.value) {
    dialogError.value = '请填写学校名称';
    return;
  }
  submitting.value = true;
  dialogError.value = '';
  try {
    await portalRequest(`/tenants/${tenant.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: formData.name,
        contact: formData.contact || null,
        phone: formData.phone || formData.contactPhone || null,
        domain: formData.domain || null,
        address: formData.address || null,
        enterpriseCode: formData.enterpriseCode || null,
        description: formData.description || null,
        shortName: formData.shortName || null,
        ...(formData.province ? { province: formData.province, city: formData.city || null } : {}),
        website: formData.website ? (formData.website.startsWith('http') ? formData.website : 'https://' + formData.website) : null,
        contactPhone: formData.contactPhone || formData.phone || null,
        educationLevel: formData.educationLevel || null,
        educationNature: formData.educationNature || null
      })
    });
    editDialog.value = false;
    ElMessage.success('保存成功');
    await fetchTenant();
  } catch (e) {
    dialogError.value = (e as Error).message || '更新失败';
  } finally {
    submitting.value = false;
  }
}

// ===== 学校管理员 =====
const admins = ref<TenantAdmin[]>([]);
const adminLoading = ref(false);
const adminError = ref('');
const adminEditDialog = ref(false);
const adminSubmitting = ref(false);
const adminEditing = ref<TenantAdmin | null>(null);
const adminForm = reactive({ username: '', name: '' });

const adminPasswordDialog = ref(false);
const passwordAdmin = ref<TenantAdmin | null>(null);
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const passwordSubmitting = ref(false);
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

async function fetchAdmins() {
  if (!tenantId.value) return;
  adminLoading.value = true;
  adminError.value = '';
  try {
    const res = await portalRequest<ListResponse<TenantAdmin>>('/admins');
    admins.value = res.items;
  } catch (e) {
    adminError.value = (e as Error).message || '加载管理员列表失败';
  } finally {
    adminLoading.value = false;
  }
}

function openAdminEdit(a: TenantAdmin) {
  adminEditing.value = a;
  adminForm.username = a.username;
  adminForm.name = a.name;
  adminError.value = '';
  adminEditDialog.value = true;
}

async function submitAdminEdit() {
  if (!adminEditing.value) return;
  if (!adminForm.username || !adminForm.name) {
    adminError.value = '账号和姓名不能为空';
    return;
  }
  adminSubmitting.value = true;
  adminError.value = '';
  try {
    await portalRequest(`/admins/${adminEditing.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ username: adminForm.username, name: adminForm.name })
    });
    ElMessage.success('保存成功');
    adminEditDialog.value = false;
    await fetchAdmins();
  } catch (e) {
    adminError.value = (e as Error).message || '保存失败';
  } finally {
    adminSubmitting.value = false;
  }
}

async function confirmAdminDelete(a: TenantAdmin) {
  try {
    await ElMessageBox.confirm(`确定删除管理员「${a.name}（${a.username}）」吗？此操作不可撤销。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await portalRequest(`/admins/${a.id}`, { method: 'DELETE' });
    ElMessage.success('删除成功');
    await fetchAdmins();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

function openAdminPassword(a: TenantAdmin) {
  passwordAdmin.value = a;
  newPassword.value = '';
  confirmPassword.value = '';
  passwordError.value = '';
  adminPasswordDialog.value = true;
}

async function submitAdminPassword() {
  if (!passwordAdmin.value) return;
  if (!newPassword.value) {
    passwordError.value = '请输入新密码';
    return;
  }
  if (!PASSWORD_RULE.test(newPassword.value)) {
    passwordError.value = '密码长度至少 8 位，且需同时包含字母和数字';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的密码不一致';
    return;
  }
  passwordSubmitting.value = true;
  passwordError.value = '';
  try {
    await portalRequest(`/admins/${passwordAdmin.value.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: newPassword.value })
    });
    ElMessage.success('修改成功');
    adminPasswordDialog.value = false;
  } catch (e) {
    passwordError.value = (e as Error).message || '修改密码失败';
  } finally {
    passwordSubmitting.value = false;
  }
}

onMounted(() => {
  fetchTenant();
  fetchAdmins();
});
</script>

<style scoped>
.list-page { padding: 16px; min-height: 300px; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.page-desc { color: #909399; font-size: 13px; margin: 4px 0 0; }
.header-actions { display: flex; gap: 8px; }
.section-card { margin-bottom: 16px; }
.tenant-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tenant-head-left { display: flex; align-items: center; gap: 12px; }
.tenant-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #ecf5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.tenant-name { font-size: 16px; font-weight: 600; }
.tenant-code { font-family: monospace; font-size: 12px; color: #909399; margin-top: 2px; }
.tenant-desc-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.head-actions { display: flex; align-items: center; gap: 8px; }
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 16px;
}
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-label { font-size: 12px; color: #909399; }
.info-value { font-size: 14px; }
.tenant-desc { margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.card-title { font-size: 15px; font-weight: 600; }
.card-subtitle { color: #909399; font-size: 12px; margin-top: 2px; }
.cell-mono { font-family: monospace; font-size: 13px; }
</style>
