// 把 file-viewer 的 CAD（DWG/DXF/DWF）WASM/worker 资产复制到 public，供运行时按需加载。
//
// 背景：@file-viewer/renderer-cad 基于 @flyfish-dev/cad-viewer，DWG 预览走
// `new Worker(workerUrl)` 并在 worker 内加载 libredwg-web.js/libredwg-web.wasm。
// Next.js 独立构建（standalone）不会把这些二进制资产打进产物，运行时自动推断
// 的 worker/wasm 路径会 404，导致 "DWG worker failed"。
// 因此在 next build 前把 cad-viewer 包内的资产复制到 public 的版本化目录，
// 前端再通过 FileViewer 的 cad.workerUrl / cad.wasmPath / cad.dwfWasmUrl 显式指向。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 脚本位于 apps/edu/scripts/，仓库根 node_modules/.pnpm 在 ../../../node_modules/.pnpm
const pnpmDir = path.resolve(__dirname, '../../../node_modules/.pnpm')
const targetDir = path.resolve(__dirname, '../public/wasm/cad/0.8.0')

const ASSET_FILES = ['dwg-worker.js', 'dwfv-render.wasm', 'libredwg-web.js', 'libredwg-web.wasm']
const CAD_VIEWER_VERSION = '0.8.0'

function findCadViewerWasmDir() {
  const entries = readdirSync(pnpmDir).filter((e) =>
    e.startsWith(`@flyfish-dev+cad-viewer@${CAD_VIEWER_VERSION}`),
  )
  if (entries.length === 0) {
    throw new Error(`未找到 @flyfish-dev/cad-viewer@${CAD_VIEWER_VERSION}，请先 pnpm install`)
  }
  return path.join(
    pnpmDir,
    entries[0],
    'node_modules',
    '@flyfish-dev',
    'cad-viewer',
    'dist',
    'wasm',
  )
}

const srcDir = findCadViewerWasmDir()
rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
for (const file of ASSET_FILES) {
  const src = path.join(srcDir, file)
  if (!existsSync(src)) {
    throw new Error(`缺少 CAD 资产源文件: ${src}`)
  }
  cpSync(src, path.join(targetDir, file))
}
console.log(
  `[file-viewer] 已复制 ${ASSET_FILES.length} 个 CAD WASM 资产到 public/wasm/cad/${CAD_VIEWER_VERSION}/`,
)
