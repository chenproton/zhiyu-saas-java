import { NextResponse } from 'next/server'
import { createJsonFileAdapter } from "@/lib/annotations/json-file-adapter"

const adapter = createJsonFileAdapter()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const annotationId = searchParams.get('annotationId')

    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID required' }, { status: 400 })
    }

    const comments = await adapter.getCommentsByAnnotationId(annotationId)
    return NextResponse.json(comments)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { annotationId, user, text, parentId, imageUrl } = await request.json()

    if (!annotationId || !user || !text) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const comment = await adapter.createComment({ annotationId, user, text, parentId, imageUrl })
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const deleted = await adapter.deleteComment(id)

    if (!deleted) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
