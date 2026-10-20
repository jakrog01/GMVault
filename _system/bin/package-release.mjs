import { execFile } from 'node:child_process'
import { readFile, readdir, rm, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'

const exec = promisify(execFile)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const manifest = JSON.parse(await readFile(path.join(root, '_system/manifest.json'), 'utf8'))
const archive = path.resolve(process.argv[2] ?? 'GMVault.zip')
const excluded = new Set(manifest.releaseExclude)
const entries = []
const visit = async relative => {
  if (excluded.has(relative) || relative.split('/').includes('node_modules')) return
  const absolute = path.join(root, relative)
  const info = await stat(absolute)
  if (info.isDirectory()) {
    for (const entry of (await readdir(absolute)).sort()) await visit(`${relative}/${entry}`)
  } else if (info.isFile()) entries.push(relative)
}
for (const relative of manifest.releaseInclude) await visit(relative)
await rm(archive, { force: true })
await exec('zip', ['-q', '-X', archive, ...entries], { cwd: root })
console.log(`packaged ${entries.length} files in ${archive}`)
