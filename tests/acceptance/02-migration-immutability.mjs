import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"

const exec = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const headFiles = new Set((await exec("git", ["ls-tree", "-r", "--name-only", "HEAD", "_system/migrations"], { cwd: root })).stdout.trim().split("\n").filter(Boolean))
const tags = (await exec("git", ["tag", "--merged", "HEAD"], { cwd: root })).stdout.trim().split("\n").filter(Boolean)
const taggedFiles = new Set()
for (const tag of tags) {
  const files = (await exec("git", ["ls-tree", "-r", "--name-only", tag, "_system/migrations"], { cwd: root })).stdout.trim().split("\n").filter(Boolean)
  for (const file of files) {
    taggedFiles.add(file)
    if (!headFiles.has(file)) continue
    const before = await exec("git", ["show", `${tag}:${file}`], { cwd: root })
    const after = await exec("git", ["show", `HEAD:${file}`], { cwd: root })
    assert.equal(after.stdout, before.stdout, `${file} changed after ${tag}`)
  }
}
for (const file of headFiles) {
  const before = (await exec("git", ["show", `HEAD:${file}`], { cwd: root })).stdout
  const after = await readFile(path.join(root, file), "utf8").catch(error => error.code === "ENOENT" ? null : Promise.reject(error))
  if (after === null) assert.ok(taggedFiles.has(file), `${file} removed before any release tag`)
  else assert.equal(after, before, `${file} changed from HEAD`)
}
console.log("migration immutability gate: clean")
