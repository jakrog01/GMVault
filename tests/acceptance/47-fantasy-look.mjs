import { execFile } from "node:child_process"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assert, run, test } from "./support.mjs"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const skipped = item => item.includes(`${path.sep}.git`) || item.includes(`${path.sep}node_modules`)
const snippet = ".obsidian/snippets/gmvault-fantasy.css"
const fonts = ".obsidian/snippets/gmvault-fonts.css"
const theme = ".obsidian/themes/Fancy-a-Story"
const appearance = ".obsidian/appearance.json"

function cli(vault, ...args) {
  return new Promise(resolve => execFile("node", [path.join(vault, "_system/bin/gmvault.mjs"), ...args], { cwd: vault, timeout: 120000 },
    (error, stdout, stderr) => resolve({ code: error ? (error.code ?? 1) : 0, output: `${stdout}${stderr}` })))
}

async function copyVault() {
  const vault = await mkdtemp(path.join(os.tmpdir(), "gmvault-fantasy38-"))
  await cp(repository, vault, { recursive: true, filter: item => !skipped(item) })
  return vault
}

async function cleanDoctor(vault) {
  const result = await cli(vault, "doctor")
  assert.equal(result.code, 0, result.output)
  assert.ok(result.output.includes("clean"), result.output)
}

test("init installs the theme and both snippets when appearance is missing", async () => {
  const vault = await copyVault()
  try {
    await rm(path.join(vault, appearance))
    await rm(path.join(vault, snippet))
    await rm(path.join(vault, fonts))
    await rm(path.join(vault, theme), { recursive: true, force: true })
    const result = await cli(vault, "init")
    assert.equal(result.code, 0, result.output)
    assert.equal(await readFile(path.join(vault, snippet), "utf8"), await readFile(path.join(vault, "_system/obsidian/snippets/gmvault-fantasy.css"), "utf8"))
    assert.equal(await readFile(path.join(vault, fonts), "utf8"), await readFile(path.join(vault, "_system/obsidian/snippets/gmvault-fonts.css"), "utf8"))
    for (const name of ["theme.css", "manifest.json", "LICENSE"]) {
      assert.deepEqual(await readFile(path.join(vault, theme, name)), await readFile(path.join(vault, "_system/obsidian/themes/Fancy-a-Story", name)))
    }
    assert.deepEqual(JSON.parse(await readFile(path.join(vault, appearance), "utf8")), { enabledCssSnippets: ["gmvault-fonts", "gmvault-fantasy"], cssTheme: "Fancy-a-Story" })
    assert.ok(JSON.parse(await readFile(path.join(vault, ".obsidian/community-plugins.json"), "utf8")).includes("obsidian-style-settings"))
    assert.equal(await readFile(path.join(vault, ".obsidian/plugins/obsidian-style-settings/main.js"), "utf8"), await readFile(path.join(vault, "_system/obsidian/plugins/obsidian-style-settings/main.js"), "utf8"))
    await cleanDoctor(vault)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
}, 60000)

test("init adds the snippets without replacing an existing theme choice", async () => {
  const vault = await copyVault()
  try {
    await writeFile(path.join(vault, appearance), '{"cssTheme":""}\n')
    const result = await cli(vault, "init")
    assert.equal(result.code, 0, result.output)
    assert.deepEqual(JSON.parse(await readFile(path.join(vault, appearance), "utf8")), { cssTheme: "", enabledCssSnippets: ["gmvault-fonts", "gmvault-fantasy"] })
    await cleanDoctor(vault)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
}, 60000)

test("update adds the snippets without replacing an existing theme choice or theme file", async () => {
  const vault = await copyVault()
  const from = await copyVault()
  try {
    await writeFile(path.join(vault, appearance), '{"cssTheme":"Minimal"}\n')
    await writeFile(path.join(vault, theme, "theme.css"), "body { color: teal; }\n")
    const result = await cli(vault, "update", "--from", from)
    assert.equal(result.code, 0, result.output)
    assert.deepEqual(JSON.parse(await readFile(path.join(vault, appearance), "utf8")), { cssTheme: "Minimal", enabledCssSnippets: ["gmvault-fonts", "gmvault-fantasy"] })
    assert.equal(await readFile(path.join(vault, theme, "theme.css"), "utf8"), "body { color: teal; }\n")
    await cleanDoctor(vault)
  } finally {
    await rm(vault, { recursive: true, force: true })
    await rm(from, { recursive: true, force: true })
  }
}, 150000)

test("a disabled snippet stays disabled byte for byte during init and update", async () => {
  const vault = await copyVault()
  const from = await copyVault()
  try {
    const choice = '{ "enabledCssSnippets": [], "cssTheme": "X" }\n'
    await writeFile(path.join(vault, appearance), choice)
    assert.equal((await cli(vault, "init")).code, 0)
    assert.equal(await readFile(path.join(vault, appearance), "utf8"), choice)
    const update = await cli(vault, "update", "--from", from)
    assert.equal(update.code, 0, update.output)
    assert.equal(await readFile(path.join(vault, appearance), "utf8"), choice)
    await cleanDoctor(vault)
  } finally {
    await rm(vault, { recursive: true, force: true })
    await rm(from, { recursive: true, force: true })
  }
}, 150000)

test("an absent snippet stays absent when another snippet is enabled", async () => {
  const vault = await copyVault()
  try {
    for (const [enabled, expected] of [
      [["gmvault-fantasy"], ["gmvault-fantasy"]],
      [[], []],
      [["other"], ["other"]]
    ]) {
      await writeFile(path.join(vault, appearance), JSON.stringify({ cssTheme: "Minimal", enabledCssSnippets: enabled }))
      const result = await cli(vault, "init")
      assert.equal(result.code, 0, result.output)
      assert.deepEqual(JSON.parse(await readFile(path.join(vault, appearance), "utf8")).enabledCssSnippets, expected)
    }
    await cleanDoctor(vault)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
}, 60000)

test("doctor names a changed or missing shipped snippet", async () => {
  const vault = await copyVault()
  try {
    const file = path.join(vault, snippet)
    const shipped = await readFile(file, "utf8")
    await writeFile(file, `${shipped}\nbody { color: red; }\n`)
    const edited = await cli(vault, "doctor")
    assert.notEqual(edited.code, 0, edited.output)
    assert.ok(edited.output.includes(snippet), edited.output)
    await rm(file)
    const missing = await cli(vault, "doctor")
    assert.notEqual(missing.code, 0, missing.output)
    assert.ok(missing.output.includes(snippet), missing.output)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
}, 60000)

test("the template snippet is identical to its shipped source", async () => {
  assert.equal(await readFile(path.join(repository, snippet), "utf8"), await readFile(path.join(repository, "_system/obsidian/snippets/gmvault-fantasy.css"), "utf8"))
  assert.equal(await readFile(path.join(repository, fonts), "utf8"), await readFile(path.join(repository, "_system/obsidian/snippets/gmvault-fonts.css"), "utf8"))
})

test("the snippet includes chapter openers, section rules, and statblocks", async () => {
  const css = await readFile(path.join(repository, "_system/obsidian/snippets/gmvault-fantasy.css"), "utf8")
  assert.match(css, /\.chapter\b/)
  assert.match(css, /\.markdown-rendered h3,[^{]*\{[^}]*border-bottom:\s*2px solid var\(--rpg-section-rule\)/)
  assert.match(css, /\.callout\[data-callout="statblock"\]/)
  assert.doesNotMatch(css, /body\.theme-(?:light|dark)\s*\{[^}]*--background-primary\s*:/s)
})

test("bundled font faces include Cinzel, EB Garamond and Latin Extended", async () => {
  const css = await readFile(path.join(repository, "_system/obsidian/snippets/gmvault-fonts.css"), "utf8")
  assert.match(css, /font-family:\s*"Cinzel"/)
  assert.match(css, /font-family:\s*"EB Garamond"/)
  assert.match(css, /url\(data:font\/woff2;base64,/)
  assert.match(css, /unicode-range:\s*U\+0100-/)
  assert.match(css, /font-style:\s*italic/)
})

await run("47-fantasy-look")
