import { createHash } from 'node:crypto'
import { readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

export const id = '2026-10-20-gmvault-rename'

const roots = ['Campaigns', 'Parties', 'Runs', 'Library', 'Calendar', 'Archive', '_local']
const oldHashes = {
  'rpgvault-fonts.css': '540a97714ddad17e6d547dd4552e74a72c70f09d2636c7783c3ed2365ce85434',
  'rpgvault-fantasy.css': 'b119f2c96c32fef3bc62a7c58b4d00eac7bf70821035c42a557e11294beb07f0'
}

export const up = async context => {
  const report = { id, renamedKeepFiles: [], skippedKeepFiles: [], appearanceChanged: false, removedSnippets: [], keptSnippets: [] }
  const visit = async relative => {
    for (const entry of await context.list(relative)) {
      const item = path.posix.join(relative, entry.name)
      if (entry.directory) {
        await visit(item)
      } else if (entry.name === '.rpgvault-keep') {
        const target = path.posix.join(relative, '.gmvault-keep')
        if (await context.exists(target)) report.skippedKeepFiles.push(item)
        else {
          report.renamedKeepFiles.push(item)
          if (!context.dryRun) await rename(path.join(context.vaultRoot, item), path.join(context.vaultRoot, target))
        }
      }
    }
  }
  for (const root of roots) await visit(root)
  const appearancePath = '.obsidian/appearance.json'
  if (await context.exists(appearancePath)) {
    const appearance = await context.readJson(appearancePath)
    if (Array.isArray(appearance.enabledCssSnippets)) {
      const next = appearance.enabledCssSnippets.map(name => name === 'rpgvault-fonts' ? 'gmvault-fonts' : name === 'rpgvault-fantasy' ? 'gmvault-fantasy' : name)
      if (JSON.stringify(next) !== JSON.stringify(appearance.enabledCssSnippets)) {
        report.appearanceChanged = true
        appearance.enabledCssSnippets = next
        await context.writeJson(appearancePath, appearance)
      }
    }
  }
  for (const [name, expected] of Object.entries(oldHashes)) {
    const relative = `.obsidian/snippets/${name}`
    if (!await context.exists(relative)) continue
    const bytes = await readFile(path.join(context.vaultRoot, relative))
    if (createHash('sha256').update(bytes).digest('hex') === expected) {
      report.removedSnippets.push(relative)
      if (!context.dryRun) await rm(path.join(context.vaultRoot, relative))
    } else report.keptSnippets.push(relative)
  }
  return report
}
