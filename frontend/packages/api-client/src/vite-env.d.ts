// Vite 构建期环境变量类型（前端经 Vite 以 import.meta.env.VITE_* 注入，替代原 process.env.NEXT_PUBLIC_*）。
// 本包为共享库、独立 tsc 时不引用 vite/client，故自声明最小 ImportMetaEnv，避免引入 vite 依赖；
// 与前端侧 vite/client 的全局 ImportMeta 声明按 interface 合并，不冲突。
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DEFAULT_PLATFORM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
