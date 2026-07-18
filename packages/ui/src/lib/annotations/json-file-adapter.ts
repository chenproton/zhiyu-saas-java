import fs from 'fs'
import path from 'path'
import type { Annotation, Comment, AnnotationStore } from './types'
import type { AnnotationAdapter } from './adapter'

export interface JsonFileAdapterOptions {
  filePath?: string
}

export function createJsonFileAdapter(
  options: JsonFileAdapterOptions = {}
): AnnotationAdapter {
  const DATA_PATH =
    options.filePath ||
    process.env.ANNOTATION_SYSTEM_DATA_PATH ||
    path.join(process.cwd(), 'data/annotations.json')

  let store: AnnotationStore | null = null

  function ensureDataDir() {
    const dir = path.dirname(DATA_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  function loadStore(): AnnotationStore {
    if (store) return store
    ensureDataDir()
    try {
      const data = fs.readFileSync(DATA_PATH, 'utf-8')
      store = JSON.parse(data) as AnnotationStore
    } catch {
      store = { annotations: [], comments: [] }
      saveStore()
    }
    return store
  }

  function saveStore() {
    if (!store) return
    ensureDataDir()
    fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2))
  }

  return {
    async getAnnotationsByPage(page: string, context?: string): Promise<Annotation[]> {
      const s = loadStore()
      const ctx = context || 'default'
      return s.annotations.filter(
        (a) => a.page === page && (a.context || 'default') === ctx
      )
    },

    async getAnnotationById(id: string): Promise<Annotation | undefined> {
      const s = loadStore()
      return s.annotations.find((a) => a.id === id)
    },

    async createAnnotation(
      annotation: Omit<Annotation, 'id' | 'createdAt'>
    ): Promise<Annotation> {
      const s = loadStore()
      const newAnnotation: Annotation = {
        ...annotation,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      s.annotations.push(newAnnotation)
      saveStore()
      return newAnnotation
    },

    async updateAnnotation(
      id: string,
      updates: Partial<Pick<Annotation, 'x' | 'y' | 'content' | 'imageUrl' | 'closed'>>
    ): Promise<Annotation | undefined> {
      const s = loadStore()
      const index = s.annotations.findIndex((a) => a.id === id)
      if (index === -1) return undefined
      s.annotations[index] = { ...s.annotations[index], ...updates }
      saveStore()
      return s.annotations[index]
    },

    async deleteAnnotation(id: string): Promise<boolean> {
      const s = loadStore()
      const initialLength = s.annotations.length
      s.annotations = s.annotations.filter((a) => a.id !== id)
      s.comments = s.comments.filter((c) => c.annotationId !== id)
      saveStore()
      return s.annotations.length !== initialLength
    },

    async getCommentsByAnnotationId(
      annotationId: string
    ): Promise<Comment[]> {
      const s = loadStore()
      return s.comments
        .filter((c) => c.annotationId === annotationId)
        .sort((a, b) => a.createdAt - b.createdAt)
    },

    async createComment(
      comment: Omit<Comment, 'id' | 'createdAt'>
    ): Promise<Comment> {
      const s = loadStore()
      const newComment: Comment = {
        ...comment,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      s.comments.push(newComment)
      saveStore()
      return newComment
    },

    async deleteComment(id: string): Promise<boolean> {
      const s = loadStore()
      const idsToDelete = new Set<string>()
      const queue = [id]

      while (queue.length > 0) {
        const currentId = queue.shift()
        if (!currentId || idsToDelete.has(currentId)) continue
        idsToDelete.add(currentId)

        s.comments.forEach((comment) => {
          if (comment.parentId === currentId) {
            queue.push(comment.id)
          }
        })
      }

      const initialLength = s.comments.length
      s.comments = s.comments.filter((c) => !idsToDelete.has(c.id))
      saveStore()
      return s.comments.length !== initialLength
    },
  }
}
