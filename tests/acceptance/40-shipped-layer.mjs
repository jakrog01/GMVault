


import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { assert, run, test } from "./support.mjs"
import { archiveEntries, cli, cloneVault, releaseBody, releaseHost, repository, zipArchive } from "../support/release.mjs"

const wholeRelease = await archiveEntries(repository)
const cleanup = async (...items) => { for (const item of items) await rm(item, { recursive: true, force: true }) }
const read = (vault, file) => readFile(path.join(vault, file), "utf8")
const exists = item => stat(item).then(() => true, () => false)
const backupDirectory = async vault => {
  const saved = await readdir(path.join(vault, ".gmvault/backups"))
  assert.equal(saved.length, 1, `exactly one backup was written: ${saved.join(", ")}`)
  return path.join(vault, ".gmvault/backups", saved[0])
}

function release(version, changes = {}) {
  const entries = []
  for (const entry of wholeRelease) {
    if (entry.name in changes) {
      if (changes[entry.name] === null) continue
      entries.push({ name: entry.name, data: changes[entry.name] })
      continue
    }
    entries.push(entry.name === "_system/VERSION" ? { name: entry.name, data: `${version}\n` } : entry)
  }
  for (const [name, data] of Object.entries(changes)) {
    if (data !== null && !wholeRelease.some(entry => entry.name === name)) entries.push({ name, data })
  }
  return zipArchive(entries)
}

async function serve(archive) {
  const served = await releaseHost({ asset: archive })
  const answer = await releaseHost({ release: releaseBody("v1.1.0", served.downloadUrl) })
  return { answer, close: async () => { await served.close(); await answer.close() } }
}

