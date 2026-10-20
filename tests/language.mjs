import { access, readFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { excluded, languageViolation } from "./language-common.mjs"

const exec = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const inspect = (name, value) => {
  if (languageViolation(value)) throw new Error(`${name}: language violation`)
}
const candidates = (await exec("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root })).stdout.trim().split("\n").filter(item => item && !excluded(item))
const tracked = (await Promise.all(candidates.map(async item => await access(path.join(root, item)).then(() => item).catch(() => null)))).filter(Boolean)
for (const file of tracked) inspect(file, `${file}\n${await readFile(path.join(root, file), "utf8")}`)
console.log(`language gate: clean (${tracked.length} files)`)
