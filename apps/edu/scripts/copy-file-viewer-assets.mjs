// 把 file-viewer 各 renderer 的运行时 WASM/worker/字体/脚本资产复制到 public，
// 供浏览器按需加载（这些资产不会被 Next.js standalone 打包进产物，运行时通过 URL 请求）。
//
// 背景：@file-viewer/preset-all 的若干 renderer 用「运行时 URL 加载」方式获取资产：
//   - CAD    → new Worker(workerUrl) + libredwg-web.wasm（DWG/DXF/DWF）
//   - archive → new Worker(workerUrl) + libarchive.wasm（7z/rar/tar/gz 等；zip 另有 jszip 兜底）
//   - model  → occt worker/runtime/wasm（STEP/IGES/BREP 等几何内核）
//   - typst  → typst.ts 编译器/渲染器 WASM（.typ/.typst）
//   - pdf    → cmaps / standard_fonts / wasm（CJK 文本解码、标准字体、图片解码）
// 若这些资产缺失，对应格式会报错或降级。因此在 next build 前把依赖包内的资产
// 复制到 public 的版本化目录，前端再通过 setDefaultFileViewerAssetBaseUrl('/') 统一解析。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 脚本位于 apps/edu/scripts/，仓库根 node_modules/.pnpm 在 ../../../node_modules/.pnpm
const pnpmDir = path.resolve(__dirname, '../../../node_modules/.pnpm')
const publicDir = path.resolve(__dirname, '../public')

// 在 .pnpm 中按「目录名前缀」定位包，返回其 node_modules 目录。
// 目录名形如 `@file-viewer+ppt@0.3.3` 或 `libarchive.js@2.0.2`（可能带 peer 后缀）。
function findPkgNodeModules(pkgDirPrefix) {
  const entries = readdirSync(pnpmDir).filter((e) => e.startsWith(pkgDirPrefix))
  if (entries.length === 0) {
    throw new Error(`未找到 ${pkgDirPrefix}，请先 pnpm install`)
  }
  return path.join(pnpmDir, entries[0], 'node_modules')
}

// 复制单个文件：srcRel 相对包 node_modules 目录，destRel 相对 public 目录。
function copyFile(pkgDirPrefix, srcRel, destRel) {
  const src = path.join(findPkgNodeModules(pkgDirPrefix), srcRel)
  if (!existsSync(src)) {
    throw new Error(`缺少资产源文件: ${src}`)
  }
  const dest = path.join(publicDir, destRel)
  mkdirSync(path.dirname(dest), { recursive: true })
  cpSync(src, dest)
}

// 复制整个目录：srcRel 相对包 node_modules 目录，destRel 相对 public 目录。
function copyDir(pkgDirPrefix, srcRel, destRel) {
  const src = path.join(findPkgNodeModules(pkgDirPrefix), srcRel)
  if (!existsSync(src)) {
    throw new Error(`缺少资产源目录: ${src}`)
  }
  const dest = path.join(publicDir, destRel)
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
}

// 复制整个目录（源为绝对路径，用于 offline/ 下的离线资产）。
function copyDirFromAbs(srcAbs, destRel) {
  if (!existsSync(srcAbs)) {
    throw new Error(`缺少离线资产源目录: ${srcAbs}`)
  }
  const dest = path.join(publicDir, destRel)
  rmSync(dest, { recursive: true, force: true })
  cpSync(srcAbs, dest, { recursive: true })
}

// ---- CAD（DWG/DXF/DWF，@flyfish-dev/cad-viewer 0.8.0）----
const CAD_WASM = '@flyfish-dev+cad-viewer@0.8.0'
for (const f of ['dwg-worker.js', 'dwfv-render.wasm', 'libredwg-web.js', 'libredwg-web.wasm']) {
  copyFile(CAD_WASM, `@flyfish-dev/cad-viewer/dist/wasm/${f}`, `wasm/cad/0.8.0/${f}`)
}

