import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"

const exec = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = file => readFile(path.join(root, file))
const manifest = JSON.parse(await read("_system/manifest.json"))
const committed = new Set((await exec("git", ["ls-files", "--cached", "-z", ".obsidian"], { cwd: root })).stdout.split("\0").filter(Boolean))
for (const entry of manifest.managedObsidian) {
  const relative = typeof entry === "string" ? entry : entry.path
  const target = `.obsidian/${relative}`
  assert.ok(committed.has(target), `${target} is committed`)
  const source = relative.startsWith("plugins/table-tools/") && ["main.js", "styles.css"].includes(path.basename(relative))
    ? `_system/plugin/${path.basename(relative)}` : `_system/obsidian/${relative}`
  const expected = await read(source)
  const actual = await read(target)
  if (entry.merge) {
    const sourceIds = JSON.parse(expected)
    const targetIds = JSON.parse(actual)
    for (const id of sourceIds) assert.ok(targetIds.includes(id), `${target} includes ${id}`)
  } else if (Array.isArray(entry.keys) && entry.keys.length) {
    const sourceJson = JSON.parse(expected)
    const targetJson = JSON.parse(actual)
    for (const key of entry.keys) assert.deepEqual(targetJson[key], sourceJson[key], `${target}:${key}`)
  } else assert.deepEqual(actual, expected, `${target} matches ${source}`)
}
console.log(`managed Obsidian sources: clean (${manifest.managedObsidian.length} files)`)
