import { execFile } from "node:child_process"
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { assert, run, test } from "./support.mjs"
import { cli, cloneVault, repository, snapshot } from "../support/release.mjs"

const exec = promisify(execFile)
const exists = item => access(item).then(() => true).catch(() => false)
const state = vault => path.join(vault, ".gmvault/state.json")
const cleanup = vault => rm(vault, { recursive: true, force: true })
const legacyCli = async (vault, args) => {
  try {
    const result = await exec("node", [path.join(vault, "_system/bin/rpgvault.mjs"), ...args], { cwd: vault })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

test("the first command moves legacy state with its contents", async () => {
  const vault = await cloneVault("gmvault-rename39-bootstrap-")
  const original = JSON.parse(await readFile(state(vault), "utf8"))
  await mkdir(path.join(vault, ".gmvault/backups/example"), { recursive: true })
  await mkdir(path.join(vault, ".gmvault/cache/example"), { recursive: true })
  await writeFile(path.join(vault, ".gmvault/backups/example/file"), "backup")
  await writeFile(path.join(vault, ".gmvault/cache/example/file"), "cache")
  await rename(path.join(vault, ".gmvault"), path.join(vault, ".rpgvault"))
  const result = await cli(vault, ["doctor"])
  assert.equal(result.code, 0, result.stderr)
  assert.equal(await exists(path.join(vault, ".rpgvault")), false)
  assert.equal(JSON.parse(await readFile(state(vault), "utf8")).installId, original.installId)
  assert.equal(await readFile(path.join(vault, ".gmvault/backups/example/file"), "utf8"), "backup")
  assert.equal(await readFile(path.join(vault, ".gmvault/cache/example/file"), "utf8"), "cache")
  await cleanup(vault)
})

test("doctor reports a legacy folder when both state folders exist", async () => {
  const vault = await cloneVault("gmvault-rename39-both-")
  await mkdir(path.join(vault, ".rpgvault"))
  await writeFile(path.join(vault, ".rpgvault/state.json"), "{}")
  const result = await cli(vault, ["doctor"])
  assert.notEqual(result.code, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /undeclared root: \.rpgvault/)
  assert.equal(await exists(path.join(vault, ".rpgvault/state.json")), true)
  await cleanup(vault)
})

test("the migration preserves disabled and edited snippets", async () => {
  const vault = await cloneVault("gmvault-rename39-migration-")
  const oldFonts = (await exec("git", ["show", "v1.2.0:_system/obsidian/snippets/rpgvault-fonts.css"], { cwd: repository })).stdout
  const oldFantasy = (await exec("git", ["show", "v1.2.0:_system/obsidian/snippets/rpgvault-fantasy.css"], { cwd: repository })).stdout
  await rm(path.join(vault, "Campaigns/.gmvault-keep"))
  await rm(path.join(vault, "_local/scripts/.gmvault-keep"))
  await writeFile(path.join(vault, "Campaigns/.rpgvault-keep"), "")
  await writeFile(path.join(vault, "_local/scripts/.rpgvault-keep"), "")
  await writeFile(path.join(vault, "Parties/.rpgvault-keep"), "")
  await writeFile(path.join(vault, ".obsidian/appearance.json"), JSON.stringify({ enabledCssSnippets: ["rpgvault-fonts"], cssTheme: "Minimal" }))
  await writeFile(path.join(vault, ".obsidian/snippets/rpgvault-fonts.css"), oldFonts)
  await writeFile(path.join(vault, ".obsidian/snippets/rpgvault-fantasy.css"), `${oldFantasy}\nuser edit\n`)
  const result = await cli(vault, ["finalize-update"])
  assert.equal(result.code, 0, result.stderr)
  assert.equal(await exists(path.join(vault, "Campaigns/.gmvault-keep")), true)
  assert.equal(await exists(path.join(vault, "Campaigns/.rpgvault-keep")), false)
  assert.equal(await exists(path.join(vault, "_local/scripts/.gmvault-keep")), true)
  assert.equal(await exists(path.join(vault, "Parties/.rpgvault-keep")), true)
  assert.deepEqual(JSON.parse(await readFile(path.join(vault, ".obsidian/appearance.json"), "utf8")).enabledCssSnippets, ["gmvault-fonts"])
  assert.equal(await exists(path.join(vault, ".obsidian/snippets/rpgvault-fonts.css")), false)
  assert.equal(await readFile(path.join(vault, ".obsidian/snippets/rpgvault-fantasy.css"), "utf8"), `${oldFantasy}\nuser edit\n`)
  assert.equal(await exists(path.join(vault, ".obsidian/snippets/gmvault-fonts.css")), true)
  assert.equal(JSON.parse(await readFile(state(vault), "utf8")).appliedMigrations.includes("2026-10-20-gmvault-rename"), true)
  await cleanup(vault)
})

test("the migration keeps an absent font snippet disabled", async () => {
  const vault = await cloneVault("gmvault-rename39-choices-")
  await writeFile(path.join(vault, ".obsidian/appearance.json"), JSON.stringify({ enabledCssSnippets: ["other", "rpgvault-fantasy"], cssTheme: "Minimal" }))
  const result = await cli(vault, ["finalize-update"])
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(JSON.parse(await readFile(path.join(vault, ".obsidian/appearance.json"), "utf8")).enabledCssSnippets, ["other", "gmvault-fantasy"])
  await cleanup(vault)
})

test("the legacy CLI entry forwards arguments and exit status", async () => {
  const vault = await cloneVault("gmvault-rename39-alias-")
  const current = await cli(vault, ["doctor"])
  const legacy = await legacyCli(vault, ["doctor"])
  assert.equal(legacy.code, current.code)
  assert.equal(legacy.stdout, current.stdout)
  assert.equal(legacy.stderr, current.stderr)
  await cleanup(vault)
})

test("an update preview leaves a legacy state folder untouched", async () => {
  const vault = await cloneVault("gmvault-rename39-preview-")
  await rename(path.join(vault, ".gmvault"), path.join(vault, ".rpgvault"))
  await writeFile(path.join(vault, "Campaigns/.rpgvault-keep"), "")
  const before = await snapshot(vault)
  const result = await cli(vault, ["update", "--from", repository, "--dry-run"])
  assert.equal(result.code, 0, result.stderr)
  assert.equal(await snapshot(vault), before)
  assert.equal(await exists(path.join(vault, ".gmvault")), false)
  await cleanup(vault)
})

await run("acceptance 39 GMVault rename")
