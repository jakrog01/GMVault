import { execFile } from "node:child_process"
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { assert, run, test } from "./support.mjs"
import { archiveEntries, cli, releaseBody, releaseHost, repository, zipArchive } from "../support/release.mjs"

const exec = promisify(execFile)
const read = file => readFile(path.join(repository, file), "utf8")
const json = async file => JSON.parse(await read(file))
const version = (await read("_system/VERSION")).trim()
const cleanup = async (...items) => { for (const item of items) await rm(item, { recursive: true, force: true }) }
const exists = item => access(item).then(() => true).catch(() => false)
const numeric = value => value.split(".").map(Number)
const newer = (left, right) => {
  const [a, b] = [numeric(left), numeric(right)]
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference) return difference > 0
  }
  return false
}
const entries = await archiveEntries(repository)
const packaged = entries.map(entry => entry.name)

const oldCli = async (vault, args, env = {}) => {
  try {
    const result = await exec("node", [path.join(vault, "_system/bin/rpgvault.mjs"), ...args], { cwd: vault, env: { ...process.env, ...env }, timeout: 120000 })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

async function previousRelease(prefix) {
  const vault = await mkdtemp(path.join(os.tmpdir(), prefix))
  await exec("git", ["archive", "v1.2.0", "|", "tar", "-x", "-C", vault], { cwd: repository, shell: "/bin/bash" })
  await oldCli(vault, ["init"])
  await writeFile(path.join(vault, "Campaigns/Mine.md"), "my campaign\n")
  await writeFile(path.join(vault, "_local/release.json"), '{"repo":"jakrog01/GMVault","asset":"GMVault.zip"}\n')
  const original = JSON.parse(await readFile(path.join(vault, ".rpgvault/state.json"), "utf8"))
  return { vault, installId: original.installId }
}

async function upgraded(vault, installId) {
  const state = JSON.parse(await readFile(path.join(vault, ".gmvault/state.json"), "utf8"))
  assert.equal(state.installedVersion, version)
  assert.equal(state.installId, installId)
  assert.ok(state.appliedMigrations.includes("2026-10-20-gmvault-rename"))
  assert.equal(await exists(path.join(vault, ".rpgvault")), false)
  assert.equal(await exists(path.join(vault, "Campaigns/.gmvault-keep")), true)
  assert.equal(await exists(path.join(vault, "Campaigns/.rpgvault-keep")), false)
  assert.deepEqual(JSON.parse(await readFile(path.join(vault, ".obsidian/appearance.json"), "utf8")).enabledCssSnippets, ["gmvault-fonts", "gmvault-fantasy"])
  assert.equal(await exists(path.join(vault, ".obsidian/snippets/rpgvault-fonts.css")), false)
  assert.equal(await exists(path.join(vault, ".obsidian/snippets/rpgvault-fantasy.css")), false)
  assert.equal(await readFile(path.join(vault, "Campaigns/Mine.md"), "utf8"), "my campaign\n")
  const doctor = await cli(vault, ["doctor"])
  assert.equal(doctor.code, 0, doctor.stderr)
  assert.ok(doctor.stdout.includes(`GMVault doctor: clean (${version})`))
}

test("the shipped version agrees with release tags", async () => {
  assert.match(version, /^\d+(\.\d+)*$/)
  const tags = (await exec("git", ["tag", "--sort=v:refname"], { cwd: repository })).stdout.split("\n").filter(Boolean)
  assert.ok(tags.includes("v1.2.0"))
  const changed = (await exec("git", ["status", "--porcelain"], { cwd: repository })).stdout.trim()
  if (!changed) {
    const here = (await exec("git", ["tag", "--points-at", "HEAD"], { cwd: repository })).stdout.split("\n").filter(Boolean)
    for (const tag of here) assert.equal(version, tag.replace(/^v/, ""))
  }
  assert.equal(newer(tags.at(-1).replace(/^v/, ""), version), false)
})

test("every release version agrees", async () => {
  for (const file of ["package.json", "_system/plugin/package.json", "_system/obsidian/plugins/table-tools/manifest.json", ".obsidian/plugins/table-tools/manifest.json"]) assert.equal((await json(file)).version, version, file)
  assert.equal((await json(".gmvault/state.json")).installedVersion, version)
})

test("the changelog describes the release", async () => {
  const changelog = await read("CHANGELOG.md")
  const heading = `## ${version}`
  assert.ok(changelog.includes(heading))
  const section = changelog.slice(changelog.indexOf(heading) + heading.length).split(/\n## /)[0]
  assert.ok(section.split("\n").filter(line => line.trim().startsWith("-")).length >= 3)
  assert.ok(section.includes("GMVault"))
  const unreleased = changelog.match(/## Unreleased([\s\S]*?)(\n## |$)/)
  assert.equal(unreleased?.[1].split("\n").filter(line => line.trim().startsWith("-")).length ?? 0, 0)
})

test("the workflow packages the requested asset", async () => {
  const workflow = await read(".github/workflows/release.yml")
  assert.ok(workflow.includes((await json("_system/manifest.json")).release.asset))
  assert.ok(workflow.includes("npm test"))
  assert.ok(/tags:\s*\['v\*'\]/.test(workflow))
})

test("the archive carries the new CLI and legacy alias without private files", async () => {
  for (const file of ["_system/VERSION", "_system/bin/gmvault.mjs", "_system/bin/rpgvault.mjs", "_system/migrations/2026-10-20-gmvault-rename.mjs", "_system/plugin/main.js", "docs/README.md", "Home.md", "README.md", "CHANGELOG.md", ".github/workflows/release.yml", ".obsidian/plugins/table-tools/main.js"]) assert.ok(packaged.includes(file), file)
  for (const file of packaged) {
    assert.equal(file.startsWith(".gmvault/backups/"), false)
    assert.equal(file.includes("node_modules/"), false)
    assert.notEqual(file, ".obsidian/plugins/table-tools/data.json")
    assert.notEqual(file, ".obsidian/workspace.json")
  }
})

test("a 1.2.0 vault upgrades from the packaged archive", async () => {
  const { vault, installId } = await previousRelease("gmvault-release35-offline-")
  const archive = path.join(await mkdtemp(path.join(os.tmpdir(), "gmvault-release35-asset-")), "GMVault.zip")
  await writeFile(archive, zipArchive(entries))
  const result = await oldCli(vault, ["update", "--from", archive])
  assert.equal(result.code, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  await upgraded(vault, installId)
  assert.equal((await readdir(path.join(vault, ".gmvault/backups"))).length, 1)
  await cleanup(vault, path.dirname(archive))
}, 300000)

test("a 1.2.0 vault upgrades through the bridged release host", async () => {
  const { vault, installId } = await previousRelease("gmvault-release35-network-")
  const served = await releaseHost({ asset: zipArchive(entries) })
  const answer = await releaseHost({ release: releaseBody(`v${version}`, served.downloadUrl) })
  const result = await oldCli(vault, ["update", "--latest"], { RPGVAULT_RELEASE_API: answer.base })
  assert.equal(result.code, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  assert.ok(answer.requests.some(request => request.includes("/repos/jakrog01/GMVault/releases/latest")))
  await upgraded(vault, installId)
  await served.close()
  await answer.close()
  await cleanup(vault)
}, 600000)

await run("acceptance 35 release")
