import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { rmSync } from "node:fs"
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { assert, run, test } from "./support.mjs"
import { cli, releaseBody, releaseHost, repository } from "../support/release.mjs"

const exec = promisify(execFile)
const read = file => readFile(path.join(repository, file), "utf8")
const json = async file => JSON.parse(await read(file))
const version = (await read("_system/VERSION")).trim()
const exists = item => access(item).then(() => true).catch(() => false)
const cleanup = async (...items) => { for (const item of items) await rm(item, { recursive: true, force: true }) }
const assetFolder = await mkdtemp(path.join(os.tmpdir(), "gmvault-release35-asset-"))
const temporary = new Set([assetFolder])
process.on("exit", () => { for (const item of temporary) rmSync(item, { recursive: true, force: true }) })
const archive = path.join(assetFolder, "GMVault.zip")
await exec("node", [path.join(repository, "_system/bin/package-release.mjs"), archive], { cwd: repository })
const packaged = (await exec("unzip", ["-Z1", archive])).stdout.trim().split("\n")
const asset = await readFile(archive)

const oldCli = async (vault, command, args, env = {}) => {
  try {
    const result = await exec("node", [path.join(vault, `_system/bin/${command}.mjs`), ...args], { cwd: vault, env: { ...process.env, ...env }, timeout: 120000 })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

async function previousRelease(tag, prefix) {
  const vault = await mkdtemp(path.join(os.tmpdir(), prefix))
  temporary.add(vault)
  await exec("git", ["archive", tag, "|", "tar", "-x", "-C", vault], { cwd: repository, shell: "/bin/bash" })
  const command = tag === "v1.2.0" ? "rpgvault" : "gmvault"
  const initial = await oldCli(vault, command, ["init"])
  assert.equal(initial.code, 0, initial.stderr)
  await writeFile(path.join(vault, "Campaigns/Mine.md"), "my campaign\n")
  const statePath = path.join(vault, tag === "v1.2.0" ? ".rpgvault/state.json" : ".gmvault/state.json")
  const state = JSON.parse(await readFile(statePath, "utf8"))
  state.installId = randomUUID()
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
  if (tag === "v1.2.0") await writeFile(path.join(vault, "_local/release.json"), '{"repo":"jakrog01/GMVault","asset":"GMVault.zip"}\n')
  return { vault, installId: state.installId, command }
}

async function upgraded(vault, installId, bridged = false) {
  const state = JSON.parse(await readFile(path.join(vault, ".gmvault/state.json"), "utf8"))
  assert.equal(state.installedVersion, version)
  assert.equal(state.installId, installId)
  assert.ok(state.appliedMigrations.includes("2026-10-20-lean-vault"))
  if (bridged) {
    assert.ok(state.appliedMigrations.includes("2026-10-20-gmvault-rename"))
    assert.equal(await exists(path.join(vault, ".rpgvault")), false)
    assert.equal(await exists(path.join(vault, "Campaigns/.rpgvault-keep")), false)
  }
  for (const file of ["README.md", "CHANGELOG.md", "docs", "tests", ".github", "package.json"]) {
    assert.equal(await exists(path.join(vault, file)), false, `${file} left the vault`)
    assert.equal(await exists(path.join(vault, ".gmvault/backups/2026-10-20-lean-vault", file)), true, `${file} was backed up`)
  }
  assert.equal(await readFile(path.join(vault, "Campaigns/Mine.md"), "utf8"), "my campaign\n")
  const doctor = await cli(vault, ["doctor"])
  assert.equal(doctor.code, 0, doctor.stderr)
}

test("the shipped version and changelog describe this release", async () => {
  assert.match(version, /^\d+\.\d+\.\d+$/)
  for (const file of ["package.json", "_system/plugin/package.json", "_system/obsidian/plugins/table-tools/manifest.json", ".obsidian/plugins/table-tools/manifest.json"]) assert.equal((await json(file)).version, version, file)
  assert.equal((await json(".gmvault/state.json")).installedVersion, version)
  const changelog = await read("CHANGELOG.md")
  const section = changelog.split(`## ${version}`)[1]?.split("\n## ")[0]
  assert.ok(section?.includes("GMVault"))
  assert.ok(section.split("\n").filter(line => line.startsWith("- ")).length >= 3)
  assert.equal(changelog.split("## Unreleased")[1]?.split("\n## ")[0].includes("- "), false)
})

test("the workflow builds the manifest package after tests", async () => {
  const workflow = await read(".github/workflows/release.yml")
  assert.ok(workflow.indexOf("npm test") < workflow.indexOf("package-release.mjs"))
  assert.ok(workflow.includes("GMVault.zip"))
  assert.ok(/tags:\s*\['v\*'\]/.test(workflow))
})

test("the archive contains only manifest paths", async () => {
  const manifest = await json("_system/manifest.json")
  for (const include of manifest.releaseInclude) assert.ok(packaged.some(file => file === include || file.startsWith(`${include}/`)), include)
  for (const root of manifest.contentRoots) assert.ok(packaged.includes(`${root}/.gmvault-keep`), root)
  for (const file of packaged) {
    assert.ok(manifest.releaseInclude.some(include => file === include || file.startsWith(`${include}/`)), file)
    assert.equal(manifest.releaseExclude.includes(file), false, file)
    assert.equal(file.split("/").includes("node_modules"), false, file)
  }
  for (const file of ["_system/VERSION", "_system/bin/gmvault.mjs", "_system/bin/rpgvault.mjs", "_system/migrations/2026-10-20-lean-vault.mjs", "_system/plugin/main.js", "Home.md", "Active.md", ".gmvault/plugin-build.json", ".obsidian/plugins/table-tools/main.js"]) assert.ok(packaged.includes(file), file)
  for (const file of ["README.md", "CHANGELOG.md", "package.json", ".gitattributes", ".gmvault/state.json", ".obsidian/workspace.json", ".obsidian/workspace-mobile.json", ".obsidian/plugins/table-tools/data.json"]) assert.equal(packaged.includes(file), false, file)
  for (const prefix of ["docs/", "tests/", ".github/", ".gmvault/backups/", ".gmvault/cache/"]) assert.equal(packaged.some(file => file.startsWith(prefix)), false, prefix)
})

test("a 2.0.1 vault upgrades offline from the lean archive", async () => {
  const { vault, installId, command } = await previousRelease("v2.0.1", "gmvault-release35-offline-")
  const result = await oldCli(vault, command, ["update", "--from", archive])
  assert.equal(result.code, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  await upgraded(vault, installId)
  await cleanup(vault)
}, 300000)

test("the RPGVault 1.2.0 bridge accepts the lean archive", async () => {
  const { vault, installId, command } = await previousRelease("v1.2.0", "gmvault-release35-bridge-")
  const result = await oldCli(vault, command, ["update", "--from", archive])
  assert.equal(result.code, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  await upgraded(vault, installId, true)
  await cleanup(vault)
}, 300000)

test("a 2.0.1 vault upgrades through the release host", async () => {
  const { vault, installId, command } = await previousRelease("v2.0.1", "gmvault-release35-network-")
  const served = await releaseHost({ asset })
  const answer = await releaseHost({ release: releaseBody(`v${version}`, served.downloadUrl) })
  const result = await oldCli(vault, command, ["update", "--latest"], { GMVAULT_RELEASE_API: answer.base })
  assert.equal(result.code, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  await upgraded(vault, installId)
  await served.close()
  await answer.close()
  await cleanup(vault)
}, 300000)

await run("acceptance 35 release")
