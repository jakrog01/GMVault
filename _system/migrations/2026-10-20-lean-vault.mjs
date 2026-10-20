import { mkdir, rename } from 'node:fs/promises'
import path from 'node:path'

export const id = '2026-10-20-lean-vault'

const templateOnly = ['README.md', 'CHANGELOG.md', 'docs', 'tests', '.github', 'package.json']

export const up = async context => {
  const state = await context.exists('.gmvault/state.json') ? await context.readJson('.gmvault/state.json') : null
  const backup = path.posix.join('.gmvault/backups', id)
  const report = { id, backup, skippedTemplate: state?.installId === 'gmvault-template', moved: [] }
  if (report.skippedTemplate) return report
  for (const relative of templateOnly) {
    if (!await context.exists(relative)) continue
    if (await context.exists(path.posix.join(backup, relative))) throw new Error(`migration backup already contains ${relative}`)
    report.moved.push(relative)
    if (context.dryRun) continue
    await mkdir(path.join(context.vaultRoot, backup), { recursive: true })
    await rename(path.join(context.vaultRoot, relative), path.join(context.vaultRoot, backup, relative))
  }
  return report
}
