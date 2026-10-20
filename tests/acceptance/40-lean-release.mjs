import { execFile } from "node:child_process"
import { rmSync } from "node:fs"
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { assert, run, test } from "./support.mjs"
import { cli, repository, snapshot } from "../support/release.mjs"

const exec = promisify(execFile)
const exists = item => access(item).then(() => true).catch(() => false)
const packageFolder = await mkdtemp(path.join(os.tmpdir(), "gmvault-lean40-package-"))
const temporary = new Set([packageFolder])
process.on("exit", () => { for (const item of temporary) rmSync(item, { recursive: true, force: true }) })
const archive = path.join(packageFolder, "GMVault.zip")
await exec("node", [path.join(repository, "_system/bin/package-release.mjs"), archive], { cwd: repository })

const unpack = async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "gmvault-lean40-vault-"))
  temporary.add(vault)
  await exec("unzip", ["-q", archive, "-d", vault])
  return vault
}
const seed = async vault => {
  for (const file of ["README.md", "CHANGELOG.md", "package.json"]) await writeFile(path.join(vault, file), file)
  for (const folder of ["docs", "tests", ".github"]) {
    await mkdir(path.join(vault, folder))
    await writeFile(path.join(vault, folder, "owner.txt"), folder)
  }
}

test("a fresh unzipped vault is clean without state", async () => {
  const vault = await unpack()
  assert.equal(await exists(path.join(vault, ".gmvault/state.json")), false)
  const result = await cli(vault, ["doctor"])
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(await exists(path.join(vault, ".gmvault/state.json")), false)
  await rm(vault, { recursive: true, force: true })
})

test("the first init persists a unique install identity", async () => {
  const first = await unpack()
  const second = await unpack()
  for (const vault of [first, second]) assert.equal((await cli(vault, ["init"])).code, 0)
  const a = JSON.parse(await readFile(path.join(first, ".gmvault/state.json"), "utf8"))
  const b = JSON.parse(await readFile(path.join(second, ".gmvault/state.json"), "utf8"))
  assert.match(a.installId, /^[0-9a-f-]{36}$/)
  assert.notEqual(a.installId, b.installId)
  await rm(first, { recursive: true, force: true })
  await rm(second, { recursive: true, force: true })
})

test("the migration moves repository files into a named backup once", async () => {
  const vault = await unpack()
  await seed(vault)
  const result = await cli(vault, ["finalize-update"])
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  const state = JSON.parse(await readFile(path.join(vault, ".gmvault/state.json"), "utf8"))
  assert.match(state.installId, /^[0-9a-f-]{36}$/)
  assert.ok(state.appliedMigrations.includes("2026-10-20-lean-vault"))
  for (const file of ["README.md", "CHANGELOG.md", "docs", "tests", ".github", "package.json"]) {
    assert.equal(await exists(path.join(vault, file)), false)
    assert.equal(await exists(path.join(vault, ".gmvault/backups/2026-10-20-lean-vault", file)), true)
  }
  assert.equal((await cli(vault, ["finalize-update"])).code, 0)
  assert.deepEqual((await readdir(path.join(vault, ".gmvault/backups/2026-10-20-lean-vault"))).sort(), [".github", "CHANGELOG.md", "README.md", "docs", "package.json", "tests"].sort())
  await rm(vault, { recursive: true, force: true })
})

test("the template install identity skips the migration", async () => {
  const vault = await unpack()
  await seed(vault)
  await writeFile(path.join(vault, ".gmvault/state.json"), JSON.stringify({ installedVersion: "2.0.1", appliedMigrations: [], installId: "gmvault-template", adoptedFrom: null }))
  const result = await cli(vault, ["finalize-update"])
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(await exists(path.join(vault, "README.md")), true)
  assert.equal(await exists(path.join(vault, ".gmvault/backups/2026-10-20-lean-vault")), false)
  await rm(vault, { recursive: true, force: true })
})

test("a dry run reports migration work without writing", async () => {
  const vault = await unpack()
  await seed(vault)
  const before = await snapshot(vault)
  const result = await cli(vault, ["update", "--from", archive, "--dry-run"])
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(await snapshot(vault), before)
  assert.equal(await exists(path.join(vault, ".gmvault/state.json")), false)
  assert.equal(await exists(path.join(vault, ".gmvault/backups")), false)
  await rm(vault, { recursive: true, force: true })
})

await run("acceptance 40 lean release")