test("the declared shipped files are replaced, and the release's own state and undeclared files are not", async () => {
  const vault = await cloneVault("gmvault-layer31-replace-")
  const installId = JSON.parse(await read(vault, ".gmvault/state.json")).installId
  await writeFile(path.join(vault, "package.json"), '{"name":"my-fork"}\n')
  const host = await serve(release("1.1.0", {
    "docs/CLI.md": "# CLI reference\n\nnew shipped page\n",
    "README.md": "# GMVault\n\nnew shipped readme\n",
    "CHANGELOG.md": "# Changelog\n\nnew shipped changelog\n",
    "Home.md": "---\ntype: home\n---\n\n# Home\n\n```gmvault-home\n```\n\nnew shipped home\n",
    ".github/workflows/release.yml": "name: release\n",
    ".gmvault/state.json": '{"installedVersion":"1.1.0","appliedMigrations":[],"installId":"gmvault-template","adoptedFrom":null}\n',
    "package.json": '{"name":"gmvault-upstream"}\n',
  }))
  const result = await cli(vault, ["update", "--latest"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the update succeeds; stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  assert.equal((await read(vault, "docs/CLI.md")).includes("new shipped page"), false, "repository documentation is not shipped")
  assert.equal((await read(vault, "README.md")).includes("new shipped readme"), false, "the repository readme is not shipped")
  assert.equal((await read(vault, "CHANGELOG.md")).includes("new shipped changelog"), false, "the changelog is not shipped")
  assert.ok((await read(vault, "Home.md")).includes("new shipped home"), "the shipped home note is replaced")
  assert.notEqual(await read(vault, ".github/workflows/release.yml"), "name: release\n", "workflows are not shipped")
  assert.equal(JSON.parse(await read(vault, ".gmvault/state.json")).installId, installId, "the install identity survives")
  assert.equal(await read(vault, "package.json"), '{"name":"my-fork"}\n', "a file no glob declares is left alone")
  assert.ok((await read(vault, "Campaigns/User/Campaign.md")).includes("owner content"), "the owner's note survives")
  assert.equal(await read(vault, "_local/templates/campaign.md"), "local override\n", "the local override survives")
  await host.close()
  await cleanup(vault)
}, 180000)

test("what the update overwrote is in the backup and named in the report", async () => {
  const vault = await cloneVault("gmvault-layer31-backup-")
  await writeFile(path.join(vault, "Home.md"), "---\ntype: home\n---\n\n# My table\n\nmy own notes\n")
  const host = await serve(release("1.1.0", { "Home.md": "---\ntype: home\n---\n\n# Home\n\n```gmvault-home\n```\n\nnew shipped home\n" }))
  const result = await cli(vault, ["update", "--latest"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the update succeeds; stderr: ${result.stderr}`)
  const backup = await backupDirectory(vault)
  assert.ok((await readFile(path.join(backup, "Home.md"), "utf8")).includes("my own notes"), "the owner's version is in the backup")
  assert.ok(await exists(path.join(backup, "_system/VERSION")), "the shipped layer is still backed up too")
  assert.ok(result.stdout.includes("Home.md"), `the report names the replaced file: ${result.stdout}`)
  assert.ok(result.stdout.includes(path.basename(backup)), `the report names the backup: ${result.stdout}`)
  await host.close()
  await cleanup(vault)
}, 180000)

test("repository folders are not mirrored by the updater", async () => {
  const vault = await cloneVault("gmvault-layer31-mirror-")
  await writeFile(path.join(vault, "docs/MY-NOTES.md"), "# My notes\n\nmine\n")
  const host = await serve(release("1.1.0", { "docs/ADOPTING.md": null }))
  const result = await cli(vault, ["update", "--latest"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the update succeeds; stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  assert.equal(await exists(path.join(vault, "docs/MY-NOTES.md")), true)
  assert.equal(await exists(path.join(vault, "docs/ADOPTING.md")), true)
  assert.equal(result.stdout.includes("MY-NOTES.md"), false)
  await host.close()
  await cleanup(vault)
}, 180000)

test("a source without Home.md leaves the shipped note alone and says so", async () => {
  const vault = await cloneVault("gmvault-layer31-partial-")
  const before = await read(vault, "Home.md")
  const host = await serve(release("1.1.0", { "Home.md": null }))
  const result = await cli(vault, ["update", "--latest"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the update succeeds; stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  assert.equal(await read(vault, "Home.md"), before)
  assert.ok(/kept Home\.md/.test(result.stdout), `the report says the note was kept: ${result.stdout}`)
  await host.close()
  await cleanup(vault)
}, 180000)

test("the selectively managed Obsidian files keep their own handling", async () => {
  const vault = await cloneVault("gmvault-layer31-obsidian-")
  await mkdir(path.join(vault, ".obsidian/plugins/table-tools"), { recursive: true })
  await writeFile(path.join(vault, ".obsidian/plugins/table-tools/data.json"), '{"apiKey":"fake-key-012345"}\n')
  await writeFile(path.join(vault, ".obsidian/workspace.json"), '{"main":"my layout"}\n')
  const host = await serve(release("1.1.0", {
    ".obsidian/workspace.json": '{"main":"shipped layout"}\n',
    ".obsidian/plugins/table-tools/data.json": '{"apiKey":""}\n',
  }))
  const result = await cli(vault, ["update", "--latest"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the update succeeds; stderr: ${result.stderr}`)
  assert.equal(await read(vault, ".obsidian/workspace.json"), '{"main":"my layout"}\n', "the workspace is never touched")
  assert.equal(JSON.parse(await read(vault, ".obsidian/plugins/table-tools/data.json")).apiKey, "fake-key-012345", "the plugin settings are never touched")
  assert.equal(`${result.stdout}${result.stderr}`.includes("fake-key-012345"), false, "no secret is printed")
  await host.close()
  await cleanup(vault)
}, 180000)

test("a preview lists the shipped layer it would replace and changes nothing", async () => {
  const vault = await cloneVault("gmvault-layer31-dry-")
  const before = await read(vault, "Home.md")
  const host = await serve(release("1.1.0", { "Home.md": "---\ntype: home\n---\n\n# Home\n\n```gmvault-home\n```\n\nnew shipped home\n" }))
  const result = await cli(vault, ["update", "--latest", "--dry-run"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the preview succeeds; stderr: ${result.stderr}`)
  assert.ok(result.stdout.includes("Home.md"), `the preview names what it would replace: ${result.stdout}`)
  assert.equal(await read(vault, "Home.md"), before, "the preview replaces nothing")
  assert.deepEqual(await readdir(path.join(vault, ".gmvault/backups")).catch(() => []), [], "the preview writes no backup")
  await host.close()
  await cleanup(vault)
}, 180000)

test("doctor refuses a manifest whose owned glob no handler covers", async () => {
  const vault = await cloneVault("gmvault-layer31-coverage-")
  const manifestPath = path.join(vault, "_system/manifest.json")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  manifest.ownedGlobs = [...manifest.ownedGlobs, "Undeclared.md"]
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  const result = await cli(vault, ["doctor"])
  assert.notEqual(result.code, 0, `doctor fails; stdout: ${result.stdout}`)
  assert.ok(`${result.stdout}${result.stderr}`.includes("Undeclared.md"), `doctor names the uncovered glob: ${result.stdout}${result.stderr}`)
  await cleanup(vault)
}, 60000)

test("a vault that installs the shipped layer unchanged still ends clean", async () => {
  const vault = await cloneVault("gmvault-layer31-guard-")
  const host = await serve(release("1.1.0"))
  const result = await cli(vault, ["update", "--latest"], { GMVAULT_RELEASE_API: host.answer.base })
  assert.equal(result.code, 0, `the update succeeds; stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  assert.ok(result.stdout.includes("GMVault doctor: clean (1.1.0)"), `it ends with the clean line: ${result.stdout}`)
  await host.close()
  await cleanup(vault)
}, 180000)

await run("acceptance 40 shipped layer")
