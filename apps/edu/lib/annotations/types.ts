export type Annotation = {
  id: string
  page: string
  context?: string
  x: number
  y: number
  content: string
  imageUrl?: string
  closed?: boolean
  createdAt: number
}

export type Comment = {
  id: string
  annotationId: string
  user: string
  text: string
  imageUrl?: string
  createdAt: number
  parentId?: string | null
}

export type AnnotationMode = 'off' | 'view' | 'edit'

export interface AnnotationStore {
  annotations: Annotation[]
  comments: Comment[]
}

/** AnnotationSystem 组件主题配置 */
export interface AnnotationTheme {
  /** 主色调（标注点、发送按钮等），默认 #ef4444 */
  primary?: string
  /** 次色调（查看模式按钮等），默认 #3b82f6 */
  secondary?: string
  /** 危险/删除色，默认 #ef4444 */
  danger?: string
  /** 标注点直径（px），默认 32 */
  dotSize?: number
  /** 控制面板背景色，默认 #ffffff */
  panelBg?: string
  /** 控制面板文字色，默认 #374151 */
  panelText?: string
}

/** AnnotationSystem 组件 Props */
export interface AnnotationSystemProps {
  /** 页面标识，默认自动读取 pathname */
  page?: string
  /** 上下文标识，用于同一路由下区分不同层级（如弹窗），默认 "default" */
  context?: string
  /** API 路由前缀，默认 "/api" */
  apiBasePath?: string
  /** 默认模式，默认 "view" */
  defaultMode?: AnnotationMode
  /** 当前用户名，默认从 localStorage 读取 */
  currentUser?: string
  /** z-index 基础值，默认 2147483647（永远在最上层） */
  zIndex?: number
  /** 主题配置 */
  theme?: AnnotationTheme
  /** 模式变化回调 */
  onModeChange?: (mode: AnnotationMode) => void
  /**
   * 弹窗模式：标注层使用 fixed inset-0 覆盖整个 viewport，
   * 与原始 annotation-system 行为一致。适合在 Dialog/Sheet 等弹窗内部使用。
   */
  fixed?: boolean
  /**
   * 容器模式：将标注层挂载到指定的 DOM 元素内部（通过 createPortal），
   * 使用 absolute inset-0 覆盖该容器。适合弹窗内部有可滚动子容器时使用。
   */
  containerRef?: React.RefObject<HTMLElement | null>
}

/** useAnnotations Hook 配置 */
export interface UseAnnotationsConfig {
  page: string
  context?: string
  apiBasePath: string
  defaultMode: AnnotationMode
  currentUser?: string
}
