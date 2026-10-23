import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"

const exec = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const diacritics = /[\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b]/
const files = (await exec("git", ["ls-files", "--cached", "-z"], { cwd: root })).stdout.split("\0").filter(Boolean)
for (const file of files) {
  const content = await readFile(path.join(root, file), "utf8").catch(error => error.code === "ENOENT" ? null : Promise.reject(error))
  if (diacritics.test(file) || (content !== null && diacritics.test(content))) throw new Error(`${file}: Polish diacritic`)
}
const messages = (await exec("git", ["log", "--all", "--format=%B"], { cwd: root })).stdout
if (diacritics.test(messages)) throw new Error("commit message: Polish diacritic")
console.log(`language gate: clean (${files.length} tracked files and commit messages)`)
