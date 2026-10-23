import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), "acceptance")
const files = readdirSync(directory).filter(name => /^\d{2}-.*\.mjs$/.test(name)).sort()
const filter = process.argv[2]
if (filter && !/^\d+$/.test(filter)) {
  console.error("usage: node tests/run.mjs [test number]")
  process.exit(2)
}
const selected = filter ? files.filter(name => Number(name.slice(0, 2)) === Number(filter)) : files
if (!selected.length) {
  console.error(`no test numbered ${filter}`)
  process.exit(2)
}
let failed = 0
for (const file of selected) {
  console.log(file)
  const result = spawnSync(process.execPath, [path.join(directory, file)], { stdio: "inherit", timeout: 600000 })
  if (result.error || result.status !== 0) {
    failed += 1
    if (result.error) console.error(`${file}: ${result.error.message}`)
  }
}
console.log(`tests: ${selected.length - failed}/${selected.length} passed`)
process.exitCode = failed ? 1 : 0
