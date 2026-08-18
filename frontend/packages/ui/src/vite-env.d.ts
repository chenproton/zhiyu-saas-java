// 本包（以及经 @zhiyu/api-client 源码引入的 api-client）在独立 tsc 时用到 import.meta.env，
// 故自声明最小 ImportMetaEnv（与前端侧 vite/client 全局声明按 interface 合并，不冲突）。
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DEFAULT_PLATFORM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
