import type { Annotation, Comment } from './types'

/**
 * AnnotationAdapter 接口
 *
 * 定义标注系统的数据持久化契约。任何后端存储（文件系统、数据库、HTTP 服务等）
 * 都可以通过实现此接口接入标注系统。
 */
export interface AnnotationAdapter {
  /** 获取指定页面和上下文的所有标注 */
  getAnnotationsByPage(page: string, context?: string): Promise<Annotation[]>

  /** 根据 ID 获取单个标注 */
  getAnnotationById(id: string): Promise<Annotation | undefined>

  /** 创建新标注 */
  createAnnotation(
    annotation: Omit<Annotation, 'id' | 'createdAt'>
  ): Promise<Annotation>

  /** 更新标注（位置、内容、图片） */
  updateAnnotation(
    id: string,
    updates: Partial<Pick<Annotation, 'x' | 'y' | 'content' | 'imageUrl' | 'closed'>>
  ): Promise<Annotation | undefined>

  /** 删除标注（连带删除其所有评论） */
  deleteAnnotation(id: string): Promise<boolean>

  /** 获取某标注下的所有评论 */
  getCommentsByAnnotationId(annotationId: string): Promise<Comment[]>

  /** 创建评论 */
  createComment(
    comment: Omit<Comment, 'id' | 'createdAt'>
  ): Promise<Comment>

  /** 删除评论（连带删除其所有回复） */
  deleteComment(id: string): Promise<boolean>
}
