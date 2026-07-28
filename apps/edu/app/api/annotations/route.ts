import { NextResponse } from 'next/server'
import { createJsonFileAdapter } from "@/lib/annotations/json-file-adapter"

const adapter = createJsonFileAdapter()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page')
    const context = searchParams.get('context') || 'default'

    if (!page) {
      return NextResponse.json({ error: 'Page parameter required' }, { status: 400 })
    }

    const annotations = await adapter.getAnnotationsByPage(page, context)
    return NextResponse.json(annotations)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { page, context, x, y, content, imageUrl } = await request.json()

    if (!page || typeof x !== 'number' || typeof y !== 'number' || !content) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const annotation = await adapter.createAnnotation({ page, context, x, y, content, imageUrl })
    return NextResponse.json(annotation, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, x, y, content, imageUrl, closed } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const updated = await adapter.updateAnnotation(id, {
      ...(x !== undefined && { x }),
      ...(y !== undefined && { y }),
      ...(content !== undefined && { content }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(closed !== undefined && { closed }),
    })

    if (!updated) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const deleted = await adapter.deleteAnnotation(id)

    if (!deleted) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 })
  }
}
