import { defineStore } from 'pinia';
import { authApi } from '@/api/auth';
import type { LoginRequest, LoginResponse, MeResponse, User } from '@/api/auth';
import { getToken, removeToken, setToken } from '@/api/http';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken() || '',
    user: null as User | null
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token)
  },
  actions: {
    async login(req: LoginRequest): Promise<LoginResponse> {
      const res = await authApi.portalLogin(req);
      if (res.token) {
        setToken(res.token);
        this.token = res.token;
        this.user = res.user;
      }
      return res;
    },
    async selectTenant(preAuthToken: string, tenantId: string): Promise<LoginResponse> {
      const res = await authApi.selectTenant({ preAuthToken, tenantId });
      setToken(res.token);
      this.token = res.token;
      this.user = res.user;
      return res;
    },
    async fetchMe(): Promise<MeResponse> {
      const res = await authApi.portalMe();
      this.user = res.user;
      return res;
    },
    logout() {
      removeToken();
      this.token = '';
      this.user = null;
    }
  }
});