// ---- archive（libarchive.js 2.0.2，7z/rar/tar/gz 等）----
const LIBARCHIVE = 'libarchive.js@2.0.2'
copyFile(LIBARCHIVE, 'libarchive.js/dist/worker-bundle.js', 'vendor/libarchive/worker-bundle.js')
copyFile(LIBARCHIVE, 'libarchive.js/dist/libarchive.wasm', 'vendor/libarchive/libarchive.wasm')

// ---- PowerPoint 97–2003（@file-viewer/ppt 0.3.3）----
const PPT = '@file-viewer+ppt@0.3.3'
for (const f of [
  'index.mjs',
  'worker.mjs',
  'frame-cache.mjs',
  'ppt-native.wasm',
  'ppt-font-cjk.otf',
  'manifest.json',
  'package.json',
  'LICENSE',
  'NOTICE',
]) {
  copyFile(PPT, `@file-viewer/ppt/${f}`, `vendor/ppt/${f}`)
}

// ---- 3D 模型（occt-import-js + geometry-engine，STEP/IGES/BREP）----
copyFile(
  '@file-viewer+geometry-engine@2.2.9',
  '@file-viewer/geometry-engine/assets/occt-worker.js',
  'wasm/model/occt-worker.js',
)
const OCCT = 'occt-import-js@0.0.23'
copyFile(OCCT, 'occt-import-js/dist/occt-import-js.js', 'wasm/model/occt-import-js.js')
copyFile(OCCT, 'occt-import-js/dist/occt-import-js.wasm', 'wasm/model/occt-import-js.wasm')
copyFile(OCCT, 'occt-import-js/dist/license.occt.txt', 'wasm/model/LICENSE.occt.txt')
copyFile(
  OCCT,
  'occt-import-js/dist/license.occt-import-js.txt',
  'wasm/model/LICENSE.occt-import-js.txt',
)

// ---- Typst（@myriaddreamin/typst.ts 0.7.0 编译器/渲染器 WASM）----
copyFile(
  '@myriaddreamin+typst-ts-web-compiler@0.7.0',
  '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
  'wasm/typst/typst_ts_web_compiler_bg.wasm',
)
copyFile(
  '@myriaddreamin+typst-ts-renderer@0.7.0',
  '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
  'wasm/typst/typst_ts_renderer_bg.wasm',
)

// ---- PDF（pdfjs-dist 5.4.624，CJK cmaps / 标准字体 / 图片解码 wasm）----
const PDFJS = 'pdfjs-dist@5.4.624'
copyDir(PDFJS, 'pdfjs-dist/cmaps', 'vendor/pdf/cmaps')
copyDir(PDFJS, 'pdfjs-dist/standard_fonts', 'vendor/pdf/standard_fonts')
copyDir(PDFJS, 'pdfjs-dist/wasm', 'vendor/pdf/wasm')

// ---- PDF CJK 字体兜底（@fontsource-variable/noto-sans-sc，未嵌入中文字体的 PDF 缺字兜底）----
// pdfFontFallback.js 期望 noto-sans-sc.css + files/*.woff2 结构；wght.css 即该 CSS（Noto Sans SC Variable）。
const NOTO_SANS = '@fontsource-variable+noto-sans-sc@5.2.10'
copyFile(NOTO_SANS, '@fontsource-variable/noto-sans-sc/wght.css', 'vendor/pdf/fonts/noto-sans-sc.css')
copyDir(NOTO_SANS, '@fontsource-variable/noto-sans-sc/files', 'vendor/pdf/fonts/files')

// ---- Typst 默认字体（offline/file-viewer/typst-fonts，开源字体，无公共 CDN 依赖）----
const offlineFontsDir = path.resolve(__dirname, '../../../offline/file-viewer/typst-fonts')
copyDirFromAbs(offlineFontsDir, 'wasm/typst/fonts')

console.log('[file-viewer] 已完成 CAD/archive/ppt/model/typst/pdf 及 CJK/typst 字体资产的 public 复制')
