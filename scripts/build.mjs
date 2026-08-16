import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 10 个平台种子词：让 client 工厂的 require 命中 DSH 种子表，不打进 bundle
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]

mkdirSync(resolve(projectRoot, 'lib'), { recursive: true })

// 1) host：ESM bundle（node:* 原生解析；@deepseek-ai/* 由宿主 Node 解析，不打进去）
await build({
  entryPoints: [resolve(projectRoot, 'src/host/index.ts')],
  outfile: resolve(projectRoot, 'lib/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  external: ['node:*'],
  minify: true,
})

// 2) client：CJS body（shiki / 本包模块内联；seed word 走 external → require；
//    .css 以 text loader 内联为字符串，供 mountStyles 注入 <style>）
await build({
  entryPoints: [resolve(projectRoot, 'src/client/index.ts')],
  outfile: resolve(projectRoot, 'lib/client.body.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  loader: { '.css': 'text' },
  external: PLATFORM_MODULES,
  minify: true,
})

// 3) 包一层 __ModuleLoader__.load 模板
const body = readFileSync(resolve(projectRoot, 'lib/client.body.js'), 'utf8')
writeFileSync(
  resolve(projectRoot, 'lib/client.js'),
  `window.__ModuleLoader__.load({
\tid: "dsh-file-explorer",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
\t\treturn module.exports;
\t}
});
`,
)
rmSync(resolve(projectRoot, 'lib/client.body.js'), { force: true })
console.log('built lib/index.js + lib/client.js')
