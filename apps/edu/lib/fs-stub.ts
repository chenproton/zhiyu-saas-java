// Node 内置模块 `fs` / `fs/promises` 的浏览器端空桩。
//
// 背景：file-viewer 的 preset-all 会拉入若干「Node 条件分支」的依赖：
//   - renderer-mindmap → @ljheee/xmind-parser 的 utils.js 有 `await import('fs/promises')`
//   - renderer-data → hyparquet 的 node.js 有 `import { createReadStream, promises as fs } from 'fs'`
// 这些分支都被 `process.versions.node` 守卫（浏览器运行时永不执行），但 Next.js Turbopack
// 打包阶段仍会静态解析并校验命名导出，导致构建失败。
// 通过 next.config.mjs 的 `turbopack.resolveAlias` 把 fs/fs/promises 映射到本桩，
// 补齐这些被静态引用的命名导出即可让打包通过；运行时该分支不会走到，空实现安全。
const noop = () => undefined

// 供 xmind-parser 的 `await import('fs/promises')` 命名空间使用
export const readFile = noop
export const writeFile = noop
export const readFileSync = noop
export const writeFileSync = noop

// 供 hyparquet 的 `createReadStream` 使用
export const createReadStream = noop
export const createWriteStream = noop

// 供 hyparquet 的 `promises as fs` 使用
export const promises = {
  readFile: noop,
  writeFile: noop,
  readFileSync: noop,
  writeFileSync: noop,
  stat: noop,
  readdir: noop,
}

export default { ...promises, createReadStream, createWriteStream }
