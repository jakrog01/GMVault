import esbuild from 'esbuild'
import { readFile } from 'node:fs/promises'

const production = process.argv[2] === 'production'
const browserRuntime = {
  name: 'browser-runtime',
  setup(build) {
    build.onResolve({ filter: /ort-loader\.mjs\?text$/ }, () => ({ path: new URL('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', import.meta.url).pathname, namespace: 'ort-loader' }))
    build.onLoad({ filter: /.*/, namespace: 'ort-loader' }, async args => ({ contents: (await readFile(args.path, 'utf8')).replaceAll('import.meta.url', JSON.stringify('https://localhost.invalid/ort/')).replaceAll('alert(', 'console.warn('), loader: 'text' }))
    build.onLoad({ filter: /transformers\.web\.js$/ }, async args => ({ contents: (await readFile(args.path, 'utf8')).replace(/IS_PROCESS_AVAILABLE && process\?\.release\?\.name === 'node'/g, 'false'), loader: 'js' }))
  }
}
const worker = await esbuild.build({
  entryPoints: ['src/local-worker.ts'],
  bundle: true,
  write: false,
  alias: { 'onnxruntime-web': './node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs' },
  plugins: [browserRuntime],
  format: 'iife',
  target: 'es2020',
  logLevel: 'warning',
  minify: true
})
const workerCode = {
  name: 'worker-code',
  setup(build) {
    build.onResolve({ filter: /local-worker\.js\?worker$/ }, () => ({ path: 'local-worker', namespace: 'worker-code' }))
    build.onLoad({ filter: /.*/, namespace: 'worker-code' }, () => ({ contents: worker.outputFiles[0].text, loader: 'text' }))
  }
}
await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', 'node:*'],
  plugins: [workerCode],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: production
})
