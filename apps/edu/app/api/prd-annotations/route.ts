import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data/prd-annotations-overrides.json')

function ensureDataDir() {
  const dir = path.dirname(DATA_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export async function GET() {
  try {
    ensureDataDir()
    if (!fs.existsSync(DATA_PATH)) {
      return NextResponse.json({ overrides: {}, floatingAnnotations: [] })
    }
    const data = fs.readFileSync(DATA_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(data))
  } catch (error) {
    return NextResponse.json({ overrides: {}, floatingAnnotations: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    ensureDataDir()
    fs.writeFileSync(DATA_PATH, JSON.stringify(body, null, 2))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
